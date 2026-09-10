import assert from "node:assert/strict"
import type { AddressInfo } from "node:net"
import test from "node:test"
import express from "express"
import integrationRoutes from "./integration.router.js"

const TEST_KEY = "atlas-term-contract-route-test-key"

test("mounted school-year route rejects malformed IDs before scope resolution", async (context) => {
  process.env.ATLAS_INTEGRATION_API_KEY = TEST_KEY

  const app = express()
  app.use("/api/integration/v1", integrationRoutes)
  const server = app.listen(0)
  await new Promise<void>((resolve) => server.once("listening", resolve))

  context.after(() => {
    server.close()
    delete process.env.ATLAS_INTEGRATION_API_KEY
  })

  const address = server.address() as AddressInfo
  const invalidQueries = [
    "schoolYearId=3.5",
    "schoolYearId=3abc",
    "schoolYearId=1e2",
    "schoolYearId=0",
    "schoolYearId=-1",
    "schoolYearId=",
    "schoolYearId=%20",
    "schoolYearId=03",
    "schoolYearId=3&schoolYearId=4",
  ]

  for (const query of invalidQueries) {
    await context.test(query, async () => {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/integration/v1/school-year?${query}`,
        { headers: { "x-integration-key": TEST_KEY } },
      )
      const body: unknown = await response.json()

      assert.equal(response.status, 400)
      assert.deepEqual(body, {
        error: {
          code: "SCHOOL_YEAR_ID_INVALID",
          message: "schoolYearId must be a positive integer",
        },
      })
    })
  }
})
