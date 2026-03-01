import { useCallback, useMemo, useState, createContext, useContext, useEffect } from 'react';
import {
    ReactFlow,
    Controls,
    ControlButton,
    useNodesState,
    useEdgesState,
    addEdge,
    Handle,
    Position,
    BaseEdge,
    getBezierPath,
    EdgeLabelRenderer,
    applyNodeChanges,
    applyEdgeChanges,
    useReactFlow,
    Panel
} from '@xyflow/react';
import type { NodeChange, EdgeChange, Connection, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { BookOpen, Edit3, X, FileText, Plus, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Papa from 'papaparse';

const CSV_URL = "https://docs.google.com/spreadsheets/d/1mtEcx9uYqE-lL8ny5aFtgvdwWwzFEBpABP7Wldm9Sow/export?format=csv";
const USERS_CSV_URL = "https://docs.google.com/spreadsheets/d/1mtEcx9uYqE-lL8ny5aFtgvdwWwzFEBpABP7Wldm9Sow/gviz/tq?tqx=out:csv&sheet=Users";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz05s-YbGypPPBykcw4ltjGhq6Sgixa1yDwmkllBFf7ltXXyE0pO9jSVs5pnl-ez2Ym/exec";

const CircleNode = ({ data }: any) => {
    return (
        <div className="custom-node-circle">
            <div className="node-content" style={{ fontWeight: 'bold' }}>{data.label}</div>
            <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
        </div>
    );
};

const GroupNode = ({ data }: any) => {
    return (
        <div className="custom-node-group">
            <div className="node-group-header" style={{ position: 'absolute', top: data.small ? '-16px' : '-22px', left: '-1px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: data.small ? '0.55rem' : '0.85rem', padding: '0px' }}>{data.label}</div>
        </div>
    );
};

const BoxNode = ({ data }: any) => {
    const renderHandlesGroup = (
        position: Position,
        items: { type: 'target' | 'source', weight: number, idPrefix: string, index: number }[]
    ) => {
        if (!items || !items.length) return null;

        const isVertical = position === Position.Top || position === Position.Bottom;

        const totalSpan = items.reduce((sum, item) => sum + (item.weight < 0 ? Math.abs(item.weight) : Math.max(3, item.weight * 0.8)), 0);
        let currentOffset = -totalSpan / 2;

        return items.map((item) => {
            const isGap = item.weight < 0;
            const thickness = isGap ? Math.abs(item.weight) : Math.max(3, item.weight * 0.8);
            const offset = currentOffset + thickness / 2;
            currentOffset += thickness;

            if (isGap) return null;

            const style: React.CSSProperties = { opacity: 0 };
            if (isVertical) {
                // Horizontal stacking for top/bottom handles
                style.left = `calc(50% + ${offset}px)`;
                style.top = position === Position.Top ? '12px' : 'auto';
                style.bottom = position === Position.Bottom ? '12px' : 'auto';
            } else {
                // Vertical stacking for left/right handles
                style.top = `calc(50% + ${offset}px)`;
                style.left = position === Position.Left ? '12px' : 'auto';
                style.right = position === Position.Right ? '12px' : 'auto';
            }

            return (
                <Handle
                    key={`${item.idPrefix}-${item.index}`}
                    id={`${item.idPrefix}-${item.index}`}
                    type={item.type}
                    position={position}
                    style={style}
                />
            );
        });
    };

    const leftItems: any[] = [];
    const rightItems: any[] = [];

    if (data.reverseHandleOrder) {
        // Pressured (target) on top
        (data.tWeights || []).forEach((w: number, i: number) => leftItems.push({ type: 'target', weight: w, idPrefix: 't', index: i }));
        if (data.tWeights?.length > 0 && data.slWeights?.length > 0) {
            leftItems.push({ type: 'source', weight: -5, idPrefix: 'gap_l', index: 0 });
        }
        (data.slWeights || []).forEach((w: number, i: number) => leftItems.push({ type: 'source', weight: w, idPrefix: 'sl', index: i }));

        (data.trWeights || []).forEach((w: number, i: number) => rightItems.push({ type: 'target', weight: w, idPrefix: 'tr', index: i }));
        if (data.trWeights?.length > 0 && data.sWeights?.length > 0) {
            rightItems.push({ type: 'target', weight: -5, idPrefix: 'gap_r', index: 0 });
        }
        (data.sWeights || []).forEach((w: number, i: number) => rightItems.push({ type: 'source', weight: w, idPrefix: 's', index: i }));
    } else {
        // Pressurer (source) on top
        (data.slWeights || []).forEach((w: number, i: number) => leftItems.push({ type: 'source', weight: w, idPrefix: 'sl', index: i }));
        if (data.slWeights?.length > 0 && data.tWeights?.length > 0) {
            leftItems.push({ type: 'source', weight: -5, idPrefix: 'gap_l', index: 0 });
        }
        (data.tWeights || []).forEach((w: number, i: number) => leftItems.push({ type: 'target', weight: w, idPrefix: 't', index: i }));

        (data.trWeights || []).forEach((w: number, i: number) => rightItems.push({ type: 'target', weight: w, idPrefix: 'tr', index: i }));
        if (data.trWeights?.length > 0 && data.sWeights?.length > 0) {
            rightItems.push({ type: 'target', weight: -5, idPrefix: 'gap_r', index: 0 });
        }
        (data.sWeights || []).forEach((w: number, i: number) => rightItems.push({ type: 'source', weight: w, idPrefix: 's', index: i }));
    }

    const bottomItems: any[] = [];
    (data.sbWeights || []).forEach((w: number, i: number) => bottomItems.push({ type: 'source', weight: w, idPrefix: 'sb', index: i }));
    if (data.sbWeights?.length > 0 && data.btWeights?.length > 0) {
        bottomItems.push({ type: 'target', weight: -5, idPrefix: 'gap_b', index: 0 });
    }
    (data.btWeights || []).forEach((w: number, i: number) => bottomItems.push({ type: 'target', weight: w, idPrefix: 'bt', index: i }));

    const topItems: any[] = [];
    (data.stWeights || []).forEach((w: number, i: number) => topItems.push({ type: 'source', weight: w, idPrefix: 'st', index: i }));
    if (data.stWeights?.length > 0 && data.ttWeights?.length > 0) {
        topItems.push({ type: 'target', weight: -5, idPrefix: 'gap_t', index: 0 });
    }
    (data.ttWeights || []).forEach((w: number, i: number) => topItems.push({ type: 'target', weight: w, idPrefix: 'tt', index: i }));

    return (
        <div className={data.lighter ? "custom-node-box lighter" : "custom-node-box"}>
            {renderHandlesGroup(Position.Left, leftItems)}
            {renderHandlesGroup(Position.Right, rightItems)}
            {renderHandlesGroup(Position.Bottom, bottomItems)}
            {renderHandlesGroup(Position.Top, topItems)}
            <div className="node-content">{data.label}</div>
        </div>
    );
};

const SplitPointNode = () => {
    return (
        <div
            style={{
                width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#60a5fa',
                border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', cursor: 'move'
            }}
            title="Drag to move the line split point"
        >
            <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
            <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
        </div>
    );
};


const DiagramContext = createContext<{
    isEditingEdges: boolean;
    updateEdgeControlPoint: (id: string, x: number, y: number) => void;
    updateEdgeSplitPoint?: (id: string, type: 'split' | 'merge', x: number) => void;
    setActiveEdgeData?: (data: any) => void;
    activeEdgeId?: string | null;
    setActiveEdgeId?: (id: string | null) => void;
} | null>(null);

const CustomEdge = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    data,
    markerEnd,
}: any) => {
    const [isHovered, setIsHovered] = useState(false);
    const { screenToFlowPosition } = useReactFlow();
    const diagramContext = useContext(DiagramContext);
    const isEditingEdges = diagramContext?.isEditingEdges || false;

    const [defaultPath, defaultLabelX, defaultLabelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    let edgePath = defaultPath;
    let labelX = defaultLabelX;
    let labelY = defaultLabelY;

    let currentSplitX = sourceX;
    let currentMergeX = targetX;
    let isHorizontal = false;

    if (data?._verticalLane) {
        // Vertical same-column connections: snap both endpoints to a shared centerX
        // so the arc is perfectly symmetric (equal gap at top and bottom).
        // 'left' arcs to the left, 'right' arcs to the right, no crossing.
        const centerX = (sourceX + targetX) / 2;
        const nudge = data._verticalLane === 'left' ? -20 : 20;
        const midY = (sourceY + targetY) / 2;
        const cx = data?.controlPoint ? data.controlPoint.x : centerX + nudge;
        edgePath = `M ${centerX},${sourceY} Q ${cx},${midY} ${centerX},${targetY}`;
        labelX = 0.25 * centerX + 0.5 * cx + 0.25 * centerX;
        labelY = 0.25 * sourceY + 0.5 * midY + 0.25 * targetY;
    } else {
        isHorizontal = true;
        const trunkLen = 45;
        const dx = targetX - sourceX;
        const dir = dx > 0 ? 1 : -1;

        let defaultSplitX = sourceX + dir * trunkLen;
        let defaultMergeX = targetX - dir * trunkLen;

        const curveWidth = 100;
        if (Math.abs(dx) > trunkLen * 2 + curveWidth) {
            // Add a slight staggered offset so multiple lines to the same target don't exactly overlap their waypoints
            const edgeIdx = data?.index || 0;
            const stagger = (((sourceX + sourceY * 2) % 60) + (edgeIdx * 15)) % 80;
            if (dx > 0) {
                // Left to Right (e.g., Media -> Gov), turn near Gov
                defaultMergeX = targetX - (60 + stagger);
                defaultSplitX = defaultMergeX - curveWidth;
            } else {
                // Right to Left (e.g., Gov -> Media), turn near Gov
                defaultSplitX = sourceX - (60 + stagger);
                defaultMergeX = defaultSplitX - curveWidth;
            }
        }

        currentSplitX = data?.splitX !== undefined ? data.splitX : defaultSplitX;
        currentMergeX = data?.mergeX !== undefined ? data.mergeX : defaultMergeX;
        const curveMidX = (currentSplitX + currentMergeX) / 2;

        if (Math.abs(targetY - sourceY) < 1) {
            edgePath = `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
        } else {
            edgePath = [
                `M ${sourceX},${sourceY}`,
                `L ${currentSplitX},${sourceY}`,
                `C ${curveMidX},${sourceY} ${curveMidX},${targetY} ${currentMergeX},${targetY}`,
                `L ${targetX},${targetY}`
            ].join(' ');
        }
        labelX = curveMidX;
        labelY = (sourceY + targetY) / 2;
    }

    const papers = data?.papers || 1;
    const strokeWidth = Math.max(3, papers * 0.8);
    const pathCount = data?.pathsData ? Object.keys(data.pathsData).length : 1;
    const hasMultiplePaths = pathCount > 1;

    return (
        <g
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={(e) => {
                if (isEditingEdges && diagramContext?.setActiveEdgeId) {
                    e.stopPropagation();
                    diagramContext.setActiveEdgeId(id);
                } else if (!isEditingEdges && diagramContext?.setActiveEdgeData) {
                    e.stopPropagation();
                    diagramContext.setActiveEdgeData(data);
                }
            }}
            style={{ cursor: 'pointer' }}
        >
            <defs>
                <linearGradient
                    id={`gradient-${id}`}
                    gradientUnits="userSpaceOnUse"
                    x1={sourceX}
                    y1={sourceY}
                    x2={targetX}
                    y2={targetY}
                >
                    <stop offset="0%" stopColor={data?.startColor || '#94a3b8'} />
                    <stop offset="100%" stopColor={data?.endColor || '#94a3b8'} />
                </linearGradient>
            </defs>
            <BaseEdge
                path={edgePath}
                markerEnd={markerEnd}
                style={{
                    ...style,
                    strokeWidth,
                    stroke: `url(#gradient-${id})`,
                    opacity: 0.9,
                    transition: 'stroke-width 0.3s',
                    filter: hasMultiplePaths ? 'drop-shadow(0px 1px 1px rgba(244, 63, 94, 0.7))' : 'none'
                }}
                interactionWidth={20}
            />
            {
                (isHovered && data?.papers && !isEditingEdges) && (
                    <EdgeLabelRenderer>
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                if (diagramContext?.setActiveEdgeData) {
                                    diagramContext.setActiveEdgeData(data);
                                }
                            }}
                            style={{
                                position: 'absolute',
                                transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                                pointerEvents: 'all',
                                background: 'white',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                border: '1px solid #d1d5db',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
                                color: '#374151',
                                fontWeight: 600,
                                zIndex: 1000,
                                cursor: 'pointer'
                            }}
                            className="nodrag nopan"
                        >
                            {data?.pathway && data.pathway !== 'Unspecified Strategy'
                                ? `${data.sourceName} influencing ${data.targetName} through ${data.pathway}: ${papers} ${papers === 1 ? 'paper' : 'papers'}`
                                : `${data?.sourceName} influencing ${data?.targetName}: ${papers} ${papers === 1 ? 'paper' : 'papers'}`
                            }
                        </div>
                    </EdgeLabelRenderer>
                )
            }
            {
                isEditingEdges && isHorizontal && diagramContext?.activeEdgeId === id && (
                    <EdgeLabelRenderer>
                        <div
                            style={{
                                position: 'absolute',
                                transform: `translate(-50%, -50%) translate(${currentSplitX}px,${sourceY}px)`,
                                pointerEvents: 'all',
                                cursor: 'ew-resize',
                                width: '12px',
                                height: '12px',
                                backgroundColor: '#ef4444',
                                border: '2px solid white',
                                borderRadius: '50%',
                                zIndex: 2000,
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            }}
                            className="nodrag nopan"
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const handleMouseMove = (moveEvent: any) => {
                                    moveEvent.preventDefault();
                                    const pos = screenToFlowPosition({ x: moveEvent.clientX, y: moveEvent.clientY });
                                    diagramContext?.updateEdgeSplitPoint?.(id, 'split', pos.x);
                                };
                                const handleMouseUp = () => {
                                    window.removeEventListener('mousemove', handleMouseMove);
                                    window.removeEventListener('mouseup', handleMouseUp);
                                };
                                window.addEventListener('mousemove', handleMouseMove);
                                window.addEventListener('mouseup', handleMouseUp);
                            }}
                        />
                        <div
                            style={{
                                position: 'absolute',
                                transform: `translate(-50%, -50%) translate(${currentMergeX}px,${targetY}px)`,
                                pointerEvents: 'all',
                                cursor: 'ew-resize',
                                width: '12px',
                                height: '12px',
                                backgroundColor: '#ef4444',
                                border: '2px solid white',
                                borderRadius: '50%',
                                zIndex: 2000,
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            }}
                            className="nodrag nopan"
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const handleMouseMove = (moveEvent: any) => {
                                    moveEvent.preventDefault();
                                    const pos = screenToFlowPosition({ x: moveEvent.clientX, y: moveEvent.clientY });
                                    diagramContext?.updateEdgeSplitPoint?.(id, 'merge', pos.x);
                                };
                                const handleMouseUp = () => {
                                    window.removeEventListener('mousemove', handleMouseMove);
                                    window.removeEventListener('mouseup', handleMouseUp);
                                };
                                window.addEventListener('mousemove', handleMouseMove);
                                window.addEventListener('mouseup', handleMouseUp);
                            }}
                        />
                    </EdgeLabelRenderer>
                )
            }

        </g >
    );
};

