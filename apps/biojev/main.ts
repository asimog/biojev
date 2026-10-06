import {
  NodeHttpClient,
  NodeRuntime,
  NodeServices,
} from "@effect/platform-node"
import { Config, Effect, Layer, Option, Path, Redacted } from "effect"
import { HttpRouter } from "effect/http"
import { BioLab } from "./biolab/BioLab.ts"
import { BioLabLive } from "./biolab/SqliteLive.ts"
import {
  ApplicationPaths,
  BioJevConfig,
  BlockTimeoutMaxMs,
  BlockTimeoutMs,
  LinuxNetworkConfig,
  OpenRouterKey,
  OpenRouterModelConfig,
  TypeSafeConfig,
} from "./config/config.ts"
import { acquireMissionLoop } from "./core/mission-loop.ts"
import { makeMissionRoutes } from "./http/missions.ts"
import { JevEngine, JevEngineError } from "./jevengine/JevEngine.ts"
import { TypeSafeLive } from "./jevengine/TypeSafeLive.ts"
import { HttpLive } from "./platform/HttpLive.ts"
import { acquireOwnership } from "./platform/ownership.ts"
import { createResearchModels } from "./platform/pi/models.ts"
import { acquireRolePrograms } from "./platform/pi/roles.ts"

const program = Effect.scoped(
  Effect.gen(function* () {
    const path = yield* Path.Path
    const root = yield* path.fromFileUrl(new URL("../../", import.meta.url))
    const databases = yield* BioJevConfig
    const ownership = yield* acquireOwnership({
      biojevDatabase: path.resolve(root, databases.biojevDatabase),
      piDatabase: path.resolve(root, databases.piDatabase),
    })
    const paths = yield* ApplicationPaths
    const openRouterKey = yield* Config.option(OpenRouterKey)
    const typeSafe = yield* Config.option(TypeSafeConfig)
    const ready =
      Option.isSome(openRouterKey) &&
      Redacted.value(openRouterKey.value).length > 0 &&
      Option.isSome(typeSafe) &&
      Redacted.value(typeSafe.value.apiKey).length > 0
    const semantic =
      Option.isSome(typeSafe) &&
      Redacted.value(typeSafe.value.apiKey).length > 0
        ? TypeSafeLive.pipe(Layer.provide(NodeHttpClient.layerNodeHttp))
        : Layer.succeed(JevEngine, {
            measure: () =>
              Effect.fail(
                new JevEngineError({
                  message: "TypeSafe credentials are not configured",
                }),
              ),
          })
    // Role and scheduler finalizers must finish before the BioLab Layer closes SQLite.
    return yield* Effect.scoped(
      Effect.gen(function* () {
        const lab = yield* BioLab
        const jev = yield* JevEngine
        const selection = yield* OpenRouterModelConfig
        const roles = yield* acquireRolePrograms({
          concurrentDirector: true,
          database: ownership.piDatabase,
          blockTimeoutMs: yield* BlockTimeoutMs,
          blockTimeoutMaxMs: yield* BlockTimeoutMaxMs,
          models: createResearchModels(
            Option.getOrUndefined(openRouterKey),
            selection,
          ),
          model: { provider: "openrouter", modelId: selection.modelId },
          jev,
          environment: {
            nodeBinary: process.execPath,
            nodeModules: path.join(root, "node_modules"),
            workerDirectory: path.join(
              root,
              "apps/biojev/platform/pi/execution-env",
            ),
            artifactDirectory: path.resolve(root, paths.artifactDirectory),
            workspaceRoot: path.resolve(root, paths.workspaceRoot),
            ...(yield* LinuxNetworkConfig),
          },
        })
        const commands = yield* acquireMissionLoop(
          {
            ...roles,
            genesis: roles.genesis,
          },
          ready,
        )
        const server = HttpRouter.serve(
          makeMissionRoutes(lab, commands, roles.activity),
        ).pipe(Layer.provide(HttpLive))
        return yield* Effect.raceFirst(
          Effect.raceFirst(Layer.launch(server), commands.wait),
          ownership.lost,
        )
      }),
    ).pipe(
      Effect.provide(
        Layer.merge(BioLabLive(ownership.biojevDatabase), semantic),
      ),
    )
  }),
).pipe(Effect.provide(NodeServices.layer))

NodeRuntime.runMain(program)
