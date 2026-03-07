import React, { useRef, useEffect, useCallback, useState } from 'react';
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
        boxSelectColor,
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

    // Update graph data when nodes/links change
    useEffect(() => {
        const nodesCopy = (nodes || []).map(n => ({ ...n }));
        const linksCopy = (links || []).map(l => ({ ...l }));
        setGraphData({ nodes: nodesCopy, links: linksCopy });
    }, [nodes, links]);

    // Sync selection from props
    useEffect(() => {
        setSelectedSet(new Set(selectedNodes || []));
    }, [selectedNodes]);

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

    // Configure force simulation
    useEffect(() => {
        const timer = setTimeout(() => {
            if (graphRef.current) {
                const fg = graphRef.current;

                const effectiveCharge = isPerformance
                    ? Math.max(chargeStrength * 0.6, -30)
                    : chargeStrength;
                fg.d3Force('charge', d3.forceManyBody().strength(effectiveCharge));

                if (linkDistance != null) {
                    fg.d3Force('link', d3.forceLink().distance(linkDistance));
                }

                if (collisionRadius != null) {
                    fg.d3Force('collision', d3.forceCollide(collisionRadius));
                } else {
                    fg.d3Force('collision', null);
                }

                fg.d3ReheatSimulation();
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
            if (newSet.has(node.id)) {
                newSet.delete(node.id);
            } else {
                newSet.add(node.id);
            }
            newSelected = Array.from(newSet);
        } else if (shiftKey) {
            const newSet = new Set(selectedSet);
            newSet.add(node.id);
            newSelected = Array.from(newSet);
        } else {
            newSelected = [node.id];
        }

        setSelectedSet(new Set(newSelected));
        if (setProps) {
            setProps({ selectedNodes: newSelected });
        }
    }, [selectedSet, setProps]);

    // Background click - clear selection (only if not box selecting)
    const handleBackgroundClick = useCallback((event) => {
        if (isBoxSelecting) return;
        setSelectedSet(new Set());
        if (setProps) {
            setProps({ selectedNodes: [] });
        }
    }, [setProps, isBoxSelecting]);

    // Right-click handler for context menu
    const handleNodeRightClick = useCallback((node, event) => {
        if (!node) return;
        if (event?.preventDefault) {
            event.preventDefault();
        }
        if (setProps) {
            setProps({
                rightClickedNode: node.id,
                rightClickPosition: {
                    x: event?.clientX || 0,
                    y: event?.clientY || 0
                }
            });
        }
    }, [setProps]);

    // Node color function
    const getNodeColor = useCallback((node) => {
        if (selectedSet.has(node.id)) {
            return selectedColor;
        }
        if (node.color) {
            return node.color;
        }
        return nodeColor || null;
    }, [selectedSet, selectedColor, nodeColor]);

    // Node label
    const getNodeLabel = useCallback((node) => {
        return node.label || node.id;
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

    // Determine effective prop values based on mode
    const effectiveEnableNodeDrag = isPerformance ? false : (enableNodeDrag !== false);
    const effectiveNodeRelSize = isPerformance ? nodeRelSize * 0.67 : nodeRelSize;
    const effectiveLinkWidth = isPerformance ? linkWidth * 0.6 : linkWidth;
    const effectiveLinkColor = isPerformance ? 'rgba(150, 150, 150, 0.1)' : linkColor;
    const effectiveCooldownTicks = isPerformance ? 200 : cooldownTicks;
    const effectiveAlphaDecay = isPerformance ? 0.01 : d3AlphaDecay;
    const effectiveVelocityDecay = isPerformance ? 0.15 : d3VelocityDecay;

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
                nodeColor={getNodeColor}
                nodeRelSize={effectiveNodeRelSize}
                nodeLabel={getNodeLabel}
                linkColor={() => effectiveLinkColor}
                linkWidth={effectiveLinkWidth}
                onNodeClick={handleNodeClick}
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
    boxSelectColor: '#1a73e8',
};

export default ForceGraph;
