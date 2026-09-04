# The SVG board (archived 2026-09-04)

The 2D board the app shipped before the floor: `scene.js` (SVG nodes and wires),
`camera.js` (pan/zoom), `editor.js` (the admin drag/wire/add-node editor),
`layout.js` + `relax.js` (columns are time, rails are family, then a
deterministic relaxation). Nothing in the app imports these. They are kept,
with their tests, because the layout and edge-curve work is real and the
public `path/` page may want it back. Founder call: the map is the floor
(`graph/scene3d/`), where position is derived from sequence, so per-student
drag layouts and the editor have no meaning there.
