# BoltWorks Game Engine

**Local extracted preview 1.1.0. Requires BWS v50.0.17 or newer, not legacy v49+. Not published or listed yet.**

[Open BoltWorks 3D Studio](https://3d.boltworksstudio.com/)

## Install

Only **plugin.bwsplugin** is needed. In a compatible BWS build, choose Plugins > Install from file, select that file, review permissions, then enable the plugin and choose Open. No commands or source files are needed.

## Character export

Choose **Send character copy** in the BWS window header. Map the eight lower/upper clips, select LOD options and prepare the character ZIP or arm-only GLB. Choose **Download export** in the header to save it. The ZIP retains GLB LODs, the character manifest and clip list. The live editor pose is restored after copying.

## Solid items

Choose an image, sword or shield, dimensions, then Build Solid Item. Inspect the preview and choose **Add item to BWS** in the header. The result uses a new group and matching grip socket if present. Existing objects are kept.

## Limits and status

Character copy: 64 MB and 512 rig bones. Animation sampling: two million bone samples. Download: 128 MB. Images: 16 MB / 16 megapixels; resulting PNG must fit the 16 MB insertion limit.

The standalone package and BWS bridge have been implemented. Browser, rig, animation, LOD, texture, actual download and runtime-import validation are pending. Do not treat this as a tested release. Geometry Nodes extraction is separate.

<details><summary>Developers only: rebuild</summary>

Run npm install and npm run build in this folder. The package includes Three.js and its license. The source-reference folder is a historical snapshot, not the runtime.

</details>
