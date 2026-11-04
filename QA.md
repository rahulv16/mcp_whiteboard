# Classroom version verification

## Learner interaction upgrade

- All ten automated tests pass, including learner ink and pointing during copy pause, stale gesture rejection, persistence and page-specific cleanup.
- Browser checks verified the shared pointer and learner stroke creation. A real MCP read returned their coordinates and page IDs. Test marks were cleared without altering lesson content.
- Handwriting is stored as strokes, not automatically transcribed. Interactions are available when the assistant reads the board; they do not automatically trigger a response.

## Classroom upgrade

- Eight automated tests pass, including real stdio and HTTP MCP clients, authorization, browser login, scene validation, notebook migration, page preservation, copying pause, source validation, persistence and undo.
- A real HTTP MCP client added a triangle-area lesson on a new page without replacing the earlier Einstein lesson. Two viewers received its update.
- Live browser checks passed for new page creation, textured triangle rendering, copying pause rejection, resume, source notes, rename, object position/width editing, page switching, and presentation mode.
- The 390-pixel mobile viewport had document width 390: no horizontal overflow. Escape closed the source dialog. The temporary viewport was reset.
- The teaching demo is saved in the notebook and `classroom-preview.png`.
- Existing board data was backed up before migration in `data/board-before-classroom-upgrade.json`.
- Docker and Azure deployment are not executed: Docker/Podman are unavailable locally. The image build recipe, persistent-storage settings, HTTPS/auth requirements and deployment smoke test are in `DEPLOYMENT.md`.
- This version does not automatically download YouTube captions or analyze video. Source links, transcripts/excerpts, timestamps and teaching notes are stored for the assistant to use. No claim that a link alone has been read or watched.
- New MCP scene/notebook tools need a refreshed assistant MCP connection. Their underlying stdio and HTTP transports passed automated tests; exposure in the next voice session remains a user test.

## Initial version checks

- Node tests: model validation, atomic upserts/removal/clear, revision conflicts, invalid coordinates/colors/strokes.
- Integration test uses the official MCP SDK client over stdio to discover all four tools and perform real calls; verifies SSE delivery, saved state, clear/undo and foreign-origin rejection.
- Live demo populated 13 objects through MCP, including LaTeX, arrows, a curve and text.
- In-app browser rendered the equation and diagram correctly. A subsequent real MCP call updated the already-open canvas with a new text object and reported one connected viewer.
- Manual equation entry rendered an integral. Undo removed edits.
- Registered as `whiteboard` in the local Codex config, verified with `codex mcp get whiteboard`.
- The initial read/clear/undo tools appeared in the assistant catalog; structured update did not. The classroom version adds a simple JSON-string scene tool to avoid the richer schema compatibility issue. During a real voice session, updates were sent through the board API while explaining relativity; the user confirmed the board worked well.
- No speech-synchronized drawing claim: animations run locally on arrival. No microphone or API calls in the board.