// Node mappings from CSV names to internal IDs
const nodeMap: Record<string, string> = {
    'Media:Legacy': 'media_legacy',
    'Media:Social': 'media_social',
    'Media': 'media_legacy', // Fallback
    'Government': 'gov',
    'People': 'people',
    'Society': 'people', // Fallback
    'Powerbroker:Foreign': 'pb_foreign',
    'Powerbroker:Domestic': 'pb_domestic',
    'Foreign Govt': 'pb_foreign',
    'Domestic Govt': 'pb_domestic'
};

// Helper to format names like "Media:Legacy" into "Legacy Media"
const formatNodeName = (name: string) => {
    if (!name) return '';
    if (name.includes(':')) {
        const parts = name.split(':');
        if (parts.length === 2) {
            return `${parts[1]} ${parts[0]}`;
        }
    }
    return name;
};

// Constant for the padding/buffer inside the Box Groups (Media and Powerbrokers)
export const GROUP_PADDING = 5;

// Saved edge waypoints from user layout export
const SAVED_EDGE_WAYPOINTS: Record<string, { splitX?: number; mergeX?: number; controlPoint?: { x: number; y: number } }> = {
    'e-media_legacy-people-Slant': { splitX: 494.04, mergeX: 553.35 },
    'e-gov-media_legacy-War_Diffusion': { splitX: 882.68, mergeX: 747.03 },
    'e-people-gov-Unspecified_Strategy': { splitX: 846.39, mergeX: 906.59 },
    'e-media_legacy-people-Unspecified_Strategy': { splitX: 480.76, mergeX: 538.30 },
    'e-people-media_legacy-Unspecified_Strategy': { splitX: 633.03, mergeX: 516.17 },
    'e-gov-media_legacy-Dead_Cat': { splitX: 938.46, mergeX: 815.40 },
    'e-media_social-people-Unspecified_Strategy': { splitX: 582.57, mergeX: 625.95 },
    'e-gov-media_legacy-Flooding_Zone': { splitX: 914.72 },
    'e-pb_foreign-media_social-Unspecified_Strategy': { splitX: 633.03, mergeX: 509.09 },
    'e-gov-people-Unilateral_actions': { splitX: 919.42, mergeX: 805.70 },
    'e-gov-media_social-Unspecified_Strategy': { splitX: 933.84, mergeX: 816.54 },
    'e-media_social-gov-Unspecified_Strategy': { splitX: 828.68, mergeX: 914.55 },
    'e-media_legacy-gov-Unspecified_Strategy': { splitX: 747.23, mergeX: 919.86 },
    'e-pb_domestic-media_legacy-Unspecified_Strategy': { splitX: 621.52, mergeX: 496.70 },
};

