# Private cloud deployment

This version includes a Docker build recipe and an authenticated Streamable HTTP MCP endpoint. It has not been deployed to Azure or built into a container image in this environment (Docker/Podman are unavailable). Do not interpret the local integration tests as a cloud deployment test.

## Build the image

From this folder, on a machine with Docker:

```sh
docker build -t whiteboard:classroom .
```

Alternatively, send this folder as the build context to your Azure Container Registry build pipeline. Do not include data, secrets, or node_modules; `.dockerignore` excludes them. Publish the resulting image to your own registry.

## Host settings

Use HTTPS ingress, target port **4180**, and one replica. This is a single-user service with a file-backed notebook; multiple replicas would have divergent state and incompatible file writes. Mount persistent writable storage at `/data` and back it up. Container filesystem changes alone are not durable across redeployments. The process runs as Node's non-root user (UID 1000); ensure the mounted directory is writable by that user.

Set environment variables:

| Variable | Value |
| --- | --- |
| `WHITEBOARD_PUBLIC_URL` | Your exact HTTPS origin, such as `https://board.example.com` (no path) |
| `WHITEBOARD_TOKEN` | A high-entropy secret with at least 32 characters, stored as an Azure secret |
| `WHITEBOARD_HOST` | `0.0.0.0` (already set in image) |
| `WHITEBOARD_PORT` | `4180` (already set) |
| `WHITEBOARD_DATA` | `/data` (already set) |

Generate a token locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Keep it out of source control, screenshots, chat and command history. Rotating it invalidates existing browser sessions and MCP credentials. Azure's HTTPS proxy must preserve the public Host header; foreign Hosts and Origins are rejected. `/healthz` is a minimal unauthenticated liveness endpoint. Configure its probe Host as `127.0.0.1:4180` or the public hostname. Allow long-running SSE responses on `/events`; viewers reconnect automatically.

## Open the board

Visit your HTTPS origin and enter the access token. The server sets an HttpOnly, Secure, SameSite=Strict browser cookie. No tokens are stored in browser localStorage. The secret grants access to the entire notebook: use this version as a private personal deployment, not a multi-user public service. For wider distribution, add user identity, per-user storage, rate limiting, auditing, operational monitoring and an explicit license decision.

## Remote MCP

Endpoint: `https://YOUR-HOST/mcp`. Clients must send `Authorization: Bearer YOUR_TOKEN`; a browser cookie is not accepted as MCP authentication. No OAuth flow is implemented. This works with MCP clients that support static bearer tokens; some hosted integrations may require OAuth and additional configuration.

For Codex, set a secret environment variable in the host running Codex and register:

```sh
codex mcp add whiteboard-cloud --url https://YOUR-HOST/mcp --bearer-token-env-var WHITEBOARD_ACCESS_TOKEN
```

Keep local and cloud server names distinct. Verify the endpoint's tool list before using it. `whiteboard_scene` accepts a JSON string for client compatibility; the structured `whiteboard_update` schema is also available but was not exposed by this host's initial tool catalog. The simpler scene tool avoids that limitation. Restart/reload the assistant's MCP connection when adding tools.

## Smoke test after deployment

1. Opening the root without a cookie should show sign-in; `/api/board` should reject anonymous requests.
2. Sign in and add a text object. Refresh: it should remain.
3. Connect an MCP client with its bearer token. Call `whiteboard_read`, then `whiteboard_scene` with a small text update. Verify the visible revision changes.
4. Press Time to copy. Edits and page changes should be rejected until Continue teaching.
5. Restart the container. Confirm all lesson pages and source notes survive on persistent storage.

Do not publish the token or disable authentication to work around connection problems.
