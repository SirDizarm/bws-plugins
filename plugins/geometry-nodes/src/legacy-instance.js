// The legacy mesher receives a private branch recipe, never shared graph params.
export function buildLegacyInstance(graph, nodeId, api) {
  const ordered = [], visiting = new Set(), visited = new Set();
  function visit(id) {
    if (visiting.has(id)) throw Error('Circular node connection.');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const c of graph.connections.filter(c => c.toNodeId === id)) visit(c.fromNodeId);
    visiting.delete(id); visited.add(id); ordered.push(id);
  }
  visit(nodeId);
  const params = {...graph.params};
  for (const id of ordered) {
    const type = api.typeOf(id);
    const values = graph.nodeParams[id] || graph.params;
    for (const match of api.fields(type, id).matchAll(/data-geometry-param="([^"]+)"/g)) {
      if (values[match[1]] !== undefined) params[match[1]] = values[match[1]];
    }
  }
  const canonical = id => api.preserveId?.(id) || ['seed','textureInput','colorPalette','textureRandomizer'].includes(api.typeOf(id)) ? id : api.typeOf(id);
  const ids = [...new Set(ordered.map(canonical))].filter(Boolean);
  const connections = graph.connections.filter(c => visited.has(c.fromNodeId) && visited.has(c.toNodeId))
    .map(c => ({...c, fromNodeId:canonical(c.fromNodeId), toNodeId:canonical(c.toNodeId)}))
    .filter(c => c.fromNodeId !== c.toNodeId);
  connections.push({fromNodeId:canonical(nodeId),toNodeId:'output',toInputIndex:0});
  const scoped = {...graph, params, nodeOrder:[...ids.filter(id=>id!=='output'),'output'],
    nodeParams:{}, smoothNodes:[], connections, generatedIds:[], centerOutput:false, buildVersion:0};
  for (const id of ordered) scoped.nodeParams[canonical(id)] = {...params,...graph.nodeParams[id]};
  const seedId = ordered.findLast(id => api.typeOf(id)==='seed');
  scoped.seed = seedId ? graph.nodeParams[seedId].seed : graph.seed;
  const meshes = api.build(scoped) || [];
  return meshes.map(mesh => {
    const spec = api.spec(mesh);
    let label=String(mesh.name||'');
    for(const prefix of [graph.name,params.outputName].filter(Boolean))label=label.split(prefix).join('');
    spec.gameAsset={...spec.gameAsset,partLabel:label.trim()};
    spec.name = graph.name + ' ' + nodeId + ' ' + mesh.name;
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) mesh.material.forEach(m=>m.dispose()); else mesh.material.dispose();
    return spec;
  });
}
