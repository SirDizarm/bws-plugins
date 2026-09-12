import {createGeometry as createDetailedImageMeshGeometry} from "./generator.js";
function reliefNumber(input, fallback, min, max) {
  const value = Number(input?.value);
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : fallback));
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

function smoothReliefHeights(heights, mask, cols, rows, passes) {
  let current = heights.slice();
  for (let pass = 0; pass < passes; pass++) {
    const next = current.slice();
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const index = y * cols + x;
        if (!mask[index]) continue;
        let sum = current[index];
        let count = 1;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            if (!ox && !oy) continue;
            const nx = x + ox;
            const ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            const ni = ny * cols + nx;
            if (!mask[ni]) continue;
            sum += current[ni];
            count++;
          }
        }
        next[index] = sum / count;
      }
    }
    current = next;
  }
  return current;
}


function reliefForegroundCheck(pixel, threshold, darkForeground) {
  return pixel.a > 24 && (darkForeground ? pixel.luma <= threshold : pixel.luma >= threshold);
}

function detectReliefViewRects(imageData, threshold, darkForeground) {
  const { width, height, data } = imageData;
  const columnHits = new Array(width).fill(0);
  const rowHits = new Array(height).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3] ?? 255;
      if (a <= 24) continue;
      const luma = data[i] * .2126 + data[i + 1] * .7152 + data[i + 2] * .0722;
      const hit = darkForeground ? luma <= threshold : luma >= threshold;
      if (!hit) continue;
      columnHits[x]++;
      rowHits[y]++;
    }
  }
  const minColumnHits = Math.max(2, Math.floor(height * .015));
  const rawRuns = [];
  let runStart = -1;
  for (let x = 0; x <= width; x++) {
    const active = x < width && columnHits[x] >= minColumnHits;
    if (active && runStart < 0) runStart = x;
    if ((!active || x === width) && runStart >= 0) {
      if (x - runStart >= Math.max(8, width * .025)) rawRuns.push({ x: runStart, right: x - 1 });
      runStart = -1;
    }
  }
  const mergedRuns = [];
  for (const run of rawRuns) {
    const prev = mergedRuns[mergedRuns.length - 1];
    if (prev && run.x - prev.right < width * .035) {
      prev.right = run.right;
    } else {
      mergedRuns.push({ ...run });
    }
  }
  const minRowHits = Math.max(2, Math.floor(width * .004));
  let top = 0;
  let bottom = height - 1;
  while (top < height - 1 && rowHits[top] < minRowHits) top++;
  while (bottom > top && rowHits[bottom] < minRowHits) bottom--;
  const padX = Math.max(2, Math.round(width * .01));
  const padY = Math.max(2, Math.round(height * .015));
  const runs = mergedRuns
    .map(run => ({
      x: Math.max(0, run.x - padX),
      y: Math.max(0, top - padY),
      w: Math.min(width - Math.max(0, run.x - padX), run.right - run.x + 1 + padX * 2),
      h: Math.min(height - Math.max(0, top - padY), bottom - top + 1 + padY * 2)
    }))
    .filter(rect => rect.w > 8 && rect.h > 8)
    .sort((a, b) => a.x - b.x);
  if (runs.length >= 3) return [runs[0], runs[Math.floor(runs.length / 2)], runs[runs.length - 1]];
  if (runs.length === 2) return [runs[0], runs[1], runs[0]];
  return [
    { x: 0, y: 0, w: Math.floor(width / 3), h: height },
    { x: Math.floor(width / 3), y: 0, w: Math.floor(width / 3), h: height },
    { x: Math.floor(width * 2 / 3), y: 0, w: width - Math.floor(width * 2 / 3), h: height }
  ];
}

