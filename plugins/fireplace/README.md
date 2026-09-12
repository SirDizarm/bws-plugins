# Fireplace 0.1.0 - experimental preview

## Download and install

### [Download plugin](https://github.com/SirDizarm/bws-plugins/raw/refs/heads/main/plugins/fireplace/plugin.bwsplugin)

**This is the only file you need: `plugin.bwsplugin`.** No commands, building, or other files are needed.

1. Download the plugin using the link above.
2. In BWS, open **Plugins → Install from file** and select that file.
3. Choose **Install plugin** after reviewing it, then **Enable**.

In BWS 50.0.15 or later, you can instead choose **Plugins → Browse plugins → Install plugin**. Direct installation needs a publicly accessible package; for a private repository, download while signed in to GitHub and use Install from file.

---


An optional isolated fireplace viewer for BWS 50 preview, with selectable saved log meshes, synthesized fire audio, fire controls, and fullscreen viewing.

Install plugin.bwsplugin through BWS Plugins, review it, then enable it. Its button appears in the Scenes toolbar. Disable or remove it through Plugins.

## Limitations

This is not a finished fireplace-authoring tool. Custom scene transfer from BWS is not implemented. Log appearance, flame occlusion, and shadow quality need more work. Flames are camera-facing rather than a 3D combustion simulation. Do not mistake this preview for the future SpellBinder room.

The workspace runs in an isolated sandbox, without editor, filesystem, or network access. Fullscreen requires user interaction. Audio is synthesized, not copied from the reference videos.

## For developers

These implementation details are not installation steps.

The self-contained package includes its HTML/JavaScript, mesh data, and Three.js license. Its source implementation currently lives in the BWS project at app/panels/fireplace-experience.js; tools/build-fireplace-plugin.mjs produces the distributable. Independent build tooling is a future packaging step.
