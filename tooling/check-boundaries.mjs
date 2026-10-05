import { readdir, readFile } from "node:fs/promises"
import { extname, join, relative, sep } from "node:path"
import process from "node:process"

const root = process.cwd()
const backend = join(root, "apps", "biojev")
const errors = []

const normalize = (path) => path.split(sep).join("/")

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(path)))
    else if (extname(entry.name) === ".ts") files.push(path)
  }
  return files
}

const importPattern =
  /\b(?:import|export)\s+(?:type\s+)?(?:[^"'`]*?\s+from\s+)?["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g

for (const file of await walk(backend)) {
  const rel = normalize(relative(root, file))
  const source = await readFile(file, "utf8")
  const imports = []

  for (const match of source.matchAll(importPattern)) {
    imports.push(match[1] ?? match[2])
  }

  const isPiIntegration = rel.startsWith("apps/biojev/platform/pi/")
  const isJevEngine = rel.startsWith("apps/biojev/jevengine/")
  const isConfig = rel.startsWith("apps/biojev/config/")
  const isPlatform = rel.startsWith("apps/biojev/platform/")
  const isExecutionEnv = rel.startsWith(
    "apps/biojev/platform/pi/execution-env/",
  )
  const isBioLab = rel.startsWith("apps/biojev/biolab/")

  for (const specifier of imports) {
    if (
      (specifier.startsWith("effect/sql") ||
        specifier.startsWith("@effect/sql-")) &&
      !(isBioLab || isPlatform)
    ) {
      errors.push(`${rel}: SQL imports belong in biolab/** or platform/**.`)
    }
    if (/(^|\/)repos\//.test(specifier)) {
      errors.push(`${rel}: reference subtrees are not production dependencies.`)
    }

    if (
      specifier === "node:fs" ||
      specifier.startsWith("node:fs/") ||
      specifier === "node:path" ||
      specifier === "node:child_process"
    ) {
      if (!isPlatform) {
        errors.push(
          `${rel}: forbidden ${specifier}. Use portable Effect platform services. Raw Node I/O belongs only at a documented platform edge.`,
        )
      }
    }

    if (
      specifier.startsWith("@earendil-works/pi") ||
      specifier === "@earendil-works/chord" ||
      specifier.startsWith("@earendil-works/chord/")
    ) {
      if (!isPiIntegration) {
        errors.push(
          `${rel}: Pi/Chord imports are only allowed in platform/pi/**.`,
        )
      }
    }

    if (specifier === "@typesafe-ai/sdk" && !isJevEngine) {
      errors.push(`${rel}: @typesafe-ai/sdk is only allowed in jevengine/**.`)
    }

    if (specifier === "@effect/sql-sqlite-node" && !(isBioLab || isPlatform)) {
      errors.push(
        `${rel}: canonical SQLite provider imports belong in biolab/** or platform/**.`,
      )
    }

    if (
      specifier === "effect/process" ||
      specifier === "effect/process/ChildProcess" ||
      specifier === "effect/process/ChildProcessSpawner"
    ) {
      if (!isExecutionEnv && rel !== "apps/biojev/platform/ownership.ts") {
        errors.push(
          `${rel}: agent process execution belongs in platform/pi/execution-env/**.`,
        )
      }
    }
  }

  if (source.includes("process.env") && !isConfig) {
    errors.push(
      `${rel}: process.env is only allowed in config/**. Use Effect Config elsewhere.`,
    )
  }

  if (
    (source.includes("Effect.runPromise(") ||
      source.includes("Effect.runSync(")) &&
    rel !== "apps/biojev/main.ts"
  ) {
    errors.push(
      `${rel}: Effect runners belong at outer runtime boundaries, not application programs.`,
    )
  }

  if (
    source.includes("Effect.runPromiseWith(") &&
    rel !== "apps/biojev/main.ts" &&
    rel !== "apps/biojev/platform/pi/execution-env/Linux.ts" &&
    rel !== "apps/biojev/platform/pi/tools.ts" &&
    rel !== "apps/biojev/jevengine/TypeSafeLive.ts"
  ) {
    errors.push(
      `${rel}: Context runners belong only at documented foreign runtime boundaries.`,
    )
  }

  if (/\bfetch\s*\(/.test(source) && !isPlatform) {
    errors.push(
      `${rel}: raw fetch is forbidden. Use Effect HttpClient through ExecutionEnv or HTTP infrastructure.`,
    )
  }
}

if (errors.length > 0) {
  console.error("BioJev architecture boundary violations:\n")
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log("BioJev architecture boundaries: OK")
}
