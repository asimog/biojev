import { HttpRouter, HttpServerResponse } from "effect/http"

export const StatusRoute = HttpRouter.add(
  "GET",
  "/api/status",
  HttpServerResponse.json({ status: "IDLE" }),
)
