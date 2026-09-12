# Extraction status

Game Engine runtime source now lives in src/exporter.js, with src/main.html and an independent build.mjs. BWS retains character-copy preparation, editor pose restoration and bounded result insertion in app/modules/plugin-character-bridge.js. Normal rigging and generic model import/export remain core functionality.

The package requires API 4 / BWS v50.0.17+. It is off by default. No plugin code runs in the parent editor.

Validation is pending: fitted and rigid-only characters; arms and equipment; mapped and fallback clips; LODs; textures; real downloads/runtime import; success/failure pose restoration; image item insertion and undo. Do not add to the curated catalogue before these checks.

source-reference is the preserved pre-extraction v50.0.15 source, not the active runtime.
