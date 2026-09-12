import * as THREE from 'three';
import {OBJExporter} from 'three/addons/exporters/OBJExporter.js';
let objects=[],textureLibrary=new Map(),groups=new Map(),projectName='model',snapshotId=null;
const groupRecord=id=>groups.get(id)||null;
const currentProjectBaseName=()=>safeFileName(projectName,'model');
const syncCurrentTextureRobloxId=()=>{};
const log=message=>{document.getElementById('status').textContent=message;};
function downloadBlob(name,blob){parent.postMessage({type:'bws-plugin-export',snapshotId,name,blob},'*');}
window.addEventListener('message',event=>{
 if(event.source!==parent||event.data?.type!=='bws-model-snapshot')return;
 const snapshot=event.data.snapshot;
 try{
  for(const mesh of objects){mesh.geometry.dispose();mesh.material.dispose();}
  objects=[];snapshotId=event.data.snapshotId;projectName=snapshot.name;
  groups=new Map(snapshot.groups.map(g=>[g.id,g]));
  textureLibrary=new Map(snapshot.textures.map(t=>[t.name,t]));
  const loader=new THREE.BufferGeometryLoader();
  objects=snapshot.meshes.map(part=>{
   const mesh=new THREE.Mesh(loader.parse(part.geometry),new THREE.MeshBasicMaterial({color:part.color}));
   mesh.name=part.name;mesh.userData=part.userData;mesh.matrixAutoUpdate=false;
   mesh.matrix.fromArray(part.matrixWorld);mesh.rotation.fromArray(part.rotation);mesh.scale.fromArray(part.scale);mesh.updateMatrixWorld(true);return mesh;
  });
  document.getElementById('export').disabled=!objects.length;
  log(objects.length+' mesh parts received from '+projectName+'. Choose Build Roblox ZIP, then Download ZIP above.');
 }catch(error){document.getElementById('export').disabled=true;log('Could not read this model: '+error.message);}
});
document.getElementById('export').onclick=()=>{try{exportObjParts();}catch(error){log('Export failed: '+error.message);}};
parent.postMessage({type:'bws-plugin-ready'},'*');

function round(value) {
  return Math.round(value * 1000) / 1000;
}

const utf8Encoder = new TextEncoder();
let crc32Table = null;

function ensureCrc32Table() {
  if (crc32Table) return crc32Table;
  crc32Table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
    }
    crc32Table[index] = value >>> 0;
  }
  return crc32Table;
}

function crc32(bytes) {
  const table = ensureCrc32Table();
  let value = 0xFFFFFFFF;
  for (let index = 0; index < bytes.length; index++) {
    value = table[(value ^ bytes[index]) & 0xFF] ^ (value >>> 8);
  }
  return (value ^ 0xFFFFFFFF) >>> 0;
}

function zipPath(path = "") {
  return String(path || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function zipTimestampParts(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const month = Math.min(12, Math.max(1, date.getMonth() + 1));
  const day = Math.min(31, Math.max(1, date.getDate()));
  const hours = Math.min(23, Math.max(0, date.getHours()));
  const minutes = Math.min(59, Math.max(0, date.getMinutes()));
  const seconds = Math.min(59, Math.max(0, date.getSeconds()));
  return {
    time: ((hours & 0x1F) << 11) | ((minutes & 0x3F) << 5) | ((Math.floor(seconds / 2)) & 0x1F),
    date: (((year - 1980) & 0x7F) << 9) | ((month & 0x0F) << 5) | (day & 0x1F)
  };
}

function zipBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return utf8Encoder.encode(String(value ?? ""));
}

function dataUrlToBytes(dataUrl = "") {
  const match = String(dataUrl || "").match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) return null;
  const isBase64 = !!match[2];
  const payload = match[3] || "";
  const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function imageExtensionFromDataUrl(dataUrl = "", fallbackName = "texture.png") {
  const mime = String(dataUrl || "").match(/^data:([^;,]+)/)?.[1]?.toLowerCase() || "";
  if (mime.includes("jpeg") || mime.includes("jpg")) return ".jpg";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("bmp")) return ".bmp";
  if (mime.includes("gif")) return ".gif";
  const ext = String(fallbackName || "").match(/\.(png|jpe?g|webp|bmp|gif)$/i)?.[0];
  return ext ? ext.toLowerCase().replace(".jpeg", ".jpg") : ".png";
}

function writeLocalZipHeader(view, { time, date, crc, size, nameLength }) {
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, time, true);
  view.setUint16(12, date, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
  view.setUint16(26, nameLength, true);
  view.setUint16(28, 0, true);
}

function writeCentralZipHeader(view, { time, date, crc, size, nameLength, localOffset }) {
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, time, true);
  view.setUint16(14, date, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, nameLength, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, localOffset, true);
}

function makeZip(entries = []) {
  const normalizedEntries = entries.map(entry => {
    const name = zipPath(entry.name);
    const nameBytes = utf8Encoder.encode(name);
    const dataBytes = zipBytes(entry.data);
    const { time, date } = zipTimestampParts(entry.modifiedAt || new Date());
    return {
      name,
      nameBytes,
      dataBytes,
      crc: crc32(dataBytes),
      time,
      date
    };
  });

  const chunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const entry of normalizedEntries) {
    const localHeader = new Uint8Array(30);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034B50, true);
    writeLocalZipHeader(localView, {
      time: entry.time,
      date: entry.date,
      crc: entry.crc,
      size: entry.dataBytes.length,
      nameLength: entry.nameBytes.length
    });
    chunks.push(localHeader, entry.nameBytes, entry.dataBytes);

    const centralHeader = new Uint8Array(46);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014B50, true);
    writeCentralZipHeader(centralView, {
      time: entry.time,
      date: entry.date,
      crc: entry.crc,
      size: entry.dataBytes.length,
      nameLength: entry.nameBytes.length,
      localOffset: offset
    });
    centralChunks.push(centralHeader, entry.nameBytes);

    offset += localHeader.length + entry.nameBytes.length + entry.dataBytes.length;
  }

  const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const endHeader = new Uint8Array(22);
  const endView = new DataView(endHeader.buffer);
  endView.setUint32(0, 0x06054B50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, normalizedEntries.length, true);
  endView.setUint16(10, normalizedEntries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return new Blob([...chunks, ...centralChunks, endHeader], { type: "application/zip" });
}



function safeFileName(name, fallback = "mesh") {
  return String(name || fallback)
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || fallback;
}

function luaString(value = "") {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n")}"`;
}

function toLuaLiteral(value, indent = 0) {
  const pad = "  ".repeat(indent);
  const nextPad = "  ".repeat(indent + 1);
  if (value === null || value === undefined) return "nil";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "0";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return luaString(value);
  if (Array.isArray(value)) {
    if (!value.length) return "{}";
    return `{\n${value.map(item => `${nextPad}${toLuaLiteral(item, indent + 1)},`).join("\n")}\n${pad}}`;
  }
  const entries = Object.entries(value);
  if (!entries.length) return "{}";
  return `{\n${entries.map(([key, item]) => `${nextPad}${/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? key : `[${luaString(key)}]`} = ${toLuaLiteral(item, indent + 1)},`).join("\n")}\n${pad}}`;
}



function swapTriangleVertices(attribute, itemSize) {
  if (!attribute) return;
  const array = attribute.array;
  const stride = itemSize;
  const vertexStride = stride * 3;
  for (let offset = 0; offset + vertexStride - 1 < array.length; offset += vertexStride) {
    for (let componentIndex = 0; componentIndex < stride; componentIndex++) {
      const first = offset + componentIndex;
      const third = offset + stride * 2 + componentIndex;
      const temp = array[first];
      array[first] = array[third];
      array[third] = temp;
    }
  }
  attribute.needsUpdate = true;
}

function axisIndex(axis) {
  return { x: 0, y: 1, z: 2 }[axis] ?? 0;
}

function component(vector, index) {
  return index === 0 ? vector.x : index === 1 ? vector.y : vector.z;
}

function normalizeRobloxAssetId(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^rbxassetid:\/\/\d+$/i.test(text)) return `rbxassetid://${text.match(/\d+$/)[0]}`;
  if (/^\d+$/.test(text)) return `rbxassetid://${text}`;
  return text;
}
function currentRobloxAxisMode() {
  return "none";
}

const ROBLOX_PACK_GEOMETRY_MIRROR_AXES = ["z", "x"];

function applyRobloxAxisConversion(geometry, mode = currentRobloxAxisMode()) {
  const scale = {
    none: [1, 1, 1],
    xFlip: [-1, 1, 1],
    zFlip: [1, 1, -1],
    xzFlip: [-1, 1, -1]
  }[mode] || [1, 1, -1];
  geometry.scale(scale[0], scale[1], scale[2]);
  if (scale[0] * scale[1] * scale[2] < 0) {
    swapTriangleVertices(geometry.getAttribute("position"), 3);
    swapTriangleVertices(geometry.getAttribute("uv"), 2);
  }
}

