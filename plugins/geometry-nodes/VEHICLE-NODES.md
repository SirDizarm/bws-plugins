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
