import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {SimplifyModifier} from 'three/addons/modifiers/SimplifyModifier.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
let crc32Table=null;const utf8Encoder=new TextEncoder();
function gameCharacterSafeName(value, fallback = "item") {
  const cleaned = String(value || fallback).trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return cleaned || fallback;
}

function pointSegmentDistanceSquared(point, start, end) {
  const segment = end.clone().sub(start);
  const lengthSquared = segment.lengthSq();
  if (lengthSquared < 1e-8) return point.distanceToSquared(start);
  const t = THREE.MathUtils.clamp(point.clone().sub(start).dot(segment) / lengthSquared, 0, 1);
  return point.distanceToSquared(start.clone().addScaledVector(segment, t));
}

function skinCandidatesForVertex(point, bones) {
  // Use stable semantic IDs for fitted human rigs. Keep the legacy name path
  // below for imported skeletons without these IDs.
  const human = bones.some(bone => bone.id === "left_hand") && bones.some(bone => bone.id === "pelvis");
  if (human) {
    const index = id => bones.findIndex(bone => bone.id === id);
    const ids = names => names.map(index).filter(i => i >= 0);
    const get = id => bones[index(id)];
    const start = bone => bone.bindPosition || bone.position;
    const end = bone => bone.bindTail || bone.tail || start(bone);
    const distance = bone => pointSegmentDistanceSquared(point, start(bone), end(bone));
    const left = get("left_hand"), right = get("right_hand");
    const side = Math.abs(point.x - start(left).x) <= Math.abs(point.x - start(right).x) ? "left" : "right";
    const hand = get(`${side}_hand`), arm = get(`${side}_forearm`);
    const pelvis = get("pelvis"), chest = get("chest");
    const scale = Math.max(.1, Math.abs(start(chest).y - start(pelvis).y) / .48);
    if (point.y <= start(pelvis).y + .12 * scale) {
      return ids([`${side}_foot`, `${side}_shin`, `${side}_thigh`, "pelvis"]);
    }
    const shoulder = get(`${side}_upper_arm`);
    const armStart = shoulder ? Math.abs(start(shoulder).x) : .24 * scale;
    if (Math.abs(point.x) > armStart && point.y > start(chest).y - .2 * scale) {
      const wristStart = arm ? Math.abs(start(arm).x) + Math.abs(start(hand).x - start(arm).x) * .72 : Math.abs(start(hand).x);
      if (Math.abs(point.x) >= wristStart) {
        const digits = ["thumb", "index", "middle", "ring", "pinky"].map(digit => {
          const chain = ids([`${side}_${digit}`, `${side}_${digit}_middle`, `${side}_${digit}_tip`]);
          return { chain, distance: Math.min(...chain.map(i => distance(bones[i]))) };
        }).filter(digit => digit.chain.length).sort((a, b) => a.distance - b.distance);
        const nearest = digits[0];
        if (nearest) {
          const proximal = bones[nearest.chain[0]];
          const axis = end(proximal).clone().sub(start(proximal)).normalize();
          const pastKnuckle = point.clone().sub(start(proximal)).dot(axis) > .005 * scale;
          if (pastKnuckle || nearest.distance < distance(hand)) {
            // Adjacent fingers must not drag each other. Blend only within the
            // winning digit, adding the palm at its root transition.
            return pastKnuckle ? nearest.chain : [...nearest.chain, ...ids([`${side}_hand`])];
          }
        }
        return ids([`${side}_hand`, `${side}_forearm`]);
      }
      return ids([`${side}_forearm`, `${side}_upper_arm`, "chest"]);
    }
    if (point.y > start(chest).y + .15 * scale) return ids(["head", "neck", "chest"]);
    return ids(["pelvis", "spine", "chest", "neck"]);
  }
  const byName = name => bones.findIndex(bone => bone.name === name);
  const named = names => names.map(byName).filter(index => index >= 0);
  const leftReference = bones.find(bone => bone.name === "Hand L")
    || bones.find(bone => bone.name === "Thigh L");
  const rightReference = bones.find(bone => bone.name === "Hand R")
    || bones.find(bone => bone.name === "Thigh R");
  const leftX = leftReference?.bindPosition?.x ?? leftReference?.position?.x;
  const rightX = rightReference?.bindPosition?.x ?? rightReference?.position?.x;
  // Imported tools disagree about whether the model's left side is +X or -X.
  // Pick the named chain whose placed joints are physically closest instead of
  // assigning weights from a hard-coded axis sign.
  const side = Number.isFinite(leftX) && Number.isFinite(rightX)
    ? (Math.abs(point.x - leftX) <= Math.abs(point.x - rightX) ? "L" : "R")
    : (point.x < 0 ? "L" : "R");
  const pelvis = bones.find(bone => bone.name === "Pelvis");
  const chest = bones.find(bone => bone.name === "Chest");
  const foot = bones.find(bone => bone.name === `Foot ${side}`);
  const hand = bones.find(bone => bone.name === `Hand ${side}`);
  const forearm = bones.find(bone => bone.name === `Forearm ${side}`);
  const pelvisY = pelvis?.bindPosition?.y ?? .9;
  const chestY = chest?.bindPosition?.y ?? 1.2;
  const footY = foot?.bindPosition?.y ?? .08;
  // The previous fixed thresholds stopped thigh influence around the middle of
  // this mannequin's upper legs. Use the placed rig instead: all vertices from
  // the sole through the hip are weighted to that side's complete leg chain.
  // Include the whole upper-leg/hip transition. The thigh joint sits beneath
  // the pelvis, but its skin must reach a little above it; otherwise the bone
  // turns under a stationary hip and the walk looks like only the shin moves.
  if (point.y <= pelvisY + .15) {
    if (point.y < footY + .12) return named([`Foot ${side}`, `Shin ${side}`, `Thigh ${side}`]);
    return named([`Thigh ${side}`, `Shin ${side}`, "Pelvis", "Root"]);
  }
  const armThreshold = point.y > chestY - .06 ? .24 : .34;
  if (Math.abs(point.x) > armThreshold) {
    // Palm, thumb, and fingers must follow the hand bone. Previously every
    // hand vertex belonged to Forearm, so wrist rotation moved only the guide.
    const handX = Math.abs(hand?.bindPosition?.x ?? hand?.position?.x ?? Infinity);
    const forearmX = Math.abs(forearm?.bindPosition?.x ?? forearm?.position?.x ?? handX);
    const wristStart = forearmX + Math.max(0, handX - forearmX) * .65;
    if (hand && Math.abs(point.x) >= wristStart) return named([
      `Thumb ${side}`, `Index ${side}`, `Middle ${side}`, `Ring ${side}`, `Pinky ${side}`,
      `Hand ${side}`, `Forearm ${side}`
    ]);
    return named([`Forearm ${side}`, `Upper Arm ${side}`, "Chest"]);
  }
  if (point.y > chestY + .26) return named(["Head", "Neck", "Chest"]);
  return named(["Chest", "Spine", "Root"]);
}