function prepareRobloxMeshGeometry(geometry) {
  if (geometry.getAttribute("normal")) geometry.deleteAttribute("normal");
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

function mirrorGeometryInPlace(geometry, axis = "x") {
  const index = axisIndex(axis);
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++) {
    const value = position.getComponent(i, index);
    position.setComponent(i, index, component(center, index) * 2 - value);
  }
  position.needsUpdate = true;
  swapTriangleVertices(position, 3);
  swapTriangleVertices(geometry.getAttribute("uv"), 2);
  if (geometry.getAttribute("normal")) geometry.deleteAttribute("normal");
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

function exportReadyMeshPart(mesh, { forRoblox = false, mirrorAxis = null, robloxAxisMode = currentRobloxAxisMode() } = {}) {
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  mesh.updateMatrixWorld(true);
  const worldMatrix = mesh.matrixWorld.clone();
  source.applyMatrix4(worldMatrix);
  if (Array.isArray(mirrorAxis)) {
    mirrorAxis.forEach(axis => mirrorGeometryInPlace(source, axis));
  } else if (mirrorAxis) {
    mirrorGeometryInPlace(source, mirrorAxis);
  }
  if (forRoblox && robloxAxisMode !== "none") applyRobloxAxisConversion(source, robloxAxisMode);
  source.computeBoundingBox();
  const center = source.boundingBox.getCenter(new THREE.Vector3());
  const bounds = source.boundingBox.clone();
  source.translate(-center.x, -center.y, -center.z);
  if (forRoblox) prepareRobloxMeshGeometry(source);
  const exportMesh = new THREE.Mesh(source, mesh.material.clone());
  exportMesh.name = mesh.name;
  exportMesh.updateMatrixWorld(true);
  return {
    exportMesh,
    center,
    bounds,
    basis: {
      right: [1, 0, 0],
      up: [0, 1, 0],
      forward: [0, 0, 1]
    }
  };
}

function meshGroupChain(mesh, allowedGroupIds = null) {
  const chain = [];
  let currentId = mesh.userData.groupId || null;
  const seen = new Set();
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const record = groupRecord(currentId);
    if (!record) break;
    if (!allowedGroupIds || allowedGroupIds.has(record.id)) chain.unshift(record);
    currentId = record.parentId || null;
  }
  return chain;
}

function safeHierarchySegment(name, fallback = "part") {
  return String(name || fallback)
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f.]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || fallback;
}

function hierarchySegmentsForMesh(mesh, allowedGroupIds = null) {
  const groupSegments = meshGroupChain(mesh, allowedGroupIds).map(record => safeHierarchySegment(record.name, "Group"));
  return [...groupSegments, safeHierarchySegment(mesh.name, mesh.userData.id || "part")];
}

function robloxPackExportPrefix() {
  return `rbx_${Date.now().toString(36)}`;
}

function robloxExportId(index, packPrefix = "rbx_pack") {
  return `${packPrefix}_mesh_${String(index + 1).padStart(5, "0")}`;
}

function flattenManifestMeshes(manifest) {
  const meshes = [];
  function visitGroup(node) {
    for (const mesh of node.meshes || []) meshes.push(mesh);
    for (const child of node.children || []) visitGroup(child);
  }
  for (const mesh of manifest.rootMeshes || []) meshes.push(mesh);
  for (const node of manifest.rootGroups || []) visitGroup(node);
  return meshes;
}

function computeRobloxPackFrame(fileEntries) {
  const box = new THREE.Box3();
  for (const entry of fileEntries) {
    if (entry.bounds) box.union(entry.bounds);
  }
  if (box.isEmpty()) {
    return {
      origin: new THREE.Vector3(),
      size: new THREE.Vector3()
    };
  }
  return {
    origin: box.getCenter(new THREE.Vector3()),
    size: box.getSize(new THREE.Vector3())
  };
}

function robloxManifestForTargets(targets, fileEntries, packPrefix) {
  const relevantGroupIds = new Set();
  for (const mesh of targets) {
    for (const record of meshGroupChain(mesh)) relevantGroupIds.add(record.id);
  }
  const packFrame = computeRobloxPackFrame(fileEntries);

  const rootGroups = [];
  const rootMeshes = [];
  const nodeMap = new Map();

  function ensureNode(record) {
    if (!record) return null;
    if (nodeMap.has(record.id)) return nodeMap.get(record.id);
    const node = {
      id: record.id,
      name: record.name,
      meshes: [],
      children: []
    };
    nodeMap.set(record.id, node);
    return node;
  }

  for (const mesh of targets) {
    const entry = fileEntries.find(item => item.mesh.userData.id === mesh.userData.id);
    if (!entry) continue;
    const chain = meshGroupChain(mesh, relevantGroupIds);
    const meshNode = {
      id: mesh.userData.id,
      exportId: entry.exportId,
      name: mesh.name,
      importName: entry.importName,
      baseImportName: entry.baseImportName || entry.importName,
      file: entry.fileName,
      position: entry.center.clone().sub(packFrame.origin).toArray().map(round),
      absolutePosition: entry.center.toArray().map(round),
      rotation: [0, 0, 0],
      originalRotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z].map(value => round(THREE.MathUtils.radToDeg(value))),
      scale: [1, 1, 1],
      originalScale: mesh.scale.toArray().map(round),
      pivot: Array.isArray(mesh.userData.pivot) ? mesh.userData.pivot.map(round) : null,
      hidden: !!mesh.userData.hidden,
      textureName: mesh.userData.textureName || null,
      hierarchyPath: entry.pathSegments
    };

    if (!chain.length) {
      rootMeshes.push(meshNode);
      continue;
    }

    let parentNode = null;
    chain.forEach((record, index) => {
      const node = ensureNode(record);
      if (index === 0 && !rootGroups.includes(node)) rootGroups.push(node);
      if (parentNode && !parentNode.children.includes(node)) parentNode.children.push(node);
      parentNode = node;
    });
    parentNode.meshes.push(meshNode);
  }

  return {
    kind: "roblox-model-pack",
    version: 2,
    name: currentProjectBaseName(),
    packId: packPrefix,
    generatedAt: new Date().toISOString(),
    axisMode: currentRobloxAxisMode(),
    geometryMirrorAxes: ROBLOX_PACK_GEOMETRY_MIRROR_AXES,
    packOrigin: packFrame.origin.toArray().map(round),
    packSize: packFrame.size.toArray().map(round),
    notes: [
      "Import every OBJ file as its own MeshPart in Roblox Studio.",
      "Put the imported MeshParts under a folder or model in workspace, then run the companion rebuild script or plugin.",
      "Each OBJ stores centered vertices. The manifest stores the model bounding-box origin plus each mesh offset from that origin, so rebuild is ID-based placement instead of name or orientation guessing.",
      `Roblox Pack OBJ geometry is pre-mirrored around each part center on ${ROBLOX_PACK_GEOMETRY_MIRROR_AXES.map(axis => axis.toUpperCase()).join(", ")} to compensate for Roblox OBJ handedness.`
    ],
    rootGroups,
    rootMeshes
  };
}

function robloxBaseGroupKey(name = "Part") {
  const text = String(name || "Part").trim();
  const stripped = text.replace(/[\s._-]*\d+$/g, "").trim();
  return stripped || text || "Part";
}

function collectRobloxTextureAssignments(manifest) {
  const byGroup = {};
  const byPath = {};

  function visitMesh(entry) {
    if (!entry) return;
    const groupKey = robloxBaseGroupKey(entry.name);
    if (!byGroup[groupKey]) byGroup[groupKey] = entry.textureName || "";
    const pathKey = Array.isArray(entry.hierarchyPath) && entry.hierarchyPath.length
      ? entry.hierarchyPath.join(".")
      : (entry.name || "part");
    if (!byPath[pathKey]) byPath[pathKey] = entry.textureName || "";
  }

  function visitGroup(node) {
    if (!node) return;
    for (const meshEntry of node.meshes || []) visitMesh(meshEntry);
    for (const child of node.children || []) visitGroup(child);
  }

  for (const meshEntry of manifest.rootMeshes || []) visitMesh(meshEntry);
  for (const node of manifest.rootGroups || []) visitGroup(node);

  const sortedGroup = Object.fromEntries(Object.entries(byGroup).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })));
  const sortedPath = Object.fromEntries(Object.entries(byPath).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })));
  return { byGroup: sortedGroup, byPath: sortedPath };
}

function collectRobloxTextureCatalog() {
  syncCurrentTextureRobloxId({ writeInput: true });
  const entries = [...textureLibrary.values()]
    .filter(entry => entry?.name)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  const catalog = {};
  for (const entry of entries) catalog[entry.name] = normalizeRobloxAssetId(entry.robloxAssetId || "");
  return catalog;
}

function collectRobloxTextureFiles(packRoot) {
  syncCurrentTextureRobloxId({ writeInput: true });
  const zipEntries = [];
  const manifestFiles = {};
  const usedNames = new Set();
  for (const entry of [...textureLibrary.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }))) {
    if (!entry?.name || !/^data:/i.test(entry.dataUrl || "")) continue;
    const bytes = dataUrlToBytes(entry.dataUrl);
    if (!bytes) continue;
    const ext = imageExtensionFromDataUrl(entry.dataUrl, entry.name);
    const base = safeFileName(String(entry.name).replace(/\.(png|jpe?g|webp|bmp|gif)$/i, ""), "texture");
    let fileName = `${base}${ext}`;
    let index = 2;
    while (usedNames.has(fileName.toLowerCase())) {
      fileName = `${base}_${index}${ext}`;
      index++;
    }
    usedNames.add(fileName.toLowerCase());
    const zipPathName = `${packRoot}/textures/${fileName}`;
    zipEntries.push({
      name: zipPathName,
      data: bytes
    });
    manifestFiles[entry.name] = {
      file: `textures/${fileName}`,
      robloxAssetId: normalizeRobloxAssetId(entry.robloxAssetId || "")
    };
  }
  return { zipEntries, manifestFiles };
}

