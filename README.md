# dash-force-graph

A [Dash](https://dash.plotly.com/) component wrapping [react-force-graph-2d](https://github.com/vasturiano/react-force-graph) for high-performance 2D graph visualization with WebGL/Canvas rendering.

## Features

- **High performance** — renders thousands of nodes using HTML5 Canvas
- **Two rendering modes** — `interactive` (full features) and `performance` (optimized for large graphs)
- **Node selection** — click, Ctrl/Cmd multi-select, Shift box-select
- **Right-click support** — capture right-click events for context menus
- **Configurable forces** — charge, link distance, collision via props
- **Directional arrows** — optional arrows on links for directed graphs
- **Two-way binding** — `selectedNodes` prop syncs selection state with Dash callbacks

## Installation

```bash
pip install dash-force-graph
```

### Development install (from source)

```bash
git clone https://github.com/PeterCarragher/dash-force-graph.git
cd dash-force-graph
npm install && npm run build
pip install -e .
```

## Quick Start

```python
import dash
from dash import html, Input, Output
from dash_force_graph import ForceGraph

app = dash.Dash(__name__)

app.layout = html.Div([
    ForceGraph(
        id='graph',
        nodes=[
            {'id': 'a', 'label': 'Node A'},
            {'id': 'b', 'label': 'Node B'},
            {'id': 'c', 'label': 'Node C'},
        ],
        links=[
            {'source': 'a', 'target': 'b'},
            {'source': 'b', 'target': 'c'},
        ],
        nodeColor='#4ecdc4',
    ),
    html.Div(id='output'),
])

@app.callback(
    Output('output', 'children'),
    Input('graph', 'selectedNodes'),
)
def show_selection(selected):
    return f"Selected: {selected}"

if __name__ == '__main__':
    app.run(debug=True)
```

## Props Reference

### Data

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `id` | string | — | Component ID |
| `nodes` | list | `[]` | Node objects. Required field: `id`. Optional: `label`, `color`, `connections` |
| `links` | list | `[]` | Link objects. Required fields: `source`, `target` (node IDs) |
| `selectedNodes` | list | `[]` | Currently selected node IDs (two-way binding) |

### Appearance

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `nodeColor` | string | — | Default node color (used when `node.color` is not set) |
| `nodeRelSize` | number | `6` | Node size relative to value |
| `linkColor` | string | `'rgba(150,150,150,0.2)'` | Default link color |
| `linkWidth` | number | `0.5` | Default link width |
| `selectedColor` | string | `'#ffd93d'` | Highlight color for selected nodes |
| `boxSelectColor` | string | `'#1a73e8'` | Box selection rectangle color |
| `linkDirectionalArrowLength` | number | `0` | Arrow length on links (0 = hidden) |
| `linkDirectionalArrowRelPos` | number | `0.5` | Arrow position along link (0–1) |

### Layout

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `width` | number | — | Container width in px (auto-detected if omitted) |
| `height` | number | — | Container height in px (auto-detected if omitted) |
| `centerAt` | string | — | Node ID to center the view on |
| `zoomLevel` | number | — | Zoom level to apply |

### Physics / Forces

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `chargeStrength` | number | `-50` | Repulsive force between nodes |
| `linkDistance` | number | `30` | Target distance between linked nodes |
| `collisionRadius` | number | `null` | Collision radius (`null` = no collision force) |
| `d3AlphaDecay` | number | `0.0228` | Simulation cooling rate |
| `d3VelocityDecay` | number | `0.4` | Node velocity dampening |
| `cooldownTicks` | number | `100` | Simulation ticks before stopping |

### Interaction

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `enableZoom` | bool | `true` | Enable scroll-to-zoom |
| `enablePan` | bool | `true` | Enable click-and-drag panning |
| `enableNodeDrag` | bool | `true` | Enable dragging individual nodes |

### Mode

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `mode` | string | `'interactive'` | `'interactive'` or `'performance'` |

**Performance mode** adjusts rendering for large graphs:
- Disables node dragging
- Weakens charge force (`chargeStrength * 0.6`, capped at `-30`)
- Shrinks nodes (`nodeRelSize * 0.67`)
- Thins links (`linkWidth * 0.6`)
- Dims link color
- Increases cooldown ticks, lowers alpha/velocity decay

### Read-only (output)

| Prop | Type | Description |
|------|------|-------------|
| `rightClickedNode` | string | ID of the last right-clicked node |
| `rightClickPosition` | dict | `{x, y}` screen position of the last right-click |

## Selection Behavior

- **Click** a node to select it (clears previous selection)
- **Ctrl/Cmd + Click** to toggle a node in the selection
- **Shift + Click** to add a node to the selection
- **Shift + Drag** to box-select multiple nodes
- **Click background** to clear selection

## Customization

### Per-node colors

Set `color` on individual node objects to override `nodeColor`:

```python
nodes = [
    {'id': 'a', 'color': '#ff6b6b'},  # custom color
    {'id': 'b'},                        # uses nodeColor prop
]
```

### Directed graphs

Enable arrows on links:

```python
ForceGraph(
    id='graph',
    nodes=nodes,
    links=links,
    linkDirectionalArrowLength=6,
    linkDirectionalArrowRelPos=1,
)
```

### Large graph handling

Set `mode='performance'` for graphs with many nodes/edges:

```python
mode = 'performance' if len(nodes) > 10000 else 'interactive'

ForceGraph(
    id='graph',
    nodes=nodes,
    links=links,
    mode=mode,
)
```

## Development

```bash
# Install JS dependencies
npm install

# Build JS bundle (required after editing src/)
npm run build

# Watch mode (auto-rebuild on changes)
npm run watch

# Install Python package in dev mode
pip install -e .
```

## License

MIT
