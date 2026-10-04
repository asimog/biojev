# HTTP boundary

The Next.js UI is a client. It does not own BioJev lifecycle or agent authority.

The backend should expose real canonical/runtime status through an Effect HTTP server.

Before implementing HTTP:
- inspect the installed Effect v4 HTTP guidance and source;
- do not guess v3 API names;
- if an API is marked unstable, allowlist only the exact required API instead of disabling unstable diagnostics globally.