function robloxCommandBarSetupLua(manifest) {
  const manifestLua = toLuaLiteral(manifest, 0);
  const textureAssignments = collectRobloxTextureAssignments(manifest);
  const textureCatalog = collectRobloxTextureCatalog();
  const textureCatalogLua = toLuaLiteral(textureCatalog, 0);
  const textureByGroupLua = toLuaLiteral(textureAssignments.byGroup, 0);
  const textureByPathLua = toLuaLiteral(textureAssignments.byPath, 0);
  return `local textureCatalog = ${textureCatalogLua}
local textureByGroup = ${textureByGroupLua}
local textureByPath = ${textureByPathLua}
local useImportedRotation = false -- OBJ geometry is already exported in final orientation; only apply manifest position.
local manifest = ${manifestLua}

local function info(...)
  print("[3D Model Studio]", ...)
end

local function warnf(...)
  warn("[3D Model Studio]", ...)
end

local function trimText(value)
  return tostring(value or ""):gsub("^%s+", ""):gsub("%s+$", "")
end

local function normalizeName(value)
  local text = tostring(value or "")
  text = text:gsub("%.obj$", "")
  text = text:gsub("%.%.%.$", "")
  text = text:gsub("%.%.%.", "_")
  text = text:gsub("[^%w]+", "_")
  text = text:gsub("_+", "_")
  text = text:gsub("^_+", "")
  text = text:gsub("_+$", "")
  return string.lower(text)
end

local function textureGroupKey(name)
  local text = trimText(name)
  local stripped = text:gsub("[%s%._%-]*%d+$", "")
  stripped = trimText(stripped)
  return stripped ~= "" and stripped or text
end

local function texturePathKey(entry)
  if entry.hierarchyPath and #entry.hierarchyPath > 0 then
return table.concat(entry.hierarchyPath, ".")
  end
  return entry.name
end

local function normalizeTextureAssetId(value)
  local text = trimText(value)
  if text == "" then
return nil
  end
  if text:match("^rbxassetid://") or text:match("^rbxasset://") then
return text
  end
  if text:match("^%d+$") then
return "rbxassetid://" .. text
  end
  return text
end

local function resolveTextureReference(value)
  local text = trimText(value)
  if text == "" then
return nil
  end
  local catalogValue = textureCatalog[text]
  if catalogValue ~= nil then
local resolvedCatalog = normalizeTextureAssetId(catalogValue)
if resolvedCatalog then
  return resolvedCatalog
end
  end
  return normalizeTextureAssetId(text)
end

local function applyTextureFields(part, entry)
  local textureId = resolveTextureReference(textureByPath[texturePathKey(entry)] or textureByGroup[textureGroupKey(entry.name)])
  if not textureId then
return
  end
  pcall(function()
part.TextureID = textureId
  end)
  pcall(function()
part.TextureContent = textureId
  end)
  part:SetAttribute("ModelerTextureId", textureId)
end

local function robloxVector(values)
  return Vector3.new(
values and values[1] or 0,
values and values[2] or 0,
values and values[3] or 0
  )
end

local function targetCFrame(entry)
  return CFrame.new(robloxVector(manifest.packOrigin) + robloxVector(entry.position))
end

local function isBuiltPack(instance)
  local current = instance
  while current do
if current:GetAttribute("ModelerBuiltPack") == manifest.packId or current:GetAttribute("ModelerBuiltPackName") == manifest.name then
  return true
end
current = current.Parent
  end
  return false
end

local function allEntries()
  local entries = {}
  local function addEntry(entry)
if entry then
  table.insert(entries, entry)
end
  end
  local function visitGroup(node)
if not node then
  return
end
for _, meshEntry in ipairs(node.meshes or {}) do
  addEntry(meshEntry)
end
for _, child in ipairs(node.children or {}) do
  visitGroup(child)
end
  end
  for _, node in ipairs(manifest.rootGroups or {}) do
visitGroup(node)
  end
  for _, meshEntry in ipairs(manifest.rootMeshes or {}) do
addEntry(meshEntry)
  end
  return entries
end

local entries = allEntries()

local function entryTokens(entry)
  local tokens = {}
  local function add(value)
if value and tostring(value) ~= "" then
  table.insert(tokens, normalizeName(value))
end
  end
  add(entry.exportId)
  add(entry.importName)
  add(entry.file)
  add((entry.file or ""):gsub("%.obj$", ""))
  return tokens
end

local function nameMatchesEntry(name, entry)
  local normalized = normalizeName(name)
  for _, token in ipairs(entryTokens(entry)) do
if normalized == token or string.sub(normalized, 1, #token + 1) == token .. "_" or string.find(normalized, token, 1, true) then
  return true
end
  end
  return false
end

local function singleBasePartInside(instance)
  if not instance then
return nil
  end
  if instance:IsA("BasePart") then
return instance
  end
  if not (instance:IsA("Model") or instance:IsA("Folder")) then
return nil
  end
  local found = nil
  local count = 0
  for _, descendant in ipairs(instance:GetDescendants()) do
if descendant:IsA("BasePart") then
  found = found or descendant
  count += 1
end
  end
  if count == 1 then
return found
  end
  return nil
end

local function findSourcePart(entry)
  local directCandidates = {}
  for _, child in ipairs(workspace:GetChildren()) do
table.insert(directCandidates, child)
  end
  for _, descendant in ipairs(workspace:GetDescendants()) do
table.insert(directCandidates, descendant)
  end

  for _, instance in ipairs(directCandidates) do
if not isBuiltPack(instance) and nameMatchesEntry(instance.Name, entry) then
  local part = singleBasePartInside(instance)
  if part then
    return part
  end
end
  end

  for _, instance in ipairs(directCandidates) do
if not isBuiltPack(instance) and instance:IsA("BasePart") and instance.Name == "default" and instance.Parent and nameMatchesEntry(instance.Parent.Name, entry) then
  return instance
end
  end

  return nil
end

local function importedRotation(part)
  if not part then
return CFrame.new()
  end
  return part.CFrame - part.CFrame.Position
end

local function diagnose()
  local found = 0
  local missing = {}
  for _, entry in ipairs(entries) do
local source = findSourcePart(entry)
if source then
  found += 1
  info("FOUND", entry.importName or entry.exportId or entry.name, "=>", source:GetFullName(), "target", tostring(targetCFrame(entry).Position))
else
  table.insert(missing, entry.importName or entry.exportId or entry.file or entry.name)
  warnf("MISSING", entry.importName or entry.exportId or entry.file or entry.name)
end
  end
  info("Diagnose found", found, "of", #entries, "imported OBJ parts.")
  return found, missing
end

local function removeOldBuiltPack()
  for _, child in ipairs(workspace:GetChildren()) do
if child:GetAttribute("ModelerBuiltPack") == manifest.packId or child:GetAttribute("ModelerBuiltPackName") == manifest.name then
  child:Destroy()
end
  end
end

local function attachMesh(entry, parent)
  local source = findSourcePart(entry)
  assert(source, "Missing imported OBJ for " .. tostring(entry.importName or entry.exportId or entry.file or entry.name))
  local part = source:Clone()
  part.Name = entry.name
  if useImportedRotation then
part.CFrame = targetCFrame(entry) * importedRotation(source)
  else
part.CFrame = targetCFrame(entry)
  end
  part:SetAttribute("ModelerSourceFile", entry.file or "")
  part:SetAttribute("ModelerExportId", entry.exportId or "")
  part:SetAttribute("ModelerHierarchyPath", texturePathKey(entry))
  applyTextureFields(part, entry)
  part.Parent = parent
  return part
end

local function buildGroup(node, parent)
  local model = Instance.new("Model")
  model.Name = node.name
  model.Parent = parent
  for _, meshEntry in ipairs(node.meshes or {}) do
attachMesh(meshEntry, model)
  end
  for _, child in ipairs(node.children or {}) do
buildGroup(child, model)
  end
  return model
end

local function rebuild()
  local found, missing = diagnose()
  if #missing > 0 then
error("Cannot rebuild. Missing " .. tostring(#missing) .. " of " .. tostring(#entries) .. " imported OBJ parts. Import every OBJ from the pack, then run this script again.")
  end
  removeOldBuiltPack()
  local root = Instance.new("Model")
  root.Name = manifest.name .. "_assembled"
  root:SetAttribute("ModelerBuiltPack", manifest.packId or manifest.name)
  root:SetAttribute("ModelerBuiltPackName", manifest.name)
  root.Parent = workspace
  for _, node in ipairs(manifest.rootGroups or {}) do
buildGroup(node, root)
  end
  for _, meshEntry in ipairs(manifest.rootMeshes or {}) do
attachMesh(meshEntry, root)
  end
  info("Built", root:GetFullName(), "from", found, "imported OBJ parts.")
  return root
end

_G.ModelerRebuildPack = rebuild
_G.ModelerDiagnoseImports = diagnose

local ok, result = pcall(rebuild)
if not ok then
  warnf("FAILED:", result)
  error(result)
end
`;
}

