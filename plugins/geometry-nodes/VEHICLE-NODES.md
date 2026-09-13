# Vehicle nodes preview - 0.3.0

Add node > Vehicles > Cargo Truck, connect Seed -> Cargo Truck -> Group Output, then Build / Update Geometry.

Separate Truck Cab, Truck Chassis, Truck Wheel Set and Cargo Bed nodes share the same origin and dimensions. Keep their wheelbase, width, tyre radius and bed dimensions matched when assembling them together. Use either the complete truck or component nodes, not both.

Metres; Y up; vehicle faces -X. Front axle X=-wheelbase/2, rear X=+wheelbase/2; wheel centres Y=tyre radius, Z=+/-(width/2-0.08). Part names identify axle and side. Wheels consist of separate tyre, rim, hub and bolts; engine rig export/grouping is not implemented yet.

Original procedural geometry: rounded hood and cab roof, glazed window openings, curved fenders, grille slats, mirrors, leaf springs, chassis rails, planked bed, treaded tyres, rims, hubs and bolts. Deterministic seed-driven colour variation.

Prototype, not visually validated. Weathered texture work, suspension/lighting metadata export and direct game integration remain pending. No Roblox meshes used.

## 0.3.1
Visible full-size scrollable graph canvas, in-place fullscreen, connected Cargo Truck template, and explicit empty-build feedback.

## 0.3.2 - Cab interior
Cab Interior is a separate component node, also included by Cargo Truck. Seating: none, driver only, two seats, or bench. Steering: left, right, or none. Includes column, wheel, pedals, gauges and gear lever. Toggle Show cab roof / Show window glass on the cab or complete truck to inspect inside. Match interior dimensions to the cab manually for now; shared mounting connections remain pending. Steering-side choice is explicit, not inferred from location.

## 0.3.3 - Bed clearance and rear lamp mounts
Bed height follows tyre diameter plus fender clearance. Added chassis-to-bed supports and cross bearers. Rear lights now have housings on a bracketed mounting bar instead of floating lenses. Browser visual validation pending.

## 0.3.4 - Hood enclosure and engine
Hood lower side panels, side vents and firewall close the open bay. Separate Engine node adds an inline-four visual assembly, also included in Cargo Truck. Show hood panels can be disabled for inspection. This is static model geometry, not an engine simulation. Browser visual validation pending.

## 0.4.0
Added box cargo, logging body, exhaust stacks, one to three rear axles, and a static forklift with fork height, spacing and length controls. Cargo Truck body choices: wood, flatbed, box, logs. Tapered hood and bumper frame brackets. Prototype geometry, not hydraulic simulation or finished weathering. Split preview and shared graph dimensions remain pending. Not visually tested.

## 0.4.1
BWS v50.0.23 host-controlled detachable preview. Inline preview hides and stops rendering while detached. Close or Return preview restores it. Graph editor stays in the original window.

## 0.4.2
Both Add node menus put general-purpose categories before vehicle and architecture generators. Node titles fall back to legacy labels, restoring missing nature and village asset names.

## 0.4.3
Node viewport uses wheel zoom and middle-drag / Space-drag pan instead of scrolling. Added Fit nodes using measured card sizes. Rulers remain anchored to the non-scrolling viewport; vertical labels have more room. Not visually tested.

## 0.4.4
Lower wooden and flatbed decks with segmented floor/side boards around rear wheel housings and enclosed inboard wheel-tub faces. Cross bearers stay inside wheel clearance. Box/logging decks remain raised. Not visually tested.

## 0.4.5
Full-width cab front cowl closes the opening below the windshield beside the hood. Not visually tested.

