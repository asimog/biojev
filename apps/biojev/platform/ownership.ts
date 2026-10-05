import { Effect, FileSystem, Option, Path, Schema, Stream } from "effect"
import { make } from "effect/process/ChildProcess"
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner"

export class OwnershipError extends Schema.TaggedError<OwnershipError>()(
  "OwnershipError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect()),
  },
) {}

export const acquireOwnership = Effect.fn("acquireOwnership")(
  function* (databases: {
    readonly biojevDatabase: string
    readonly piDatabase: string
  }) {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const spawner = yield* ChildProcessSpawner
    const resolve = Effect.fn("ownership.resolve")(function* (
      filename: string,
    ) {
      const absolute = path.resolve(filename)
      yield* fs.makeDirectory(path.dirname(absolute), {
        recursive: true,
        mode: 0o700,
      })
      if (yield* fs.exists(absolute)) return yield* fs.realPath(absolute)
      return path.join(
        yield* fs.realPath(path.dirname(absolute)),
        path.basename(absolute),
      )
    })
    const biojevDatabase = yield* resolve(databases.biojevDatabase)
    const piDatabase = yield* resolve(databases.piDatabase)
    let identical = biojevDatabase === piDatabase
    if (
      !identical &&
      (yield* fs.exists(biojevDatabase)) &&
      (yield* fs.exists(piDatabase))
    ) {
      const left = yield* fs.stat(biojevDatabase)
      const right = yield* fs.stat(piDatabase)
      identical =
        left.dev === right.dev &&
        Option.isSome(left.ino) &&
        Option.isSome(right.ino) &&
        left.ino.value === right.ino.value
    }
    if (identical)
      return yield* new OwnershipError({
        message: "BioLab and Pi must use different databases",
      })
    const handle = yield* spawner.spawn(
      make(
        "flock",
        [
          "--no-fork",
          "--nonblock",
          biojevDatabase,
          "flock",
          "--no-fork",
          "--nonblock",
          piDatabase,
          "/bin/sh",
          "-c",
          "printf 'LOCKED\\n'; cat >/dev/null",
        ],
        {
          env: { PATH: "/usr/bin:/bin" },
          extendEnv: false,
          stdin: "pipe",
          stderr: "ignore",
        },
      ),
    )
    const ready = yield* handle.stdout.pipe(
      Stream.decodeText(),
      Stream.splitLines,
      Stream.runHead,
    )
    if (Option.isNone(ready) || ready.value !== "LOCKED")
      return yield* new OwnershipError({
        message:
          "Another scheduler owns a configured store or ownership could not be acquired",
      })
    const assertHeld = Effect.gen(function* () {
      if (!(yield* handle.isRunning))
        return yield* new OwnershipError({
          message: "Scheduler store ownership was lost",
        })
    }).pipe(
      Effect.mapError((cause) =>
        cause instanceof OwnershipError
          ? cause
          : new OwnershipError({
              message: "Cannot verify scheduler ownership",
              cause,
            }),
      ),
    )
    const lost = handle.exitCode.pipe(
      Effect.flatMap(
        () =>
          new OwnershipError({ message: "Scheduler store ownership was lost" }),
      ),
      Effect.mapError((cause) =>
        cause instanceof OwnershipError
          ? cause
          : new OwnershipError({
              message: "Cannot observe scheduler ownership",
              cause,
            }),
      ),
    )
    return { biojevDatabase, piDatabase, assertHeld, lost }
  },
  Effect.mapError((cause) =>
    cause instanceof OwnershipError
      ? cause
      : new OwnershipError({
          message: "Cannot acquire scheduler ownership",
          cause,
        }),
  ),
)
