import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["apps/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "repos/**"],
  },
})
