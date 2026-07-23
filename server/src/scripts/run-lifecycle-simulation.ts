import "dotenv/config"
import { spawnSync } from "node:child_process"
import process from "node:process"

const ALLOWED_DATABASE_NAME = "enrollpro"
const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "::1"])

function assertDestructiveRunIsAllowed(): void {
  if (process.env.ALLOW_DESTRUCTIVE_LIFECYCLE_SIM !== "true") {
    throw new Error(
      "Set ALLOW_DESTRUCTIVE_LIFECYCLE_SIM=true to confirm that the local enrollpro database may be erased.",
    )
  }

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is required.")
  }

  const databaseUrl = new URL(connectionString)
  const databaseName = databaseUrl.pathname.replace(/^\/+/, "")
  if (
    !ALLOWED_HOSTS.has(databaseUrl.hostname)
    || databaseName !== ALLOWED_DATABASE_NAME
  ) {
    throw new Error(
      "Lifecycle simulation is restricted to the local PostgreSQL database named enrollpro.",
    )
  }
}

function resetDatabase(): void {
  const result = process.platform === "win32"
    ? spawnSync(
        "pnpm exec prisma migrate reset --force --skip-seed --skip-generate",
        {
          cwd: process.cwd(),
          env: process.env,
          shell: true,
          stdio: "inherit",
        },
      )
    : spawnSync(
        "pnpm",
        [
          "exec",
          "prisma",
          "migrate",
          "reset",
          "--force",
          "--skip-seed",
          "--skip-generate",
        ],
        {
          cwd: process.cwd(),
          env: process.env,
          stdio: "inherit",
        },
      )

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(
      `Prisma database reset failed with exit code ${String(result.status)}.`,
    )
  }
}

async function main(): Promise<void> {
  assertDestructiveRunIsAllowed()

  process.env.JWT_SECRET ??= "lifecycle-simulation-jwt-secret"
  process.env.ADMIN_BOSY_LOCK_PIN ??= "123456"
  process.env.MRF_INTEGRATION_API_KEY ??= "lifecycle-mrf-service-key"
  process.env.NODE_ENV = "test"

  console.log("RESET Confirmed local database: enrollpro")
  resetDatabase()

  const { runLifecycleSimulation } = await import(
    "./lifecycle-simulation.js"
  )
  await runLifecycleSimulation()
}

main().catch((error: unknown) => {
  console.error(
    "LIFECYCLE SIMULATION FAILED",
    error instanceof Error ? error.stack ?? error.message : String(error),
  )
  process.exitCode = 1
})
