import { Config } from "effect"

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
