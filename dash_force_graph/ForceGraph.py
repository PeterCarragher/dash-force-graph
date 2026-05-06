"""ForceGraph Dash component."""

from dash.development.base_component import Component, _explicitize_args


class ForceGraph(Component):
    """
    A high-performance graph visualization component using force-graph.

    ForceGraph renders large graphs efficiently using WebGL/Canvas.
    It supports interactive features like node selection, panning, zooming,
    box selection, and dynamic graph updates.

    Use the `mode` prop to switch between 'interactive' (full features) and
    'performance' (optimized for large graphs — disables node drag, weakens
    forces, uses smaller nodes and dimmer links).

    Keyword arguments:
    - id (string): The ID of this component.
    - nodes (list): List of node objects. Each node should have at least 'id'.
        Optional fields: 'label', 'color', 'connections', 'x', 'y'.
    - links (list): List of link objects. Each link needs 'source' and 'target' (node IDs).
        Optional fields: 'color', 'width'.
    - selectedNodes (list): List of currently selected node IDs. Supports two-way binding.
    - width (number): Width of the graph container in pixels.
    - height (number): Height of the graph container in pixels.
    - nodeColor (string): Default color for nodes (when node.color is not set).
    - linkColor (string): Default color for links (default: 'rgba(150, 150, 150, 0.2)').
    - linkWidth (number): Default width for links (default: 0.5).
    - enableZoom (boolean): Enable zoom interaction (default: True).
    - enablePan (boolean): Enable pan interaction (default: True).
    - enableNodeDrag (boolean): Enable node dragging (default: True).
        Automatically disabled in 'performance' mode.
    - cooldownTicks (number): Simulation ticks before stopping (default: 100).
    - centerAt (string): Node ID to center the view on.
    - zoomLevel (number): Zoom level to apply.
    - mode (string): Rendering mode — 'interactive' or 'performance' (default: 'interactive').
    - chargeStrength (number): Charge force strength (default: -50). Weakened in performance mode.
    - linkDistance (number): Target link distance (default: 30).
    - collisionRadius (number): Collision detection radius. None disables collision force.
    - d3AlphaDecay (number): Simulation alpha decay rate (default: 0.0228).
    - d3VelocityDecay (number): Simulation velocity decay rate (default: 0.4).
    - nodeRelSize (number): Node size relative to value (default: 6).
    - selectedColor (string): Color for selected nodes (default: '#ffd93d').
    - linkDirectionalArrowLength (number): Arrow length for directed links (default: 0).
    - linkDirectionalArrowRelPos (number): Arrow position along link 0-1 (default: 0.5).
    - boxSelectColor (string): Color for box selection rectangle (default: '#1a73e8').
    - rightClickedNode (string): ID of the last right-clicked node (read-only).
    - rightClickPosition (dict): Position {x, y} of the last right-click (read-only).
    """

    _children_props = []
    _base_nodes = ['children']
    _namespace = 'dash_force_graph'
    _type = 'ForceGraph'

    _js_dist = []
    _css_dist = []

    @_explicitize_args
    def __init__(
        self,
        id=Component.UNDEFINED,
        nodes=Component.UNDEFINED,
        links=Component.UNDEFINED,
        selectedNodes=Component.UNDEFINED,
        width=Component.UNDEFINED,
        height=Component.UNDEFINED,
        nodeColor=Component.UNDEFINED,
        linkColor=Component.UNDEFINED,
        linkWidth=Component.UNDEFINED,
        enableZoom=Component.UNDEFINED,
        enablePan=Component.UNDEFINED,
        enableNodeDrag=Component.UNDEFINED,
        cooldownTicks=Component.UNDEFINED,
        centerAt=Component.UNDEFINED,
        zoomLevel=Component.UNDEFINED,
        mode=Component.UNDEFINED,
        chargeStrength=Component.UNDEFINED,
        linkDistance=Component.UNDEFINED,
        collisionRadius=Component.UNDEFINED,
        d3AlphaDecay=Component.UNDEFINED,
        d3VelocityDecay=Component.UNDEFINED,
        nodeRelSize=Component.UNDEFINED,
        selectedColor=Component.UNDEFINED,
        linkDirectionalArrowLength=Component.UNDEFINED,
        linkDirectionalArrowRelPos=Component.UNDEFINED,
        boxSelectColor=Component.UNDEFINED,
        rightClickedNode=Component.UNDEFINED,
        rightClickPosition=Component.UNDEFINED,
        showNeighborLabels=Component.UNDEFINED,
        **kwargs
    ):
        self._prop_names = [
            'id',
            'nodes',
            'links',
            'selectedNodes',
            'width',
            'height',
            'nodeColor',
            'linkColor',
            'linkWidth',
            'enableZoom',
            'enablePan',
            'enableNodeDrag',
            'cooldownTicks',
            'centerAt',
            'zoomLevel',
            'mode',
            'chargeStrength',
            'linkDistance',
            'collisionRadius',
            'd3AlphaDecay',
            'd3VelocityDecay',
            'nodeRelSize',
            'selectedColor',
            'linkDirectionalArrowLength',
            'linkDirectionalArrowRelPos',
            'boxSelectColor',
            'rightClickedNode',
            'rightClickPosition',
            'showNeighborLabels',
        ]
        self._valid_wildcard_attributes = []
        self.available_properties = list(self._prop_names)
        self.available_wildcard_properties = []
        _explicit_args = kwargs.pop('_explicit_args')
        _locals = locals()
        _locals.update(kwargs)
        args = {k: _locals[k] for k in _explicit_args if k != 'children'}

        super(ForceGraph, self).__init__(**args)