function buildReliefViewProfile(imageData, rect, rows, threshold, darkForeground) {
  const profile = [];
  for (let y = 0; y < rows; y++) {
    const sy = rect.y + (y / Math.max(1, rows - 1)) * Math.max(1, rect.h - 1);
    let minX = Infinity;
    let maxX = -Infinity;
    let lumaSum = 0;
    let count = 0;
    const samples = Math.max(24, Math.min(180, Math.round(rect.w)));
    for (let x = 0; x < samples; x++) {
      const sx = rect.x + (x / Math.max(1, samples - 1)) * Math.max(1, rect.w - 1);
      const pixel = sampleReliefPixel(imageData, imageData.width, imageData.height, sx, sy);
      if (!reliefForegroundCheck(pixel, threshold, darkForeground)) continue;
      minX = Math.min(minX, x / Math.max(1, samples - 1));
      maxX = Math.max(maxX, x / Math.max(1, samples - 1));
      lumaSum += pixel.luma;
      count++;
    }
    if (!count) {
      profile.push({ active: false, center: .5, width: 0, luma: darkForeground ? 255 : 0 });
    } else {
      profile.push({
        active: true,
        center: (minX + maxX) * .5,
        width: Math.max(0, maxX - minX),
        luma: lumaSum / count
      });
    }
  }
  return profile;
}

function smoothReliefProfile(profile, passes) {
  let current = profile.map(row => ({ ...row }));
  for (let pass = 0; pass < passes; pass++) {
    current = current.map((row, index) => {
      let width = row.active ? row.width : 0;
      let center = row.active ? row.center : .5;
      let luma = row.luma;
      let count = row.active ? 1 : 0;
      for (const offset of [-1, 1]) {
        const other = current[index + offset];
        if (!other?.active) continue;
        width += other.width;
        center += other.center;
        luma += other.luma;
        count++;
      }
      if (!count) return { ...row, active: false };
      return { active: true, width: width / count, center: center / count, luma: luma / count };
    });
  }
  return current;
}

// A front/back reference sheet is often cropped tight against one extended
// arm, cutting the other arm off-frame entirely (confirmed on the sample
// T-pose sheet: the front and back panels each only contain one full arm).
// The carve above faithfully reconstructs only what the image shows, which
// then reconstructs as a lopsided half-body. Rather than requiring a manual
// mirror step afterward (the previous workflow), pick whichever half of the
// carved body reaches further from center — the side that was actually
// captured in frame — and mirror it across the center plane so the output
// is always one complete, symmetric body.
function mirrorReliefGeometryToSymmetricHalf(positions, uvs) {
  const vertexCount = Math.floor(positions.length / 3);
  let maxLeftReach = 0;
  let maxRightReach = 0;
  let leftVertexCount = 0;
  let rightVertexCount = 0;
  for (let i = 0; i < vertexCount; i++) {
    const x = positions[i * 3];
    if (x < -1e-4) {
      leftVertexCount++;
      maxLeftReach = Math.max(maxLeftReach, -x);
    } else if (x > 1e-4) {
      rightVertexCount++;
      maxRightReach = Math.max(maxRightReach, x);
    }
  }
  const keepRight = maxLeftReach !== maxRightReach ? maxRightReach > maxLeftReach : rightVertexCount >= leftVertexCount;

  const keptPositions = [];
  const keptUvs = [];
  const triangleCount = Math.floor(vertexCount / 3);
  for (let t = 0; t < triangleCount; t++) {
    const base = t * 9;
    const uvBase = t * 6;
    // Split by centroid, not "any vertex on this side" — the torso/leg rings
    // are already centered at x=0, so most of their triangles have at least
    // one vertex on each side. Filtering by "touches the kept side" kept
    // almost the whole body both times, and mirroring that duplicated the
    // entire figure into conjoined twins instead of completing one.
    const centroidX = (positions[base] + positions[base + 3] + positions[base + 6]) / 3;
    const belongsToKeptHalf = keepRight ? centroidX >= 0 : centroidX <= 0;
    if (!belongsToKeptHalf) continue;
    for (let k = 0; k < 9; k++) keptPositions.push(positions[base + k]);
    for (let k = 0; k < 6; k++) keptUvs.push(uvs[uvBase + k]);
  }

  const mirroredPositions = [];
  const mirroredUvs = [];
  const keptTriangleCount = Math.floor(keptPositions.length / 9);
  for (let t = 0; t < keptTriangleCount; t++) {
    const base = t * 9;
    const uvBase = t * 6;
    // Mirroring x flips triangle winding, so vertex order is reversed
    // (a, c, b instead of a, b, c) to keep outward-facing normals correct.
    mirroredPositions.push(
      -keptPositions[base], keptPositions[base + 1], keptPositions[base + 2],
      -keptPositions[base + 6], keptPositions[base + 7], keptPositions[base + 8],
      -keptPositions[base + 3], keptPositions[base + 4], keptPositions[base + 5]
    );
    mirroredUvs.push(
      keptUvs[uvBase], keptUvs[uvBase + 1],
      keptUvs[uvBase + 4], keptUvs[uvBase + 5],
      keptUvs[uvBase + 2], keptUvs[uvBase + 3]
    );
  }

  return {
    positions: [...keptPositions, ...mirroredPositions],
    uvs: [...keptUvs, ...mirroredUvs],
    keptSide: keepRight ? "right" : "left"
  };
}

