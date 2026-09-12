# BoltWorks public plugins

Optional plugins for BoltWorks Studio. Install only what you want; plugins are not automatically enabled or downloaded by the editor.

## Available previews

| Plugin | Status | Package |
| --- | --- | --- |
| [Fireplace](plugins/fireplace/README.md) | Experimental scene viewer, version 0.1.0 | [Download / install URL](https://raw.githubusercontent.com/SirDizarm/bws-plugins/main/plugins/fireplace/plugin.bwsplugin) |

## Install in BWS 50 preview

1. Open Plugins in BWS.
2. Paste the direct package URL above into the URL installer, or download the package and choose Install from file.
3. Review the source and permissions. Installation starts disabled.
4. Enable the plugin. Fireplace appears in the Scenes toolbar.

This is a multi-plugin repository. Use an individual package link, not the repository root, with the current BWS loader. Updates are manual. The legacy editor does not use this installer.

## Planned, not available yet

- Roblox Exporter: one ZIP with separate OBJ parts, a hierarchy manifest, and Roblox assembly scripts. OBJ parts use studs; 1 stud = 0.28 metres.
- Minecraft modeling: separate custom meshes and a one-unit block with 16-by-16 texture pixels per face.
- Other BWS extensions will be added after extraction and testing.

These plans are not installable packages. The BWS editor migration and unfinished exporters are not included here. Private plugins will be maintained separately.

## License

See LICENSE and NOTICE. Packaged third-party runtimes retain their own licenses; Fireplace includes THREE-LICENSE.txt inside its package. BoltWorks branding and visual assets remain subject to the accompanying notice.