const baseNodesTemplate: Node[] = [
    { id: 'powerbroker_group', type: 'group', data: { label: 'POWERBROKERS', small: true }, position: { x: 633.53, y: 356.19 }, style: { width: 90, height: 77 }, zIndex: 0 },
    { id: 'pb_domestic', type: 'box', data: { label: 'Domestic', tWeights: [], slWeights: [], sWeights: [], lighter: true }, position: { x: GROUP_PADDING, y: GROUP_PADDING }, parentId: 'powerbroker_group', zIndex: 10 },
    { id: 'pb_foreign', type: 'box', data: { label: 'Foreign', tWeights: [], slWeights: [], sWeights: [], lighter: true }, position: { x: GROUP_PADDING, y: 41 }, parentId: 'powerbroker_group', zIndex: 10 },
    { id: 'media_group', type: 'group', data: { label: 'MEDIA' }, position: { x: 340, y: 220 }, style: { width: 130, height: 134 }, zIndex: 0 },
    { id: 'media_legacy', type: 'box', data: { label: 'Legacy', tWeights: [], sWeights: [], trWeights: [], reverseHandleOrder: true }, position: { x: GROUP_PADDING, y: GROUP_PADDING }, parentId: 'media_group', zIndex: 10 },
    { id: 'media_social', type: 'box', data: { label: 'Social', tWeights: [], sWeights: [], trWeights: [] }, position: { x: GROUP_PADDING, y: 88 }, parentId: 'media_group', zIndex: 10 },
    { id: 'people', type: 'box', data: { label: 'People', tWeights: [], sWeights: [], trWeights: [], reverseHandleOrder: true }, position: { x: 649.72, y: 265 }, zIndex: 10 },
    { id: 'gov', type: 'box', data: { label: 'Government', tWeights: [], sWeights: [], slWeights: [] }, position: { x: 954.79, y: 265 }, zIndex: 10 },
];