function addSkinAttributes(geometry, bones) {
  const position = geometry.getAttribute("position");
  const indices = new Uint16Array(position.count * 4);
  const weights = new Float32Array(position.count * 4);
  const point = new THREE.Vector3();
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    point.fromBufferAttribute(position, vertex);
    let candidates = skinCandidatesForVertex(point, bones);
    if (!candidates.length) candidates = bones.map((bone, index) => ({ bone, index }))
      .filter(({ bone }) => !/socket|camera|mount/i.test(`${bone.id} ${bone.role || ""}`))
      .map(({ index }) => index);
    if (!candidates.length) candidates = [0];
    const influences = candidates.map(index => {
      const bone = bones[index];
      const distanceSquared = pointSegmentDistanceSquared(point, bone.bindPosition, bone.bindTail);
      return { index, weight: 1 / Math.max(.0001, distanceSquared) };
    }).sort((a, b) => b.weight - a.weight).slice(0, 4);
    const total = influences.reduce((sum, influence) => sum + influence.weight, 0) || 1;
    influences.forEach((influence, slot) => {
      indices[vertex * 4 + slot] = influence.index;
      weights[vertex * 4 + slot] = influence.weight / total;
    });
  }
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
}

function gameItemNumber(input, fallback, min, max) {
  const value = Number(input?.value);
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : fallback));
}

function gameItemLargestMask(imageData) {
  const sourceWidth = imageData.width;
  const sourceHeight = imageData.height;
  const scale = Math.min(1, 128 / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(12, Math.round(sourceWidth * scale));
  const height = Math.max(12, Math.round(sourceHeight * scale));
  const samples = new Array(width * height);
  const cornerColors = [];
  let hasTransparency = false;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = sampleReliefPixel(imageData, sourceWidth, sourceHeight,
        x / Math.max(1, width - 1) * (sourceWidth - 1),
        y / Math.max(1, height - 1) * (sourceHeight - 1));
      samples[y * width + x] = pixel;
      if (pixel.a < 245) hasTransparency = true;
      if ((x < 3 || x >= width - 3) && (y < 3 || y >= height - 3)) cornerColors.push(pixel);
    }
  }
  const background = cornerColors.reduce((sum, pixel) => ({ r: sum.r + pixel.r, g: sum.g + pixel.g, b: sum.b + pixel.b }), { r: 0, g: 0, b: 0 });
  const divisor = Math.max(1, cornerColors.length);
  background.r /= divisor; background.g /= divisor; background.b /= divisor;
  const mask = samples.map(pixel => {
    if (pixel.a <= 28) return false;
    if (hasTransparency) return pixel.a >= 52;
    const distance = Math.hypot(pixel.r - background.r, pixel.g - background.g, pixel.b - background.b);
    return distance >= 24;
  });
  const visited = new Uint8Array(mask.length);
  let largest = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue;
    const component = [];
    const queue = [start];
    visited[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const index = queue[cursor];
      component.push(index);
      const x = index % width;
      const y = Math.floor(index / width);
      for (const next of [index - 1, index + 1, index - width, index + width]) {
        if (next < 0 || next >= mask.length || visited[next] || !mask[next]) continue;
        const nx = next % width;
        const ny = Math.floor(next / width);
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
        visited[next] = 1;
        queue.push(next);
      }
    }
    if (component.length > largest.length) largest = component;
  }
  if (largest.length < 12) throw new Error("The item silhouette could not be separated from its background. Use a PNG with a plain or transparent background.");
  const largestSet = new Set(largest);
  const bounds = { left: width, right: 0, top: height, bottom: 0 };
  largest.forEach(index => {
    const x = index % width;
    const y = Math.floor(index / width);
    bounds.left = Math.min(bounds.left, x); bounds.right = Math.max(bounds.right, x);
    bounds.top = Math.min(bounds.top, y); bounds.bottom = Math.max(bounds.bottom, y);
  });
  const profiles = [];
  for (let y = bounds.top; y <= bounds.bottom; y++) {
    let left = width;
    let right = -1;
    for (let x = bounds.left; x <= bounds.right; x++) {
      if (!largestSet.has(y * width + x)) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
    if (right >= left) profiles.push({ y, left, right, center: (left + right) * .5 });
  }
  for (let pass = 0; pass < 2; pass++) {
    const copy = profiles.map(row => ({ ...row }));
    for (let i = 1; i < profiles.length - 1; i++) {
      copy[i].left = (profiles[i - 1].left + profiles[i].left * 2 + profiles[i + 1].left) / 4;
      copy[i].right = (profiles[i - 1].right + profiles[i].right * 2 + profiles[i + 1].right) / 4;
      copy[i].center = (copy[i].left + copy[i].right) * .5;
    }
    profiles.splice(0, profiles.length, ...copy);
  }
  return { width, height, bounds, profiles };
}

function gameItemGeometryParts(imageData, type, heightMeters, thickness) {
  const silhouette = gameItemLargestMask(imageData);
  const { width, height, bounds, profiles } = silhouette;
  const sourceHeight = Math.max(1, bounds.bottom - bounds.top);
  const unit = heightMeters / sourceHeight;
  const centerX = (bounds.left + bounds.right) * .5;
  const front = { positions: [], uvs: [] };
  const back = { positions: [], uvs: [] };
  const edge = { positions: [], uvs: [] };
  const rim = { positions: [], uvs: [] };
  const uvFor = (x, y) => [x / Math.max(1, width - 1), 1 - y / Math.max(1, height - 1)];
  const point = (x, y, z) => [(x - centerX) * unit, (bounds.bottom - y) * unit, z];
  const pushTriangle = (part, a, b, c, ua, ub, uc) => {
    part.positions.push(...a, ...b, ...c);
    part.uvs.push(...ua, ...ub, ...uc);
  };
  const pushQuad = (part, a, b, c, d, ua, ub, uc, ud, reverse = false) => {
    if (reverse) {
      pushTriangle(part, a, c, b, ua, uc, ub);
      pushTriangle(part, a, d, c, ua, ud, uc);
    } else {
      pushTriangle(part, a, b, c, ua, ub, uc);
      pushTriangle(part, a, c, d, ua, uc, ud);
    }
  };
  const half = thickness * .5;
  // Match the studio's visible Front Work side: source art faces -Z while the
  // plain/material back faces +Z. This is the same convention used by the
  // editor's imported front-facing model art.
  const outerFrontZ = type === "sword" ? -thickness * .08 : -half;
  const centerFrontZ = type === "sword" ? -half : -half - thickness * .18;
  const outerBackZ = type === "sword" ? thickness * .08 : half;
  const centerBackZ = half;
  for (let i = 0; i < profiles.length - 1; i++) {
    const a = profiles[i];
    const b = profiles[i + 1];
    const auL = uvFor(a.left, a.y), auC = uvFor(a.center, a.y), auR = uvFor(a.right, a.y);
    const buL = uvFor(b.left, b.y), buC = uvFor(b.center, b.y), buR = uvFor(b.right, b.y);
    pushQuad(front,
      point(a.left, a.y, outerFrontZ), point(a.right, a.y, outerFrontZ), point(b.right, b.y, outerFrontZ), point(b.left, b.y, outerFrontZ),
      auL, auR, buR, buL, true);
    if (type === "sword") {
      front.positions.splice(front.positions.length - 18, 18);
      front.uvs.splice(front.uvs.length - 12, 12);
      pushQuad(front, point(a.left, a.y, outerFrontZ), point(a.center, a.y, centerFrontZ), point(b.center, b.y, centerFrontZ), point(b.left, b.y, outerFrontZ), auL, auC, buC, buL, true);
      pushQuad(front, point(a.center, a.y, centerFrontZ), point(a.right, a.y, outerFrontZ), point(b.right, b.y, outerFrontZ), point(b.center, b.y, centerFrontZ), auC, auR, buR, buC, true);
    }
    if (type === "sword") {
      pushQuad(back, point(a.left, a.y, outerBackZ), point(b.left, b.y, outerBackZ), point(b.center, b.y, centerBackZ), point(a.center, a.y, centerBackZ), auL, buL, buC, auC, true);
      pushQuad(back, point(a.center, a.y, centerBackZ), point(b.center, b.y, centerBackZ), point(b.right, b.y, outerBackZ), point(a.right, a.y, outerBackZ), auC, buC, buR, auR, true);
    } else {
      pushQuad(back, point(a.left, a.y, outerBackZ), point(b.left, b.y, outerBackZ), point(b.right, b.y, outerBackZ), point(a.right, a.y, outerBackZ), auL, buL, buR, auR, true);
      const aInsetL = a.left + (a.right - a.left) * .12;
      const aInsetR = a.right - (a.right - a.left) * .12;
      const bInsetL = b.left + (b.right - b.left) * .12;
      const bInsetR = b.right - (b.right - b.left) * .12;
      const rimZ = outerBackZ - .004;
      pushQuad(rim, point(a.left, a.y, rimZ), point(b.left, b.y, rimZ), point(bInsetL, b.y, rimZ), point(aInsetL, a.y, rimZ), auL, buL, uvFor(bInsetL, b.y), uvFor(aInsetL, a.y), true);
      pushQuad(rim, point(aInsetR, a.y, rimZ), point(bInsetR, b.y, rimZ), point(b.right, b.y, rimZ), point(a.right, a.y, rimZ), uvFor(aInsetR, a.y), uvFor(bInsetR, b.y), buR, auR, true);
    }
    pushQuad(edge, point(a.left, a.y, outerFrontZ), point(b.left, b.y, outerFrontZ), point(b.left, b.y, outerBackZ), point(a.left, a.y, outerBackZ), auL, buL, buL, auL);
    pushQuad(edge, point(a.right, a.y, outerBackZ), point(b.right, b.y, outerBackZ), point(b.right, b.y, outerFrontZ), point(a.right, a.y, outerFrontZ), auR, buR, buR, auR);
  }
  const first = profiles[0];
  const last = profiles[profiles.length - 1];
  pushQuad(edge, point(first.left, first.y, outerBackZ), point(first.right, first.y, outerBackZ), point(first.right, first.y, outerFrontZ), point(first.left, first.y, outerFrontZ), uvFor(first.left, first.y), uvFor(first.right, first.y), uvFor(first.right, first.y), uvFor(first.left, first.y));
  pushQuad(edge, point(last.left, last.y, outerFrontZ), point(last.right, last.y, outerFrontZ), point(last.right, last.y, outerBackZ), point(last.left, last.y, outerBackZ), uvFor(last.left, last.y), uvFor(last.right, last.y), uvFor(last.right, last.y), uvFor(last.left, last.y));
  return { front, back, edge, rim };
}

