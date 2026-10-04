import { NodeServices } from "@effect/platform-node"
import { Layer } from "effect"

/**
 * Node is a concrete platform provider, not BioJev domain vocabulary.
 *
 * Application and ExecutionEnv code should depend on portable Effect services.
 * Current Effect v4 NodeServices.layer supplies Node-backed implementations
 * for common platform capabilities such as filesystem/path/process support.
 */
export const NodePlatformLive = Layer.mergeAll(NodeServices.layer)
