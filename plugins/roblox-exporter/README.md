# Roblox Exporter

Optional plugin for BWS 50.0.10 or later (API 2). Version 1.1.0 is a development preview; browser file saving and Roblox Studio import remain unverified.

Exports one ZIP with separate centered OBJ parts, textures, hierarchy manifest, setup Lua and Roblox rebuild plugin Lua. OBJ uses studs: 1 stud = 0.28 metres.

Install plugin.bwsplugin from Plugins, enable it, then Open. Choose Send current model, Build Roblox ZIP, and Download ZIP. Sharing includes hidden meshes and the texture library; it never changes the editor scene. No network or filesystem access.

## Build independently

Run `npm install` then `npm run build` in this folder. Source lives in src/. The generated package embeds its runtime and the Three.js license; it has no runtime dependency on a BWS checkout.

See index.html for instructions and CHANGELOG.md for updates. Root LICENSE and NOTICE apply.
