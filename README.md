# WhiteBoard · classroom prototype

A persistent white canvas for a conversation, with saved lesson pages, LaTeX equations, drawing tools, textured shapes, local images and source notes. Runs on Mac, Windows or Linux with Node.js 20+. The browser shows the board; stdio or authenticated Streamable HTTP MCP lets an assistant read and edit it. WhiteBoard has no microphone or AI engine of its own. During our voice test, the assistant updated the board while explaining relativity. That demonstrated the voice-to-board workflow, but not word-level audio/animation synchronization.

## Start

### Learn together

- **Point** pins a shared gold marker where you tap, recording the page, coordinates, time and teaching-object ID when hit. Say “explain this spot” and ask the assistant to read the board.
- **Write** draws with a mouse, touch or stylus on a separate learner ink layer. **Select / move** returns to editing teaching objects. **Clear my ink** affects only the current page's learner strokes; **Clear pointer** removes the marker.
- These controls stay visible in presentation mode and work during **Time to copy** without changing the teaching content. Ink persists in saved lessons and SVG exports; the pointer is omitted from SVG exports. Up to 100 learner strokes are stored per notebook.
- MCP `whiteboard_read` returns `board.learner.focus` and `board.learner.marks`. These are available on read, not automatic assistant notifications. Handwriting is stored as strokes, not automatically transcribed or guaranteed to be understood. Explain your marks aloud when needed.
- All connected viewers share one learner layer; this is not a multi-student identity system. Stale gestures are rejected rather than written onto a different lesson state.

```sh
npm ci
npm start
```

Open http://127.0.0.1:4180 (not the HTML file directly). The board binds to loopback by default. The same notebook is shared by all viewers and MCP clients. `WHITEBOARD_PORT` changes the port and must match in both processes. `WHITEBOARD_DATA` changes the data folder. Windows PowerShell uses `$env:WHITEBOARD_PORT="4181"`; macOS/Linux can use `WHITEBOARD_PORT=4181 npm start`. See [DEPLOYMENT.md](DEPLOYMENT.md) for Docker and private Azure hosting.

## Teach and take notes

1. Start with a question and a learning goal. Ask the assistant to teach one idea at a time and keep previous steps visible.
2. Add a source in **Source & lesson notes**: a video, book or GitHub URL plus an accessible transcript/excerpt and timestamps/page numbers. A link alone is only a reference; the board does not download or watch it. The assistant can use its connected research tools to retrieve accessible material, or ask for an excerpt when unavailable. Timestamps alone do not supply the content.
3. Use **Time to copy** to freeze scene edits, undo and page changes. Press **Continue teaching** when ready. This holds the board, not the assistant's speech; tell the assistant if you also want it to pause speaking.
4. Use **+ Page** for each concept or worked example. Pages autosave locally; use the page selector to revisit them. Rename/delete pages through their buttons. Delete is recoverable with Undo in the current session.
5. Use **Present** for a cleaner teaching view. **Save lesson** downloads the whole notebook as JSON, including pages and source notes. **Open lesson** restores it (Undo can recover the previous notebook). **Save SVG** exports only the current page.

The teaching workflow is: state a goal → write a definition → illustrate it → work through an example → pause for copying → ask a check question → adapt. Content accuracy and pacing still require the assistant and learner's judgment; the board is the shared visual surface.

## Draw and edit

Use Pen, Text, Equation, Shape or Image. Shapes include rectangles, ellipses, triangles, diamonds and arrows; fills can be solid, hatched or dotted. Choose ink color and pen thickness. Upload PNG/JPEG/WebP images below 500 KB; SVG uploads and remote image URLs are intentionally unsupported. Images become part of the saved notebook.

With Pen off, drag an object to move it. Double-click it to edit, or choose it in the **Select an object** list and press **Edit selected** for keyboard access. The editor changes position, dimensions and text size. Line/stroke geometry uses its points; its width/height fields do not rescale those points. **Apply ink & texture** applies the toolbar styles to the selected object; **Bring forward** moves it above other objects. Delete selected and Undo operate on the same state the assistant sees.

## Connect to Codex

```sh
codex mcp add whiteboard -- node /absolute/path/to/whiteboard/mcp.mjs
```

