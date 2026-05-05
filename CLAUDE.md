# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
npm install && npm run build   # install and build bundle
npm run watch                  # rebuild on file changes (dev)
pip install -e .               # install Python package in editable mode
```

After any change to `src/ForceGraph.js` or `src/index.js`, run `npm run build` — the Python Dash package serves the compiled `dash_force_graph/bundle.js`, not the source.

## Architecture

This is a **Dash component** wrapping `react-force-graph-2d`. The stack:

1. **`src/ForceGraph.js`** — React component. All rendering logic lives here: node/link canvas painting, selection state, box-select overlay, physics config, viewport auto-fit.
2. **Webpack** bundles it as a UMD module into `dash_force_graph/bundle.js`. React/ReactDOM are externals (supplied by Dash at runtime).
3. **`dash_force_graph/ForceGraph.py`** — manually written Dash `Component` subclass that mirrors the React props. This file is **not auto-generated** — if you add a prop to the React component, you must also add it here.
4. **`dash_force_graph/__init__.py`** — registers `bundle.js` via `_js_dist` so Dash serves it.

Props flow Python → JSON → React via Dash's serialization. React → Python updates happen via the `setProps` callback (e.g. `setProps({ selectedNodes: [...] })`).

## Key Implementation Details

**Selection highlighting** uses `nodeCanvasObjectMode` as a per-node function returning `'before'` for selected nodes and `undefined` for others. This makes `nodeCanvasObject` (`paintRing`) draw glow rings *before* the default circle renders. `autoPauseRedraw={false}` is required — otherwise the canvas freezes after simulation cools and selections don't appear.

**Performance mode** (`mode='performance'`) reduces charge strength, node size, link width, and disables dragging for large graphs. The thresholds are set in `force_graph_vis.py` (the consuming app), not in the component itself.

**Box selection** uses an invisible overlay div (z-indexed above the canvas when Shift is held). It intercepts mouse events and uses `graph2ScreenCoords` to convert canvas positions for hit-testing.

**Viewport auto-fit**: on `graphData` change, immediately centers at (0,0), then re-centers to the true bounding box after `onEngineStop` fires.

**`selectedNodes` prop** is two-way: Dash can set it (e.g. from a legend-click callback), and the component reports back via `setProps` on node clicks. The `useEffect([selectedNodes])` in the component syncs incoming Dash prop changes to React state.