function sampleReliefPixel(imageData, width, height, x, y) {
  const px = Math.max(0, Math.min(width - 1, Math.round(x)));
  const py = Math.max(0, Math.min(height - 1, Math.round(y)));
  const i = (py * width + px) * 4;
  const r = imageData.data[i] || 0;
  const g = imageData.data[i + 1] || 0;
  const b = imageData.data[i + 2] || 0;
  const a = imageData.data[i + 3] ?? 255;
  const luma = r * .2126 + g * .7152 + b * .0722;
  return { r, g, b, a, luma };
}

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

function gameCharacterCompactGlbSkins(source) {
  const input = new Uint8Array(source);
  const inputView = new DataView(input.buffer, input.byteOffset, input.byteLength);
  if (inputView.getUint32(0, true) !== 0x46546C67 || inputView.getUint32(4, true) !== 2) return source;
  const chunks = [];
  let offset = 12;
  while (offset + 8 <= input.byteLength) {
    const length = inputView.getUint32(offset, true);
    const type = inputView.getUint32(offset + 4, true);
    chunks.push({ type, data: input.slice(offset + 8, offset + 8 + length) });
    offset += 8 + length;
  }
  const jsonChunk = chunks.find(chunk => chunk.type === 0x4E4F534A);
  if (!jsonChunk) return source;
  const gltf = JSON.parse(new TextDecoder().decode(jsonChunk.data).replace(/[\u0000\u0020]+$/g, ""));
  if (!Array.isArray(gltf.skins) || gltf.skins.length <= 1) return source;
  for (const node of gltf.nodes || []) if (Number.isInteger(node.skin)) node.skin = 0;
  gltf.skins = [gltf.skins[0]];
  const jsonBytes = new TextEncoder().encode(JSON.stringify(gltf));
  const paddedJson = new Uint8Array((jsonBytes.length + 3) & ~3);
  paddedJson.fill(0x20);
  paddedJson.set(jsonBytes);
  jsonChunk.data = paddedJson;
  const totalLength = 12 + chunks.reduce((sum, chunk) => sum + 8 + chunk.data.length, 0);
  const output = new Uint8Array(totalLength);
  const outputView = new DataView(output.buffer);
  outputView.setUint32(0, 0x46546C67, true);
  outputView.setUint32(4, 2, true);
  outputView.setUint32(8, totalLength, true);
  offset = 12;
  for (const chunk of chunks) {
    outputView.setUint32(offset, chunk.data.length, true);
    outputView.setUint32(offset + 4, chunk.type, true);
    output.set(chunk.data, offset + 8);
    offset += 8 + chunk.data.length;
  }
  return output.buffer;
}

const GAME_ENGINE_EXPORT_FPS = 24;
const GAME_ENGINE_CLIP_SPECS = Object.freeze([
  { name: "Lower_Idle", layer: "lower", aliases: ["lower idle", "idle guard", "idle"], loopMode: "loop" },
  { name: "Lower_Walk", layer: "lower", aliases: ["lower walk", "walk guard", "walking", "walk"], loopMode: "loop" },
  { name: "Lower_Run", layer: "lower", aliases: ["lower run", "running speed", "sprint", "running", "run"], loopMode: "loop" },
  { name: "Lower_Jump", layer: "lower", aliases: ["lower jump", "jump"], loopMode: "once" },
  { name: "Upper_Idle", layer: "upper", aliases: ["upper idle", "idle guard", "idle"], loopMode: "loop" },
  { name: "Upper_Slash", layer: "upper", aliases: ["upper slash", "sword slash", "slash", "attack"], loopMode: "once" },
  { name: "Upper_Thrust", layer: "upper", aliases: ["upper thrust", "sword thrust poke", "sword thrust", "poke", "thrust"], loopMode: "holdLast" },
  { name: "Upper_Block", layer: "upper", aliases: ["upper block", "shield block", "blocking", "block"], loopMode: "holdLast" }
]);

