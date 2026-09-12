# Scene Rendering

## Download and install

### [Download plugin](https://github.com/SirDizarm/bws-plugins/raw/refs/heads/main/plugins/scene-rendering/plugin.bwsplugin)

**This is the only file you need: `plugin.bwsplugin`.** No commands, building, or other files are needed.

1. Download the plugin using the link above.
2. In BWS, open **Plugins → Install from file** and select that file.
3. Choose **Install plugin** after reviewing it, then **Enable**.

In BWS 50.0.15 or later, you can instead choose **Plugins → Browse plugins → Install plugin**. Direct installation needs a publicly accessible package; for a private repository, download while signed in to GitHub and use Install from file.

---


Optional static lighting workspace. Use BWS 50.0.14 or later. Install, enable, then Open from Plugins or the Scenes toolbar. Choose Send current model; adjust lamps and view fullscreen.

Supports static mesh geometry, base colors and named image textures. Animated rigs, custom shaders and normal maps are not transferred. This is not Scene Studio and does not change the editor lighting. Existing saved lighting state remains compatible in BWS.

<details>
<summary>For developers: build from source (not needed to install)</summary>

Run npm install then npm run build in this folder. Includes Three.js and its license. Root LICENSE and NOTICE apply.

</details>

## Status

Development preview. Browser model transfer, rundown preview and reset checked on a 3,101-part house.

## Rundown preview (1.2.0)

Click to select a part; Shift-click adds to the selection. A searchable list also selects parts, including pieces hidden by damage. Select all applies the condition slider to the whole received model. Weathering, loosened pieces, partial collapse and gaps are reversible. Restore selected or Reset all damage returns to the received base state.

Browser screenshots checked maximum damage and a complete reset on a 3,101-part house. Fire placement, fracture physics, saved damage state and exporting damaged scenes are not implemented yet.
