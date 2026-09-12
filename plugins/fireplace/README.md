# Fireplace 0.1.0 - experimental preview

An optional isolated fireplace viewer for BWS 50 preview, with selectable saved log meshes, synthesized fire audio, fire controls, and fullscreen viewing.

Install plugin.bwsplugin through BWS Plugins, review it, then enable it. Its button appears in the Scenes toolbar. Disable or remove it through Plugins.

## Limitations

This is not a finished fireplace-authoring tool. Custom scene transfer from BWS is not implemented. Log appearance, flame occlusion, and shadow quality need more work. Flames are camera-facing rather than a 3D combustion simulation. Do not mistake this preview for the future SpellBinder room.

The workspace runs in an isolated sandbox, without editor, filesystem, or network access. Fullscreen requires user interaction. Audio is synthesized, not copied from the reference videos.

The self-contained package includes its HTML/JavaScript, mesh data, and Three.js license. Its source implementation currently lives in the BWS project at app/panels/fireplace-experience.js; tools/build-fireplace-plugin.mjs produces the distributable. Independent build tooling is a future packaging step.