function gameCharacterSearchToken(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function gameCharacterCanonicalBoneName(bone) {
  const token = gameCharacterSearchToken(`${bone.id} ${bone.name}`);
  if (token.includes("grip socket r")) return "grip_socket_r";
  if (token.includes("grip socket l")) return "grip_socket_l";
  const exact = ["root", "pelvis", "spine", "chest", "neck", "head"].find(name => token.split(" ").includes(name));
  if (exact) return exact;
  return gameCharacterSafeName(bone.id || bone.name || "bone").toLowerCase();
}

function gameCharacterFindSourceClip(spec) {
  const entries = Object.entries(animationState.clips || {});
  const select = document.querySelector(`[data-game-engine-clip="${spec.name}"]`);
  if (select?.value && animationState.clips?.[select.value]) return select.value;
  const exact = entries.find(([id, clip]) => gameCharacterSearchToken(clip?.name || id) === gameCharacterSearchToken(spec.name));
  if (exact) return exact[0];
  for (const alias of spec.aliases) {
    const found = entries.find(([id, clip]) => gameCharacterSearchToken(clip?.name || id).includes(alias));
    if (found) return found[0];
  }
  return "";
}

function syncGameEnginePluginUi({ forceAutoMap = false } = {}) {
  const entries = Object.entries(animationState.clips || {});
  for (const spec of GAME_ENGINE_CLIP_SPECS) {
    const select = document.querySelector(`[data-game-engine-clip="${spec.name}"]`);
    if (!select) continue;
    const previous = forceAutoMap ? "" : select.value;
    select.innerHTML = `<option value="">Generate bind-pose fallback</option>` + entries.map(([id, clip]) =>
      `<option value="${animationTimelineEscape(id)}">${animationTimelineEscape(clip?.name || id)}</option>`).join("");
    select.value = previous && animationState.clips?.[previous] ? previous : gameCharacterFindSourceClip(spec);
  }
  const mapped = GAME_ENGINE_CLIP_SPECS.filter(spec => gameCharacterFindSourceClip(spec)).length;
  if (els.gameEngineExportStatus) els.gameEngineExportStatus.textContent = `${mapped}/8 runtime clips mapped. Missing clips export as explicit bind-pose tracks until you assign a source.`;
}

function gameCharacterExportBones() {
  const bones = rigBones.filter(bone => bone.role !== "camera").map(bone => ({
    ...bone,
    bindPosition: (bone.bindPosition || bone.position).clone(),
    bindRotation: (bone.bindRotation || bone.rotation || new THREE.Euler()).clone(),
    bindTail: (bone.bindTail || bone.tail || bone.position).clone()
  }));
  const tokenFor = bone => gameCharacterSearchToken(`${bone.id} ${bone.name}`);
  for (const side of ["l", "r"]) {
    const socketId = `grip_socket_${side}`;
    if (bones.some(bone => gameCharacterCanonicalBoneName(bone) === socketId)) continue;
    const words = side === "l" ? ["left hand", "lefthand", "hand l"] : ["right hand", "righthand", "hand r"];
    const hand = bones.find(bone => words.some(word => tokenFor(bone).includes(word)));
    if (!hand) continue;
    bones.push({
      id: socketId,
      name: socketId,
      parentId: hand.id,
      role: "itemSocket",
      bindPosition: hand.bindTail.clone(),
      bindRotation: hand.bindRotation.clone(),
      bindTail: hand.bindTail.clone().add(new THREE.Vector3(0, .08, 0)),
      generatedForExport: true
    });
  }
  return bones;
}

function gameCharacterBoneLayer(bone) {
  const token = gameCharacterSearchToken(`${bone.id} ${bone.name}`);
  return /(^| )(root|pelvis|thigh|shin|foot|leg)( |$)/.test(` ${token} `) ? "lower" : "upper";
}

function gameCharacterSampleKey(sourceClip, bone, frame) {
  const frames = (sourceClip?.keys?.[bone.id] || []).slice().sort((a, b) => Number(a.frame) - Number(b.frame));
  const bindPosition = bone.bindPosition;
  const bindRotation = bone.bindRotation;
  if (!frames.length) return { position: bindPosition.clone(), rotation: bindRotation.clone() };
  let before = frames[0], after = frames[frames.length - 1];
  for (const key of frames) {
    if (Number(key.frame) <= frame) before = key;
    if (Number(key.frame) >= frame) { after = key; break; }
  }
  const span = Math.max(1, Number(after.frame) - Number(before.frame));
  const alpha = before === after ? 0 : (frame - Number(before.frame)) / span;
  const startPosition = Array.isArray(before.position) ? before.position : bindPosition.toArray();
  const endPosition = Array.isArray(after.position) ? after.position : startPosition;
  const startRotation = Array.isArray(before.rotation) ? before.rotation : bindRotation.toArray();
  const endRotation = Array.isArray(after.rotation) ? after.rotation : startRotation;
  return {
    position: new THREE.Vector3(...startPosition.map((value, axis) => value + (endPosition[axis] - value) * alpha)),
    rotation: new THREE.Euler(...startRotation.map((value, axis) => value + (endRotation[axis] - value) * alpha), "XYZ")
  };
}

function gameCharacterAnimationClips(exportBones, exportBoneNames) {
  syncActiveAnimationClip();
  const clips = [];
  const clipMeta = [];
  for (const spec of GAME_ENGINE_CLIP_SPECS) {
    const sourceId = gameCharacterFindSourceClip(spec);
    const sourceClip = sourceId ? animationState.clips[sourceId] : null;
    const sourceFps = Math.max(1, Number(sourceClip?.fps) || GAME_ENGINE_EXPORT_FPS);
    const sourceEnd = Math.max(1, Number(sourceClip?.end) || GAME_ENGINE_EXPORT_FPS);
    const outputEnd = Math.max(1, Math.round(sourceEnd * GAME_ENGINE_EXPORT_FPS / sourceFps));
    const times = Array.from({ length: outputEnd + 1 }, (_, frame) => frame / GAME_ENGINE_EXPORT_FPS);
    const tracks = [];
    for (const bone of exportBones) {
      const parent = exportBones.find(candidate => candidate.id === bone.parentId);
      const positions = [];
      const quaternions = [];
      for (let outputFrame = 0; outputFrame <= outputEnd; outputFrame += 1) {
        const sourceFrame = Math.min(sourceEnd, outputFrame * sourceFps / GAME_ENGINE_EXPORT_FPS);
        const enabled = gameCharacterBoneLayer(bone) === spec.layer;
        const pose = enabled ? gameCharacterSampleKey(sourceClip, bone, sourceFrame) : {
          position: bone.bindPosition.clone(), rotation: bone.bindRotation.clone()
        };
        if (gameCharacterCanonicalBoneName(bone) === "root") pose.position.copy(bone.bindPosition);
        const localPosition = parent
          ? bone.bindPosition.clone().sub(parent.bindPosition).add(pose.position.clone().sub(bone.bindPosition))
          : bone.bindPosition.clone().add(pose.position.clone().sub(bone.bindPosition));
        const bindQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(
          bone.bindRotation.x, bone.bindRotation.y, bone.bindRotation.z, "XYZ"
        ));
        const poseQuaternion = new THREE.Quaternion().setFromEuler(pose.rotation);
        const localQuaternion = poseQuaternion.multiply(bindQuaternion.invert()).normalize();
        positions.push(localPosition.x, localPosition.y, localPosition.z);
        quaternions.push(localQuaternion.x, localQuaternion.y, localQuaternion.z, localQuaternion.w);
      }
      const exportName = exportBoneNames.get(bone.id);
      tracks.push(new THREE.VectorKeyframeTrack(`${exportName}.position`, times, positions));
      tracks.push(new THREE.QuaternionKeyframeTrack(`${exportName}.quaternion`, times, quaternions));
    }
    clips.push(new THREE.AnimationClip(spec.name, outputEnd / GAME_ENGINE_EXPORT_FPS, tracks));
    clipMeta.push({
      id: spec.name,
      name: spec.name,
      sourceClipId: sourceId || null,
      sourceClipName: sourceClip?.name || null,
      layer: spec.layer,
      loopMode: spec.loopMode,
      fps: GAME_ENGINE_EXPORT_FPS,
      frameCount: outputEnd + 1,
      durationSeconds: outputEnd / GAME_ENGINE_EXPORT_FPS,
      allBonesExplicit: true,
      unusedBones: "bindPose"
    });
  }
  return { clips, clipMeta };
}

