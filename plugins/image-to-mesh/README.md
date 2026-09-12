# Image to Mesh

Optional plugin for BWS 50.0.13 or later (API 3). Install plugin.bwsplugin, then enable and Open. Load an image, select a reconstruction mode, preview the result, then choose Add mesh to BWS. Existing objects are retained.

The existing AI referenceMatch.createMesh command now requires this plugin to be installed and enabled. Its validated request is sent to the isolated generator; BWS validates returned geometry before insertion. There is no direct editor or network access.

## Build

Run npm install and npm run build in this folder. Source algorithms were extracted without changing the reconstruction calculations. Three.js license is included in the package.

## Status

Development preview. Installation and plugin-window screenshot checks passed. Mesh generation, scene insertion and AI-command integration testing remain pending. Root LICENSE and NOTICE apply.