## 0.5.0 - Experimental assembly streams
Added Remove Parts, Place Part (Target and Part inputs, top/center/bottom/manual anchors, XYZ position/rotation/scale), Hinge (manual pivot, group, axis and limits), and Interaction Volume (oriented debug box, purpose, dimensions, maximum item dimensions, capacity and oversized override). Geometry and Join inputs are evaluated as streams without implicit overlap replacement. Vehicle part groups are inferred from generated part names. Interaction/hinge metadata travels in gameAsset. Missing groups, unsupported legacy procedural nodes and cycles stop before replacing the preview. Current support: asset-generator inputs, Join and assembly nodes; existing graphs retain their old evaluation. Not visually tested. Pending: click-to-place, explicit persistent mounting-point IDs, specific door/hood subgroups, full legacy modifier support, textures in assembly preview, engine enforcement/random filling, and curated templates. Top anchor uses bounding-box top, not the cargo floor. Debug boxes are actual preview geometry tagged debugOnly: disable them before exporting to consumers that do not honor that flag.

## 0.5.1
Assembly preview meshes now receive unique runtime IDs across graphs. Logical assembly metadata IDs remain separate. Not visually tested.

## 0.5.2
Cargo stake bolts belong to the cargo assembly instead of the cab, so Remove Parts / cargo also removes those fittings. Not visually retested.

## 0.5.3
Heavy Cargo Area node: oriented volume, item dimensions, count, maximum item mass, total mass, cargo category and explicit oversized/overweight debug options. Place Part records payload mass and a loadId shared across its meshes so consumers count a vehicle once. Unknown mass is null, not zero. Multiple placed vehicle streams can be combined with Join. These are exported rules only: no automatic fitting, packing, mass calculation, eligibility enforcement or cargo physics yet. Geometry remains merged into a node output; engine entity reconstruction requires engine support. Not tested.

## 0.5.4
Workspace instructions now explain Save .bwnc for node recipe files and Add generated copy / Save Project for models. BWS v50.0.25 removes the Save graphs to BWS header button. Existing saved recipes remain intact.

## 0.5.5
Move existing Save .bwnc and Load .bwnc buttons to a sticky toolbar at the top of the plugin workspace, above the preview. Existing file handlers retained; no duplicate lower buttons. Not visually tested.

## 0.5.6
Host-header Save Geometry Nodes and Load Geometry Nodes use explicit save/load messages (BWS v50.0.26). Removed duplicate internal file toolbar. Import to workspace is additive. Updated instructions. Not visually tested.

## 0.5.7
Every asset/assembly node now owns its parameter record, including first instances. Existing graph values are snapshotted before edits; shared legacy values are preserved rather than guessed. New asset nodes also get independent records. Fixes truck/forklift colors, body settings and shared assembly controls changing together. Not visually tested.

## 0.5.8
Inline preview orientation guide with labelled positive/negative axes and six view buttons. Detached equivalent requires BWS v50.0.27. Sidebar node manipulation and picking remain pending. Not visually tested.

## 0.5.9 - Independent saved asset settings
Legacy recipes now allocate independent asset settings during load and before building, not only when cards render. Shared in-memory parameter objects are separated without replacing saved values. Includes the 0.5.7 input isolation fix. Updating the installed plugin is required; no BWS core changes. Existing overwritten colours cannot be recovered automatically. Built but not interaction-tested.

## 0.5.10 - Input and identity isolation
Seed, texture, palette and texture-randomizer cards own their settings. Asset generators resolve connected seed values independently. Texture uploads target their own node, including the first texture input. Adding nodes finds an unused ID after deletion; duplicate cards no longer emit duplicate instance attributes. Legacy tree generation still uses a shared pipeline and needs further per-instance evaluation work.

## 0.6.0 - Independent branches and fork cargo
All node cards now own parameter records, including migrated recipes. Separate legacy geometry branches are evaluated with private recipes; transform and smoothing nodes operate on their own geometry streams. Building-detail chains preserve distinct node IDs, including repeated windows, and resolve against their upstream house rather than being treated as standalone assets. House Batch retains its existing dedicated builder.

