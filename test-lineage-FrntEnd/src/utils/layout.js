import dagre from 'dagre';

export const getLayoutedElements = (nodes, edges, direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph(); 
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 100,
    ranksep: 100,
    marginx: 20,
    marginy: 20,
  });

  nodes.forEach((node) => {
    const labelLength = node.data?.label?.length || 10;
    const estimatedWidth = Math.max(500, labelLength * 10);
    const isAttributeLevel = node.data?.level === 6;
    dagreGraph.setNode(node.id, { width: estimatedWidth, height: isAttributeLevel ? 140 : 80  });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const pos = dagreGraph.node(node.id);
    return {
      ...node,
      position: { x: pos.x, y: pos.y },
    };
  });

  return { nodes: layoutedNodes, edges };
};
