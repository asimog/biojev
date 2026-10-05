import type { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

const failure = (message: string, status: number) =>
  Response.json({ error: { message } }, { status })

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params
  const valid =
    (path.length === 1 && ["status", "missions"].includes(path[0])) ||
    (path[0] === "missions" &&
      path.length >= 2 &&
      path.length <= 3 &&
      path[1] !== "." &&
      path[1] !== ".." &&
      !path[1].includes("/") &&
      (path.length === 2 ||
        ["commands", "history", "events"].includes(path[2])))
  if (!valid) return failure("Unknown application endpoint", 404)
  const writing = request.method === "POST"
  // NextURL normalizes loopback IPs to localhost; browsers send the actual Host.
  const origin = `${request.nextUrl.protocol}//${request.headers.get("host")}`
  if (
    writing &&
    (request.headers.get("origin") !== origin ||
      !["127.0.0.1", "localhost", "[::1]"].includes(new URL(origin).hostname) ||
      request.headers.get("content-type")?.split(";")[0] !== "application/json")
  )
    return failure("Use a same-origin JSON request", 403)
  if (
    writing &&
    !(
      (path.length === 1 && path[0] === "missions") ||
      (path.length === 3 && path[2] === "commands")
    )
  )
    return failure("Command endpoint required", 405)

  let body: Uint8Array | undefined
  if (writing) {
    const reader = request.body?.getReader()
    if (!reader) return failure("JSON body required", 400)
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        size += chunk.value.byteLength
        if (size > 128 * 1024) {
          await reader.cancel()
          return failure("Request body is too large", 413)
        }
        chunks.push(chunk.value)
      }
    } finally {
      reader.releaseLock()
    }
    body = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      body.set(chunk, offset)
      offset += chunk.byteLength
    }
  }
  const url = new URL(
    `/api/${path.map(encodeURIComponent).join("/")}`,
    process.env.BIOJEV_BACKEND_URL ?? "http://127.0.0.1:3001",
  )
  for (const key of ["after", "limit"]) {
    const value = request.nextUrl.searchParams.get(key)
    if (value !== null) url.searchParams.set(key, value)
  }
  try {
    const response = await fetch(url, {
      method: request.method,
      headers: writing ? { "content-type": "application/json" } : undefined,
      body: body === undefined ? undefined : Buffer.from(body),
      signal: request.signal,
      cache: "no-store",
      redirect: "error",
    })
    return new Response(response.body, {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "x-accel-buffering": "no",
      },
    })
  } catch {
    return failure("BioJev backend is unavailable", 502)
  }
}

export const GET = proxy
export const POST = proxy
