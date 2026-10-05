import { Config, Schema } from "effect"

/**
 * Process configuration belongs here.
 * Application code should not read process.env directly.
 */
export const BioJevConfig = Config.all({
  biojevDatabase: Config.String("BIOJEV_DATABASE").pipe(
    Config.withDefault("data/biojev.sqlite"),
  ),
  piDatabase: Config.String("PI_DATABASE").pipe(
    Config.withDefault("data/pi-runtime.sqlite"),
  ),
})

export const LinuxNetworkConfig = Config.all({
  slirpBinary: Config.String("BIOJEV_SLIRP_BINARY").pipe(
    Config.withDefault("/usr/bin/slirp4netns"),
  ),
  slirpLibraryDirectory: Config.String("BIOJEV_SLIRP_LIBRARY_DIRECTORY").pipe(
    Config.withDefault(""),
  ),
})

export const OpenRouterKey = Config.Redacted("OPENROUTER_API_KEY")

export const DefaultOpenRouterModels = {
  modelId: "deepseek/deepseek-v4.1-flash",
  fallbackModelId: "openrouter/free",
} as const

export const OpenRouterModelConfig = Config.all({
  modelId: Config.String("OPENROUTER_MODEL").pipe(
    Config.withDefault(DefaultOpenRouterModels.modelId),
  ),
  fallbackModelId: Config.String("OPENROUTER_FALLBACK_MODEL").pipe(
    Config.withDefault(DefaultOpenRouterModels.fallbackModelId),
  ),
})

export const TypeSafeConfig = Config.all({
  apiKey: Config.Redacted("TYPESAFE_API_KEY"),
  baseURL: Config.String("TYPESAFE_BASE_URL").pipe(
    Config.withDefault("https://api.typesafe.ai"),
  ),
  model: Config.String("TYPESAFE_DEFAULT_MODEL").pipe(
    Config.withDefault("jev-latest"),
  ),
})

export const ApplicationPaths = Config.all({
  genesisCatalog: Config.String("BIOJEV_GENESIS_CATALOG").pipe(
    Config.withDefault("data/genesis.json"),
  ),
  artifactDirectory: Config.String("BIOJEV_ARTIFACT_DIRECTORY").pipe(
    Config.withDefault("data/artifacts"),
  ),
  workspaceRoot: Config.String("BIOJEV_WORKSPACE_ROOT").pipe(
    Config.withDefault("data/workspaces"),
  ),
})

export const BlockTimeoutMs = Config.schema(
  Schema.Int.check(Schema.isGreaterThan(0)),
  "BIOJEV_BLOCK_TIMEOUT_MS",
).pipe(Config.withDefault(600000))