function gameCharacterObjectRole(object) {
  const token = gameCharacterSearchToken(`${object.name} ${object.userData?.rigRole || ""}`);
  if (/sword|weapon|blade/.test(token)) return { role: "equipment", socket: "grip_socket_r" };
  if (/shield|off hand|offhand/.test(token)) return { role: "equipment", socket: "grip_socket_l" };
  if (object.userData?.rigRole === "armor") return { role: "equipment", socket: null };
  return { role: "skinPart", socket: null };
}

function gameCharacterManifest(baseName, glbName, exportBones, boundObjects, clipMeta, lods = []) {
  const sockets = exportBones.filter(bone => gameCharacterCanonicalBoneName(bone).startsWith("grip_socket_")).map(bone => ({
    id: gameCharacterCanonicalBoneName(bone), boneId: bone.id, name: gameCharacterCanonicalBoneName(bone), purpose: "equipment"
  }));
  const bodyParts = [];
  const attachments = [];
  boundObjects.forEach((object, index) => {
    const classification = gameCharacterObjectRole(object);
    const entry = {
      id: object.userData?.id || object.uuid,
      name: object.name || "Skinned Part",
      boneId: classification.socket || gameCharacterArmorBinding(object)?.bone?.id || null,
      role: classification.role,
      attachment: "skinned",
      meshSlot: index + 1
    };
    if (classification.role === "equipment") attachments.push(entry);
    else bodyParts.push(entry);
  });
  return {
    kind: "boltworks-game-engine-character",
    formatVersion: 2,
    generator: "BoltWorks 3D AI Studio / BoltWorks Game Engine plugin",
    generatedAt: new Date().toISOString(),
    name: baseName,
    model: { file: glbName, format: "glTF-binary-2.0", animationSource: "embedded", lods },
    coordinateSystem: { handedness: "right-handed", units: "meters", upAxis: "+Y", groundPlane: "XZ" },
    skeleton: {
      stableAcrossClips: true,
      rootBoneIds: exportBones.filter(bone => !bone.parentId).map(bone => bone.id),
      bones: exportBones.map(bone => ({
        id: bone.id,
        name: gameCharacterCanonicalBoneName(bone),
        parentId: bone.parentId || null,
        role: bone.role || gameCharacterBoneLayer(bone),
        bindPosition: bone.bindPosition.toArray(),
        bindRotation: bone.bindRotation.toArray()
      }))
    },
    animations: clipMeta,
    sockets,
    bodyParts,
    equipment: attachments,
    runtime: {
      engine: "Raylib",
      fps: GAME_ENGINE_EXPORT_FPS,
      layeredTracks: ["lower", "upper"],
      rootMotion: false,
      skinnedMeshes: true,
      animatedMeshNodeTransforms: false,
      rigidPartAttachments: false,
      everyClipContainsEveryBone: true,
      unusedBonesUseBindPose: true
    }
  };
}

function validateGameEngineCharacter({ announce = false } = {}) {
  const exportBones = gameCharacterExportBones();
  const names = new Set(exportBones.map(gameCharacterCanonicalBoneName));
  const required = ["root", "pelvis", "spine", "chest", "neck", "head", "grip_socket_r", "grip_socket_l"];
  const missingBones = required.filter(name => !names.has(name));
  const missingClips = GAME_ENGINE_CLIP_SPECS.filter(spec => !gameCharacterFindSourceClip(spec)).map(spec => spec.name);
  const hasCharacter = !!activeSkinRuntime?.avatar?.isSkinnedMesh || rigBones.length > 0;
  const messages = [];
  if (!hasCharacter) messages.push("fit or glue a character skeleton first");
  if (missingBones.length) messages.push(`missing bones: ${missingBones.join(", ")}`);
  if (missingClips.length) messages.push(`bind-pose fallbacks: ${missingClips.join(", ")}`);
  const text = messages.length ? `Check character — ${messages.join("; ")}.` : "Character is ready for the layered Raylib export.";
  if (els.gameEngineExportStatus) els.gameEngineExportStatus.textContent = text;
  if (announce) log(text);
  return { valid: hasCharacter && !missingBones.length, exportBones, missingBones, missingClips };
}

