import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import * as d3 from 'd3-force';

/**
 * ForceGraph - A Dash component wrapping force-graph-2d for high-performance
 * graph visualization with WebGL rendering.
 */
const ForceGraph = (props) => {
    const {
        id,
        nodes,
        links,
        selectedNodes,
        width,
        height,
        nodeColor,
        linkColor,
        linkWidth,
        enableZoom,
        enablePan,
        enableNodeDrag,
        cooldownTicks,
        centerAt,
        zoomLevel,
        mode,
        chargeStrength,
        linkDistance,
        collisionRadius,
        d3AlphaDecay,
        d3VelocityDecay,
        nodeRelSize,
        selectedColor,
        linkDirectionalArrowLength,
        linkDirectionalArrowRelPos,
        linkDirectionalParticleSpeed,
        boxSelectColor,
        showNeighborLabels,
        labelFontSize,
        fitView,
        setProps,
    } = props;

    const isPerformance = mode === 'performance';

    const graphRef = useRef();
    const containerRef = useRef();
    const overlayRef = useRef();
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [selectedSet, setSelectedSet] = useState(new Set(selectedNodes || []));
    const [dimensions, setDimensions] = useState({ width: width || 800, height: height || 600 });

    // Box selection state
    const [isBoxSelecting, setIsBoxSelecting] = useState(false);
    const [boxStart, setBoxStart] = useState(null);
    const [boxEnd, setBoxEnd] = useState(null);
    const [shiftHeld, setShiftHeld] = useState(false);

    // Neighbor / adjacency maps (keyed by node id and link __idx)
    const neighborMapRef = useRef(new Map());   // nodeId -> Set<neighborId>
    const adjacentLinksRef = useRef(new Map()); // nodeId -> Set<linkIdx>

    // Graph version counter — incremented when nodes/links change, so useMemo
    // can recompute highlights even if selectedSet reference is unchanged.
    const [graphVersion, setGraphVersion] = useState(0);

    // Track shift key globally
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Shift') setShiftHeld(true);
        };
        const handleKeyUp = (e) => {
            if (e.key === 'Shift') setShiftHeld(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Update dimensions from props or container
    useEffect(() => {
        if (width && height) {
            setDimensions({ width, height });
        } else if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                setDimensions({ width: rect.width, height: rect.height });
            }
        }
    }, [width, height]);

    // Update graph data when nodes/links change; tag links with __idx so we can
    // identify them after d3 replaces source/target with object references.
    useEffect(() => {
        const nodesCopy = (nodes || []).map(n => ({ ...n }));
        const linksCopy = (links || []).map((l, idx) => ({ ...l, __idx: idx }));
        setGraphData({ nodes: nodesCopy, links: linksCopy });
    }, [nodes, links]);

    // Build neighbor/adjacency maps from the original props (string IDs only).
    // Also bump graphVersion so highlight memo recomputes.
    useEffect(() => {
        const neighborMap = new Map();
        const adjacentLinks = new Map();
        (nodes || []).forEach(n => {
            neighborMap.set(n.id, new Set());
            adjacentLinks.set(n.id, new Set());
        });
        (links || []).forEach((link, idx) => {
            const src = link.source;
            const tgt = link.target;
            if (neighborMap.has(src)) { neighborMap.get(src).add(tgt); adjacentLinks.get(src).add(idx); }
            if (neighborMap.has(tgt)) { neighborMap.get(tgt).add(src); adjacentLinks.get(tgt).add(idx); }
        });
        neighborMapRef.current = neighborMap;
        adjacentLinksRef.current = adjacentLinks;
        setGraphVersion(v => v + 1);
    }, [nodes, links]);

    // Sync selection from props (e.g. legend click from Dash)
    useEffect(() => {
        setSelectedSet(new Set(selectedNodes || []));
    }, [selectedNodes]);

    // Derived highlight sets — recomputed whenever selection or graph topology changes.
    const { highlightNodeIds, highlightLinkIndices } = useMemo(() => {
        if (!selectedSet.size) {
            return { highlightNodeIds: new Set(), highlightLinkIndices: new Set() };
        }
        const nodeIds = new Set();
        const linkIndices = new Set();
        selectedSet.forEach(nodeId => {
            (neighborMapRef.current.get(nodeId) || new Set()).forEach(id => nodeIds.add(id));
            (adjacentLinksRef.current.get(nodeId) || new Set()).forEach(idx => linkIndices.add(idx));
        });
        return { highlightNodeIds: nodeIds, highlightLinkIndices: linkIndices };
    }, [selectedSet, graphVersion]); // eslint-disable-line react-hooks/exhaustive-deps

    // Center on node when centerAt changes
    useEffect(() => {
        if (centerAt && graphRef.current) {
            const node = graphData.nodes.find(n => n.id === centerAt);
            if (node && node.x !== undefined) {
                graphRef.current.centerAt(node.x, node.y, 500);
                graphRef.current.zoom(2, 500);
            }
        }
    }, [centerAt, graphData.nodes]);

    // Apply zoom level
    useEffect(() => {
        if (zoomLevel && graphRef.current) {
            graphRef.current.zoom(zoomLevel, 300);
        }
    }, [zoomLevel]);

    // Fit all nodes into view (used by presenter mode); delay lets CSS layout settle first
    useEffect(() => {
        if (!fitView || !graphRef.current) return;
        const timer = setTimeout(() => {
            if (!graphRef.current) return;
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    setDimensions({ width: rect.width, height: rect.height });
                }
            }
            graphRef.current.zoomToFit(400, 40, node => {
            const neighbors = neighborMapRef.current.get(node.id);
            return neighbors !== undefined && neighbors.size > 0;
        });
        }, 300);
        return () => clearTimeout(timer);
    }, [fitView]);

    const recenterOnStopRef = useRef(false);
    const graphDataRef = useRef(graphData);
    useEffect(() => { graphDataRef.current = graphData; }, [graphData]);
    const fitViewRef = useRef(fitView);
    useEffect(() => { fitViewRef.current = fitView; }, [fitView]);

    // Track whether the latest graphData change is a pure filter/hide (no new node IDs)
    // vs a structural change (new nodes appeared). Must run before the reset-view and
    // force-config effects so they can read the flag synchronously.
    const prevNodeIdsRef = useRef(new Set());
    const isFilterChangeRef = useRef(false);
    useEffect(() => {
        const prevIds = prevNodeIdsRef.current;
        isFilterChangeRef.current = prevIds.size > 0 && graphData.nodes.every(n => prevIds.has(n.id));
        prevNodeIdsRef.current = new Set(graphData.nodes.map(n => n.id));
    }, [graphData]);

    // Reset viewport when graph data changes.
    // In presenter mode: always delegate to handleEngineStop for a single clean zoomToFit.
    // For filter changes the simulation alpha is already near 0, so onEngineStop fires
    // almost immediately (no node movement, no double-transition).
    // In normal mode: reset camera immediately; handleEngineStop re-centers after simulation.
    useEffect(() => {
        if (!graphData.nodes.length) return;
        recenterOnStopRef.current = true;
        if (!graphRef.current) return;
        if (!fitViewRef.current) {
            graphRef.current.centerAt(0, 0, 0);
            graphRef.current.zoom(0.6, 0);
        }
    }, [graphData]);

    const handleEngineStop = useCallback(() => {
        if (!recenterOnStopRef.current || !graphRef.current) return;
        recenterOnStopRef.current = false;
        const nodes = graphDataRef.current.nodes;
        if (!nodes.length) return;
        if (fitViewRef.current) {
            graphRef.current.zoomToFit(400, 40, node => {
                const neighbors = neighborMapRef.current.get(node.id);
                return neighbors !== undefined && neighbors.size > 0;
            });
        } else {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            nodes.forEach(n => {
                if (n.x !== undefined) {
                    minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
                    minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
                }
            });
            graphRef.current.centerAt((minX + maxX) / 2, (minY + maxY) / 2, 400);
            graphRef.current.zoom(0.6, 400);
        }
    }, []);

    // Configure force simulation
    useEffect(() => {
        // Capture filter-change flag at effect setup time (before the async timer).
        const filterChange = isFilterChangeRef.current;
        const timer = setTimeout(() => {
            if (graphRef.current) {
                const fg = graphRef.current;

                const effectiveCharge = isPerformance
                    ? Math.max(chargeStrength * 0.6, -30)
                    : chargeStrength;
                fg.d3Force('charge', d3.forceManyBody().strength(effectiveCharge));

                if (linkDistance != null) {
                    const linkForce = fg.d3Force('link');
                    if (linkForce) {
                        linkForce.distance(linkDistance);
                    }
                }

                if (collisionRadius != null) {
                    fg.d3Force('collision', d3.forceCollide(collisionRadius));
                } else {
                    fg.d3Force('collision', null);
                }

                // Skip reheat for pure filter/hide changes — nodes already have stable
                // positions in force-graph's internal cache. Reheating would cause them
                // to drift away from the viewport before handleEngineStop can re-fit.
                if (!filterChange) {
                    fg.d3ReheatSimulation();
                }
            }
        }, 100);
        return () => clearTimeout(timer);
    }, [graphData, isPerformance, chargeStrength, linkDistance, collisionRadius]);

    // Node click handler
    const handleNodeClick = useCallback((node, event) => {
        if (!node) return;

        const ctrlKey = event?.ctrlKey || false;
        const metaKey = event?.metaKey || false;
        const shiftKey = event?.shiftKey || false;

        let newSelected;
        if (ctrlKey || metaKey) {
            const newSet = new Set(selectedSet);
            if (newSet.has(node.id)) newSet.delete(node.id);
            else newSet.add(node.id);
            newSelected = Array.from(newSet);
        } else if (shiftKey) {
            newSelected = Array.from(new Set([...selectedSet, node.id]));
        } else {
            newSelected = [node.id];
        }

        setSelectedSet(new Set(newSelected));
        if (setProps) setProps({ selectedNodes: newSelected });
    }, [selectedSet, setProps]);

    // Background click - clear selection (only if not box selecting)
    const handleBackgroundClick = useCallback(() => {
        if (isBoxSelecting) return;
        setSelectedSet(new Set());
        if (setProps) setProps({ selectedNodes: [] });
    }, [setProps, isBoxSelecting]);

    // Right-click handler for context menu
    const handleNodeRightClick = useCallback((node, event) => {
        if (!node) return;
        if (event?.preventDefault) event.preventDefault();
        if (setProps) {
            setProps({
                rightClickedNode: node.id,
                rightClickPosition: { x: event?.clientX || 0, y: event?.clientY || 0 }
            });
        }
    }, [setProps]);

    // Node color — always use node's own color; glow ring handles selection highlight
    const getNodeColor = useCallback((node) => {
        return node.color || nodeColor || null;
    }, [nodeColor]);

    // Effective prop values based on mode
    const effectiveNodeRelSize = isPerformance ? nodeRelSize * 0.67 : nodeRelSize;
    const effectiveLinkWidth = isPerformance ? linkWidth * 0.6 : linkWidth;
    const effectiveLinkColor = isPerformance ? 'rgba(150, 150, 150, 0.1)' : linkColor;
    const effectiveCooldownTicks = isPerformance ? 200 : cooldownTicks;
    const effectiveAlphaDecay = isPerformance ? 0.01 : d3AlphaDecay;
    const effectiveVelocityDecay = isPerformance ? 0.15 : d3VelocityDecay;

    // Canvas object mode: selected nodes get 'before' so the glow ring is drawn
    // underneath the default circle. Labels are in onRenderFramePost so they
    // always appear on top of every node circle regardless of draw order.
    const nodeCanvasObjectMode = useCallback((node) => {
        if (selectedSet.has(node.id)) return 'before';
        return undefined;
    }, [selectedSet]);

    // Canvas object: glow ring only, drawn before the default circle
    const nodeCanvasObject = useCallback((node, ctx) => {
        const r = effectiveNodeRelSize * Math.sqrt(node.val || 1);
        const color = node.color || nodeColor || '#4ecdc4';
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 2.2, 0, 2 * Math.PI, false);
        ctx.fillStyle = color + '33';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 1.6, 0, 2 * Math.PI, false);
        ctx.fillStyle = color + '88';
        ctx.fill();
    }, [selectedSet, effectiveNodeRelSize, nodeColor]); // eslint-disable-line react-hooks/exhaustive-deps

    // Post-render pass: draw all labels after every node circle has been painted
    // so labels are never obscured by nodes drawn later in the same frame.
    const handleRenderFramePost = useCallback((ctx, globalScale) => {
        const nodes = graphDataRef.current.nodes;
        const fontSize = Math.max(2, (labelFontSize || 10) / globalScale);
        ctx.font = `${fontSize}px 'Space Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        nodes.forEach(node => {
            const isSelected = selectedSet.has(node.id);
            const isNeighbor = showNeighborLabels && highlightNodeIds.has(node.id);
            if (!isSelected && !isNeighbor) return;
            if (node.x === undefined || node.y === undefined) return;

            const label = node.label || node.id || '';
            if (!label) return;

            const r = effectiveNodeRelSize * Math.sqrt(node.val || 1);
            const textWidth = ctx.measureText(label).width;
            const pad = 1.5 / globalScale;
            const labelY = node.y + r + 2 / globalScale;

            ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
            ctx.fillRect(node.x - textWidth / 2 - pad, labelY - pad, textWidth + pad * 2, fontSize + pad * 2);
            ctx.fillStyle = isSelected ? '#111' : '#555';
            ctx.fillText(label, node.x, labelY);
        });
    }, [selectedSet, highlightNodeIds, showNeighborLabels, effectiveNodeRelSize, labelFontSize]); // eslint-disable-line react-hooks/exhaustive-deps

    // Link rendering — highlight adjacent links
    const getLinkWidth = useCallback((link) => {
        return highlightLinkIndices.has(link.__idx)
            ? (isPerformance ? 1.5 : 2.5)
            : effectiveLinkWidth;
    }, [highlightLinkIndices, isPerformance, effectiveLinkWidth]);

    const getLinkColor = useCallback((link) => {
        return highlightLinkIndices.has(link.__idx)
            ? 'rgba(255, 210, 60, 0.9)'
            : effectiveLinkColor;
    }, [highlightLinkIndices, effectiveLinkColor]);

    const getLinkParticles = useCallback((link) => {
        return highlightLinkIndices.has(link.__idx) ? 4 : 0;
    }, [highlightLinkIndices]);

    const getLinkParticleWidth = useCallback((link) => {
        return highlightLinkIndices.has(link.__idx) ? 12 : 0;
    }, [highlightLinkIndices]);

    // Node label (tooltip on hover — kept for non-highlighted nodes)
    const getNodeLabel = useCallback((node) => {
        if (selectedSet.has(node.id)) return '';
        if (showNeighborLabels && highlightNodeIds.has(node.id)) return '';
        return node.label || node.id;
    }, [selectedSet, highlightNodeIds, showNeighborLabels]);

    // Fix node position after drag by setting fx/fy (pins it in the d3 simulation)
    const handleNodeDragEnd = useCallback((node) => {
        node.fx = node.x;
        node.fy = node.y;
    }, []);

    // Box selection handlers on the overlay
    const handleOverlayMouseDown = useCallback((event) => {
        if (!shiftHeld) return;
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        setIsBoxSelecting(true);
        setBoxStart({ x, y });
        setBoxEnd({ x, y });
        event.preventDefault();
        event.stopPropagation();
    }, [shiftHeld]);

    const handleOverlayMouseMove = useCallback((event) => {
        if (!isBoxSelecting || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        setBoxEnd({ x, y });
    }, [isBoxSelecting]);

    const handleOverlayMouseUp = useCallback((event) => {
        if (!isBoxSelecting || !boxStart || !boxEnd || !graphRef.current) {
            setIsBoxSelecting(false);
            return;
        }

        const minX = Math.min(boxStart.x, boxEnd.x);
        const maxX = Math.max(boxStart.x, boxEnd.x);
        const minY = Math.min(boxStart.y, boxEnd.y);
        const maxY = Math.max(boxStart.y, boxEnd.y);

        if (maxX - minX > 5 && maxY - minY > 5) {
            const graph = graphRef.current;
            const selected = [];

            graphData.nodes.forEach(node => {
                if (node.x !== undefined && node.y !== undefined) {
                    const screenCoords = graph.graph2ScreenCoords(node.x, node.y);
                    if (screenCoords.x >= minX && screenCoords.x <= maxX &&
                        screenCoords.y >= minY && screenCoords.y <= maxY) {
                        selected.push(node.id);
                    }
                }
            });

            if (selected.length > 0) {
                const newSet = event?.ctrlKey || event?.metaKey
                    ? new Set([...selectedSet, ...selected])
                    : new Set(selected);
                setSelectedSet(newSet);
                if (setProps) {
                    setProps({ selectedNodes: Array.from(newSet) });
                }
            }
        }

        setIsBoxSelecting(false);
        setBoxStart(null);
        setBoxEnd(null);
    }, [isBoxSelecting, boxStart, boxEnd, graphData.nodes, selectedSet, setProps]);

    // Get selection box style
    const getSelectionBoxStyle = () => {
        if (!isBoxSelecting || !boxStart || !boxEnd) return { display: 'none' };
        return {
            position: 'absolute',
            left: Math.min(boxStart.x, boxEnd.x),
            top: Math.min(boxStart.y, boxEnd.y),
            width: Math.abs(boxEnd.x - boxStart.x),
            height: Math.abs(boxEnd.y - boxStart.y),
            border: `2px dashed ${boxSelectColor}`,
            backgroundColor: `${boxSelectColor}19`,
            pointerEvents: 'none',
            zIndex: 1000,
        };
    };

    const effectiveEnableNodeDrag = isPerformance ? false : (enableNodeDrag !== false);

    return (
        <div
            id={id}
            ref={containerRef}
            style={{
                width: '100%',
                height: '100%',
                minWidth: '400px',
                minHeight: '300px',
                position: 'relative'
            }}
        >
            {/* Invisible overlay for box selection when shift is held */}
            <div
                ref={overlayRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: shiftHeld ? 100 : -1,
                    cursor: shiftHeld ? 'crosshair' : 'default',
                    pointerEvents: shiftHeld ? 'auto' : 'none',
                }}
                onMouseDown={handleOverlayMouseDown}
                onMouseMove={handleOverlayMouseMove}
                onMouseUp={handleOverlayMouseUp}
                onMouseLeave={handleOverlayMouseUp}
            />
            {/* Selection box */}
            <div style={getSelectionBoxStyle()} />
            {/* Wrap ForceGraph2D to ensure proper z-stacking with overlay */}
            <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
            <ForceGraph2D
                ref={graphRef}
                graphData={graphData}
                width={dimensions.width}
                height={dimensions.height}
                autoPauseRedraw={false}
                nodeColor={getNodeColor}
                nodeCanvasObject={nodeCanvasObject}
                nodeCanvasObjectMode={nodeCanvasObjectMode}
                nodeRelSize={effectiveNodeRelSize}
                nodeLabel={getNodeLabel}
                linkColor={getLinkColor}
                linkWidth={getLinkWidth}
                linkDirectionalParticles={getLinkParticles}
                linkDirectionalParticleWidth={getLinkParticleWidth}
                linkDirectionalParticleSpeed={linkDirectionalParticleSpeed}
                onNodeClick={handleNodeClick}
                onNodeDragEnd={handleNodeDragEnd}
                onBackgroundClick={handleBackgroundClick}
                onNodeRightClick={handleNodeRightClick}
                enableZoomInteraction={enableZoom !== false}
                enablePanInteraction={enablePan !== false}
                enableNodeDrag={effectiveEnableNodeDrag}
                cooldownTicks={effectiveCooldownTicks}
                d3AlphaDecay={effectiveAlphaDecay}
                d3VelocityDecay={effectiveVelocityDecay}
                linkDirectionalArrowLength={linkDirectionalArrowLength}
                linkDirectionalArrowRelPos={linkDirectionalArrowRelPos}
                onEngineStop={handleEngineStop}
                onRenderFramePost={handleRenderFramePost}
            />
            </div>
        </div>
    );
};

ForceGraph.defaultProps = {
    nodes: [],
    links: [],
    selectedNodes: [],
    enableZoom: true,
    enablePan: true,
    enableNodeDrag: true,
    cooldownTicks: 100,
    mode: 'interactive',
    chargeStrength: -50,
    linkDistance: 30,
    collisionRadius: null,
    d3AlphaDecay: 0.0228,
    d3VelocityDecay: 0.4,
    nodeRelSize: 6,
    selectedColor: '#ffd93d',
    linkColor: 'rgba(150, 150, 150, 0.2)',
    linkWidth: 0.5,
    linkDirectionalArrowLength: 0,
    linkDirectionalArrowRelPos: 0.5,
    linkDirectionalParticleSpeed: 0.009,
    boxSelectColor: '#1a73e8',
    showNeighborLabels: false,
    labelFontSize: 10,
    fitView: false,
};

export default ForceGraph;