function robloxSetupLua(manifest) {
  return robloxCommandBarSetupLua(manifest);
  const manifestLua = toLuaLiteral(manifest, 0);
  const textureAssignments = collectRobloxTextureAssignments(manifest);
  const textureCatalog = collectRobloxTextureCatalog();
  const textureCatalogLua = toLuaLiteral(textureCatalog, 0);
  const textureByGroupLua = toLuaLiteral(textureAssignments.byGroup, 0);
  const textureByPathLua = toLuaLiteral(textureAssignments.byPath, 0);
  return `-- 3D Model Studio Roblox placement helper
-- Edit the config blocks below first, then run the script.
-- textureCatalog: replace each texture name with the correct Roblox asset id once
-- textureByGroup: same texture name for every part with the same base name
-- textureByPath: exact texture name override for one specific hierarchy path
-- createPlacementMarkers: builds visible helper markers for every part target
-- After running once, command-bar helpers are available:
-- _G.ModelerRebuildPack(), _G.ModelerDiagnoseImports(), _G.ModelerShowTargetMarkers(), _G.ModelerClearTargetMarkers()

local textureCatalog = ${textureCatalogLua}
local textureByGroup = ${textureByGroupLua}
local textureByPath = ${textureByPathLua}
local createPlacementMarkers = false
local useImportedRotation = false -- OBJ geometry is already exported in final orientation; only apply manifest position.
local markerFolderName = "ModelerPlacementMarkers"
local markerSize = 0.35
local markerTransparency = 0.2
local markerLabelMode = "short" -- "short", "path", or "none"
local markerLabelScale = 0.75
local markerLabelStagger = 0.18

local manifest = ${manifestLua}
local okSelection, Selection = pcall(function()
  return game:GetService("Selection")
end)

assert(okSelection and Selection, "3D Model Studio: this helper must be run from the Roblox Studio Command Bar or a Studio plugin.")

local function info(...)
  print("[3D Model Studio]", ...)
end

local function warnf(...)
  warn("[3D Model Studio]", ...)
end

local function isBuiltPackSelection(instance)
  local current = instance
  while current do
if current:IsA("Model") and (current:GetAttribute("ModelerBuiltPack") == manifest.name or current.Name == manifest.name) then
  return true
end
current = current.Parent
  end
  return false
end

local function collectManifestExportIds()
  local ids = {}
  local function addMesh(entry)
if entry and entry.exportId then
  table.insert(ids, tostring(entry.exportId):gsub("%.obj$", ""))
end
  end
  local function visitGroup(node)
if not node then
  return
end
for _, meshEntry in ipairs(node.meshes or {}) do
  addMesh(meshEntry)
end
for _, child in ipairs(node.children or {}) do
  visitGroup(child)
end
  end
  for _, node in ipairs(manifest.rootGroups or {}) do
visitGroup(node)
  end
  for _, meshEntry in ipairs(manifest.rootMeshes or {}) do
addMesh(meshEntry)
  end
  return ids
end

local manifestExportIds = collectManifestExportIds()

local function instanceNameMatchesExportId(instance, exportId)
  local name = string.lower(tostring(instance and instance.Name or "")):gsub("%.obj$", "")
  local token = string.lower(tostring(exportId or "")):gsub("%.obj$", "")
  if token == "" then
return false
  end
  return name == token or string.sub(name, 1, #token + 1) == token .. "_" or string.find(name, token, 1, true) ~= nil
end

local function countExportIdMatches(root)
  if not root then
return 0
  end
  local seen = {}
  local count = 0
  local function check(instance)
for _, exportId in ipairs(manifestExportIds) do
  if not seen[exportId] and instanceNameMatchesExportId(instance, exportId) then
    seen[exportId] = true
    count += 1
    break
  end
end
  end
  check(root)
  for _, descendant in ipairs(root:GetDescendants()) do
check(descendant)
  end
  return count
end

local function bestImportRootFromWorkspace()
  local bestRoot = nil
  local bestCount = 0
  local workspaceCount = countExportIdMatches(workspace)
  if workspaceCount > 0 then
bestRoot = workspace
bestCount = workspaceCount
  end
  for _, child in ipairs(workspace:GetChildren()) do
if not isBuiltPackSelection(child) then
  local count = countExportIdMatches(child)
  if count > bestCount then
    bestRoot = child
    bestCount = count
  end
end
  end
  return bestRoot, bestCount
end

local function resolveImportedRoot()
  local expectedCount = #manifestExportIds
  local selected = Selection:Get()[1]
  if selected then
if isBuiltPackSelection(selected) then
  warnf("Selected object is the rebuilt model, not the imported source. Searching Workspace for imported OBJ IDs.")
else
  local selectedCount = countExportIdMatches(selected)
  if expectedCount <= 1 or selectedCount >= expectedCount then
    info("Using selected imported root:", selected:GetFullName(), "matched", selectedCount, "of", expectedCount, "OBJ IDs")
    return selected
  end
  local bestRoot, bestCount = bestImportRootFromWorkspace()
  if bestRoot and bestCount > selectedCount then
    warnf("Selected object only contains", selectedCount, "of", expectedCount, "OBJ IDs. Using", bestRoot:GetFullName(), "with", bestCount, "matches instead.")
    return bestRoot
  end
  if selectedCount > 0 then
    warnf("Selected object only contains", selectedCount, "of", expectedCount, "OBJ IDs, but no better root was found. Trying selected object anyway.")
    return selected
  end
  warnf("Selected object has no matching exported OBJ IDs. Searching Workspace.")
end
  end
  local fallback = workspace:FindFirstChild("ImportedParts")
  if fallback then
local fallbackCount = countExportIdMatches(fallback)
if fallbackCount > 0 then
  info("Using fallback imported root:", fallback:GetFullName(), "matched", fallbackCount, "of", expectedCount, "OBJ IDs")
  return fallback
end
warnf("workspace.ImportedParts exists but contains no matching exported OBJ IDs. Searching Workspace.")
  end
  local bestRoot, bestCount = bestImportRootFromWorkspace()
  assert(bestRoot and bestCount > 0, "Could not find imported OBJ models. Import the OBJ files first, then select their folder/model or leave them in Workspace and run again.")
  info("Using discovered imported root:", bestRoot:GetFullName(), "matched", bestCount, "of", expectedCount, "OBJ IDs")
  return bestRoot
end

local function meshPartFromCandidate(candidate)
	if not candidate then
		return nil
  end
  if candidate:IsA("MeshPart") or candidate:IsA("Part") or candidate:IsA("BasePart") then
return candidate
  end
  if candidate:IsA("Model") or candidate:IsA("Folder") then
local descendants = candidate:GetDescendants()
local firstBasePart = nil
local basePartCount = 0
for _, descendant in ipairs(descendants) do
  if descendant:IsA("BasePart") then
    firstBasePart = firstBasePart or descendant
    basePartCount += 1
  end
end
if basePartCount == 1 then
  return firstBasePart
end
	end
	return nil
end

local function normalizeToken(value)
	local text = tostring(value or "")
	text = text:gsub("%.obj$", "")
	text = text:gsub("%.%.%.$", "")
	text = text:gsub("%.%.%.", "_")
	text = text:gsub("[^%w]+", "_")
	text = text:gsub("_+", "_")
	text = text:gsub("^_+", "")
	text = text:gsub("_+$", "")
	return string.lower(text)
end

local function candidateNamesForEntry(entry)
	local names = {
entry.exportId,
		entry.importName,
		entry.importName .. ".obj",
		entry.file
	}
	return names
end

local function hasEntryExportIdPrefix(instanceName, entry)
  local exportId = tostring(entry.exportId or entry.importName or ""):gsub("%.obj$", "")
  if exportId == "" then
return false
  end
  local instanceNorm = normalizeToken(instanceName)
  local exportNorm = normalizeToken(exportId)
  return instanceNorm == exportNorm or string.sub(instanceNorm, 1, #exportNorm + 1) == exportNorm .. "_"
end

local function matchesEntryName(instance, entry)
	if not instance then
		return false
	end
	local instanceName = instance.Name
  if hasEntryExportIdPrefix(instanceName, entry) then
return true
  end
	local instanceNorm = normalizeToken(instanceName)
	for _, candidateName in ipairs(candidateNamesForEntry(entry)) do
		if instanceName == candidateName or instanceNorm == normalizeToken(candidateName) then
			return true
		end
	end
	return false
end

local function trimText(value)
  return tostring(value or ""):gsub("^%s+", ""):gsub("%s+$", "")
end

local function textureGroupKey(name)
  local text = trimText(name)
  local stripped = text:gsub("[%s%._%-]*%d+$", "")
  stripped = trimText(stripped)
  return stripped ~= "" and stripped or text
end

local function texturePathKey(entry)
  if entry.hierarchyPath and #entry.hierarchyPath > 0 then
return table.concat(entry.hierarchyPath, ".")
  end
  return entry.name
end

local function manifestMeshPathMap()
  local lookup = {}
  local function visitMesh(entry)
if entry then
  lookup[texturePathKey(entry)] = entry
end
  end
  local function visitGroup(node)
if not node then
  return
end
for _, meshEntry in ipairs(node.meshes or {}) do
  visitMesh(meshEntry)
end
for _, child in ipairs(node.children or {}) do
  visitGroup(child)
end
  end
  for _, meshEntry in ipairs(manifest.rootMeshes or {}) do
visitMesh(meshEntry)
  end
  for _, node in ipairs(manifest.rootGroups or {}) do
visitGroup(node)
  end
  return lookup
end

local meshEntryByPath = manifestMeshPathMap()

local function normalizeTextureAssetId(value)
  local text = trimText(value)
  if text == "" then
return nil
  end
  if text:match("^rbxassetid://") or text:match("^rbxasset://") then
return text
  end
  if text:match("^%d+$") then
return "rbxassetid://" .. text
  end
  return text
end

local function resolveTextureReference(value)
  local text = trimText(value)
  if text == "" then
return nil
  end
  local catalogValue = textureCatalog[text]
  if catalogValue ~= nil then
local resolvedCatalog = normalizeTextureAssetId(catalogValue)
if resolvedCatalog then
  return resolvedCatalog
end
  end
  return normalizeTextureAssetId(text)
end

local function applyTextureFields(part, entry)
  local textureId = resolveTextureReference(textureByPath[texturePathKey(entry)] or textureByGroup[textureGroupKey(entry.name)])
  if not textureId then
return
  end
  pcall(function()
part.TextureID = textureId
  end)
  pcall(function()
part.TextureContent = textureId
  end)
  part:SetAttribute("ModelerTextureId", textureId)
end

local function resolvePositionSourceEntry(entry)
  return entry
end

local function robloxVectorFromStudio(values)
  return Vector3.new(
values and values[1] or 0,
values and values[2] or 0,
values and values[3] or 0
  )
end

local function manifestPackOrigin()
  return robloxVectorFromStudio(manifest.packOrigin)
end

local function resolveEntryCFrame(entry)
  local sourceEntry = resolvePositionSourceEntry(entry)
  local position = manifestPackOrigin() + robloxVectorFromStudio(sourceEntry.position)
  return CFrame.new(position)
end

local function makeMarkerPart(name, size, color, cf, parent)
  local part = Instance.new("Part")
  part.Name = name
  part.Size = size
  part.Color = color
  part.Anchored = true
  part.CanCollide = false
  part.CanTouch = false
  part.CanQuery = false
  part.Material = Enum.Material.Neon
  part.Transparency = markerTransparency
  part.CFrame = cf
  part.Parent = parent
  return part
end

local function markerDisplayName(entry)
  if markerLabelMode == "path" and entry.hierarchyPath and #entry.hierarchyPath > 0 then
return table.concat(entry.hierarchyPath, " > ")
  end
  local parts = entry.hierarchyPath or {}
  local tail = {}
  for index = math.max(1, #parts - 1), #parts do
if parts[index] then
  table.insert(tail, parts[index])
end
  end
  if #tail > 0 then
return table.concat(tail, " / ")
  end
  return entry.name
end

local function attachMarkerLabel(parent, text, orderIndex)
  if markerLabelMode == "none" then
return
  end
  local billboard = Instance.new("BillboardGui")
  billboard.Name = "Label"
  billboard.Size = UDim2.fromOffset(200, 30)
  billboard.StudsOffset = Vector3.new(0, markerSize * (1.7 + ((orderIndex or 0) % 4) * markerLabelStagger), 0)
  billboard.AlwaysOnTop = true
  billboard.MaxDistance = 250
  billboard.Parent = parent
  local label = Instance.new("TextLabel")
  label.Size = UDim2.fromScale(1, 1)
  label.BackgroundColor3 = Color3.fromRGB(10, 12, 18)
  label.BackgroundTransparency = 0.22
  label.BorderSizePixel = 0
  label.Text = text
  label.TextScaled = false
  label.TextSize = math.floor(16 * markerLabelScale)
  label.Font = Enum.Font.Code
  label.TextColor3 = Color3.fromRGB(255, 255, 255)
  label.TextStrokeTransparency = 0.2
  label.TextWrapped = false
  label.Parent = billboard
  local corner = Instance.new("UICorner")
  corner.CornerRadius = UDim.new(0, 5)
  corner.Parent = label
end

local function createPlacementMarker(entry, parent, orderIndex)
  local cf = resolveEntryCFrame(entry)
  local marker = Instance.new("Model")
  marker.Name = entry.name .. "_marker"
  marker.Parent = parent
  local core = makeMarkerPart("Core", Vector3.new(markerSize * 0.34, markerSize * 0.34, markerSize * 0.34), Color3.fromRGB(255, 221, 87), cf, marker)
  makeMarkerPart("AxisX", Vector3.new(markerSize, markerSize * 0.12, markerSize * 0.12), Color3.fromRGB(255, 96, 96), cf * CFrame.new(markerSize * 0.5, 0, 0), marker)
  makeMarkerPart("AxisY", Vector3.new(markerSize * 0.12, markerSize, markerSize * 0.12), Color3.fromRGB(110, 255, 110), cf * CFrame.new(0, markerSize * 0.5, 0), marker)
  makeMarkerPart("AxisZ", Vector3.new(markerSize * 0.12, markerSize * 0.12, markerSize), Color3.fromRGB(110, 180, 255), cf * CFrame.new(0, 0, markerSize * 0.5), marker)
  core:SetAttribute("ModelerMarkerPath", (entry.hierarchyPath and table.concat(entry.hierarchyPath, ".")) or entry.name)
  attachMarkerLabel(core, markerDisplayName(entry), orderIndex)
  return marker
end

local function clearPlacementMarkers()
  local existing = workspace:FindFirstChild(markerFolderName)
  if existing then
existing:Destroy()
  end
end

local function addAllPlacementMarkers(markerFolder)
  local markerIndex = 0
  local function addMarkersForGroup(node)
for _, meshEntry in ipairs(node.meshes or {}) do
  markerIndex += 1
  createPlacementMarker(meshEntry, markerFolder, markerIndex)
end
for _, child in ipairs(node.children or {}) do
  addMarkersForGroup(child)
end
  end
  for _, node in ipairs(manifest.rootGroups or {}) do
addMarkersForGroup(node)
  end
  for _, meshEntry in ipairs(manifest.rootMeshes or {}) do
markerIndex += 1
createPlacementMarker(meshEntry, markerFolder, markerIndex)
  end
  return markerIndex
end

local function showTargetMarkers()
  clearPlacementMarkers()
  local markerFolder = Instance.new("Folder")
  markerFolder.Name = markerFolderName
  markerFolder.Parent = workspace
  local markerCount = addAllPlacementMarkers(markerFolder)
  info("Created", markerCount, "target marker(s) at exact manifest positions for pack", manifest.name, manifest.packId or "")
  return markerFolder
end

local function findImportedPart(importedRoot, entry)
	local candidates = candidateNamesForEntry(entry)
	for _, candidateName in ipairs(candidates) do
		local found = importedRoot:FindFirstChild(candidateName, true)
		local meshPart = meshPartFromCandidate(found)
		if meshPart then
			info("Matched import by exact name:", candidateName, "->", meshPart:GetFullName())
			return meshPart
		end
	end
	local fallbackBySource = nil
	for _, descendant in ipairs(importedRoot:GetDescendants()) do
		if descendant:IsA("BasePart") and descendant:GetAttribute("ModelerSourceFile") == entry.file then
			fallbackBySource = descendant
			break
		end
		if descendant:IsA("BasePart") and descendant.Name == "default" and matchesEntryName(descendant.Parent, entry) then
			info("Matched import by wrapper/default:", descendant.Parent:GetFullName(), "->", descendant:GetFullName())
			return descendant
		end
		if matchesEntryName(descendant, entry) then
			local meshPart = meshPartFromCandidate(descendant)
			if meshPart then
				info("Matched import by normalized name:", descendant:GetFullName(), "->", meshPart:GetFullName())
				return meshPart
			end
		end
	end
	if fallbackBySource then
		info("Matched import by ModelerSourceFile attribute:", fallbackBySource:GetFullName())
		return fallbackBySource
	end
	error("Missing imported MeshPart or wrapper for: " .. entry.importName .. " (file " .. entry.file .. ")")
end

local function importedRotationCFrame(sourcePart)
  if not sourcePart then
return CFrame.new()
  end
  return sourcePart.CFrame - sourcePart.CFrame.Position
end

local function setPartTransform(part, entry, sourcePart)
  if useImportedRotation then
part.CFrame = resolveEntryCFrame(entry) * importedRotationCFrame(sourcePart)
  else
part.CFrame = resolveEntryCFrame(entry)
  end
  part:SetAttribute("ModelerSourceFile", entry.file)
  if entry.textureName then
part:SetAttribute("ModelerTexture", entry.textureName)
  end
end

local function attachMesh(importedRoot, entry, parent)
	local sourcePart = findImportedPart(importedRoot, entry)
	local part = sourcePart:Clone()
	part.Name = entry.name
	setPartTransform(part, entry, sourcePart)
  applyTextureFields(part, entry)
	part.Parent = parent
	part:SetAttribute("ModelerImportName", entry.importName)
	part:SetAttribute("ModelerBaseImportName", entry.baseImportName or entry.importName)
	part:SetAttribute("ModelerHierarchyPath", texturePathKey(entry))
	return part
end

local function buildGroup(importedRoot, node, parent)
  local container = Instance.new("Model")
  container.Name = node.name
  container.Parent = parent
  for _, meshEntry in ipairs(node.meshes or {}) do
attachMesh(importedRoot, meshEntry, container)
  end
  for _, child in ipairs(node.children or {}) do
buildGroup(importedRoot, child, container)
  end
  return container
end

local function buildPack(importedRoot)
  for _, child in ipairs(workspace:GetChildren()) do
if child:IsA("Model") and child ~= importedRoot and (child:GetAttribute("ModelerBuiltPack") == manifest.name or child.Name == manifest.name) then
  child:Destroy()
end
  end
  local root = Instance.new("Model")
  root.Name = manifest.name
  root:SetAttribute("ModelerBuiltPack", manifest.name)
  root.Parent = workspace
  local markerFolder = nil
  if createPlacementMarkers then
clearPlacementMarkers()
markerFolder = Instance.new("Folder")
markerFolder.Name = markerFolderName
markerFolder.Parent = workspace
  end
  for _, node in ipairs(manifest.rootGroups or {}) do
buildGroup(importedRoot, node, root)
  end
  for _, meshEntry in ipairs(manifest.rootMeshes or {}) do
attachMesh(importedRoot, meshEntry, root)
  end
  if markerFolder then
addAllPlacementMarkers(markerFolder)
  end
  return root
end

local function diagnoseImports()
  local importedRoot = resolveImportedRoot()
  local checked = 0
  local missing = 0

  local function visitMesh(entry)
checked += 1
local ok, partOrMessage = pcall(function()
  return findImportedPart(importedRoot, entry)
end)
if ok and partOrMessage then
  local part = partOrMessage
  info("Import", checked, texturePathKey(entry), "source", part:GetFullName(), "sourcePos", tostring(part.Position), "sourceRot", tostring(part.Orientation), "targetPos", tostring(resolveEntryCFrame(entry).Position), "localOffset", tostring(robloxVectorFromStudio(entry.position)))
else
  missing += 1
  warnf("Missing import for", texturePathKey(entry), entry.file, partOrMessage)
end
  end

  local function visitGroup(node)
for _, meshEntry in ipairs(node.meshes or {}) do
  visitMesh(meshEntry)
end
for _, child in ipairs(node.children or {}) do
  visitGroup(child)
end
  end

  for _, node in ipairs(manifest.rootGroups or {}) do
visitGroup(node)
  end
  for _, meshEntry in ipairs(manifest.rootMeshes or {}) do
visitMesh(meshEntry)
  end
  info("Diagnose complete. Checked", checked, "mesh entries. Missing", missing)
end

local function rebuildFromSelection()
  local importedRoot = resolveImportedRoot()
  info("Rebuilding pack:", manifest.name)
  local built = buildPack(importedRoot)
  info("Built Roblox model hierarchy:", built:GetFullName())
  return built
end

_G.ModelerRebuildPack = rebuildFromSelection
_G.ModelerDiagnoseImports = diagnoseImports
_G.ModelerShowTargetMarkers = showTargetMarkers
_G.ModelerClearTargetMarkers = clearPlacementMarkers

local built = rebuildFromSelection()
info("Command helpers installed: _G.ModelerRebuildPack(), _G.ModelerDiagnoseImports(), _G.ModelerShowTargetMarkers(), _G.ModelerClearTargetMarkers()")
`;
}

