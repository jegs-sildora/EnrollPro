import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, extname, resolve } from "node:path"

const root = process.cwd()
const roots = [
  resolve(root, "docs"),
  resolve(root, "README.md"),
  resolve(root, "ARCHITECTURE_MICROSERVICES.md"),
  resolve(root, "ACTIVE-TERM-INTEGRATION.md"),
]

function markdownFiles(path) {
  if (!existsSync(path)) return []
  if (statSync(path).isFile()) return extname(path) === ".md" ? [path] : []
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    markdownFiles(resolve(path, entry.name)),
  )
}

const failures = []
for (const file of roots.flatMap(markdownFiles)) {
  const source = readFileSync(file, "utf8")
  const links = source.matchAll(/!?(?:\[[^\]]*\])\(([^)]+)\)/g)
  for (const match of links) {
    const raw = match[1]?.trim().replace(/^<|>$/g, "")
    if (!raw || /^(?:https?:|mailto:|codex:|#)/i.test(raw)) continue

    const pathOnly = decodeURIComponent(raw.split("#", 1)[0].split("?", 1)[0])
    if (!pathOnly) continue
    const target = resolve(dirname(file), pathOnly)
    if (!existsSync(target)) {
      failures.push(`${file.slice(root.length + 1)} -> ${raw}`)
    }
  }
}

if (failures.length > 0) {
  console.error("Broken local Markdown links:\n" + failures.join("\n"))
  process.exitCode = 1
} else {
  console.info("Documentation links are valid.")
}
