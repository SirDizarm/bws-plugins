# Roblox Exporter

## Download and install

### [Download plugin](https://github.com/SirDizarm/bws-plugins/raw/refs/heads/main/plugins/roblox-exporter/plugin.bwsplugin)

**This is the only file you need: `plugin.bwsplugin`.** No commands, building, or other files are needed.

1. Download the plugin using the link above.
2. In BWS, open **Plugins → Install from file** and select that file.
3. Choose **Install plugin** after reviewing it, then **Enable**.

In BWS 50.0.15 or later, you can instead choose **Plugins → Browse plugins → Install plugin**. Direct installation needs a publicly accessible package; for a private repository, download while signed in to GitHub and use Install from file.

---


Optional plugin for BWS 50.0.10 or later (API 2). Version 1.1.0 is a development preview; browser file saving and Roblox Studio import remain unverified.

Exports one ZIP with separate centered OBJ parts, textures, hierarchy manifest, setup Lua and Roblox rebuild plugin Lua. OBJ uses studs: 1 stud = 0.28 metres.

Install plugin.bwsplugin from Plugins, enable it, then Open. Choose Send current model, Build Roblox ZIP, and Download ZIP. Sharing includes hidden meshes and the texture library; it never changes the editor scene. No network or filesystem access.

<details>
<summary>For developers: build from source (not needed to install)</summary>

Run `npm install` then `npm run build` in this folder. Source lives in src/. The generated package embeds its runtime and the Three.js license; it has no runtime dependency on a BWS checkout.

See index.html for instructions and CHANGELOG.md for updates. Root LICENSE and NOTICE apply.

</details>