function gameCharacterSimplifiedGeometry(source, keepRatio, skinBones = null) {
  let geometry = source.clone();
  const triangles = Math.floor((geometry.index?.count || geometry.getAttribute("position")?.count || 0) / 3);
  if (keepRatio < .999 && triangles >= 160) {
    try {
      geometry = mergeVertices(geometry, 1e-5);
      const vertexCount = geometry.getAttribute("position")?.count || 0;
      const removeCount = Math.max(0, Math.floor(vertexCount * (1 - keepRatio)));
      if (removeCount > 0 && vertexCount - removeCount >= 12) {
        const reduced = new SimplifyModifier().modify(geometry, removeCount);
        geometry.dispose();
        geometry = reduced;
      }
    } catch (error) {
      geometry.dispose();
      geometry = source.clone();
      console.warn("Realtime character LOD simplification was skipped:", error);
    }
  }
  if (skinBones?.length) addSkinAttributes(geometry, skinBones);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

async function gameCharacterBuildGlb({ baseName, avatar, skinBones, exportBones, exportBoneNames, boundObjects, boundRestWorlds, clips, keepRatio, level }) {
  avatar.updateMatrixWorld(true);
  const exportAvatar = cloneSkeleton(avatar);
  exportAvatar.name = `${baseName}_Skin_LOD${level}`;
  exportAvatar.userData = { ...exportAvatar.userData, bwsRole: "skin", bwsLodLevel: level };
  exportAvatar.geometry = gameCharacterSimplifiedGeometry(avatar.geometry, keepRatio, skinBones);
  const exportBonesById = new Map();
  exportAvatar.traverse(node => {
    const id = node.userData?.rigBoneId;
    if (!node.isBone || !id) return;
    node.name = exportBoneNames.get(id) || gameCharacterCanonicalBoneName({ id, name: node.name });
    exportBonesById.set(id, node);
  });
  const pendingBones = exportBones.filter(bone => !exportBonesById.has(bone.id));
  while (pendingBones.length) {
    const index = pendingBones.findIndex(bone => !bone.parentId || exportBonesById.has(bone.parentId));
    if (index < 0) break;
    const bone = pendingBones.splice(index, 1)[0];
    const node = new THREE.Bone();
    node.name = exportBoneNames.get(bone.id);
    node.userData.rigBoneId = bone.id;
    const parentBone = exportBones.find(candidate => candidate.id === bone.parentId);
    if (parentBone && exportBonesById.has(parentBone.id)) {
      node.position.copy(bone.bindPosition).sub(parentBone.bindPosition);
      exportBonesById.get(parentBone.id).add(node);
    } else {
      node.position.copy(bone.bindPosition);
      exportAvatar.add(node);
    }
    exportBonesById.set(bone.id, node);
    exportAvatar.skeleton.bones.push(node);
  }
  exportAvatar.updateMatrixWorld(true);
  exportAvatar.skeleton.calculateInverses();
  const avatarWorldInverse = avatar.matrixWorld.clone().invert();
  for (const object of boundObjects) {
    const binding = gameCharacterArmorBinding(object);
    const classification = gameCharacterObjectRole(object);
    const socketBone = classification.socket
      ? exportBones.find(bone => gameCharacterCanonicalBoneName(bone) === classification.socket)
      : null;
    const targetBoneId = socketBone?.id || binding?.bone?.id;
    const targetBone = exportBonesById.get(targetBoneId);
    const boneIndex = exportAvatar.skeleton.bones.indexOf(targetBone);
    if (!targetBone || boneIndex < 0) continue;
    const restWorld = new THREE.Matrix4();
    if (boundRestWorlds?.has(object)) {
      restWorld.copy(boundRestWorlds.get(object));
    } else if (binding.rest?.objectPosition) {
      restWorld.compose(
        binding.rest.objectPosition,
        binding.rest.objectQuaternion || new THREE.Quaternion().setFromEuler(binding.rest.objectRotation),
        object.scale
      );
    } else {
      object.updateMatrixWorld(true);
      restWorld.copy(object.matrixWorld);
    }
    const geometry = gameCharacterSimplifiedGeometry(object.geometry, keepRatio)
      .applyMatrix4(avatarWorldInverse.clone().multiply(restWorld));
    const count = geometry.getAttribute("position").count;
    const indices = new Uint16Array(count * 4);
    const weights = new Float32Array(count * 4);
    for (let vertex = 0; vertex < count; vertex += 1) {
      indices[vertex * 4] = boneIndex;
      weights[vertex * 4] = 1;
    }
    geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
    const sourceMaterial = Array.isArray(object.material) ? object.material[0] : object.material;
    const skinnedPart = new THREE.SkinnedMesh(geometry, sourceMaterial.clone());
    skinnedPart.name = gameCharacterSafeName(object.name, "Skinned_Part");
    skinnedPart.userData = {
      bwsRole: classification.role,
      bwsObjectId: object.userData?.id || object.uuid,
      bwsBoneId: targetBoneId,
      bwsSocket: classification.socket,
      bwsLodLevel: level
    };
    exportAvatar.add(skinnedPart);
    skinnedPart.bind(exportAvatar.skeleton, exportAvatar.bindMatrix);
  }
  exportAvatar.userData.bwsMeshSlots = [
    { role: "skin", index: 0, id: avatar.userData?.id || avatar.uuid },
    ...boundObjects.map((object, index) => ({
      role: gameCharacterObjectRole(object).role,
      index: index + 1,
      id: object.userData?.id || object.uuid,
      boneId: gameCharacterObjectRole(object).socket || gameCharacterArmorBinding(object)?.bone?.id || null
    }))
  ];
  const root = new THREE.Group();
  root.name = `${baseName}_LOD${level}`;
  root.add(exportAvatar);
  const rawBinary = await new GLTFExporter().parseAsync(root, {
    binary: true,
    animations: clips,
    onlyVisible: false,
    trs: true,
    includeCustomExtensions: true
  });
  return gameCharacterCompactGlbSkins(rawBinary);
}

function gameCharacterArmGeometry(source, skinBones, side = "both") {
  let working = source.clone();
  addSkinAttributes(working, skinBones);
  if (working.index) {
    const nonIndexed = working.toNonIndexed();
    working.dispose();
    working = nonIndexed;
  }
  const allowed = new Set();
  skinBones.forEach((bone, index) => {
    const token = gameCharacterSearchToken(`${bone.id} ${bone.name}`);
    const isArm = /(^| )(upper arm|forearm|hand|thumb|index|middle|ring|pinky|finger)( |$)/.test(` ${token} `);
    const isLeft = /(^| )left( |$)/.test(` ${token} `);
    const isRight = /(^| )right( |$)/.test(` ${token} `);
    if (isArm && (side === "both" || (side === "left" && isLeft) || (side === "right" && isRight))) allowed.add(index);
  });
  if (!allowed.size) {
    working.dispose();
    throw new Error(`No ${side === "both" ? "arm" : `${side} arm`} bones were found in this rig.`);
  }
  const skinIndex = working.getAttribute("skinIndex");
  const skinWeight = working.getAttribute("skinWeight");
  const position = working.getAttribute("position");
  if (!skinIndex || !skinWeight || !position) {
    working.dispose();
    throw new Error("The fitted character does not contain usable skin weights.");
  }
  const keptTriangles = [];
  for (let vertex = 0; vertex < position.count; vertex += 3) {
    let matchingVertices = 0;
    let matchingWeight = 0;
    for (let corner = 0; corner < 3; corner++) {
      const index = vertex + corner;
      let strongestWeight = -1;
      let strongestBone = -1;
      for (let slot = 0; slot < 4; slot++) {
        const weight = skinWeight.array[index * skinWeight.itemSize + slot] || 0;
        const boneIndex = skinIndex.array[index * skinIndex.itemSize + slot] || 0;
        if (allowed.has(boneIndex)) matchingWeight += weight;
        if (weight > strongestWeight) { strongestWeight = weight; strongestBone = boneIndex; }
      }
      if (allowed.has(strongestBone)) matchingVertices++;
    }
    if (matchingVertices >= 2 || matchingWeight >= 1.35) keptTriangles.push(vertex);
  }
  if (!keptTriangles.length) {
    working.dispose();
    throw new Error("No arm surface matched the selected arm bones. Refit the skin before exporting arms.");
  }
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(working.attributes)) {
    const values = [];
    for (const triangleStart of keptTriangles) {
      for (let corner = 0; corner < 3; corner++) {
        const index = triangleStart + corner;
        for (let component = 0; component < attribute.itemSize; component++) values.push(attribute.array[index * attribute.itemSize + component]);
      }
    }
    const ArrayType = attribute.array?.constructor || Float32Array;
    geometry.setAttribute(name, new THREE.BufferAttribute(new ArrayType(values), attribute.itemSize, attribute.normalized));
  }
  working.dispose();
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

async function exportGameCharacterArmsGlb() {
  if (!activeSkinRuntime?.avatar?.isSkinnedMesh || !activeSkinRuntime?.skeleton || !activeSkinRuntime?.bones?.length) {
    const message = "Arm export needs a fitted skinned character. Glue the model to the rig first.";
    if (els.gameEngineExportStatus) els.gameEngineExportStatus.textContent = message;
    log(message);
    return;
  }
  const side = ["left", "right", "both"].includes(els.gameArmExportSideInput?.value) ? els.gameArmExportSideInput.value : "both";
  const editorState = gameCharacterCaptureEditorState();
  let editorRestored = false;
  let filteredAvatar = null;
  try {
    animationState.playing = false;
    if (!(animationState.bindingRest instanceof Map)) prepareAnimationBindingRest();
    syncActiveAnimationClip();
    const exportBones = gameCharacterExportBones();
    const usedNames = new Set();
    const exportBoneNames = new Map(exportBones.map(bone => {
      const base = gameCharacterCanonicalBoneName(bone);
      let name = base;
      let suffix = 2;
      while (usedNames.has(name)) name = `${base}_${suffix++}`;
      usedNames.add(name);
      return [bone.id, name];
    }));
    const { clips } = gameCharacterAnimationClips(exportBones, exportBoneNames);
    restoreAnimationBindPose({ render: false });
    activeSkinRuntime.avatar.updateMatrixWorld(true);
    filteredAvatar = cloneSkeleton(activeSkinRuntime.avatar);
    filteredAvatar.geometry = gameCharacterArmGeometry(activeSkinRuntime.avatar.geometry, activeSkinRuntime.bones, side);
    filteredAvatar.updateMatrixWorld(true);
    const baseName = `${gameCharacterSafeName(currentProjectBaseName(), "boltworks-character")}-${side}-arms`;
    gameCharacterRestoreEditorState(editorState);
    editorRestored = true;
    const binary = await gameCharacterBuildGlb({
      baseName,
      avatar: filteredAvatar,
      skinBones: null,
      exportBones,
      exportBoneNames,
      boundObjects: [],
      boundRestWorlds: new Map(),
      clips,
      keepRatio: 1,
      level: 0
    });
    downloadBlob(`${baseName}.glb`, new Blob([binary], { type: "model/gltf-binary" }));
    const label = side === "both" ? "both arms" : `${side} arm`;
    if (els.gameEngineExportStatus) els.gameEngineExportStatus.textContent = `Exported ${label} only, with skinning and animations but no held equipment.`;
    log(`Exported ${baseName}.glb with ${label} geometry and no equipment.`);
  } catch (error) {
    console.error(error);
    if (els.gameEngineExportStatus) els.gameEngineExportStatus.textContent = `Arm export failed: ${error.message || error}`;
    log(`Arm export failed: ${error.message || error}`);
  } finally {
    if (!editorRestored) gameCharacterRestoreEditorState(editorState);
    filteredAvatar?.geometry?.dispose?.();
  }
}

async function exportGameCharacterPackage() {
  const editorState = gameCharacterCaptureEditorState();
  let temporarySkinRuntime = null;
  if (!activeSkinRuntime?.avatar?.isSkinnedMesh || !activeSkinRuntime?.skeleton) {
    temporarySkinRuntime = gameCharacterTemporaryRigidRuntime();
    activeSkinRuntime = temporarySkinRuntime;
  }
  if (!activeSkinRuntime?.avatar?.isSkinnedMesh || !activeSkinRuntime?.skeleton) {
    log("Export Game Character needs a fitted bone rig with glued model parts.");
    gameCharacterRestoreEditorState(editorState);
    temporarySkinRuntime?.avatar.geometry?.dispose?.();
    temporarySkinRuntime?.avatar.material?.dispose?.();
    return;
  }
  syncActiveAnimationClip();
  const validation = validateGameEngineCharacter();
  const baseName = gameCharacterSafeName(currentProjectBaseName(), "boltworks-character");
  const glbName = `${baseName}.glb`;
  let exportStage = "prepare animation bindings";
  let exportAvatar = null;
  let exportSkinBones = [];
  let boundRestWorlds = null;
  let editorRestored = false;
  try {
    animationState.playing = false;
    if (!(animationState.bindingRest instanceof Map)) prepareAnimationBindingRest();
    const avatar = activeSkinRuntime.avatar;
    const exportBones = validation.exportBones;
    const usedNames = new Set();
    const exportBoneNames = new Map(exportBones.map(bone => {
      const base = gameCharacterCanonicalBoneName(bone);
      let name = base;
      let suffix = 2;
      while (usedNames.has(name)) name = `${base}_${suffix++}`;
      usedNames.add(name);
      return [bone.id, name];
    }));
    const boundObjects = objects.filter(object => object !== avatar
      && object.geometry?.getAttribute?.("position")
      && !object.userData?.editorHelper
      && gameCharacterArmorBinding(object));
    exportStage = "sample animation clips";
    const { clips, clipMeta } = gameCharacterAnimationClips(exportBones, exportBoneNames);
    exportStage = "capture isolated bind pose";
    restoreAnimationBindPose({ render: false });
    activeSkinRuntime.avatar.updateMatrixWorld(true);
    exportAvatar = cloneSkeleton(activeSkinRuntime.avatar);
    exportAvatar.updateMatrixWorld(true);
    exportSkinBones = [...activeSkinRuntime.bones];
    boundRestWorlds = new Map(boundObjects.map(object => {
      object.updateMatrixWorld(true);
      return [object, object.matrixWorld.clone()];
    }));
    // Sampling must never remain visible while GLB/LOD generation awaits. The
    // detached bind-pose avatar above is now the only model used by the export.
    gameCharacterRestoreEditorState(editorState);
    editorRestored = true;
    const useLods = els.gameCharacterLodInput?.checked !== false;
    const mediumRatio = Math.max(.2, Math.min(.9, Number(els.gameOptimizeRatioInput?.value || 65) / 100));
    const levels = useLods
      ? [
          { level: 0, keepRatio: 1, file: glbName, minDistance: 0 },
          { level: 1, keepRatio: mediumRatio, file: `${baseName}-lod1.glb`, minDistance: 12 },
          { level: 2, keepRatio: Math.max(.2, mediumRatio * .5), file: `${baseName}-lod2.glb`, minDistance: 28 }
        ]
      : [{ level: 0, keepRatio: 1, file: glbName, minDistance: 0 }];
    const binaries = [];
    for (const level of levels) {
      exportStage = `build LOD ${level.level}`;
      const binary = await gameCharacterBuildGlb({ baseName, avatar: exportAvatar, skinBones: exportSkinBones, exportBones, exportBoneNames, boundObjects, boundRestWorlds, clips, ...level });
      binaries.push({ ...level, binary });
    }
    exportStage = "build character manifest";
    const manifestLods = levels.map(level => ({
      level: level.level,
      file: level.file,
      minDistance: level.minDistance,
      keepDetailPercent: Math.round(level.keepRatio * 100)
    }));
    const manifest = gameCharacterManifest(baseName, glbName, exportBones, boundObjects, clipMeta, manifestLods);
    const clipList = [
      "Clip\tFrames\tFPS\tLayer\tPlayback\tSource",
      ...clipMeta.map(clip => `${clip.name}\t${clip.frameCount}\t${clip.fps}\t${clip.layer}\t${clip.loopMode}\t${clip.sourceClipName || "bind-pose fallback"}`)
    ].join("\n");
    const readme = [
      "BoltWorks Game Engine Character Package v2",
      "",
      `${glbName} contains one shared skeleton, skinned body parts, socketed/skinned equipment, and all eight explicit layered clips at 24 FPS.`,
      useLods ? "LOD1 and LOD2 contain progressively lighter skinned geometry for distance-based rendering." : "No distance LOD files were requested.",
      `${baseName}.bws-character.json contains the stable skeleton, grip sockets, layer masks, playback modes, and runtime guarantees.`,
      `${baseName}.clip-list.txt lists clip names, frame counts, FPS, layers, playback modes, and their source clips.`,
      "CONFIRMED: animated body meshes are skinned meshes; the package contains no rigidPart body attachments and no animated mesh-node transform channels.",
      "Raylib can evaluate Lower_* and Upper_* clips independently, combine their bone masks, and hold the final Upper_Thrust or Upper_Block frame."
    ].join("\n");
    exportStage = "assemble character archive";
    const zip = makeZip([
      ...binaries.map(level => ({ name: level.file, data: new Uint8Array(level.binary) })),
      { name: `${baseName}.bws-character.json`, data: JSON.stringify(manifest, null, 2) },
      { name: `${baseName}.clip-list.txt`, data: clipList },
      { name: "README.txt", data: readme }
    ]);
    downloadBlob(`${baseName}.bws-character.zip`, zip);
    if (els.gameEngineExportStatus) els.gameEngineExportStatus.textContent = `Exported ${clips.length} layered clips at 24 FPS with ${exportBones.length} stable bones.`;
    log(`Exported ${baseName}.bws-character.zip with ${levels.length} LOD level${levels.length === 1 ? "" : "s"}, ${exportBones.length} bones, ${clips.length} layered clips, and ${boundObjects.length} skinned parts.`);
  } catch (error) {
    console.error(error);
    log(`Game Character export failed during ${exportStage}: ${error?.message || error}`);
  } finally {
    if (!editorRestored) gameCharacterRestoreEditorState(editorState);
    if (temporarySkinRuntime?.temporary) {
      temporarySkinRuntime.avatar.geometry?.dispose?.();
      temporarySkinRuntime.avatar.material?.dispose?.();
    }
  }
}


const els=Object.fromEntries([...document.querySelectorAll('[id]')].map(el=>[el.id,el]));
let activeSkinRuntime=null,rigBones=[],snapshotId=null,projectName='character';
const animationState={clips:{},bindingRest:new Map()};
const log=message=>{els.gameEngineExportStatus.textContent=message;};
const animationTimelineEscape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currentProjectBaseName=()=>projectName;
const syncActiveAnimationClip=()=>{};
const prepareAnimationBindingRest=()=>{};
const restoreAnimationBindPose=()=>{};
const gameCharacterCaptureEditorState=()=>({skinRuntime:activeSkinRuntime});
const gameCharacterRestoreEditorState=state=>{activeSkinRuntime=state.skinRuntime;};
const gameCharacterTemporaryRigidRuntime=()=>null;
const gameCharacterArmorBinding=object=>{const bone=rigBones.find(b=>b.id===object.userData?.snapshotBoneId);return bone?{bone,rest:null}:null;};
let objects=[];
function downloadBlob(name,blob){parent.postMessage({type:'bws-character-export',snapshotId,name,blob},'*');}
let busy=false,copyRoot=null;
async function run(job){if(busy)return;busy=true;try{await job();}catch(error){log(error.message);}finally{busy=false;}}
function disposeCopy(root){root?.traverse(node=>{node.geometry?.dispose();for(const material of [].concat(node.material||[])){for(const value of Object.values(material))if(value?.isTexture)value.dispose();material.dispose();}});}
window.addEventListener('message',event=>{
 if(event.source!==parent||event.data?.type!=='bws-character-snapshot')return;
 run(async()=>{
  const data=event.data.snapshot;
  const loaded=await new THREE.ObjectLoader().parseAsync(data.scene);
  const avatar=loaded.children.find(node=>node.isSkinnedMesh);
  if(!avatar?.skeleton){disposeCopy(loaded);throw Error('Character copy has no skinned skeleton.');}
  disposeCopy(copyRoot);copyRoot=loaded;loaded.updateMatrixWorld(true);
  const decodeBone=b=>({...b,position:new THREE.Vector3().fromArray(b.position),rotation:new THREE.Euler().fromArray(b.rotation),tail:new THREE.Vector3().fromArray(b.bindTail),bindPosition:new THREE.Vector3().fromArray(b.bindPosition),bindRotation:new THREE.Euler().fromArray(b.bindRotation),bindTail:new THREE.Vector3().fromArray(b.bindTail)});
  rigBones=data.rigBones.map(decodeBone);objects=loaded.children.filter(node=>node!==avatar);
  activeSkinRuntime={avatar,skeleton:avatar.skeleton,bones:data.skinBones.map(decodeBone),threeBones:new Map(avatar.skeleton.bones.map(b=>[b.userData.rigBoneId,b]))};
  animationState.clips=data.clips||{};animationState.bindingRest=new Map();
  snapshotId=event.data.snapshotId;projectName=data.name;
  syncGameEnginePluginUi({forceAutoMap:true});log('Character copy received. Map clips, then prepare an export. Your BWS model is unchanged.');
 });
});
function checkExportSize(){
 if(!activeSkinRuntime)throw Error('Choose Send character copy in the BWS window header first.');
 const boneCount=rigBones.length+2;
 const samples=GAME_ENGINE_CLIP_SPECS.reduce((sum,spec)=>{const c=animationState.clips[gameCharacterFindSourceClip(spec)];return sum+Math.max(1,Math.round((Number(c?.end)||24)*24/Math.max(1,Number(c?.fps)||24)))+1;},0)*boneCount;
 if(!Number.isFinite(samples)||samples>2000000)throw Error('Character animation export exceeds the two-million bone sample limit. Shorten the source clips.');
}
els.exportGameCharacterBtn.onclick=()=>run(async()=>{checkExportSize();await exportGameCharacterPackage();});
els.exportGameArmsBtn.onclick=()=>run(async()=>{checkExportSize();await exportGameCharacterArmsGlb();});
els.gameEngineAutoMapBtn.onclick=()=>syncGameEnginePluginUi({forceAutoMap:true});
els.gameEngineValidateBtn.onclick=()=>validateGameEngineCharacter({announce:true});
let itemImage=null,itemUrl='',itemName='item.png';
els.gameItemImageBtn.onclick=()=>els.gameItemImageFile.click();
els.gameItemImageFile.onchange=()=>run(async()=>{
 const file=els.gameItemImageFile.files[0];if(!file)return;
 if(file.size>16000000)throw Error('Choose an image smaller than 16 MB.');
 const url=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Image read failed'));r.readAsDataURL(file);});
 const image=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Image decode failed'));i.src=url;});
 if(image.width*image.height>16000000)throw Error('Choose an image smaller than 16 megapixels.');
 const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
 itemImage=ctx.getImageData(0,0,canvas.width,canvas.height);itemUrl=canvas.toDataURL('image/png');itemName=file.name;els.gameItemImageName.textContent=file.name;els.gameItemBuildBtn.disabled=false;
 els.gameItemBuildStatus.textContent='Choose sword or shield, then preview the solid item.';
});
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(640,360);els.preview.append(renderer.domElement);
const previewScene=new THREE.Scene();previewScene.background=new THREE.Color('#18282c');previewScene.add(new THREE.HemisphereLight(0xffffff,0x334433,2));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(3,6,-5);previewScene.add(light);
const camera=new THREE.PerspectiveCamera(40,640/360,.01,1000),controls=new OrbitControls(camera,renderer.domElement);let previewRoot=null;
const resize=new ResizeObserver(()=>{const w=els.preview.clientWidth;if(w){renderer.setSize(w,360);camera.aspect=w/360;camera.updateProjectionMatrix();}});resize.observe(els.preview);
renderer.setAnimationLoop(()=>renderer.render(previewScene,camera));
els.gameItemBuildBtn.onclick=()=>run(async()=>{
 if(!itemImage)throw Error('Choose an item image first.');
 const type=els.gameItemTypeInput.value==='shield'?'shield':'sword',parts=gameItemGeometryParts(itemImage,type,gameItemNumber(els.gameItemHeightInput,4,.25,20),gameItemNumber(els.gameItemThicknessInput,.24,.02,2));
 if(previewRoot){previewScene.remove(previewRoot);disposeCopy(previewRoot);}previewRoot=new THREE.Group();previewScene.add(previewRoot);
 const texture=await new THREE.TextureLoader().loadAsync(itemUrl);texture.colorSpace=THREE.SRGBColorSpace;
 for(const [key,part]of Object.entries(parts)){if(!part.positions.length)continue;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(part.positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(part.uvs,2));g.computeVertexNormals();const textured=key==='front'||(key==='back'&&type==='sword');const m=new THREE.MeshStandardMaterial({color:key==='back'&&type==='shield'?0x5b321d:key==='edge'||key==='rim'?0x777b7d:0xffffff,map:textured?texture:null,side:THREE.DoubleSide,roughness:.5});previewRoot.add(new THREE.Mesh(g,m));}
 const box=new THREE.Box3().setFromObject(previewRoot),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()).length();controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(size*.3,size*.2,-size*1.8));camera.lookAt(center);controls.update();
 parent.postMessage({type:'bws-game-item',item:{type,name:itemName,textureUrl:itemUrl,parts}},'*');els.gameItemBuildStatus.textContent='Preview ready. Choose Add item to BWS in the window header to insert it.';
});
parent.postMessage({type:'bws-plugin-ready'},'*');