function createReliefGeometryFromViewSheet({ imageData, cols, rows, scale, depth, back, threshold, smoothPasses, darkForeground }) {
  const viewRects = detectReliefViewRects(imageData, threshold, darkForeground);
  const [frontRect, sideRect, backRect] = viewRects;
  // Matches the single-view mode's input ceiling (reliefGridXInput/reliefGridYInput,
  // 8-160 / 8-220 in index.html) instead of an unrelated lower ceiling that used to
  // silently cap view-sheet detail well below what a caller could actually request.
  const gridX = Math.max(12, Math.min(160, Math.round(cols)));
  const gridY = Math.max(16, Math.min(220, Math.round(rows)));
  const gridZ = Math.max(10, Math.min(88, Math.round(gridX * .55)));
  const meshH = scale;
  const meshW = scale * .52;
  const meshD = Math.max(back, depth, .25) * 2.4;
  const frontMask = new Array(gridX * gridY).fill(false);
  const backMask = new Array(gridX * gridY).fill(false);
  const sideMask = new Array(gridZ * gridY).fill(false);
  const sampleRect = (rect, nx, ny) => {
    const sx = rect.x + Math.max(0, Math.min(1, nx)) * Math.max(1, rect.w - 1);
    const sy = rect.y + Math.max(0, Math.min(1, ny)) * Math.max(1, rect.h - 1);
    return sampleReliefPixel(imageData, imageData.width, imageData.height, sx, sy);
  };
  for (let y = 0; y < gridY; y++) {
    const ny = y / Math.max(1, gridY - 1);
    for (let x = 0; x < gridX; x++) {
      const nx = x / Math.max(1, gridX - 1);
      frontMask[y * gridX + x] = reliefForegroundCheck(sampleRect(frontRect, nx, ny), threshold, darkForeground);
      backMask[y * gridX + x] = reliefForegroundCheck(sampleRect(backRect, 1 - nx, ny), threshold, darkForeground);
    }
    for (let z = 0; z < gridZ; z++) {
      const nz = z / Math.max(1, gridZ - 1);
      sideMask[y * gridZ + z] = reliefForegroundCheck(sampleRect(sideRect, nz, ny), threshold, darkForeground);
    }
  }
  if (smoothPasses > 0) {
    const softenMask = (mask, w, h, passes) => {
      let current = mask.slice();
      for (let pass = 0; pass < passes; pass++) {
        const next = current.slice();
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            let hits = 0;
            for (let oy = -1; oy <= 1; oy++) {
              for (let ox = -1; ox <= 1; ox++) {
                if (current[(y + oy) * w + x + ox]) hits++;
              }
            }
            next[y * w + x] = hits >= 4;
          }
        }
        current = next;
      }
      return current;
    };
    const passes = Math.min(2, smoothPasses);
    for (const [target, softened] of [
      [frontMask, softenMask(frontMask, gridX, gridY, passes)],
      [backMask, softenMask(backMask, gridX, gridY, passes)],
      [sideMask, softenMask(sideMask, gridZ, gridY, passes)]
    ]) {
      for (let i = 0; i < target.length; i++) target[i] = softened[i];
    }
  }
  const occupied = new Uint8Array(gridX * gridY * gridZ);
  const voxelIndex = (x, y, z) => (y * gridZ + z) * gridX + x;
  const isVoxel = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < gridX && y < gridY && z < gridZ && occupied[voxelIndex(x, y, z)] === 1;
  const rowRuns = (mask, width, y) => {
    const runs = [];
    let start = -1;
    for (let x = 0; x <= width; x++) {
      const active = x < width && mask[y * width + x];
      if (active && start < 0) start = x;
      if ((!active || x === width) && start >= 0) {
        runs.push({ start, end: x - 1, center: (start + x) * .5, radius: Math.max(.5, (x - start) * .5) });
        start = -1;
      }
    }
    return runs;
  };
  const findRun = (runs, x) => runs.find(run => x >= run.start && x <= run.end) || null;
  const sideProfiles = [];
  const bodyRuns = [];
  for (let y = 0; y < gridY; y++) {
    const unionRow = new Array(gridX).fill(false);
    for (let x = 0; x < gridX; x++) unionRow[x] = frontMask[y * gridX + x] || backMask[y * gridX + x];
    const unionMask = new Array(gridX).fill(false);
    for (let x = 0; x < gridX; x++) unionMask[x] = unionRow[x];
    bodyRuns[y] = rowRuns(unionMask, gridX, 0);
    const sideRuns = rowRuns(sideMask, gridZ, y);
    const largestSide = sideRuns.sort((a, b) => (b.end - b.start) - (a.end - a.start))[0] || null;
    sideProfiles[y] = largestSide;
  }
  // `point()` below naively maps grid column gridX/2 to mesh-X 0. That only
  // lands on the body's true centerline if the detected view rect happens to
  // crop the figure symmetrically — false whenever the sheet is cropped tight
  // against one outstretched arm (confirmed on the sample T-pose sheet: the
  // torso sits near one edge of its panel, with the rest of the panel width
  // taken up by the extended arm). The leg rows aren't affected by that crop,
  // so they give a robust estimate of where the body actually is; take the
  // median across the leg region and use that as the center instead of
  // assuming gridX/2.
  //
  // A row's legs can appear as one merged run (feet together) or two
  // separate runs (feet apart, e.g. a normal standing pose) — using "the
  // widest run's own center" only handles the merged case; with two
  // separate runs it locks onto whichever leg happens to be marginally
  // wider that row instead of the true centerline, which doubled the head
  // and a leg when first tried on a standing-apart robot reference. Using
  // the midpoint between the outermost edges of ALL runs in the row handles
  // both cases: it reduces to a merged run's own center, and finds the true
  // gap-center between two separate legs.
  const legCenterSamples = [];
  for (let y = Math.floor(gridY * .55); y < Math.floor(gridY * .9); y++) {
    const runs = bodyRuns[y] || [];
    if (!runs.length) continue;
    const minStart = Math.min(...runs.map(run => run.start));
    const maxEnd = Math.max(...runs.map(run => run.end));
    legCenterSamples.push((minStart + maxEnd) / 2);
  }
  legCenterSamples.sort((a, b) => a - b);
  const bodyCenterGridX = legCenterSamples.length
    ? legCenterSamples[Math.floor(legCenterSamples.length / 2)]
    : gridX / 2;
  const centerFrac = bodyCenterGridX / gridX;
  let voxelCount = 0;
  for (let y = 0; y < gridY; y++) {
    const side = sideProfiles[y];
    if (!side) continue;
    for (let x = 0; x < gridX; x++) {
      const run = findRun(bodyRuns[y], x);
      if (!run) continue;
      const xCenter = x + .5;
      const xRound = Math.abs(xCenter - run.center) / Math.max(.5, run.radius);
      if (xRound > 1.08) continue;
      const zAllowance = Math.sqrt(Math.max(0, 1 - xRound * xRound)) * 1.08;
      for (let z = 0; z < gridZ; z++) {
        if (!sideMask[y * gridZ + z]) continue;
        const zCenter = z + .5;
        const zRound = Math.abs(zCenter - side.center) / Math.max(.5, side.radius);
        if (zRound > zAllowance) continue;
        occupied[voxelIndex(x, y, z)] = 1;
        voxelCount++;
      }
    }
  }
  const positions = [];
  const uvs = [];
  const point = (x, y, z) => [
    (x / gridX - centerFrac) * meshW,
    (.5 - y / gridY) * meshH,
    (z / gridZ - .5) * meshD
  ];
  const pushTri = (a, b, c) => {
    positions.push(...a.p, ...b.p, ...c.p);
    uvs.push(...a.uv, ...b.uv, ...c.uv);
  };
  const pushQuad = (a, b, c, d) => {
    pushTri(a, b, c);
    pushTri(a, c, d);
  };
  const detailStrength = Math.min(.22, Math.max(.04, depth * .12));
  const detailContrastStrength = detailStrength * 2.8;
  // Per-vertex surface detail (sampling the source image directly at each
  // subdivided vertex, with no spatial pre-filtering) was tried and measured:
  // rendering it with only the absolute-brightness term and only the local-
  // contrast term, in isolation, each independently reproduced the same
  // fuzzy/spiky surface — because at the resolutions this mode now supports,
  // a single-point sample lands inside the source photo's own per-pixel grain
  // (compression noise, dither, anti-aliasing), not real shading. The plain
  // voxel-carved surface (no displacement) was clean by comparison, so
  // detail stays off until this has a real box/gaussian pre-filter over the
  // sampled image rather than a handful of unblurred neighbor points.
  const detailAmountFor = () => 0;
  const displacePoint = (p, direction, amount) => [
    p[0] + direction[0] * amount,
    p[1] + direction[1] * amount,
    p[2] + direction[2] * amount
  ];
  const detailVertex = (x, y, z, u, vv, view, direction) => {
    const base = point(x, y, z);
    const amount = detailAmountFor(view, x, y, z);
    return { p: displacePoint(base, direction, amount), uv: [u, vv] };
  };
  const v = (x, y, z, u, vv, view = "none", direction = [0, 0, 0]) => {
    if (view !== "none") return detailVertex(x, y, z, u, vv, view, direction);
    return { p: point(x, y, z), uv: [u, vv] };
  };
  const polishLevel = Math.max(0, smoothPasses - 2);
  const maxPatchSpan = polishLevel > 0 ? Math.max(2, 8 - polishLevel) : Infinity;
  const mix = (a, b, t) => a + (b - a) * t;
  const mixArray = (a, b, t) => a.map((value, index) => mix(value, b[index], t));
  const mixVertex = (a, b, t) => ({ p: mixArray(a.p, b.p, t), uv: mixArray(a.uv, b.uv, t) });
  const patchVertex = (a, b, c, d, u, vv) => {
    const top = mixVertex(a, b, u);
    const bottom = mixVertex(d, c, u);
    return mixVertex(top, bottom, vv);
  };
  const pushQuadPatch = (a, b, c, d, stepsU = 1, stepsV = 1) => {
    const uSteps = Math.max(1, Math.round(stepsU));
    const vSteps = Math.max(1, Math.round(stepsV));
    if (uSteps === 1 && vSteps === 1) {
      pushQuad(a, b, c, d);
      return;
    }
    for (let py = 0; py < vSteps; py++) {
      const v0 = py / vSteps;
      const v1 = (py + 1) / vSteps;
      for (let px = 0; px < uSteps; px++) {
        const u0 = px / uSteps;
        const u1 = (px + 1) / uSteps;
        pushQuad(
          patchVertex(a, b, c, d, u0, v0),
          patchVertex(a, b, c, d, u1, v0),
          patchVertex(a, b, c, d, u1, v1),
          patchVertex(a, b, c, d, u0, v1)
        );
      }
    }
  };
  const relaxWeldedPositions = (iterations, strength) => {
    if (positions.length < 9 || iterations <= 0 || strength <= 0) return;
    const vertices = [];
    const faces = [];
    const keyToIndex = new Map();
    const getVertexIndex = offset => {
      const key = `${positions[offset].toFixed(5)},${positions[offset + 1].toFixed(5)},${positions[offset + 2].toFixed(5)}`;
      if (keyToIndex.has(key)) return keyToIndex.get(key);
      const index = vertices.length;
      keyToIndex.set(key, index);
      vertices.push([positions[offset], positions[offset + 1], positions[offset + 2]]);
      return index;
    };
    for (let i = 0; i < positions.length; i += 9) {
      faces.push([getVertexIndex(i), getVertexIndex(i + 3), getVertexIndex(i + 6)]);
    }
    const neighbors = vertices.map(() => new Set());
    for (const [a, b, c] of faces) {
      neighbors[a].add(b); neighbors[a].add(c);
      neighbors[b].add(a); neighbors[b].add(c);
      neighbors[c].add(a); neighbors[c].add(b);
    }
    let current = vertices.map(vertex => vertex.slice());
    for (let pass = 0; pass < iterations; pass++) {
      const next = current.map(vertex => vertex.slice());
      for (let i = 0; i < current.length; i++) {
        const list = [...neighbors[i]];
        if (!list.length) continue;
        const average = [0, 0, 0];
        for (const ni of list) {
          average[0] += current[ni][0];
          average[1] += current[ni][1];
          average[2] += current[ni][2];
        }
        average[0] /= list.length;
        average[1] /= list.length;
        average[2] /= list.length;
        next[i] = [
          mix(current[i][0], average[0], strength),
          mix(current[i][1], average[1], strength),
          mix(current[i][2], average[2], strength)
        ];
      }
      current = next;
    }
    for (let i = 0; i < positions.length; i += 3) {
      const key = `${positions[i].toFixed(5)},${positions[i + 1].toFixed(5)},${positions[i + 2].toFixed(5)}`;
      const vertex = current[keyToIndex.get(key)];
      if (!vertex) continue;
      positions[i] = vertex[0];
      positions[i + 1] = vertex[1];
      positions[i + 2] = vertex[2];
    }
  };
  const greedyPlane = (w, h, isFilled, pushRect) => {
    const used = new Uint8Array(w * h);
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const start = yy * w + xx;
        if (used[start] || !isFilled(xx, yy)) continue;
        let rectW = 1;
        while (xx + rectW < w && !used[yy * w + xx + rectW] && isFilled(xx + rectW, yy)) rectW++;
        let rectH = 1;
        outer: while (yy + rectH < h) {
          for (let rx = 0; rx < rectW; rx++) {
            const index = (yy + rectH) * w + xx + rx;
            if (used[index] || !isFilled(xx + rx, yy + rectH)) break outer;
          }
          rectH++;
        }
        for (let ry = 0; ry < rectH; ry++) {
          for (let rx = 0; rx < rectW; rx++) used[(yy + ry) * w + xx + rx] = 1;
        }
        pushRect(xx, yy, rectW, rectH);
      }
    }
  };
  let mergedFaceCount = 0;
  for (let z = 0; z < gridZ; z++) {
    greedyPlane(gridX, gridY, (x, y) => isVoxel(x, y, z) && !isVoxel(x, y, z - 1), (x, y, w, h) => {
      mergedFaceCount++;
      pushQuadPatch(v(x, y, z, x / gridX, 1 - y / gridY, "front", [0, 0, -1]), v(x + w, y, z, (x + w) / gridX, 1 - y / gridY, "front", [0, 0, -1]), v(x + w, y + h, z, (x + w) / gridX, 1 - (y + h) / gridY, "front", [0, 0, -1]), v(x, y + h, z, x / gridX, 1 - (y + h) / gridY, "front", [0, 0, -1]), Math.ceil(w / maxPatchSpan), Math.ceil(h / maxPatchSpan));
    });
    greedyPlane(gridX, gridY, (x, y) => isVoxel(x, y, z) && !isVoxel(x, y, z + 1), (x, y, w, h) => {
      mergedFaceCount++;
      pushQuadPatch(v(x, y, z + 1, x / gridX, 1 - y / gridY, "back", [0, 0, 1]), v(x, y + h, z + 1, x / gridX, 1 - (y + h) / gridY, "back", [0, 0, 1]), v(x + w, y + h, z + 1, (x + w) / gridX, 1 - (y + h) / gridY, "back", [0, 0, 1]), v(x + w, y, z + 1, (x + w) / gridX, 1 - y / gridY, "back", [0, 0, 1]), Math.ceil(h / maxPatchSpan), Math.ceil(w / maxPatchSpan));
    });
  }
  for (let x = 0; x < gridX; x++) {
    greedyPlane(gridZ, gridY, (z, y) => isVoxel(x, y, z) && !isVoxel(x - 1, y, z), (z, y, w, h) => {
      mergedFaceCount++;
      pushQuadPatch(v(x, y, z, z / gridZ, 1 - y / gridY, "side", [-1, 0, 0]), v(x, y + h, z, z / gridZ, 1 - (y + h) / gridY, "side", [-1, 0, 0]), v(x, y + h, z + w, (z + w) / gridZ, 1 - (y + h) / gridY, "side", [-1, 0, 0]), v(x, y, z + w, (z + w) / gridZ, 1 - y / gridY, "side", [-1, 0, 0]), Math.ceil(h / maxPatchSpan), Math.ceil(w / maxPatchSpan));
    });
    greedyPlane(gridZ, gridY, (z, y) => isVoxel(x, y, z) && !isVoxel(x + 1, y, z), (z, y, w, h) => {
      mergedFaceCount++;
      pushQuadPatch(v(x + 1, y, z, z / gridZ, 1 - y / gridY, "side", [1, 0, 0]), v(x + 1, y, z + w, (z + w) / gridZ, 1 - y / gridY, "side", [1, 0, 0]), v(x + 1, y + h, z + w, (z + w) / gridZ, 1 - (y + h) / gridY, "side", [1, 0, 0]), v(x + 1, y + h, z, z / gridZ, 1 - (y + h) / gridY, "side", [1, 0, 0]), Math.ceil(w / maxPatchSpan), Math.ceil(h / maxPatchSpan));
    });
  }
  for (let y = 0; y < gridY; y++) {
    greedyPlane(gridX, gridZ, (x, z) => isVoxel(x, y, z) && !isVoxel(x, y - 1, z), (x, z, w, h) => {
      mergedFaceCount++;
      pushQuadPatch(v(x, y, z, x / gridX, z / gridZ), v(x, y, z + h, x / gridX, (z + h) / gridZ), v(x + w, y, z + h, (x + w) / gridX, (z + h) / gridZ), v(x + w, y, z, (x + w) / gridX, z / gridZ), Math.ceil(h / maxPatchSpan), Math.ceil(w / maxPatchSpan));
    });
    greedyPlane(gridX, gridZ, (x, z) => isVoxel(x, y, z) && !isVoxel(x, y + 1, z), (x, z, w, h) => {
      mergedFaceCount++;
      pushQuadPatch(v(x, y + 1, z, x / gridX, z / gridZ), v(x + w, y + 1, z, (x + w) / gridX, z / gridZ), v(x + w, y + 1, z + h, (x + w) / gridX, (z + h) / gridZ), v(x, y + 1, z + h, x / gridX, (z + h) / gridZ), Math.ceil(w / maxPatchSpan), Math.ceil(h / maxPatchSpan));
    });
  }
  if (polishLevel > 0) relaxWeldedPositions(Math.min(4, polishLevel), .12);
  if (positions.length < 9) throw new Error("No sheet foreground was found. Try Threshold or Dark foreground.");
  const symmetric = mirrorReliefGeometryToSymmetricHalf(positions, uvs);
  return {
    positions: symmetric.positions,
    uvs: symmetric.uvs,
    meta: {
      mode: "viewSheetOvalHullDetailPolished", cols: gridX, rows: gridY, depthSlices: gridZ, sourceW: imageData.width, sourceH: imageData.height,
      threshold, darkForeground, smoothPasses, polishLevel, depth, back, voxelCount, mergedFaceCount, detailStrength, detailContrastStrength, viewRects,
      mirroredFromSide: symmetric.keptSide
    }
  };
}

