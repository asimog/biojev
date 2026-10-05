"use client"

import { Schema } from "effect"
import { useEffect, useRef, useState } from "react"
import {
  HistoryView,
  MissionListView,
  MissionSnapshotView,
} from "../../biojev/http/views"

const button =
  "rounded border border-gray-400 px-3 py-2 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40"

async function request(path: string, command?: unknown): Promise<unknown> {
  const response = await fetch(`/api/biojev/${path}`, {
    cache: "no-store",
    ...(command === undefined
      ? {}
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(command),
        }),
  })
  if (!response.ok)
    throw new Error(
      `Request failed (${response.status}). Check backend availability and mission state.`,
    )
  return response.json()
}

export default function Home() {
  const [list, setList] = useState<typeof MissionListView.Type | null>(null)
  const [selected, setSelected] = useState("")
  const [snapshot, setSnapshot] = useState<MissionSnapshotView | null>(null)
  const [history, setHistory] = useState<HistoryView | null>(null)
  const [statement, setStatement] = useState("")
  const [revision, setRevision] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [connection, setConnection] = useState("Connecting")
  const [now, setNow] = useState(0)
  const historyLoader = useRef<(() => Promise<void>) | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  async function refreshList() {
    const value = Schema.decodeUnknownSync(MissionListView)(
      await request("missions"),
    )
    setList(value)
  }
  useEffect(() => {
    let live = true
    request("missions")
      .then((value) => {
        if (!live) return
        const decoded = Schema.decodeUnknownSync(MissionListView)(value)
        setList(decoded)
        const retained = new URL(window.location.href).searchParams.get(
          "mission",
        )
        setSelected(
          decoded.missions.find((mission) => mission.missionId === retained)
            ?.missionId ??
            decoded.missions[0]?.missionId ??
            "",
        )
      })
      .catch((cause: unknown) => {
        if (live) setError(String(cause))
      })
    return () => {
      live = false
    }
  }, [])
  useEffect(() => {
    setSnapshot(null)
    setHistory(null)
    if (!selected) return
    const url = new URL(window.location.href)
    url.searchParams.set("mission", selected)
    window.history.replaceState(null, "", url)
    let live = true
    const path = `missions/${encodeURIComponent(selected)}`
    let cursor = 0
    let more = false
    let loading = false
    const loadHistory = async () => {
      if (loading) return
      loading = true
      try {
        const page = Schema.decodeUnknownSync(HistoryView)(
          await request(`${path}/history?after=${cursor}`),
        )
        if (!live) return
        cursor = page.cursor
        more = page.next !== null
        setHistory((previous) => ({
          ...page,
          records: [...(previous?.records ?? []), ...page.records],
        }))
      } catch (cause) {
        if (live) setError(String(cause))
      } finally {
        loading = false
      }
    }
    historyLoader.current = loadHistory
    const stream = new EventSource(`/api/biojev/${path}/events`)
    stream.addEventListener("snapshot", (event: MessageEvent<string>) => {
      try {
        if (!live) return
        setSnapshot(
          Schema.decodeUnknownSync(MissionSnapshotView)(JSON.parse(event.data)),
        )
        setConnection("Live")
      } catch {
        setConnection("Invalid backend response")
      }
    })
    stream.onerror = () => {
      if (live) setConnection("Disconnected — reconnecting")
    }
    void loadHistory()
    const timer = window.setInterval(() => {
      if (!more) void loadHistory()
    }, 5000)
    return () => {
      live = false
      historyLoader.current = null
      stream.close()
      window.clearInterval(timer)
    }
  }, [selected])
  async function perform(operation: () => Promise<void>) {
    setBusy(true)
    setError("")
    try {
      await operation()
      await refreshList()
    } catch (cause) {
      setError(String(cause))
    } finally {
      setBusy(false)
    }
  }
  const mission = snapshot?.lifecycle.mission
  const scheduler = snapshot?.scheduler ?? list?.scheduler
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <h1 className="text-3xl font-semibold">BioJev</h1>
      <p data-testid="application-status">
        Status:{" "}
        {scheduler
          ? scheduler.activeMissionId === null
            ? "IDLE"
            : "RUNNING"
          : "Unavailable"}
      </p>
      {error && (
        <p role="alert" className="text-red-800">
          {error}
        </p>
      )}
      {scheduler && !scheduler.enabled && (
        <p>
          Model providers are not configured. Mission execution is unavailable.
        </p>
      )}
      <section aria-labelledby="start-heading">
        <h2 id="start-heading" className="text-xl font-semibold">
          New mission
        </h2>
        <form
          className="mt-3 space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            void perform(async () => {
              const missionId = crypto.randomUUID()
              await request("missions", { missionId, statement })
              setSelected(missionId)
              setStatement("")
            })
          }}
        >
          <label htmlFor="mission-statement" className="block">
            What should BioJev investigate?
          </label>
          <textarea
            id="mission-statement"
            required
            maxLength={100000}
            value={statement}
            onChange={(event) => setStatement(event.target.value)}
            className="min-h-24 w-full rounded border border-gray-400 p-3"
          />
          <button
            className={button}
            disabled={busy || !scheduler?.enabled || !statement.trim()}
            type="submit"
          >
            Start mission
          </button>
        </form>
      </section>
      <section aria-labelledby="mission-heading" className="space-y-4">
        <h2 id="mission-heading" className="text-xl font-semibold">
          Institutional history
        </h2>
        <label htmlFor="mission-selection" className="block">
          Mission
        </label>
        <select
          id="mission-selection"
          className="w-full rounded border border-gray-400 p-2"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          <option value="">Select a mission</option>
          {list?.missions.map((item) => (
            <option key={item.missionId} value={item.missionId}>
              {item.statement.slice(0, 100)} — {item.status}
            </option>
          ))}
        </select>
        {list?.missions.length === 0 && <p>No missions have been recorded.</p>}
        {selected && <p role="status">Activity connection: {connection}</p>}
        {mission && snapshot && (
          <>
            <p className="whitespace-pre-wrap">{mission.statement}</p>
            <p>
              Mission: {mission.status} · Revision {mission.revision}
            </p>
            <div className="flex flex-wrap gap-2">
              {(["pause", "resume", "stop"] as const).map((action) => (
                <button
                  type="button"
                  key={action}
                  className={button}
                  disabled={
                    busy ||
                    mission.status === "STOPPED" ||
                    (action === "pause" && mission.status !== "RUNNING") ||
                    (action === "resume" && !scheduler?.enabled)
                  }
                  onClick={() =>
                    void perform(async () => {
                      await request(
                        `missions/${encodeURIComponent(selected)}/commands`,
                        { action },
                      )
                    })
                  }
                >
                  {action === "resume" && scheduler?.failures[selected]
                    ? "Retry mission"
                    : action[0].toUpperCase() + action.slice(1)}
                </button>
              ))}
            </div>
            {scheduler?.failures[selected] && (
              <p role="alert">{scheduler.failures[selected]}</p>
            )}
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault()
                void perform(async () => {
                  await request(
                    `missions/${encodeURIComponent(selected)}/commands`,
                    {
                      action: "revise",
                      expectedRevision: mission.revision,
                      statement: revision,
                    },
                  )
                  setRevision("")
                })
              }}
            >
              <label htmlFor="revision" className="block">
                Revise mission
              </label>
              <textarea
                id="revision"
                required
                maxLength={100000}
                className="min-h-20 w-full rounded border border-gray-400 p-3"
                value={revision}
                onChange={(event) => setRevision(event.target.value)}
              />
              <button
                type="submit"
                className={button}
                disabled={
                  busy ||
                  mission.status === "STOPPED" ||
                  !scheduler?.enabled ||
                  !revision.trim()
                }
              >
                Save revision
              </button>
            </form>
            <p>Genesis: {snapshot.genesis?.status ?? "NOT_STARTED"}</p>
            {snapshot.genesis?.outcomes
              .filter((outcome) => outcome.failure !== null)
              .map((outcome) => (
                <p key={outcome.inputId} className="text-red-800">
                  Discovery incomplete: {outcome.inputId} — {outcome.failure}
                </p>
              ))}
            <p>
              Countable research blocks in the current validation window:{" "}
              {snapshot.lifecycle.countableBlocks}. Validation occurs after each
              ten-block window.
            </p>
            {snapshot.lifecycle.validationDue && (
              <p>Validation required before more research.</p>
            )}
            {snapshot.lifecycle.validationCompletedAwaitingDirectorReview && (
              <p>Validation awaits Director review.</p>
            )}
            {snapshot.lifecycle.validation && (
              <details>
                <summary>
                  Validation cycle: {snapshot.lifecycle.validation.status}
                </summary>
                <pre className="overflow-auto whitespace-pre-wrap text-sm">
                  {JSON.stringify(snapshot.lifecycle.validation, null, 2)}
                </pre>
              </details>
            )}
            <h3 className="text-lg font-semibold">Research blocks</h3>
            {snapshot.blocks.length === 0 && (
              <p>No ResearchBlock admitted yet.</p>
            )}
            {snapshot.blocks.map((block) => (
              <details
                key={block.blockId}
                className="border-t border-gray-300 py-3"
              >
                <summary className="break-words">
                  {block.blockId} — {block.status} · {block.classification}
                </summary>
                <p>Started: {new Date(block.startedAt).toLocaleString()}</p>
                <p>Deadline: {new Date(block.deadline).toLocaleString()}</p>
                {block.reason && (
                  <p className="whitespace-pre-wrap">{block.reason}</p>
                )}
              </details>
            ))}
            <h3 className="text-lg font-semibold">Live activity</h3>
            {snapshot.activity.length === 0 && (
              <p>No agent activity retained.</p>
            )}
            {snapshot.activity.map((activity) => (
              <div
                key={activity.runId}
                className="space-y-2 border-t border-gray-300 py-3"
              >
                <p>
                  {activity.role}: {activity.state}
                  {activity.runtimeAvailable ? "" : " — runtime unavailable"}
                </p>
                {activity.modelActive && <p>Model active</p>}
                {activity.blockId && (
                  <p className="break-words">Block: {activity.blockId}</p>
                )}
                {activity.state === "ACTIVE" &&
                  activity.startedAt !== undefined && (
                    <p>
                      Elapsed:{" "}
                      {Math.max(
                        0,
                        Math.floor((now - activity.startedAt) / 1000),
                      )}{" "}
                      seconds
                    </p>
                  )}
                {activity.requestedModel && (
                  <p>
                    Requested model: {activity.requestedModel.provider}/
                    {activity.requestedModel.modelId}
                  </p>
                )}
                {activity.actualModel && (
                  <p>
                    Reported model: {activity.actualModel.provider}/
                    {activity.actualModel.modelId}
                  </p>
                )}
                {activity.tools?.map((tool) => (
                  <div key={tool.id}>
                    <p>
                      {tool.name}: {tool.status}
                    </p>
                    {tool.command && (
                      <pre className="overflow-auto whitespace-pre-wrap text-sm">
                        {tool.command}
                      </pre>
                    )}
                    {tool.output && (
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-gray-100 p-3 text-sm">
                        {tool.output}
                      </pre>
                    )}
                  </div>
                ))}
                {activity.recentTools && activity.recentTools.length > 0 && (
                  <details>
                    <summary>Recent tool activity</summary>
                    {activity.recentTools.map((tool) => (
                      <div key={tool.id} className="mt-2">
                        <p>
                          {tool.name}: {tool.status}
                        </p>
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-sm">
                          {tool.output}
                        </pre>
                      </div>
                    ))}
                  </details>
                )}
                {activity.usage && (
                  <details>
                    <summary>Conversation usage (cumulative)</summary>
                    <p>
                      Costs, when present, are catalog estimates. Provider
                      billing is unavailable.
                    </p>
                    <pre className="overflow-auto text-sm">
                      {JSON.stringify(activity.usage, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
            <h3 className="text-lg font-semibold">Retained records</h3>
            {history?.records.length === 0 && (
              <p>No institutional records retained yet.</p>
            )}
            {history?.records.map((record) => (
              <details
                key={record.id}
                className="border-t border-gray-300 py-3"
              >
                <summary>
                  {record.record.kind} ·{" "}
                  {new Date(record.createdAt).toLocaleString()}
                </summary>
                <pre className="overflow-auto whitespace-pre-wrap text-sm">
                  {JSON.stringify(record.record.value, null, 2)}
                </pre>
              </details>
            ))}
            {history?.next !== null && history?.next !== undefined && (
              <button
                type="button"
                className={button}
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    await historyLoader.current?.()
                  })
                }
              >
                Load more history
              </button>
            )}
          </>
        )}
      </section>
    </main>
  )
}