function robloxPluginLua(manifest) {
  const manifestLua = toLuaLiteral(manifest, 0);
  const textureAssignments = collectRobloxTextureAssignments(manifest);
  const textureCatalog = collectRobloxTextureCatalog();
  const textureCatalogLua = toLuaLiteral(textureCatalog, 0);
  const textureByGroupLua = toLuaLiteral(textureAssignments.byGroup, 0);
  const textureByPathLua = toLuaLiteral(textureAssignments.byPath, 0);
  return `-- 3D Model Studio Roblox rebuild plugin
local pluginObj = plugin
local Selection = game:GetService("Selection")

local textureCatalog = ${textureCatalogLua}
local textureByGroup = ${textureByGroupLua}
local textureByPath = ${textureByPathLua}
local createPlacementMarkers = false
local useImportedRotation = false -- OBJ geometry is already exported in final orientation; only apply manifest position.
local markerFolderName = "ModelerPlacementMarkers"
local markerSize = 0.35
local markerTransparency = 0.2
local markerLabelMode = "short" -- "short", "path", or "none"
local markerLabelScale = 0.75
local markerLabelStagger = 0.18

local manifest = ${manifestLua}

local function info(...)
  print("[3D Model Studio]", ...)
end

local function isBuiltPackSelection(instance)
  local current = instance
  while current do
if current:IsA("Model") and (current:GetAttribute("ModelerBuiltPack") == manifest.name or current.Name == manifest.name) then
  return true
end
current = current.Parent
  end
  return false
end

local function collectManifestExportIds()
  local ids = {}
  local function addMesh(entry)
if entry and entry.exportId then
  table.insert(ids, tostring(entry.exportId):gsub("%.obj$", ""))
end
  end
  local function visitGroup(node)
if not node then
  return
end
for _, meshEntry in ipairs(node.meshes or {}) do
  addMesh(meshEntry)
end
for _, child in ipairs(node.children or {}) do
  visitGroup(child)
end
  end
  for _, node in ipairs(manifest.rootGroups or {}) do
visitGroup(node)
  end
  for _, meshEntry in ipairs(manifest.rootMeshes or {}) do
addMesh(meshEntry)
  end
  return ids
end

local manifestExportIds = collectManifestExportIds()

local function instanceNameMatchesExportId(instance, exportId)
  local name = string.lower(tostring(instance and instance.Name or "")):gsub("%.obj$", "")
  local token = string.lower(tostring(exportId or "")):gsub("%.obj$", "")
  if token == "" then
return false
  end
  return name == token or string.sub(name, 1, #token + 1) == token .. "_" or string.find(name, token, 1, true) ~= nil
end

local function countExportIdMatches(root)
  if not root then
return 0
  end
  local seen = {}
  local count = 0
  local function check(instance)
for _, exportId in ipairs(manifestExportIds) do
  if not seen[exportId] and instanceNameMatchesExportId(instance, exportId) then
    seen[exportId] = true
    count += 1
    break
  end
end
  end
  check(root)
  for _, descendant in ipairs(root:GetDescendants()) do
check(descendant)
  end
  return count
end

local function bestImportRootFromWorkspace()
  local bestRoot = nil
  local bestCount = 0
  local workspaceCount = countExportIdMatches(workspace)
  if workspaceCount > 0 then
bestRoot = workspace
bestCount = workspaceCount
  end
  for _, child in ipairs(workspace:GetChildren()) do
if not isBuiltPackSelection(child) then
  local count = countExportIdMatches(child)
  if count > bestCount then
    bestRoot = child
    bestCount = count
  end
end
  end
  return bestRoot, bestCount
end

local function findImportedRoot()
  local expectedCount = #manifestExportIds
  local selected = Selection:Get()[1]
  if selected then
if isBuiltPackSelection(selected) then
  warn("[3D Model Studio]", "Selected object is the rebuilt model, not the imported source. Searching Workspace for imported OBJ IDs.")
else
  local selectedCount = countExportIdMatches(selected)
  if expectedCount <= 1 or selectedCount >= expectedCount then
    info("Using selected imported root:", selected:GetFullName(), "matched", selectedCount, "of", expectedCount, "OBJ IDs")
    return selected
  end
  local bestRoot, bestCount = bestImportRootFromWorkspace()
  if bestRoot and bestCount > selectedCount then
    warn("[3D Model Studio]", "Selected object only contains", selectedCount, "of", expectedCount, "OBJ IDs. Using", bestRoot:GetFullName(), "with", bestCount, "matches instead.")
    return bestRoot
  end
  if selectedCount > 0 then
    warn("[3D Model Studio]", "Selected object only contains", selectedCount, "of", expectedCount, "OBJ IDs, but no better root was found. Trying selected object anyway.")
    return selected
  end
  warn("[3D Model Studio]", "Selected object has no matching exported OBJ IDs. Searching Workspace.")
end
  end
  local fallback = workspace:FindFirstChild("ImportedParts")
  if fallback then
local fallbackCount = countExportIdMatches(fallback)
if fallbackCount > 0 then
  info("Using fallback imported root:", fallback:GetFullName(), "matched", fallbackCount, "of", expectedCount, "OBJ IDs")
  return fallback
end
warn("[3D Model Studio]", "workspace.ImportedParts exists but contains no matching exported OBJ IDs. Searching Workspace.")
  end
  local bestRoot, bestCount = bestImportRootFromWorkspace()
  if bestRoot and bestCount > 0 then
info("Using discovered imported root:", bestRoot:GetFullName(), "matched", bestCount, "of", expectedCount, "OBJ IDs")
return bestRoot
  end
  return nil
end

local function meshPartFromCandidate(candidate)
	if not candidate then
		return nil
  end
  if candidate:IsA("MeshPart") or candidate:IsA("Part") or candidate:IsA("BasePart") then
return candidate
  end
  if candidate:IsA("Model") or candidate:IsA("Folder") then
local descendants = candidate:GetDescendants()
local firstBasePart = nil
local basePartCount = 0
for _, descendant in ipairs(descendants) do
  if descendant:IsA("BasePart") then
    firstBasePart = firstBasePart or descendant
    basePartCount += 1
  end
end
if basePartCount == 1 then
  return firstBasePart
end
	end
	return nil
end

local function normalizeToken(value)
	local text = tostring(value or "")
	text = text:gsub("%.obj$", "")
	text = text:gsub("%.%.%.$", "")
	text = text:gsub("%.%.%.", "_")
	text = text:gsub("[^%w]+", "_")
	text = text:gsub("_+", "_")
	text = text:gsub("^_+", "")
	text = text:gsub("_+$", "")
	return string.lower(text)
end

local function candidateNamesForEntry(entry)
	local names = {
entry.exportId,
		entry.importName,
		entry.importName .. ".obj",
		entry.file
	}
	return names
end

local function hasEntryExportIdPrefix(instanceName, entry)
  local exportId = tostring(entry.exportId or entry.importName or ""):gsub("%.obj$", "")
  if exportId == "" then
return false
  end
  local instanceNorm = normalizeToken(instanceName)
  local exportNorm = normalizeToken(exportId)
  return instanceNorm == exportNorm or string.sub(instanceNorm, 1, #exportNorm + 1) == exportNorm .. "_"
end

local function matchesEntryName(instance, entry)
	if not instance then
		return false
	end
	local instanceName = instance.Name
  if hasEntryExportIdPrefix(instanceName, entry) then
return true
  end
	local instanceNorm = normalizeToken(instanceName)
	for _, candidateName in ipairs(candidateNamesForEntry(entry)) do
		if instanceName == candidateName or instanceNorm == normalizeToken(candidateName) then
			return true
		end
	end
	return false
end

local function trimText(value)
  return tostring(value or ""):gsub("^%s+", ""):gsub("%s+$", "")
end

local function textureGroupKey(name)
  local text = trimText(name)
  local stripped = text:gsub("[%s%._%-]*%d+$", "")
  stripped = trimText(stripped)
  return stripped ~= "" and stripped or text
end

local function texturePathKey(entry)
  if entry.hierarchyPath and #entry.hierarchyPath > 0 then
return table.concat(entry.hierarchyPath, ".")
  end
  return entry.name
end

local function manifestMeshPathMap()
  local lookup = {}
  local function visitMesh(entry)
if entry then
  lookup[texturePathKey(entry)] = entry
end
  end
  local function visitGroup(node)
if not node then
  return
end
for _, meshEntry in ipairs(node.meshes or {}) do
  visitMesh(meshEntry)
end
for _, child in ipairs(node.children or {}) do
  visitGroup(child)
end
  end
  for _, meshEntry in ipairs(manifest.rootMeshes or {}) do
visitMesh(meshEntry)
  end
  for _, node in ipairs(manifest.rootGroups or {}) do
visitGroup(node)
  end
  return lookup
end

local meshEntryByPath = manifestMeshPathMap()

local function normalizeTextureAssetId(value)
  local text = trimText(value)
  if text == "" then
return nil
  end
  if text:match("^rbxassetid://") or text:match("^rbxasset://") then
return text
  end
  if text:match("^%d+$") then
return "rbxassetid://" .. text
  end
  return text
end

local function resolveTextureReference(value)
  local text = trimText(value)
  if text == "" then
return nil
  end
  local catalogValue = textureCatalog[text]
  if catalogValue ~= nil then
local resolvedCatalog = normalizeTextureAssetId(catalogValue)
if resolvedCatalog then
  return resolvedCatalog
end
  end
  return normalizeTextureAssetId(text)
end

local function applyTextureFields(part, entry)
  local textureId = resolveTextureReference(textureByPath[texturePathKey(entry)] or textureByGroup[textureGroupKey(entry.name)])
  if not textureId then
return
  end
  pcall(function()
part.TextureID = textureId
  end)
  pcall(function()
part.TextureContent = textureId
  end)
  part:SetAttribute("ModelerTextureId", textureId)
end

local function resolvePositionSourceEntry(entry)
  return entry
end

local function robloxVectorFromStudio(values)
  return Vector3.new(
values and values[1] or 0,
values and values[2] or 0,
values and values[3] or 0
  )
end

local function manifestPackOrigin()
  return robloxVectorFromStudio(manifest.packOrigin)
end

local function resolveEntryCFrame(entry)
  local sourceEntry = resolvePositionSourceEntry(entry)
  local position = manifestPackOrigin() + robloxVectorFromStudio(sourceEntry.position)
  return CFrame.new(position)
end

local function makeMarkerPart(name, size, color, cf, parent)
  local part = Instance.new("Part")
  part.Name = name
  part.Size = size
  part.Color = color
  part.Anchored = true
  part.CanCollide = false
  part.CanTouch = false
  part.CanQuery = false
  part.Material = Enum.Material.Neon
  part.Transparency = markerTransparency
  part.CFrame = cf
  part.Parent = parent
  return part
end

local function markerDisplayName(entry)
  if markerLabelMode == "path" and entry.hierarchyPath and #entry.hierarchyPath > 0 then
return table.concat(entry.hierarchyPath, " > ")
  end
  local parts = entry.hierarchyPath or {}
  local tail = {}
  for index = math.max(1, #parts - 1), #parts do
if parts[index] then
  table.insert(tail, parts[index])
end
  end
  if #tail > 0 then
return table.concat(tail, " / ")
  end
  return entry.name
end

local function attachMarkerLabel(parent, text, orderIndex)
  if markerLabelMode == "none" then
return
  end
  local billboard = Instance.new("BillboardGui")
  billboard.Name = "Label"
  billboard.Size = UDim2.fromOffset(200, 30)
  billboard.StudsOffset = Vector3.new(0, markerSize * (1.7 + ((orderIndex or 0) % 4) * markerLabelStagger), 0)
  billboard.AlwaysOnTop = true
  billboard.MaxDistance = 250
  billboard.Parent = parent
  local label = Instance.new("TextLabel")
  label.Size = UDim2.fromScale(1, 1)
  label.BackgroundColor3 = Color3.fromRGB(10, 12, 18)
  label.BackgroundTransparency = 0.22
  label.BorderSizePixel = 0
  label.Text = text
  label.TextScaled = false
  label.TextSize = math.floor(16 * markerLabelScale)
  label.Font = Enum.Font.Code
  label.TextColor3 = Color3.fromRGB(255, 255, 255)
  label.TextStrokeTransparency = 0.2
  label.TextWrapped = false
  label.Parent = billboard
  local corner = Instance.new("UICorner")
  corner.CornerRadius = UDim.new(0, 5)
  corner.Parent = label
end

local function createPlacementMarker(entry, parent, orderIndex)
  local cf = resolveEntryCFrame(entry)
  local marker = Instance.new("Model")
  marker.Name = entry.name .. "_marker"
  marker.Parent = parent
  local core = makeMarkerPart("Core", Vector3.new(markerSize * 0.34, markerSize * 0.34, markerSize * 0.34), Color3.fromRGB(255, 221, 87), cf, marker)
  makeMarkerPart("AxisX", Vector3.new(markerSize, markerSize * 0.12, markerSize * 0.12), Color3.fromRGB(255, 96, 96), cf * CFrame.new(markerSize * 0.5, 0, 0), marker)
  makeMarkerPart("AxisY", Vector3.new(markerSize * 0.12, markerSize, markerSize * 0.12), Color3.fromRGB(110, 255, 110), cf * CFrame.new(0, markerSize * 0.5, 0), marker)
  makeMarkerPart("AxisZ", Vector3.new(markerSize * 0.12, markerSize * 0.12, markerSize), Color3.fromRGB(110, 180, 255), cf * CFrame.new(0, 0, markerSize * 0.5), marker)
  core:SetAttribute("ModelerMarkerPath", (entry.hierarchyPath and table.concat(entry.hierarchyPath, ".")) or entry.name)
  attachMarkerLabel(core, markerDisplayName(entry), orderIndex)
  return marker
end

local function findImportedPart(importedRoot, entry)
	for _, candidateName in ipairs(candidateNamesForEntry(entry)) do
		local found = importedRoot and importedRoot:FindFirstChild(candidateName, true)
		local meshPart = meshPartFromCandidate(found)
		if meshPart then
			info("Matched import by exact name:", candidateName, "->", meshPart:GetFullName())
			return meshPart
		end
	end
	for _, descendant in ipairs(importedRoot:GetDescendants()) do
		if descendant:IsA("BasePart") and descendant.Name == "default" and matchesEntryName(descendant.Parent, entry) then
			info("Matched import by wrapper/default:", descendant.Parent:GetFullName(), "->", descendant:GetFullName())
			return descendant
		end
		if matchesEntryName(descendant, entry) then
			local meshPart = meshPartFromCandidate(descendant)
			if meshPart then
				info("Matched import by normalized name:", descendant:GetFullName(), "->", meshPart:GetFullName())
				return meshPart
			end
		end
	end
	error("Missing imported MeshPart or wrapper for: " .. entry.importName .. " (file " .. entry.file .. ")")
end

local function importedRotationCFrame(sourcePart)
  if not sourcePart then
return CFrame.new()
  end
  return sourcePart.CFrame - sourcePart.CFrame.Position
end

local function setPartTransform(part, entry, sourcePart)
  if useImportedRotation then
part.CFrame = resolveEntryCFrame(entry) * importedRotationCFrame(sourcePart)
  else
part.CFrame = resolveEntryCFrame(entry)
  end
  part:SetAttribute("ModelerSourceFile", entry.file)
  if entry.textureName then
part:SetAttribute("ModelerTexture", entry.textureName)
  end
end

local function attachMesh(importedRoot, entry, parent)
	local sourcePart = findImportedPart(importedRoot, entry)
	local part = sourcePart:Clone()
	part.Name = entry.name
	setPartTransform(part, entry, sourcePart)
  applyTextureFields(part, entry)
	part.Parent = parent
  part:SetAttribute("ModelerImportName", entry.importName)
  part:SetAttribute("ModelerBaseImportName", entry.baseImportName or entry.importName)
  part:SetAttribute("ModelerHierarchyPath", texturePathKey(entry))
  return part
end

local function buildGroup(importedRoot, node, parent)
  local container = Instance.new("Model")
  container.Name = node.name
  container.Parent = parent
  for _, meshEntry in ipairs(node.meshes or {}) do
attachMesh(importedRoot, meshEntry, container)
  end
  for _, child in ipairs(node.children or {}) do
buildGroup(importedRoot, child, container)
  end
  return container
end

local function rebuild()
  local importedRoot = findImportedRoot()
  assert(importedRoot, "Select the imported pack folder/model first, or create workspace.ImportedParts.")
  info("Rebuilding pack:", manifest.name)
  for _, child in ipairs(workspace:GetChildren()) do
if child:IsA("Model") and child ~= importedRoot and (child:GetAttribute("ModelerBuiltPack") == manifest.name or child.Name == manifest.name) then
  child:Destroy()
end
  end
  local root = Instance.new("Model")
  root.Name = manifest.name
  root:SetAttribute("ModelerBuiltPack", manifest.name)
  root.Parent = workspace
  local markerFolder = nil
  if createPlacementMarkers then
local existing = workspace:FindFirstChild(markerFolderName)
if existing then existing:Destroy() end
markerFolder = Instance.new("Folder")
markerFolder.Name = markerFolderName
markerFolder.Parent = workspace
  end
  for _, node in ipairs(manifest.rootGroups or {}) do
buildGroup(importedRoot, node, root)
  end
  for _, meshEntry in ipairs(manifest.rootMeshes or {}) do
attachMesh(importedRoot, meshEntry, root)
  end
  if markerFolder then
local markerIndex = 0
local function addMarkersForGroup(node)
  for _, meshEntry in ipairs(node.meshes or {}) do
    markerIndex += 1
    createPlacementMarker(meshEntry, markerFolder, markerIndex)
  end
  for _, child in ipairs(node.children or {}) do
    addMarkersForGroup(child)
  end
end
for _, node in ipairs(manifest.rootGroups or {}) do
  addMarkersForGroup(node)
end
for _, meshEntry in ipairs(manifest.rootMeshes or {}) do
  markerIndex += 1
  createPlacementMarker(meshEntry, markerFolder, markerIndex)
end
  end
  Selection:Set({ root })
  info("Built Roblox model hierarchy:", root:GetFullName())
end

if pluginObj then
  local toolbar = pluginObj:CreateToolbar("3D Model Studio")
  local rebuildButton = toolbar:CreateButton("RebuildPack", "Rebuild imported MeshParts into " .. manifest.name, "")
  local menuButton = toolbar:CreateButton("ModelerTools", "Open rebuild tools for " .. manifest.name, "")

  local widgetInfo = DockWidgetPluginGuiInfo.new(
Enum.InitialDockState.Right,
true,
false,
420,
560,
300,
360
  )
  local widget = pluginObj:CreateDockWidgetPluginGui("ModelerTools_" .. manifest.name, widgetInfo)
  widget.Title = "3D Model Studio Tools"

  local rootFrame = Instance.new("Frame")
  rootFrame.Size = UDim2.fromScale(1, 1)
  rootFrame.BackgroundColor3 = Color3.fromRGB(22, 24, 30)
  rootFrame.BorderSizePixel = 0
  rootFrame.Parent = widget

  local topBar = Instance.new("Frame")
  topBar.Size = UDim2.new(1, -12, 0, 72)
  topBar.Position = UDim2.fromOffset(6, 6)
  topBar.BackgroundTransparency = 1
  topBar.Parent = rootFrame

  local title = Instance.new("TextLabel")
  title.Size = UDim2.new(1, 0, 0, 20)
  title.BackgroundTransparency = 1
  title.TextXAlignment = Enum.TextXAlignment.Left
  title.Font = Enum.Font.SourceSansBold
  title.TextSize = 18
  title.TextColor3 = Color3.fromRGB(255, 255, 255)
  title.Text = manifest.name .. " rebuild tools"
  title.Parent = topBar

  local subtitle = Instance.new("TextLabel")
  subtitle.Size = UDim2.new(1, 0, 0, 18)
  subtitle.Position = UDim2.fromOffset(0, 22)
  subtitle.BackgroundTransparency = 1
  subtitle.TextXAlignment = Enum.TextXAlignment.Left
  subtitle.Font = Enum.Font.SourceSans
  subtitle.TextSize = 14
  subtitle.TextColor3 = Color3.fromRGB(186, 192, 204)
  subtitle.Text = "Rebuild the pack, diagnose import matching, or toggle placement markers."
  subtitle.Parent = topBar

  local rebuildNow = Instance.new("TextButton")
  rebuildNow.Size = UDim2.fromOffset(116, 30)
  rebuildNow.Position = UDim2.fromOffset(0, 42)
  rebuildNow.BackgroundColor3 = Color3.fromRGB(52, 168, 120)
  rebuildNow.TextColor3 = Color3.fromRGB(255, 255, 255)
  rebuildNow.Text = "Rebuild"
  rebuildNow.Font = Enum.Font.SourceSansSemibold
  rebuildNow.TextSize = 16
  rebuildNow.AutoButtonColor = true
  rebuildNow.Parent = topBar

  local markerToggle = Instance.new("TextButton")
  markerToggle.Size = UDim2.fromOffset(132, 30)
  markerToggle.Position = UDim2.fromOffset(126, 42)
  markerToggle.BackgroundColor3 = Color3.fromRGB(48, 56, 72)
  markerToggle.TextColor3 = Color3.fromRGB(255, 255, 255)
  markerToggle.Text = createPlacementMarkers and "Markers: On" or "Markers: Off"
  markerToggle.Font = Enum.Font.SourceSansSemibold
  markerToggle.TextSize = 16
  markerToggle.AutoButtonColor = true
  markerToggle.Parent = topBar

  local function makeActionButton(label, color)
local button = Instance.new("TextButton")
button.Size = UDim2.fromOffset(120, 30)
button.BackgroundColor3 = color or Color3.fromRGB(48, 56, 72)
button.TextColor3 = Color3.fromRGB(255, 255, 255)
button.Text = label
button.Font = Enum.Font.SourceSansSemibold
button.TextSize = 16
button.AutoButtonColor = true
local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 5)
corner.Parent = button
return button
  end

  local diagnoseButton = makeActionButton("Diagnose", Color3.fromRGB(82, 126, 204))
  diagnoseButton.Position = UDim2.fromOffset(268, 42)
  diagnoseButton.Parent = topBar

  local scroll = Instance.new("ScrollingFrame")
  scroll.Size = UDim2.new(1, -12, 1, -84)
  scroll.Position = UDim2.fromOffset(6, 78)
  scroll.BackgroundColor3 = Color3.fromRGB(14, 16, 22)
  scroll.BorderSizePixel = 0
  scroll.ScrollBarThickness = 8
  scroll.CanvasSize = UDim2.fromOffset(0, 0)
  scroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
  scroll.Parent = rootFrame

  local list = Instance.new("UIListLayout")
  list.Padding = UDim.new(0, 6)
  list.Parent = scroll

  local listPad = Instance.new("UIPadding")
  listPad.PaddingTop = UDim.new(0, 6)
  listPad.PaddingBottom = UDim.new(0, 6)
  listPad.PaddingLeft = UDim.new(0, 6)
  listPad.PaddingRight = UDim.new(0, 6)
  listPad.Parent = scroll

  local infoCard = Instance.new("Frame")
  infoCard.Size = UDim2.new(1, -4, 0, 132)
  infoCard.BackgroundColor3 = Color3.fromRGB(28, 31, 40)
  infoCard.BorderSizePixel = 0
  infoCard.Parent = scroll
  local infoCorner = Instance.new("UICorner")
  infoCorner.CornerRadius = UDim.new(0, 6)
  infoCorner.Parent = infoCard

  local infoTitle = Instance.new("TextLabel")
  infoTitle.Size = UDim2.new(1, -16, 0, 22)
  infoTitle.Position = UDim2.fromOffset(8, 8)
  infoTitle.BackgroundTransparency = 1
  infoTitle.TextXAlignment = Enum.TextXAlignment.Left
  infoTitle.Font = Enum.Font.SourceSansBold
  infoTitle.TextSize = 17
  infoTitle.TextColor3 = Color3.fromRGB(255, 255, 255)
  infoTitle.Text = "Rebuild imported pack"
  infoTitle.Parent = infoCard

  local infoText = Instance.new("TextLabel")
  infoText.Size = UDim2.new(1, -16, 0, 84)
  infoText.Position = UDim2.fromOffset(8, 34)
  infoText.BackgroundTransparency = 1
  infoText.TextWrapped = true
  infoText.TextXAlignment = Enum.TextXAlignment.Left
  infoText.TextYAlignment = Enum.TextYAlignment.Top
  infoText.Font = Enum.Font.SourceSans
  infoText.TextSize = 15
  infoText.TextColor3 = Color3.fromRGB(186, 192, 204)
  infoText.Text = "1. Import every OBJ from the exported ZIP.\n2. Select the imported folder/model in Explorer.\n3. Click Rebuild.\n\nPlacement is ID-based: each mesh_XXXXX OBJ is placed at manifest.packOrigin plus its saved local offset."
  infoText.Parent = infoCard

  local function diagnoseImports()
local importedRoot = findImportedRoot()
if not importedRoot then
  warn("[3D Model Studio]", "Select the imported OBJ folder/model in Explorer, or create workspace.ImportedParts.")
  return
end

local checked = 0
local missing = 0
local function visitMesh(entry)
  checked += 1
  local ok, partOrMessage = pcall(function()
    return findImportedPart(importedRoot, entry)
  end)
  if ok and partOrMessage then
    local part = partOrMessage
    info("Import", checked, texturePathKey(entry), "source", part:GetFullName(), "sourcePos", tostring(part.Position), "sourceRot", tostring(part.Orientation), "targetPos", tostring(resolveEntryCFrame(entry).Position), "localOffset", tostring(robloxVectorFromStudio(entry.position)))
  else
    missing += 1
    warn("[3D Model Studio]", "Missing import for", texturePathKey(entry), entry.file, partOrMessage)
  end
end

local function visitGroup(node)
  for _, meshEntry in ipairs(node.meshes or {}) do
    visitMesh(meshEntry)
  end
  for _, child in ipairs(node.children or {}) do
    visitGroup(child)
  end
end

for _, node in ipairs(manifest.rootGroups or {}) do
  visitGroup(node)
end
for _, meshEntry in ipairs(manifest.rootMeshes or {}) do
  visitMesh(meshEntry)
end
info("Diagnose complete. Checked", checked, "mesh entries. Missing", missing)
  end

  rebuildButton.Click:Connect(function()
rebuild()
  end)
  rebuildNow.MouseButton1Click:Connect(function()
rebuild()
  end)
  diagnoseButton.MouseButton1Click:Connect(function()
diagnoseImports()
  end)
  markerToggle.MouseButton1Click:Connect(function()
createPlacementMarkers = not createPlacementMarkers
markerToggle.Text = createPlacementMarkers and "Markers: On" or "Markers: Off"
  end)
  menuButton.Click:Connect(function()
widget.Enabled = not widget.Enabled
  end)
else
  rebuild()
end
`;
}