export function buildReliefGeometry({ imageData, cols, rows, scale, depth, back, threshold, smoothPasses, detailStrength = 1, darkForeground, sourceMode = "single", buildMode = "standard", sourceName = "reference image" }) {
  if (!imageData) throw new Error("No source image data was provided.");
  const sourceW = imageData.width;
  const sourceH = imageData.height;
  if (sourceMode === "sheet") {
    const detailed = buildMode === "solidVisualHull";
    const recoveredV30 = buildMode === "recoveredV30";
    const hybridV46 = buildMode === "hybridV46";
    const hybridV47 = buildMode === "hybridV47";
    return createDetailedImageMeshGeometry({
      imageData,
      cols: detailed || recoveredV30 || hybridV46 || hybridV47 ? cols : Math.min(cols, 84),
      rows: detailed || recoveredV30 || hybridV46 || hybridV47 ? rows : Math.min(rows, 144),
      scale, depth, back, threshold, smoothPasses, detailStrength: detailed || recoveredV30 || hybridV46 || hybridV47 ? detailStrength : detailStrength * .5, darkForeground,
      sourceMode: "sheet", buildMode: hybridV47 ? "hybridV47" : (hybridV46 ? "hybridV46" : (recoveredV30 ? "recoveredV30" : "solidVisualHull")), sourceName
    });
  }
  const aspect = sourceW / Math.max(1, sourceH);
  const meshH = scale;
  const meshW = scale * aspect;
  const mask = new Array(cols * rows).fill(false);
  const heights = new Array(cols * rows).fill(0);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const sx = (x / Math.max(1, cols - 1)) * (sourceW - 1);
      const sy = (y / Math.max(1, rows - 1)) * (sourceH - 1);
      const pixel = sampleReliefPixel(imageData, sourceW, sourceH, sx, sy);
      const inForeground = pixel.a > 24 && (darkForeground ? pixel.luma <= threshold : pixel.luma >= threshold);
      const index = y * cols + x;
      mask[index] = inForeground;
      const normalized = darkForeground
        ? Math.max(0, Math.min(1, (threshold - pixel.luma) / Math.max(1, threshold)))
        : Math.max(0, Math.min(1, (pixel.luma - threshold) / Math.max(1, 255 - threshold)));
      heights[index] = Math.pow(normalized, .75) * depth;
    }
  }
  const smoothHeights = smoothReliefHeights(heights, mask, cols, rows, smoothPasses);
  const positions = [];
  const uvs = [];
  const point = (x, y, z) => [
    (x / Math.max(1, cols - 1) - .5) * meshW,
    (.5 - y / Math.max(1, rows - 1)) * meshH,
    z
  ];
  const uv = (x, y) => [x / Math.max(1, cols - 1), 1 - y / Math.max(1, rows - 1)];
  const pushTri = (a, b, c) => {
    positions.push(...a.p, ...b.p, ...c.p);
    uvs.push(...a.uv, ...b.uv, ...c.uv);
  };
  const pushQuad = (a, b, c, d) => {
    pushTri(a, b, c);
    pushTri(a, c, d);
  };
  const frontVertex = (x, y) => ({ p: point(x, y, smoothHeights[y * cols + x]), uv: uv(x, y) });
  const backVertex = (x, y) => ({ p: point(x, y, -back), uv: uv(x, y) });
  const isValid = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && mask[y * cols + x];

  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < cols - 1; x++) {
      if (!(isValid(x, y) && isValid(x + 1, y) && isValid(x + 1, y + 1) && isValid(x, y + 1))) continue;
      const a = frontVertex(x, y), b = frontVertex(x + 1, y), c = frontVertex(x + 1, y + 1), d = frontVertex(x, y + 1);
      pushQuad(a, d, c, b);
      if (back > 0) {
        const ba = backVertex(x, y), bb = backVertex(x + 1, y), bc = backVertex(x + 1, y + 1), bd = backVertex(x, y + 1);
        pushQuad(ba, bb, bc, bd);
      }
    }
  }
  if (back > 0) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (!isValid(x, y)) continue;
        if (!isValid(x, y - 1) && isValid(x + 1, y)) pushQuad(frontVertex(x, y), frontVertex(x + 1, y), backVertex(x + 1, y), backVertex(x, y));
        if (!isValid(x + 1, y) && isValid(x, y + 1)) pushQuad(frontVertex(x, y), backVertex(x, y), backVertex(x, y + 1), frontVertex(x, y + 1));
        if (!isValid(x, y + 1) && isValid(x + 1, y)) pushQuad(frontVertex(x, y), backVertex(x, y), backVertex(x + 1, y), frontVertex(x + 1, y));
        if (!isValid(x - 1, y) && isValid(x, y + 1)) pushQuad(frontVertex(x, y), frontVertex(x, y + 1), backVertex(x, y + 1), backVertex(x, y));
      }
    }
  }
  if (positions.length < 9) throw new Error("No foreground mesh was found. Try lowering/raising Threshold or toggling Dark foreground.");
  return {
    positions,
    uvs,
    meta: { mode: "single", cols, rows, sourceW, sourceH, threshold, darkForeground, smoothPasses, depth, back }
  };
}