Fork Cargo Area follows the forklift tines and exposes cargo height, capacity and weight rules. Connect its output to Place Part's Target socket, connect a load to Part, and choose the forks placement anchor. Fork height raises the tines, cargo area and placed load together. No BWS Studio changes are required.

Browser checks: house template rebuilt successfully (1,889 parts), including two window nodes and a roof. Forklift with a primitive load and fork cargo area rebuilt successfully (88 parts); raising fork height to 1.5 moved the load and area with the forks. Separate tree branches produced distinct heights and branch counts. Earlier candidate checks covered separate truck/forklift paint, body settings, seeds, palettes, texture variation and non-reused node IDs.

Limitations: repeated legacy tree node types within one ancestor chain still use the legacy mesher's single slot per type; full arbitrary modifier stacking is not implemented. Assembly texture rendering remains pending. Cargo eligibility, packing and physics require engine support. House Batch, file-save round trips and every possible mixed-node combination were not retested for this release. Multiple recipes can retain their built outputs in the plugin preview; closing and reopening the plugin starts a fresh preview.

## 0.7.0 - Vehicle themes and starter recipe catalog (candidate)
Vehicle Theme is an opt-in shared input connected to the third vehicle socket. Shape style (classic, round, square, futuristic) and condition (clean, worn, rusty, broken) are separate. Override connected theme restores the vehicle card's own settings and paint. Classic/clean remains the default, preserving existing recipes. Shape changes affect box rounding and hood profile; the futuristic option is an angular treatment, not a complete new cab design. Rust is per-part material variation, not a texture. Broken adds deterministic shallow panel dents and can omit boards or glazing.

The expandable Industrial collection contains Old Yard Truck, Industrial Box Truck, Rusty Flatbed, Salvage Truck, Forklift and Load, and Timber Workshop. Thumbnails render actual recipe geometry in muted green using a temporary renderer, without inserting it into the workspace. Use these Geometry Nodes adds a new editable recipe. User-curated persistent catalog entries, downloadable thumbnail files, house themes, cranes, excavators and trailers remain pending. Save Geometry Nodes is still required to retain edited recipes after closing the plugin.

Includes the truck door/sill/step wheel-arch clearance changes and forklift-only fork controls, previously installed and tested across nine tyre/cab configurations. Theme and catalog additions have not yet been built, installed or tested.

## 0.8.0 - Machinery construction kit (unvalidated candidate)
Adds 17 machinery nodes: Caterpillar Tracks, Tracked Utility Carrier, Excavator, Crane Assembly, Articulated Boom, Telescopic Boom, Excavator Bucket, Crane Hook, Hydraulic Cylinder, Stabilizer Legs, Rotating Base, Machinery Cab, Cargo Trailer, Trailer Coupling, Tipping Cargo Body, Industrial Cab-over, and Axle and Wheels. Tracks include separate shoes, grousers and rollers, with length, gauge, width, count and phase controls. Tracked Utility Carrier is unarmed.

Excavator and crane poses expose base rotation and boom controls. Excavators include outer-arm and bucket angles. Crane cable remains vertical while its boom elevates. Tipping beds expose bed and tailgate angles. New cabins have door-angle controls. Components can be combined using existing assembly nodes; eleven machinery catalog examples bring the collection to 48 entries, including a truck with a separate crane node. Richer and ruined house recipes remain included.

Machinery meshes carry role and pose-joint descriptions in gameAsset.machinery, with generation-space pivots, axes and an asset offset. These are not an engine rig, constraints, track animation, collision or hydraulic simulation. Consumers must apply subsequent assembly transforms when interpreting generation-space metadata. The generic Hinge node remains separate. Standalone booms and tools require manual placement; automatic socket mounting and inverse kinematics are not implemented. Existing classic-truck doors/hood are not retrofitted with moving joints. House themes, persistent user catalogs and click-to-place preview editing remain pending. New geometry, parameter extremes, catalog size/performance and exports have not yet been built or tested.