function App() {
    const [nodes, setNodes] = useNodesState(baseNodesTemplate);
    const [edges, setEdges] = useEdgesState<Edge>([]);
    const [isEditingEdges, setIsEditingEdges] = useState(false);
    const [isAddingRecord, setIsAddingRecord] = useState(false);
    const [activeEdgeData, setActiveEdgeData] = useState<any>(null);
    const [activeEdgeId, setActiveEdgeId] = useState<string | null>(null);
    const [authorStats, setAuthorStats] = useState<{ name: string; count: number }[]>([]);
    const [userMap, setUserMap] = useState<Record<string, string>>({});
    const [usersList, setUsersList] = useState<{ email: string, name: string }[]>([]);
    const [uniqueNodes, setUniqueNodes] = useState<string[]>([]);
    const [allPathways, setAllPathways] = useState<Record<string, string[]>>({}); // source-target -> pathways

    const [formData, setFormData] = useState({
        sourceNode: '',
        targetNode: '',
        user: '',
        author: '',
        journal: '',
        year: '',
        relevance: 'Low',
        pathway: '',
        blurb: '',
        newSourceNode: '',
        newTargetNode: '',
        newPathName: ''
    });
    const [file, setFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showNewSourceInput, setShowNewSourceInput] = useState(false);
    const [showNewTargetInput, setShowNewTargetInput] = useState(false);
    const [showNewPathInput, setShowNewPathInput] = useState(false);

    // Dynamic Google Sheets fetching
    useEffect(() => {
        Papa.parse(CSV_URL, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const rows = results.data as any[];
                const groupedEdges: Record<string, any> = {};

                const nodeNames = new Set<string>();
                const pathMap: Record<string, Set<string>> = {};

                // 1. Group rows by Source -> Target path
                rows.forEach((row) => {
                    const rawStart = row['StartNode']?.trim();
                    const rawEnd = row['EndNode']?.trim();
                    if (!rawStart || !rawEnd) return;

                    nodeNames.add(rawStart);
                    nodeNames.add(rawEnd);

                    const sourceId = nodeMap[rawStart];
                    const targetId = nodeMap[rawEnd];
                    if (!sourceId || !targetId) return; // Skip unknown nodes
                    const pathway = row['Pathway']?.trim() || 'Unspecified Strategy';
                    const edgeId = `e-${sourceId}-${targetId}-${pathway.replace(/\s+/g, '_')}`;

                    const comboKey = `${sourceId}|||${targetId}`;
                    if (!pathMap[comboKey]) pathMap[comboKey] = new Set();

                    if (!groupedEdges[edgeId]) {
                        groupedEdges[edgeId] = {
                            id: edgeId, source: sourceId, target: targetId, type: 'custom',
                            data: {
                                papers: 0,
                                startColor: '#1e3a8a',
                                endColor: '#60a5fa',
                                papersList: [],
                                sourceName: formatNodeName(rawStart),
                                targetName: formatNodeName(rawEnd),
                                pathsData: {},
                                index: 0,
                                pathway
                            }
                        };
                    }
                    if (pathway !== 'Unspecified Strategy') pathMap[comboKey].add(pathway);

                    groupedEdges[edgeId].data.papers += 1;
                    groupedEdges[edgeId].data.papersList.push(row);
                    if (!groupedEdges[edgeId].data.pathsData[pathway]) {
                        groupedEdges[edgeId].data.pathsData[pathway] = { count: 0, papers: [] };
                    }
                    groupedEdges[edgeId].data.pathsData[pathway].count += 1;
                    groupedEdges[edgeId].data.pathsData[pathway].papers.push(row);
                });

                setUniqueNodes(Array.from(nodeNames).sort());
                const finalPaths: Record<string, string[]> = {};
                Object.entries(pathMap).forEach(([k, v]) => finalPaths[k] = Array.from(v).sort());
                setAllPathways(finalPaths);

                // 2. Absolute X lookup per node (for grouped nodes, add parent offset)
                //    This lets us pick the nearest/shortest side automatically.
                const nodeAbsX: Record<string, number> = {
                    powerbroker_group: 634, pb_domestic: 634 + GROUP_PADDING, pb_foreign: 634 + GROUP_PADDING,
                    media_group: 340, media_legacy: 340 + GROUP_PADDING, media_social: 340 + GROUP_PADDING,
                    people: 650, gov: 955,
                };
                const nodeAbsY: Record<string, number> = {
                    powerbroker_group: 356, pb_domestic: 356 + GROUP_PADDING, pb_foreign: 356 + 41,
                    media_group: 220, media_legacy: 220 + GROUP_PADDING, media_social: 220 + 88,
                    people: 265, gov: 265,
                };

                const edgeList = Object.values(groupedEdges);

                // 3. Determine source/target sides from relative X and Y position:
                //    - Same column (same X ±50): use vertical top/bottom handles
                //    - Source LEFT of target → exits RIGHT (s), enters LEFT (t)
                //    - Source RIGHT of target → exits LEFT (sl), enters RIGHT (tr)
                edgeList.forEach((edge: any) => {
                    const srcX = nodeAbsX[edge.source] ?? 500;
                    const tgtX = nodeAbsX[edge.target] ?? 500;
                    const srcY = nodeAbsY[edge.source] ?? 200;
                    const tgtY = nodeAbsY[edge.target] ?? 200;
                    const sameColumn = Math.abs(srcX - tgtX) < 50;

                    if (sameColumn) {
                        if (srcY <= tgtY) {
                            edge._sourceSide = 'sb';
                            edge._targetSide = 'tt';
                            edge.data._verticalLane = 'left'; // nudge left in CustomEdge using real sourceX
                        } else {
                            edge._sourceSide = 'st';
                            edge._targetSide = 'bt';
                            edge.data._verticalLane = 'right'; // nudge right
                        }
                    } else if (srcX <= tgtX) {
                        edge._sourceSide = 's';
                        edge._targetSide = 't';
                    } else {
                        edge._sourceSide = 'sl';
                        edge._targetSide = 'tr';
                    }
                });

                // 4. Sort edges to minimize crossings, then assign sequential handle indices
                //    For SOURCE handles: sort by target Y
                //    For TARGET handles: sort by source Y
                const parsedNodes: any[] = JSON.parse(JSON.stringify(baseNodesTemplate));

                const edgesBySourceSide: Record<string, any[]> = {};
                const edgesByTargetSide: Record<string, any[]> = {};
                edgeList.forEach((edge: any) => {
                    const sk = `${edge.source}_${edge._sourceSide}`;
                    const tk = `${edge.target}_${edge._targetSide}`;
                    if (!edgesBySourceSide[sk]) edgesBySourceSide[sk] = [];
                    edgesBySourceSide[sk].push(edge);
                    if (!edgesByTargetSide[tk]) edgesByTargetSide[tk] = [];
                    edgesByTargetSide[tk].push(edge);
                });

                Object.values(edgesBySourceSide).forEach((edges) => {
                    edges.sort((a: any, b: any) => {
                        const yDiff = (nodeAbsY[a.target] ?? 200) - (nodeAbsY[b.target] ?? 200);
                        if (yDiff !== 0) return yDiff;

                        // If same Y, sort by distance ascending (closer targets get top handles)
                        const srcX = nodeAbsX[a.source] ?? 500;
                        const distA = Math.abs((nodeAbsX[a.target] ?? 500) - srcX);
                        const distB = Math.abs((nodeAbsX[b.target] ?? 500) - srcX);
                        if (distA !== distB) return distA - distB;

                        // For same-target lines, sort by pathway name in edge ID to ensure parallel paths
                        return a.id.localeCompare(b.id);
                    });
                    edges.forEach((edge: any, idx: number) => {
                        edge.sourceHandle = `${edge._sourceSide}-${idx}`;
                        edge.data = { ...edge.data, index: idx };
                    });
                });

                Object.values(edgesByTargetSide).forEach((edges) => {
                    edges.sort((a: any, b: any) => {
                        const yDiff = (nodeAbsY[a.source] ?? 200) - (nodeAbsY[b.source] ?? 200);
                        if (yDiff !== 0) return yDiff;

                        // For items in the same column, we must ensure indices match source indices
                        // to prevent crossings. Using strictly alphabetical edge IDs.
                        return a.id.localeCompare(b.id);
                    });
                    edges.forEach((edge: any, idx: number) => {
                        edge.targetHandle = `${edge._targetSide}-${idx}`;
                    });
                });

                // 5. Build per-node weight arrays
                const weightByNodeSide: Record<string, number[]> = {};
                Object.entries(edgesBySourceSide).forEach(([key, edges]) => {
                    weightByNodeSide[key] = edges.map((e: any) => e.data.papers);
                });
                Object.entries(edgesByTargetSide).forEach(([key, edges]) => {
                    weightByNodeSide[key] = edges.map((e: any) => e.data.papers);
                });

                parsedNodes.forEach((node: any) => {
                    node.data.sWeights = weightByNodeSide[`${node.id}_s`] || [];
                    node.data.tWeights = weightByNodeSide[`${node.id}_t`] || [];
                    node.data.slWeights = weightByNodeSide[`${node.id}_sl`] || [];
                    node.data.trWeights = weightByNodeSide[`${node.id}_tr`] || [];
                    node.data.sbWeights = weightByNodeSide[`${node.id}_sb`] || [];
                    node.data.ttWeights = weightByNodeSide[`${node.id}_tt`] || [];
                    node.data.stWeights = weightByNodeSide[`${node.id}_st`] || [];
                    node.data.btWeights = weightByNodeSide[`${node.id}_bt`] || [];
                });

                // Apply saved edge waypoints
                edgeList.forEach((edge: any) => {
                    const saved = SAVED_EDGE_WAYPOINTS[edge.id];
                    if (saved) {
                        edge.data = { ...edge.data, ...saved };
                    }
                });

                setNodes(parsedNodes);
                setEdges(edgeList);
            },
            error: (error) => { console.error("Error reading CSV:", error); }
        });

        // Fetch Users sheet in parallel to build email->name map, then count unique papers
        Papa.parse(USERS_CSV_URL, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (usersResult) => {
                const usersRows = usersResult.data as any[];
                const emailToName: Record<string, string> = {};
                const uList: { email: string, name: string }[] = [];
                usersRows.forEach((u) => {
                    const email = u['Email']?.trim().replace(/^"|"$/g, '');
                    const name = u['Name']?.trim().replace(/^"|"$/g, '');
                    if (email && name) {
                        emailToName[email] = name;
                        uList.push({ email, name });
                    }
                });
                setUserMap(emailToName);
                setUsersList(uList);

                // Now count unique filenames per user from the main CSV
                Papa.parse(CSV_URL, {
                    download: true,
                    header: true,
                    skipEmptyLines: true,
                    complete: (dataResult) => {
                        const rows = dataResult.data as any[];
                        const uniqueFilesPerUser: Record<string, Set<string>> = {};

                        rows.forEach((row) => {
                            const email = row['User']?.trim();
                            const filename = row['Filename']?.trim();
                            if (!email || !filename) return;
                            if (!uniqueFilesPerUser[email]) uniqueFilesPerUser[email] = new Set();
                            uniqueFilesPerUser[email].add(filename);
                        });

                        const stats = Object.entries(uniqueFilesPerUser)
                            .map(([email, files]) => ({
                                name: emailToName[email] || email.split('@')[0],
                                count: files.size
                            }))
                            .sort((a, b) => b.count - a.count);

                        setAuthorStats(stats);
                    }
                });
            }
        });
    }, []);

    // updateEdgeControlPoint
    const updateEdgeControlPoint = useCallback((id: string, x: number, y: number) => {
        setEdges((eds) =>
            eds.map((e) => {
                if (e.id === id) {
                    return { ...e, data: { ...e.data, controlPoint: { x, y } } };
                }
                return e;
            })
        );
    }, [setEdges]);

    // updateEdgeSplitPoint
    const updateEdgeSplitPoint = useCallback((id: string, type: 'split' | 'merge', x: number) => {
        setEdges((eds) =>
            eds.map((e) => {
                if (e.id === id) {
                    const newData = { ...e.data };
                    if (type === 'split') newData.splitX = x;
                    if (type === 'merge') newData.mergeX = x;
                    return { ...e, data: newData };
                }
                return e;
            })
        );
    }, [setEdges]);

    const nodeTypes = useMemo(() => ({
        circle: CircleNode,
        group: GroupNode,
        box: BoxNode,
        splitPoint: SplitPointNode
    }), []);

    const edgeTypes = useMemo(() => ({
        custom: CustomEdge
    }), []);

    // Auto-select first edge when enabling editor
    useEffect(() => {
        if (isEditingEdges && edges.length > 0 && !activeEdgeId) {
            setActiveEdgeId(edges[0].id);
        }
    }, [isEditingEdges, edges, activeEdgeId]);

    const onNodesChange = useCallback(
        (changes: NodeChange[]) => setNodes((nds) => {
            const updatedChanges = changes.map((change) => {
                // Handle constrained movements
                if (change.type === 'position') {
                    // Lock Y-axis for media group only (People/Gov Y is set dynamically below)
                    if (change.id === 'media_group') {
                        if (change.position) {
                            const node = nds.find((n) => n.id === change.id);
                            if (node) {
                                change.position.y = node.position.y;
                            }
                        }
                    }
                    // People and Gov: lock Y (set dynamically), allow X
                    if (['people', 'gov'].includes(change.id as string)) {
                        if (change.position) {
                            const node = nds.find((n) => n.id === change.id);
                            if (node) {
                                change.position.y = node.position.y; // will be overridden below
                            }
                        }
                    }
                    // Lock X-axis for grouped elements inside
                    if (['media_legacy', 'media_social', 'pb_domestic', 'pb_foreign'].includes(change.id as string)) {
                        if (change.position) {
                            const node = nds.find((n) => n.id === change.id);
                            if (node) {
                                change.position.x = node.position.x;
                                // Prevent moving above the top boundary depending on group sizing
                                if (change.position.y < GROUP_PADDING) {
                                    change.position.y = GROUP_PADDING;
                                }
                            }
                        }
                    }
                }
                return change;
            });

            let appliedNodes = applyNodeChanges(updatedChanges, nds);

            // Auto-resize the parent groups based on their contents dynamically
            const handleResizeGroup = (node1Id: string, node2Id: string, groupId: string, minWidth: number, topPadding: number) => {
                const n1 = appliedNodes.find((n) => n.id === node1Id);
                const n2 = appliedNodes.find((n) => n.id === node2Id);
                if (n1 && n2) {
                    const maxY = Math.max(n1.position.y, n2.position.y);
                    const iG = appliedNodes.findIndex((n) => n.id === groupId);
                    if (iG !== -1) {
                        const newHeight = maxY + topPadding;
                        appliedNodes[iG] = {
                            ...appliedNodes[iG],
                            style: { ...((appliedNodes[iG] as Node).style || {}), height: newHeight, width: minWidth }
                        } as Node;
                    }
                }
            };
            // Box heights: Legacy/Social ~41px, Domestic/Foreign ~31px
            handleResizeGroup('media_legacy', 'media_social', 'media_group', 130, Math.round(41 + GROUP_PADDING));
            handleResizeGroup('pb_domestic', 'pb_foreign', 'powerbroker_group', 90, Math.round(31 + GROUP_PADDING));

            // Dynamically center People and Government Y on the Media group's vertical center
            const mediaGroup = appliedNodes.find((n) => n.id === 'media_group');
            if (mediaGroup) {
                const mediaHeight = ((mediaGroup as any).style?.height as number) || 180;
                const mediaCenterY = mediaGroup.position.y + mediaHeight / 2;
                // Approximate box height for People/Gov nodes is ~44px, center them on mediaCenterY
                const nodeHalfHeight = 22;
                const targetY = mediaCenterY - nodeHalfHeight;

                ['people', 'gov'].forEach((nodeId) => {
                    const idx = appliedNodes.findIndex((n) => n.id === nodeId);
                    if (idx !== -1) {
                        appliedNodes[idx] = {
                            ...appliedNodes[idx],
                            position: { ...appliedNodes[idx].position, y: targetY }
                        } as Node;
                    }
                });
            }

            return appliedNodes;
        }),
        [setNodes]
    );

    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        [setEdges]
    );

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge({ ...params, type: 'custom', data: { papers: 1, startColor: '#38bdf8', endColor: '#1d4ed8' } }, eds)),
        [setEdges]
    );

    const exportLayout = useCallback(() => {
        const nodePositions = nodes.map((n) => ({
            id: n.id,
            position: n.position,
            ...(n.style ? { style: { width: (n.style as any).width, height: (n.style as any).height } } : {})
        }));
        const edgeWaypoints = edges.map((e: any) => ({
            id: e.id,
            ...(e.data?.splitX !== undefined ? { splitX: e.data.splitX } : {}),
            ...(e.data?.mergeX !== undefined ? { mergeX: e.data.mergeX } : {}),
            ...(e.data?.controlPoint !== undefined ? { controlPoint: e.data.controlPoint } : {}),
        })).filter((e) => Object.keys(e).length > 1);
        const output = JSON.stringify({ nodes: nodePositions, edges: edgeWaypoints }, null, 2);
        navigator.clipboard.writeText(output).then(() => {
            alert('Layout copied to clipboard! Paste it in chat.');
        });
    }, [nodes, edges]);

    return (
        <div className="app-container">
            <header className="header" style={{ position: 'relative' }}>
                <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <BookOpen className="header-accent" />
                    <span>
                        Functional effect of media in <span style={{ color: "var(--accent-color)" }}>goverment accountability</span>
                    </span>
                </motion.h1>
            </header>
            <div className="diagram-container" style={{ position: 'relative' }}>
                <DiagramContext.Provider value={{ isEditingEdges, updateEdgeControlPoint, updateEdgeSplitPoint, setActiveEdgeData, activeEdgeId, setActiveEdgeId }}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onPaneClick={() => setActiveEdgeId(null)}
                        nodeTypes={nodeTypes}
                        edgeTypes={edgeTypes}
                        fitView
                        colorMode="light"
                        defaultViewport={{ x: 0, y: 0, zoom: 0.74 }}
                    >
                        <Controls orientation="horizontal">
                            <ControlButton
                                onClick={() => setIsEditingEdges(!isEditingEdges)}
                                title="Toggle Edge Curve Controls"
                            >
                                <Edit3 size={16} color={isEditingEdges ? '#ef4444' : 'currentColor'} />
                            </ControlButton>
                            <ControlButton
                                onClick={() => setIsAddingRecord(true)}
                                title="Add New Record"
                            >
                                <Plus size={16} />
                            </ControlButton>
                            <ControlButton
                                onClick={exportLayout}
                                title="Export Layout (copy node positions & edge waypoints to clipboard)"
                            >
                                <FileText size={16} />
                            </ControlButton>
                        </Controls>
                        {/* Gradient direction legend */}
                        <Panel position="top-right" style={{ background: 'white', padding: '11px 18px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.06)', margin: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                <span style={{ fontSize: '12px', color: '#1e3a8a', fontWeight: 600, whiteSpace: 'nowrap' }}>Pressurer</span>
                                <div style={{
                                    width: '90px', height: '7px', borderRadius: '3px',
                                    background: 'linear-gradient(to right, #1e3a8a, #60a5fa)'
                                }} />
                                <span style={{ fontSize: '12px', color: '#60a5fa', fontWeight: 600, whiteSpace: 'nowrap' }}>Pressured</span>
                            </div>
                        </Panel>
                        <Panel position="bottom-right" style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', width: '280px', margin: '20px', transform: 'scale(0.55)', transformOrigin: 'bottom right' }}>
                            <h3 style={{ margin: '0 0 16px 0', fontSize: '13px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em', fontWeight: 'bold' }}>Papers by Contributor</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {authorStats.length === 0 ? (
                                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>Loading...</div>
                                ) : (
                                    authorStats.map((item, index) => {
                                        const maxCount = authorStats[0].count;
                                        const pct = Math.round((item.count / maxCount) * 100);
                                        return (
                                            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '60px', fontSize: '12px', color: '#4b5563', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                                                <div style={{ flex: 1, backgroundColor: '#f1f5f9', height: '14px', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: index === 0 ? '#0060c5' : '#60a5fa', borderRadius: '4px', transition: 'width 0.6s ease' }} />
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#1e3a8a', fontWeight: 'bold', minWidth: '20px', textAlign: 'right' }}>{item.count}</div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </Panel>
                    </ReactFlow>
                </DiagramContext.Provider>

                {/* Paper Details Interactive Modal Popup */}
                <AnimatePresence>
                    {activeEdgeData && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                position: 'fixed',
                                top: 0, left: 0, right: 0, bottom: 0,
                                backgroundColor: 'rgba(255, 255, 255, 0.4)',
                                backdropFilter: 'blur(8px)',
                                zIndex: 9999,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            onClick={() => setActiveEdgeData(null)}
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    background: 'white',
                                    padding: '32px',
                                    borderRadius: '16px',
                                    width: '650px',
                                    maxHeight: '85vh',
                                    overflowY: 'auto',
                                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0,0,0,0.05)',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', fontWeight: 'bold' }}>
                                            <span style={{ color: '#1e3a8a' }}>{activeEdgeData.sourceName}</span>
                                            <span style={{ color: '#94a3b8' }}>→</span>
                                            <span style={{ color: '#60a5fa' }}>{activeEdgeData.targetName}</span>
                                        </div>
                                        <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 600 }}>Total Papers: {activeEdgeData.papers}</div>
                                    </div>
                                    <button onClick={() => setActiveEdgeData(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
                                </div>

                                {activeEdgeData.pathsData ? Object.entries(activeEdgeData.pathsData).map(([pathName, pathInfo]: any) => (
                                    <div key={pathName} style={{ marginBottom: '24px' }}>
                                        <h3 style={{ margin: '0 0 12px 0', color: '#334155', fontSize: '1.1rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px' }}>
                                            Path: <span style={{ color: '#0f172a' }}>{pathName}</span> <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'normal' }}>({pathInfo.count} papers)</span>
                                        </h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            {pathInfo.papers.map((paper: any, idx: number) => {
                                                const fileId = paper['File ID'];
                                                const paperLink = paper.Link || paper.URL || paper['Link '] || (fileId ? `https://drive.google.com/file/d/${fileId}/view` : null);
                                                return (
                                                    <div key={idx} style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                                                            <div>
                                                                <strong style={{ color: '#0f172a' }}>{paper.Author || 'Unknown Author'}</strong>
                                                                <span style={{ color: '#94a3b8', margin: '0 6px' }}>•</span>
                                                                <span style={{ color: '#0f172a' }}>{paper.Year || 'N/A'}</span>
                                                                <span style={{ color: '#94a3b8', margin: '0 6px' }}>•</span>
                                                                <i style={{ color: '#334155' }}>{paper.Journal || 'Unknown Journal'}</i>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                <span style={{ fontSize: '0.8rem', background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', height: 'fit-content' }}>{paper.Relevance || 'No Rating'}</span>
                                                                {paperLink && (
                                                                    <a href={paperLink} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none', color: 'white', background: '#3b82f6', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                                                                        <FileText size={14} /> View PDF
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <p style={{ margin: '8px 0', fontSize: '0.9rem', color: '#475569', lineHeight: '1.5' }}>
                                                            {paper['Blurb '] || paper['Blurb'] || 'No blurb provided in database.'}
                                                        </p>

                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                                Added by: <strong style={{ color: '#475569' }}>{userMap[paper.User?.trim()] || paper.User?.split('@')[0] || 'Unknown User'}</strong>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )) : null}

                                <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
                {/* Add New Record Modal */}
                <AnimatePresence>
                    {isAddingRecord && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                position: 'fixed',
                                top: 0, left: 0, right: 0, bottom: 0,
                                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                                backdropFilter: 'blur(10px)',
                                zIndex: 10000,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            onClick={() => setIsAddingRecord(false)}
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    background: '#1e293b',
                                    padding: '40px',
                                    borderRadius: '24px',
                                    width: '550px',
                                    maxHeight: '90vh',
                                    overflowY: 'auto',
                                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.1)',
                                    color: 'white'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                                    <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>Add Research Record</h2>
                                    <button onClick={() => setIsAddingRecord(false)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', color: '#94a3b8', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
                                </div>

                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    if (!APPS_SCRIPT_URL) {
                                        alert("Please set the APPS_SCRIPT_URL in the code first.");
                                        return;
                                    }
                                    setIsSubmitting(true);
                                    try {
                                        let fileData = "";
                                        let mimeType = "";
                                        let filename = "";

                                        if (file) {
                                            fileData = await new Promise((resolve) => {
                                                const reader = new FileReader();
                                                reader.onload = () => resolve((reader.result as string).split(',')[1]);
                                                reader.readAsDataURL(file);
                                            });
                                            mimeType = file.type;
                                            filename = file.name;
                                        }

                                        const payload = {
                                            action: "addPaper",
                                            startNode: showNewSourceInput ? formData.newSourceNode : formData.sourceNode,
                                            endNode: showNewTargetInput ? formData.newTargetNode : formData.targetNode,
                                            user: formData.user,
                                            author: formData.author,
                                            journal: formData.journal,
                                            year: formData.year,
                                            relevance: formData.relevance,
                                            pathway: showNewPathInput ? formData.newPathName : formData.pathway,
                                            blurb: formData.blurb,
                                            fileData,
                                            mimeType,
                                            filename
                                        };

                                        await fetch(APPS_SCRIPT_URL, {
                                            method: 'POST',
                                            mode: 'no-cors', // Apps Script requires no-cors sometimes or handled via redirect
                                            body: JSON.stringify(payload)
                                        });

                                        alert("Record sent to database! It may take a minute to appear in the diagram.");
                                        setIsAddingRecord(false);
                                        // Reset form
                                        setFormData({
                                            sourceNode: '', targetNode: '', user: '', author: '', journal: '',
                                            year: '', relevance: 'Low', pathway: '', blurb: '',
                                            newSourceNode: '', newTargetNode: '', newPathName: ''
                                        });
                                        setFile(null);
                                    } catch (err) {
                                        console.error(err);
                                        alert("Error submitting record. Check console.");
                                    } finally {
                                        setIsSubmitting(false);
                                    }
                                }} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Your Name</label>
                                        <select
                                            required
                                            value={formData.user}
                                            onChange={(e) => setFormData({ ...formData, user: e.target.value })}
                                            style={{ background: '#0f172a', border: '1px solid #334155', height: '44px', borderRadius: '8px', color: 'white', padding: '0 12px' }}
                                        >
                                            <option value="">Select your name...</option>
                                            {usersList.map(u => <option key={u.email} value={u.email}>{u.name}</option>)}
                                        </select>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Source Node</label>
                                            {!showNewSourceInput ? (
                                                <select
                                                    required
                                                    value={formData.sourceNode}
                                                    onChange={(e) => {
                                                        if (e.target.value === 'ADD_NEW') {
                                                            setShowNewSourceInput(true);
                                                            setFormData({ ...formData, sourceNode: '', pathway: '' });
                                                        }
                                                        else setFormData({ ...formData, sourceNode: e.target.value, pathway: '' });
                                                    }}
                                                    style={{ background: '#0f172a', border: '1px solid #334155', height: '44px', borderRadius: '8px', color: 'white', padding: '0 12px' }}
                                                >
                                                    <option value="">Select source...</option>
                                                    {uniqueNodes.map(name => <option key={name} value={name}>{formatNodeName(name)}</option>)}
                                                    <option value="ADD_NEW">+ Add New Node...</option>
                                                </select>
                                            ) : (
                                                <input
                                                    autoFocus
                                                    placeholder="Node name"
                                                    value={formData.newSourceNode}
                                                    onChange={(e) => setFormData({ ...formData, newSourceNode: e.target.value, pathway: '' })}
                                                    onBlur={() => { if (!formData.newSourceNode) setShowNewSourceInput(false); }}
                                                    style={{ background: '#0f172a', border: '1px solid #3b82f6', height: '44px', borderRadius: '8px', color: 'white', padding: '0 12px' }}
                                                />
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Target Node</label>
                                            {!showNewTargetInput ? (
                                                <select
                                                    required
                                                    value={formData.targetNode}
                                                    onChange={(e) => {
                                                        if (e.target.value === 'ADD_NEW') {
                                                            setShowNewTargetInput(true);
                                                            setFormData({ ...formData, targetNode: '', pathway: '' });
                                                        }
                                                        else setFormData({ ...formData, targetNode: e.target.value, pathway: '' });
                                                    }}
                                                    style={{ background: '#0f172a', border: '1px solid #334155', height: '44px', borderRadius: '8px', color: 'white', padding: '0 12px' }}
                                                >
                                                    <option value="">Select target...</option>
                                                    {uniqueNodes.map(name => <option key={name} value={name}>{formatNodeName(name)}</option>)}
                                                    <option value="ADD_NEW">+ Add New Node...</option>
                                                </select>
                                            ) : (
                                                <input
                                                    autoFocus
                                                    placeholder="Node name"
                                                    value={formData.newTargetNode}
                                                    onChange={(e) => setFormData({ ...formData, newTargetNode: e.target.value, pathway: '' })}
                                                    onBlur={() => { if (!formData.newTargetNode) setShowNewTargetInput(false); }}
                                                    style={{ background: '#0f172a', border: '1px solid #3b82f6', height: '44px', borderRadius: '8px', color: 'white', padding: '0 12px' }}
                                                />
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Author(s)</label>
                                        <input type="text" value={formData.author} onChange={(e) => setFormData({ ...formData, author: e.target.value })} placeholder="e.g. Smith, J. & Doe, A." style={{ background: '#0f172a', border: '1px solid #334155', height: '44px', borderRadius: '8px', color: 'white', padding: '0 12px' }} />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '16px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Journal / Source</label>
                                            <input type="text" value={formData.journal} onChange={(e) => setFormData({ ...formData, journal: e.target.value })} placeholder="e.g. Nature, Science" style={{ background: '#0f172a', border: '1px solid #334155', height: '44px', borderRadius: '8px', color: 'white', padding: '0 12px' }} />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Year</label>
                                            <input type="text" value={formData.year} onChange={(e) => setFormData({ ...formData, year: e.target.value })} placeholder="2024" style={{ background: '#0f172a', border: '1px solid #334155', height: '44px', borderRadius: '8px', color: 'white', padding: '0 12px' }} />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Relevance</label>
                                            <select value={formData.relevance} onChange={(e) => setFormData({ ...formData, relevance: e.target.value })} style={{ background: '#0f172a', border: '1px solid #334155', height: '44px', borderRadius: '8px', color: 'white', padding: '0 12px' }}>
                                                <option value="Low">Low (No border)</option>
                                                <option value="Medium">Medium (Thin light blue border)</option>
                                                <option value="High">High (Darker blue border)</option>
                                            </select>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Pathway</label>
                                            {!showNewPathInput ? (
                                                <select
                                                    value={formData.pathway}
                                                    onChange={(e) => {
                                                        if (e.target.value === 'ADD_NEW') setShowNewPathInput(true);
                                                        else setFormData({ ...formData, pathway: e.target.value });
                                                    }}
                                                    style={{ background: '#0f172a', border: '1px solid #334155', height: '44px', borderRadius: '8px', color: 'white', padding: '0 12px' }}
                                                >
                                                    <option value="">Select pathway...</option>
                                                    {(() => {
                                                        const srcId = nodeMap[formData.sourceNode];
                                                        const tgtId = nodeMap[formData.targetNode];
                                                        const paths = allPathways[`${srcId}|||${tgtId}`] || [];
                                                        // Auto-select if there's exactly one path and none is selected yet
                                                        if (paths.length === 1 && !formData.pathway && !showNewPathInput) {
                                                            setTimeout(() => setFormData(prev => ({ ...prev, pathway: paths[0] })), 0);
                                                        }
                                                        return paths.map(p => <option key={p} value={p}>{p}</option>);
                                                    })()}
                                                    {(formData.sourceNode && formData.targetNode && !(allPathways[`${formData.sourceNode}|||${formData.targetNode}`]?.length)) && (
                                                        <option value="" disabled>No existing pathways for this pair</option>
                                                    )}
                                                    <option value="ADD_NEW">+ Add New Pathway...</option>
                                                </select>
                                            ) : (
                                                <input
                                                    autoFocus
                                                    placeholder="Pathway name"
                                                    value={formData.newPathName}
                                                    onChange={(e) => setFormData({ ...formData, newPathName: e.target.value })}
                                                    onBlur={() => { if (!formData.newPathName) setShowNewPathInput(false); }}
                                                    style={{ background: '#0f172a', border: '1px solid #3b82f6', height: '44px', borderRadius: '8px', color: 'white', padding: '0 12px' }}
                                                />
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Blurb / Abstract</label>
                                        <textarea value={formData.blurb} onChange={(e) => setFormData({ ...formData, blurb: e.target.value })} placeholder="Brief description of what this paper shows..." style={{ background: '#0f172a', border: '1px solid #334155', minHeight: '100px', borderRadius: '8px', color: 'white', padding: '12px', resize: 'vertical' }} />
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>PDF File (Optional)</label>
                                        <div
                                            onClick={() => document.getElementById('file-upload')?.click()}
                                            style={{
                                                border: '2px dashed #334155',
                                                borderRadius: '12px',
                                                padding: '20px',
                                                textAlign: 'center',
                                                cursor: 'pointer',
                                                background: file ? '#0f172a' : 'transparent',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <input id="file-upload" type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
                                            {file ? (
                                                <div style={{ color: '#60a5fa', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                    <FileText size={20} /> {file.name}
                                                </div>
                                            ) : (
                                                <div style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                    <Upload size={20} /> Click to choose a PDF
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '16px', display: 'flex', gap: '16px' }}>
                                        <button type="button" onClick={() => setIsAddingRecord(false)} style={{ flex: 1, padding: '14px', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: '12px', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
                                        <button type="submit" disabled={isSubmitting} style={{ flex: 1, padding: '14px', background: isSubmitting ? '#94a3b8' : '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)' }}>
                                            {isSubmitting ? 'Uploading...' : 'Upload & Save'}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default App;
