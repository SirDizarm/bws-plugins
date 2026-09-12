# Geometry Nodes

**Local extracted preview 0.2.1. Requires BWS v50.0.18+. Not compatible with legacy v49+. Validation pending; not published or catalogued.**

[Open BoltWorks 3D Studio](https://3d.boltworksstudio.com/)

## Install

Only **plugin.bwsplugin** is needed. Choose Plugins > Install from file, review the file, Enable, then Open. No build commands are required for users.

## Use

Choose Send graphs to copy saved recipes and textures. Create/edit graphs and Build preview. Add generated copy keeps existing objects. Replace graph output asks for confirmation before replacing the last output linked to that graph; other objects stay unchanged. New geometry is prepared before removing the prior output, and insertion is undoable in BWS.

Choose Save graphs to BWS to retain recipe edits. Closing without saving discards edits. Node editor local undo is not yet implemented. Save .bwnc prepares a file; choose Download graph in the BWS header to save it. Fullscreen replaces the old detached browser window.

Scene Studio requires the enabled plugin when generating trees or rocks from node recipes. Existing saved meshes and graph recipes remain in BWS even when the plugin is absent. Shared Scene Studio geometry/math helpers remain in BWS; they are not downloaded plugin code.

## Validation pending

Browser graph editing and generation, saved project compatibility, tree/house outputs, house batches, textures, .bwnc files, recipe persistence, replacement/undo and Scene Studio requests still need testing. Limits: 24 recipes, 5,000 output parts, nine million position components, 8 MB recipes and 64 MB shared textures. Large house batches may exceed these limits. House batch asset metadata is preserved, but output replacement currently replaces the full linked graph output, not individual houses in BWS.

## Developers

Runtime source is src/main.js with src/factory.js and src/main.html. Run npm install and npm run build only when rebuilding from source. source-reference is historical, not active. Retain LICENSE, NOTICE and bundled THREE-LICENSE.txt.