Use an absolute Node executable path if the desktop app cannot find Node. The MCP process starts the local board server if needed. To load newly configured tools, a fresh task or application reload may be necessary. Keep the board open alongside voice chat. Ask: “Use WhiteBoard to show 3 + 2 with circles.” If the host does not expose the tools in voice mode, that is an integration limitation; the separate MCP demo still verifies the canvas update loop.

## Tools

- `whiteboard_read`: scene, revision, canvas size, viewer count and last acknowledged displayed revision.
- `whiteboard_update`: atomic batch of objects; upsert by stable id, remove ids, or replace the entire scene.
- `whiteboard_clear`: clear the board, recoverable with Undo.
- `whiteboard_undo`: undo up to 30 changes in this server session.
- `whiteboard_scene`: JSON-string alternative to structured update, for MCP clients that cannot expose the richer schema.
- `whiteboard_notebook`: create/switch/delete pages; attach source title/URL/transcript/notes; pause/resume for copying. It never retrieves a video by itself.

Coordinates are 1200 × 800, starting at the upper left. Text uses x/y as top-left; newlines are supported. Equations take LaTeX in `text` and should have enough width/height for their rendered size. Shapes use x/y/width/height. Lines, arrows and strokes use absolute `points` pairs. Objects accept six-digit hex color, fill (hex or `none`), size, weight, thickness (1–30), opacity (0.1–1), texture (solid/hatch/dots), and animate. Image objects take a raster data URL in `image`. An upsert replaces the full object; read the board before modifying an existing object. `expectedRevision` rejects stale changes. Batch up to 200 objects; 500 objects per page, 50 pages per notebook, 20 MB per notebook. No arbitrary code or raw HTML is accepted. Do not remove a copying pause without the user's instruction.

Example arguments to whiteboard_update:

```json
{"title":"A little algebra","replace":true,"elements":[{"id":"equation","type":"equation","text":"x^2 + 2x + 1 = (x+1)^2","x":100,"y":120,"width":1000,"height":200,"size":48},{"id":"underline","type":"line","points":[[100,280],[900,280]],"color":"#3d8469"}]}
```

## Test

```sh
npm test
npm run demo
node classroom-demo.mjs
```

The original demo invokes the real MCP SDK client over stdio and replaces the current page with a diagram and equation. The classroom demo uses HTTP MCP and adds a new triangle-area lesson page while preserving existing pages. Tests exercise schema validation, atomic edits, actual stdio/HTTP MCP calls, SSE updates, persistence, page navigation, copy pause, source validation, login, token authentication and cross-origin rejection. Running tests requires permission to bind local ports.

## Scope and behavior

The canvas renders text, LaTeX (local KaTeX assets), geometric shapes, polylines and pen strokes. Plot curves by sending sampled points. Existing objects retain their DOM nodes when unchanged; only new/changed objects animate. Pen strokes and shape outlines animate on receipt, not in synchronization with speech. Reduced-motion is respected. Clear/replacement removes old animations immediately. Browser reconnection reloads the latest scene.

All notebook pages are saved atomically to `data/board.json`; undo history is memory-only and capped at 30 snapshots and approximately 60 MB. Old single-page data migrates automatically. Invalid stored state causes startup to stop instead of silently discarding it. Save SVG embeds equation fonts, but equation rendering relies on foreignObject support; use a browser to open it. Keep separate exported JSON files for separate courses; the server has one active notebook, not a multi-user course library.

The server validates Hosts and Origins, requires JSON for scene writes, and exposes only known static assets and lesson operations. It does not execute assistant-provided code or expose general file access. Local mode trusts processes running under the local user account. Non-loopback hosting requires an HTTPS public origin and a strong bearer token. Cloud MCP uses bearer authentication; browser sign-in uses an HttpOnly cookie. This is a private single-user deployment model, not multi-tenant authorization. Consult the deployment guide before exposing it.

MCP protocol success means the edit was accepted by the server, not that audio and visuals were synchronized. Connected-viewer information and the browser's last acknowledged revision help diagnose display delivery. Reconnect MCP or reload the assistant after this upgrade to load the new scene/notebook tools. The initial structured update tool did not appear in this host's tool catalog; the JSON-string scene tool is provided for compatibility.
