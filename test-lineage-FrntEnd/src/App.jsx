import { useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import CustomNode from "./CustomNode";
import ConfigurationPanel from "./configurationPanel";
import { getLayoutedElements } from "./utils/layout";
import "@xyflow/react/dist/style.css";

const formatTableName = (tableName) => {
  return tableName
    .split(/[^a-zA-Z0-9]+/)  
    .filter(Boolean)       
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const extractTableName = (query) => {
  const match = query.match(/FROM\s+([^\s;]+)/i);
    if (match) {
    const fullTableName = match[1].trim();
    const parts = fullTableName.split(".");
    return parts[parts.length - 1]; 
  }
  return "Lineage Root"; 
};

const sanitize = (val) => (val === null || val === undefined ? "null" : val);

function App() {
  const [rawData, setRawData] = useState([]);  
  const [availableColumns, setAvailableColumns] = useState([]);
  const [hierarchyKeys, setHierarchyKeys] = useState([]);
  const [expandedLevels, setExpandedLevels] = useState({});
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);
  const [rootLabel, setRootLabel] = useState("Lineage Root");
  const { fitView } = useReactFlow();

  const fetchColumnsFromQuery = async (query) => {
    setLoading(true);
    const tableLabel = extractTableName(query);
    setRootLabel(tableLabel);
    const formattedLabel = formatTableName(tableLabel);
    setRootLabel(formattedLabel);

    try {
      const API_BASE = import.meta.env.VITE_API_BASE;

      const res = await fetch(`${API_BASE}/data`, {
      // const res = await fetch("/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error: ${res.status} - ${text}`);
      }

      const json = await res.json();
      console.log(json);
      window.lastQueryResult = json;

      const dynamicColumns = json.columns || [];
      setAvailableColumns(dynamicColumns);
      setRawData(json.rows || []);

      setLoading(false);

      return dynamicColumns;
    } catch (err) {
      console.error("Error fetching columns:", err);
      setLoading(false);
      return [];
    }
  };

  const handleApply = (newHierarchy, filteredData) => {
    setHierarchyKeys(newHierarchy);
    setExpandedLevels({});
    setNodes([]);
    setEdges([]);
    fetchData(newHierarchy, filteredData);
  };

  const getChildCount = (rows, parentKey, parentValue, childKey, ancestry = []) => {
    const filteredRows = rows.filter((row) =>
      ancestry.every((val, i) => sanitize(row[hierarchyKeys[i]]) === val)
    );

    return new Set(
      filteredRows
        .filter((row) => sanitize(row[parentKey]) === parentValue)
        .map((row) => sanitize(row[childKey]))
        .filter(Boolean)
    ).size;
  };

  const fetchData = useCallback((hierarchy = hierarchyKeys, filteredData = null) => {
    const data = filteredData?.rows || rawData;
    if (!data.length || hierarchy.length === 0) return;

    const firstLevelValues = [...new Set(data.map((row) => sanitize(row[hierarchy[0]])))];

    const initialNodes = [
      {
        id: "root",
        type: "customNode",
        data: { label: `${rootLabel} Lineage`, level: -1 },
        position: { x: 0, y: 0 },
        draggable: false,
      },
      ...firstLevelValues.map((value) => {
        const childCount = getChildCount(
          data,
          hierarchy[0],
          value,
          hierarchy[1]
        );
        return {
          id: `0-root/${encodeURIComponent(value)}`,
          type: "customNode",
          data: {
            label: value,
            level: 0,
            isExpanded: false,
            childCount,
          },
          position: { x: 0, y: 0 },
        };
      }),
    ];

    const initialEdges = firstLevelValues.map((value) => ({
      id: `e-root-0-root/${encodeURIComponent(value)}`,
      source: "root",
      target: `0-root/${encodeURIComponent(value)}`,
    }));

    const { nodes: layoutedNodes, edges: layoutedEdges } =
      getLayoutedElements(initialNodes, initialEdges);

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    fitView({ duration: 400 });
  }, [rawData, hierarchyKeys, fitView]);

  const expandLevel = (filtered, nextLevel, parentId) => {
    const key = hierarchyKeys[nextLevel];
    if (expandedLevels[parentId]?.expanded) return;

    const childrenMap = new Map();
    const newNodes = [];
    const newEdges = [];

    if (nextLevel === hierarchyKeys.length - 1) {
      const attributeSet = new Set(
        filtered.map((row) => sanitize(row[key])).filter(Boolean)
      );
      let attributeList = [...attributeSet];

      const attrId = `${nextLevel}-${parentId}/attributes`;

      newNodes.push({
        id: attrId,
        type: "customNode",
        data: {
          label: "Attributes",
          level: nextLevel,
          attributes: attributeList,
        },
        position: { x: 0, y: 0 },
      });

      newEdges.push({
        id: `e-${parentId}-${attrId}`,
        source: parentId,
        target: attrId,
      });

      const updatedNodes = nodes.map((n) =>
        n.id === parentId
          ? {
              ...n,
              data: {
                ...n.data,
                isExpanded: true,
              },
            }
          : n
      );

      const combinedNodes = updatedNodes.concat(newNodes);
      const combinedEdges = [...edges, ...newEdges];

      const { nodes: layoutedNodes, edges: layoutedEdges } =
        getLayoutedElements(combinedNodes, combinedEdges);

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      fitView({ duration: 400 });
      setExpandedLevels((prev) => ({
        ...prev,
        [parentId]: { expanded: true, level: nextLevel - 1 },
      }));
      return;
    }

    const ancestry = parentId.split("/").slice(1).map(decodeURIComponent);

    filtered.forEach((row) => {
      const childLabelRaw = row[key];
      const childLabel = sanitize(childLabelRaw);
      const childId =`${nextLevel}-${parentId}/${encodeURIComponent(childLabel)}`;

      if (!childrenMap.has(childId)) {
        childrenMap.set(childId, true);

        const childCount = getChildCount(
          rawData,
          key,
          childLabelRaw,
          hierarchyKeys[nextLevel + 1],
          [...ancestry, childLabel]
        );

        if (!nodes.some((n) => n.id === childId)) {
          newNodes.push({
            id: childId,
            type: "customNode",
            data: {
              label: childLabel,
              level: nextLevel,
              isExpanded: false,
              childCount,
            },
            position: { x: 0, y: 0 },
          });
        }

        if (!edges.some((e) => e.id === `e-${parentId}-${childId}`)) {
          newEdges.push({
            id: `e-${parentId}-${childId}`,
            source: parentId,
            target: childId,
          });
        }
      }
    });

    const childCount = childrenMap.size;
    const updatedNodes = nodes.map((n) =>
      n.id === parentId
        ? {
            ...n,
            data: {
              ...n.data,
              isExpanded: true,
              childCount,
            },
          }
        : n
    );

    const combinedNodes = updatedNodes.concat(newNodes);
    const combinedEdges = [...edges, ...newEdges];

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      combinedNodes,
      combinedEdges
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    fitView({ duration: 400 });
    setExpandedLevels((prev) => ({
      ...prev,
      [parentId]: { expanded: true, level: nextLevel - 1 },
    }));
  };

  const collapseLevel = (parentId, parentLevel) => {
    const directChildren = edges
      .filter((e) => e.source === parentId)
      .map((e) => e.target);

    const getDescendants = (ids) => {
      let all = [...ids];
      ids.forEach((id) => {
        const childEdges = edges.filter((e) => e.source === id);
        const childIds = childEdges.map((e) => e.target);
        all.push(...getDescendants(childIds));
      });
      return all;
    };

    const descendantsToRemove = getDescendants(directChildren);

    const ancestry = parentId.split("/").slice(1).map(decodeURIComponent);

    const newNodeList = nodes
      .filter((n) => !descendantsToRemove.includes(n.id))
      .map((n) =>
        n.id === parentId
          ? {
              ...n,
              data: {
                ...n.data,
                isExpanded: false,
                childCount: getChildCount(
                  rawData,
                  hierarchyKeys[parentLevel],
                  n.data.label,
                  hierarchyKeys[parentLevel + 1],
                  ancestry
                ),
              },
            }
          : n
      );

    const newEdgeList = edges.filter(
      (e) =>
        !descendantsToRemove.includes(e.source) &&
        !descendantsToRemove.includes(e.target)
    );

    setNodes(newNodeList);
    setEdges(newEdgeList);
    fitView({ duration: 400 });
    setExpandedLevels((prev) => ({
      ...prev,
      [parentId]: { expanded: false, level: parentLevel },
    }));
  };

  const handleNodeClick = useCallback(
    (data) => {
      const { label, level } = data;
      const clickedNode = nodes.find(
        (n) => n.data.label === label && n.data.level === level
      );
      const id = clickedNode?.id;
      if (!id) return;

      const isExpanded = expandedLevels[id]?.expanded;

      if (isExpanded && level >= 0) {
        collapseLevel(id, level);
      } else if (!isExpanded && level < hierarchyKeys.length) {
        const ancestry = id.split("/").slice(1).map(decodeURIComponent);
        const filters = hierarchyKeys.slice(0, level + 1);

        const filteredData = rawData.filter((row) =>
          filters.every((k, i) => sanitize(row[k]) === ancestry[i])
        );

        expandLevel(filteredData, level + 1, id);
      }
    },
    [expandedLevels, rawData, nodes, edges, hierarchyKeys]
  );

  const nodeTypesWithClick = {
    customNode: (props) => (
      <CustomNode 
        {...props} 
        nodeId={props.id}
        onClick={handleNodeClick} 
        hierarchyKeys={hierarchyKeys} 
      />
    ),
  };

  const renderScaleBar = () => {
    if (!hierarchyKeys.length) return null;

    return (
      <>
        <div style={scaleContainerStyle("top")}>
          {hierarchyKeys.map((key, index) => (
            <div key={index} style={scaleLabelStyle}>{key}</div>
          ))}
        </div>
        <div style={scaleContainerStyle("bottom")}>
          {hierarchyKeys.map((key, index) => (
            <div key={index} style={scaleLabelStyle}>{key}</div>
          ))}
        </div>
      </>
    );
  };

  const scaleContainerStyle = (position) => ({
    position: "absolute",
    [position]: 0,
    left: 0,
    width: "100%",
    display: "flex",
    justifyContent: "space-around",
    padding: "4px 0",
    borderTop: position === "top" ? "1px solid #999" : "none",
    borderBottom: position === "bottom" ? "1px solid #999" : "none",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    zIndex: 500,
  });

  const scaleLabelStyle = {
    color: "#666",
    fontSize: "12px",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <ConfigurationPanel
        onApply={handleApply}
        currentHierarchy={hierarchyKeys}
        availableColumns={availableColumns}
        fetchColumnsFromQuery={fetchColumnsFromQuery}
      />
      {renderScaleBar()}
      {loading ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
            backgroundColor: "#ffffff",
          }}
        >
          <div className="bouncing-dots-loader">
            <div className="dot"></div>
            <div className="dot"></div>
            <div className="dot"></div>
          </div>
        </div>
      ) : (
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypesWithClick}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
          >
            <Controls position="bottom-right" />
            <Background />
          </ReactFlow>
        </ReactFlowProvider>
      )}
    </div>
  );
}

export default App;