function exportObjParts() {

  const targets = objects.slice();
  if (!targets.length) {
    log("No mesh parts to export.");
    return [];
  }
  const exporter = new OBJExporter();
  const usedNames = new Map();
  const exports = [];
  const fileEntries = [];
  const zipEntries = [];
  const baseProjectName = currentProjectBaseName();
  const robloxAxisMode = currentRobloxAxisMode();
  const packPrefix = robloxPackExportPrefix();
  const packRoot = `${baseProjectName}-roblox-pack`;
  for (const mesh of targets) {
    const pathSegments = hierarchySegmentsForMesh(mesh);
    const base = pathSegments.join(".");
    const count = (usedNames.get(base) || 0) + 1;
    usedNames.set(base, count);
    const exportId = robloxExportId(exports.length, packPrefix);
    const importName = exportId;
    const fileName = `${importName}.obj`;
    const { exportMesh, center, bounds, basis } = exportReadyMeshPart(mesh, { forRoblox: true, mirrorAxis: ROBLOX_PACK_GEOMETRY_MIRROR_AXES, robloxAxisMode });
    const text = exporter.parse(exportMesh);
    zipEntries.push({
      name: `${packRoot}/${fileName}`,
      data: text
    });
    exportMesh.geometry.dispose();
    exportMesh.material.dispose?.();
    exports.push(fileName);
    fileEntries.push({
      mesh,
      exportId,
      fileName,
      importName,
      baseImportName: importName,
      center,
      bounds,
      basis,
      pathSegments
    });
  }
  const manifest = robloxManifestForTargets(targets, fileEntries, packPrefix);
  const texturePackage = collectRobloxTextureFiles(packRoot);
  manifest.textureFiles = texturePackage.manifestFiles;
  zipEntries.push(...texturePackage.zipEntries);
  const manifestName = `${baseProjectName}-roblox-manifest.json`;
  const scriptName = `${baseProjectName}-roblox-setup.lua`;
  const pluginName = `${baseProjectName}-roblox-plugin.lua`;
  zipEntries.push(
    {
      name: `${packRoot}/${manifestName}`,
      data: JSON.stringify(manifest, null, 2)
    },
    {
      name: `${packRoot}/${scriptName}`,
      data: robloxSetupLua(manifest)
    },
    {
      name: `${packRoot}/${pluginName}`,
      data: robloxPluginLua(manifest)
    }
  );
  const zipBlob = makeZip(zipEntries);
  const zipName = `${packRoot}.zip`;
  downloadBlob(zipName, zipBlob);
  log(`Exported ${exports.length} Roblox-ready OBJ part${exports.length === 1 ? "" : "s"} into ${zipName}. The ZIP includes centered per-part OBJ files, the hierarchy manifest, and both Roblox rebuild scripts.`, {
    archive: zipName,
    rootFolder: packRoot,
    packId: packPrefix,
    axisMode: robloxAxisMode,
    geometryMirrorAxes: ROBLOX_PACK_GEOMETRY_MIRROR_AXES,
    textureFiles: texturePackage.zipEntries.length,
    objFiles: exports,
    manifest: manifestName,
    script: scriptName,
    plugin: pluginName
  });
  return exports;
}

