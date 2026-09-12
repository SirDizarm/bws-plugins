# Image to Mesh

## Download and install

### [Download plugin](https://github.com/SirDizarm/bws-plugins/raw/refs/heads/main/plugins/image-to-mesh/plugin.bwsplugin)

**This is the only file you need: `plugin.bwsplugin`.** No commands, building, or other files are needed.

1. Download the plugin using the link above.
2. In BWS, open **Plugins → Install from file** and select that file.
3. Choose **Install plugin** after reviewing it, then **Enable**.

In BWS 50.0.15 or later, you can instead choose **Plugins → Browse plugins → Install plugin**. Direct installation needs a publicly accessible package; for a private repository, download while signed in to GitHub and use Install from file.

---


Optional plugin for BWS 50.0.13 or later (API 3). Install plugin.bwsplugin, then enable and Open. Load an image, select a reconstruction mode, preview the result, then choose Add mesh to BWS. Existing objects are retained.

The existing AI referenceMatch.createMesh command now requires this plugin to be installed and enabled. Its validated request is sent to the isolated generator; BWS validates returned geometry before insertion. There is no direct editor or network access.

<details>
<summary>For developers: build from source (not needed to install)</summary>

Run npm install and npm run build in this folder. Source algorithms were extracted without changing the reconstruction calculations. Three.js license is included in the package.

</details>

## Status

Development preview. Installation and plugin-window screenshot checks passed. Mesh generation, scene insertion and AI-command integration testing remain pending. Root LICENSE and NOTICE apply.
