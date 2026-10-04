# BioJev web

From the repository root, run `npm run dev:backend` and `npm run dev:web` in
separate terminals. Open http://localhost:3000. The server-rendered page requests
http://127.0.0.1:3001/api/status on each request; there is no cached or fallback
IDLE state. Backend failures propagate to the Next.js error boundary.

Set `BIOJEV_BACKEND_URL` for another backend origin. Backend listening options
are `BIOJEV_HOST` (default 127.0.0.1) and `BIOJEV_PORT` (default 3001).

Install dependencies from the root with `npm ci`; keep only the root lockfile.
