export const dynamic = "force-dynamic"

export default async function Home() {
  const response = await fetch(
    `${process.env.BIOJEV_BACKEND_URL ?? "http://127.0.0.1:3001"}/api/status`,
    { cache: "no-store", signal: AbortSignal.timeout(5000) },
  )
  if (!response.ok)
    throw new Error(`Backend status request failed: ${response.status}`)
  const body: unknown = await response.json()
  if (
    typeof body !== "object" ||
    body === null ||
    !("status" in body) ||
    body.status !== "IDLE"
  ) {
    throw new Error("Invalid backend status response")
  }
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-semibold">BioJev</h1>
      <p className="mt-4">Status: {body.status}</p>
    </main>
  )
}
