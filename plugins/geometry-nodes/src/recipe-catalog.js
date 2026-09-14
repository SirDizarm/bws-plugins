import * as THREE from 'three';

const entries=[
 {id:54,name:'Burned Stonefoot House',description:'Stone ground floor supporting a scorched timber-and-plaster upper storey, with broken infill and damaged rafters.',ruin:true,params:{ruinConstruction:'stone-timber-plaster',ruinStoneHeight:2.5,ruinWidth:6,ruinDepth:5,ruinHeight:8,ruinDamage:.45,ruinBurn:.85}},
 {id:49,name:'Classic Open Farm Tractor',description:'Old-fashioned open-seat tractor with large rear tyres, chevron treads and a rear hitch.',type:'vehicleTractor',params:{tractorCab:false,tractorLoader:false},theme:{themeShape:'round',themeCondition:'worn',themePaint:'#963f35'}},
 {id:50,name:'Enclosed Field Tractor',description:'Classic enclosed cab, opening door, small front wheels and broad rear mudguards.',type:'vehicleTractor',params:{tractorCab:true,tractorWheelbase:2.6},theme:{themeShape:'square',themeCondition:'worn',themePaint:'#974d3c'}},
 {id:51,name:'Farm Front Loader',description:'Cab tractor with twin lifting arms and a solid-sided loading bucket. Adjust loader elevation and bucket tilt.',type:'vehicleTractor',params:{tractorCab:true,tractorLoader:true,tractorLoaderAngle:25,tractorBucketAngle:0},theme:{themeShape:'classic',themeCondition:'worn',themePaint:'#59764c'}},
 {id:52,name:'Raised Yard Loader',description:'Open-seat tractor with a raised front loader and wide bucket.',type:'vehicleTractor',params:{tractorLoader:true,tractorLoaderAngle:50,tractorBucketWidth:2.2,tractorBucketAngle:15},theme:{themeShape:'round',themeCondition:'clean',themePaint:'#788c55'}},
 {id:53,name:'Weathered Farm Tractor',description:'Rust-tinted classic tractor with an open driving position and exposed engine details.',type:'vehicleTractor',params:{tractorRearRadius:.85,tractorFrontRadius:.4},theme:{themeShape:'classic',themeCondition:'rusty',themeWear:.75,themePaint:'#855344'}},
 {id:1,name:'Old Yard Truck',description:'Rounded workhorse with wooden sides.',type:'vehicleCargoTruck',params:{vehicleBody:'wood'},theme:{themeShape:'round',themeCondition:'worn'}},
 {id:2,name:'Industrial Box Truck',description:'Square bodywork and enclosed cargo.',type:'vehicleCargoTruck',params:{vehicleBody:'box'},theme:{themeShape:'square',themeCondition:'clean'}},
 {id:3,name:'Rusty Flatbed',description:'A weathered yard truck with an open deck.',type:'vehicleCargoTruck',params:{vehicleBody:'flatbed'},theme:{themeShape:'classic',themeCondition:'rusty',themeWear:.7}},
 {id:4,name:'Salvage Truck',description:'Dented panels and missing boards or glazing.',type:'vehicleCargoTruck',params:{vehicleBody:'wood'},theme:{themeShape:'classic',themeCondition:'broken',themeWear:.7}},
 {id:5,name:'Forklift and Load',description:'Adjust fork height to lift the load and cargo area.',type:'vehicleForklift',params:{vehicleForkLift:1.1},theme:{themeShape:'classic',themeCondition:'worn'},load:true},
 {id:6,name:'Timber Workshop',description:'An editable house with floor, windows, door and roof.',house:true},
 {id:7,name:'Farm Supply Truck',description:'Short wheelbase, low wooden sides and faded green paint.',type:'vehicleCargoTruck',params:{vehicleWheelbase:2.8,vehicleBedLength:2.4,vehicleBedSides:.4},theme:{themeShape:'round',themeCondition:'worn',themePaint:'#63765a'}},
 {id:8,name:'Harvest Hauler',description:'Long wooden bed with tall sides and tandem rear axles.',type:'vehicleCargoTruck',params:{vehicleWheelbase:4.6,vehicleBedLength:4.4,vehicleBedSides:1.1,vehicleRearAxles:2},theme:{themeShape:'classic',themeCondition:'worn',themePaint:'#a58a50'}},
 {id:9,name:'Forest Log Carrier',description:'A long timber rack carrying four layers of logs.',type:'vehicleCargoTruck',params:{vehicleBody:'logs',vehicleWheelbase:4.6,vehicleBedLength:4.4,vehicleRearAxles:2,vehicleCargoHeight:2,vehicleLogRows:4},theme:{themeShape:'classic',themeCondition:'worn',themePaint:'#506b60'}},
 {id:10,name:'Heavy Timber Rig',description:'Three rear axles, six log layers and twin exhaust stacks.',type:'vehicleCargoTruck',params:{vehicleBody:'logs',vehicleWheelbase:4.8,vehicleBedLength:4.5,vehicleRearAxles:3,vehicleCargoHeight:2.8,vehicleLogRows:6,vehicleStacks:true},theme:{themeShape:'square',themeCondition:'rusty',themeWear:.35,themePaint:'#6c5343'}},
 {id:11,name:'Village Delivery Van',description:'A compact bonneted box truck, not a modern cab-over.',type:'vehicleCargoTruck',params:{vehicleBody:'box',vehicleWheelbase:2.8,vehicleBedLength:2.3,vehicleCargoHeight:1.5,vehicleWidth:1.9},theme:{themeShape:'round',themeCondition:'clean',themePaint:'#8d533f'}},
 {id:12,name:'Depot Furniture Truck',description:'Tall enclosed cargo body and a long wheelbase.',type:'vehicleCargoTruck',params:{vehicleBody:'box',vehicleWheelbase:4.6,vehicleBedLength:4.4,vehicleCargoHeight:2.8,vehicleRearAxles:2},theme:{themeShape:'square',themeCondition:'worn',themePaint:'#657b82'}},
 {id:13,name:'Postal Yard Truck',description:'A small cream-painted enclosed delivery truck.',type:'vehicleCargoTruck',params:{vehicleBody:'box',vehicleBedLength:2.4,vehicleCargoHeight:1.8,vehicleWidth:2,vehicleSeats:'driver'},theme:{themeShape:'classic',themeCondition:'worn',themePaint:'#b0a37f'}},
 {id:14,name:'Quarry Flatbed',description:'Wide open deck, large tyres and tandem rear axles.',type:'vehicleCargoTruck',params:{vehicleBody:'flatbed',vehicleWheelbase:4.5,vehicleBedLength:4.3,vehicleRearAxles:2,vehicleWheelRadius:.62,vehicleWidth:2.7},theme:{themeShape:'square',themeCondition:'rusty',themePaint:'#8f7950'}},
 {id:15,name:'Surplus Utility Truck',description:'Olive work truck with high wooden sides; no armour or weapons.',type:'vehicleCargoTruck',params:{vehicleWheelRadius:.6,vehicleBedSides:.9,vehicleRearAxles:2,vehicleWheelbase:4.4,vehicleBedLength:4.1,vehicleSeats:'bench'},theme:{themeShape:'square',themeCondition:'worn',themePaint:'#62694a'}},
 {id:16,name:'Restored Red Workhorse',description:'Clean rounded bodywork and a low wooden cargo bed.',type:'vehicleCargoTruck',params:{vehicleBody:'wood',vehicleBedSides:.45,vehicleWood:'#936d45'},theme:{themeShape:'round',themeCondition:'clean',themePaint:'#8e3930'}},
 {id:17,name:'Abandoned Delivery Truck',description:'Rusty dented panels and missing glazing on an enclosed truck.',type:'vehicleCargoTruck',params:{vehicleBody:'box',vehicleCargoHeight:2.1,vehicleShowGlass:false},theme:{themeShape:'classic',themeCondition:'broken',themeWear:.9,themePaint:'#667e82'}},
 {id:18,name:'Engine Inspection Truck',description:'Hood panels removed to expose the existing engine geometry.',type:'vehicleCargoTruck',params:{vehicleBody:'flatbed',vehicleShowHood:false,vehicleStacks:true},theme:{themeShape:'classic',themeCondition:'worn',themePaint:'#778477'}},
 {id:19,name:'Retro Future Courier',description:'Optional angular hood treatment on the classic truck chassis.',type:'vehicleCargoTruck',params:{vehicleBody:'box',vehicleCargoHeight:1.4,vehicleWidth:2.1},theme:{themeShape:'futuristic',themeCondition:'clean',themePaint:'#78998b'}},
 {id:20,name:'Warehouse Forklift',description:'Clean compact forklift with its forks near ground level.',type:'vehicleForklift',params:{vehicleForkLift:.12,vehicleForkSpread:.55,vehicleForkLength:1},theme:{themeShape:'square',themeCondition:'clean',themePaint:'#a78a40'}},
 {id:21,name:'Long Fork Yard Loader',description:'Two-metre forks, wider spacing and worn industrial paint.',type:'vehicleForklift',params:{vehicleForkLift:.25,vehicleForkSpread:1,vehicleForkLength:2},theme:{themeShape:'classic',themeCondition:'worn',themePaint:'#a46338'}},
 {id:22,name:'High Lift Demonstrator',description:'A box payload and cargo area follow the raised forks.',type:'vehicleForklift',params:{vehicleForkLift:2,vehicleForkSpread:.8,vehicleForkLength:1.6},theme:{themeShape:'round',themeCondition:'clean',themePaint:'#648778'},load:true},
 {id:23,name:'Salvage Yard Forklift',description:'A worn loader with rust-tinted panels and low forks.',type:'vehicleForklift',params:{vehicleForkLift:.3,vehicleForkLength:1.5},theme:{themeShape:'classic',themeCondition:'rusty',themeWear:.8,themePaint:'#885a48'}},
 {id:24,name:'Wide Load Forklift',description:'Wide-spaced long forks carrying an editable broad box.',type:'vehicleForklift',params:{vehicleForkLift:.65,vehicleForkSpread:1.1,vehicleForkLength:2},theme:{themeShape:'square',themeCondition:'worn',themePaint:'#778267'},load:true,payload:{primitiveSizeX:1.2,primitiveSizeY:.55,primitiveSizeZ:1.1}},
 {id:25,name:'Village Storehouse',description:'A broad single-storey timber building with small windows.',house:true,houseParams:{buildingWidth:8,buildingDepth:7,buildingStoreys:1,buildingBays:4},windowParams:{windowWidth:.7,windowHeight:.8},roofParams:{roofRise:1.5,roofStyle:'shingles'}},
 {id:26,name:'Tall Guild House',description:'Three storeys of timber framing beneath a steep clay roof.',house:true,houseParams:{buildingWidth:6,buildingDepth:6,buildingStoreys:3,buildingStoreyHeight:2.7},windowParams:{windowLevel:2,windowCount:2},roofParams:{roofRise:2.8,roofStyle:'clay'}},
 {id:27,name:'Roadside Workshop',description:'Low, elongated workshop with a broad open doorway.',house:true,houseParams:{buildingWidth:9,buildingDepth:4,buildingStoreys:1,buildingBays:5},doorParams:{doorWidth:2.5,doorHeight:2.5,doorStyle:'open'},roofParams:{roofRise:1.2,roofStyle:'slate'}},
 {id:28,name:'Small Timber Cottage',description:'Compact one-storey cottage with shuttered windows.',house:true,houseParams:{buildingWidth:4,buildingDepth:3.5,buildingStoreys:1,buildingBays:2},windowParams:{windowWidth:.7,windowHeight:1,windowStyle:'shutters'},roofParams:{roofRise:1.4,roofStyle:'shingles'}},
 {id:29,name:'Market Hall Shell',description:'Wide two-storey shell for later interior and decoration work.',house:true,houseParams:{buildingWidth:10,buildingDepth:8,buildingStoreys:2,buildingBays:5},windowParams:{windowLevel:2,windowCount:3},doorParams:{doorWidth:2,doorStyle:'open'},roofParams:{roofRise:2.2,roofStyle:'clay'}},
 {id:30,name:'Stonefoot Merchant House',description:'Stone ground floor, cross-braced timber, leaded windows and a door canopy.',house:true,stone:true,houseParams:{buildingWidth:6,buildingDepth:5,buildingStoreys:2},windowParams:{windowCount:2,windowWidth:.85},roofParams:{roofStyle:'scalloped',roofRise:2.2}},
 {id:31,name:'Grey Stone Cottage',description:'Single-storey stone walls, shuttered windows and a slate roof.',house:true,stone:true,houseParams:{buildingWidth:5,buildingDepth:4,buildingStoreys:1},windowParams:{windowStyle:'shutters',windowWidth:.8},stoneParams:{medievalStoneColor:'#858b86',medievalStoneCourses:12},roofParams:{roofStyle:'slate',roofRise:1.8}},
 {id:32,name:'Old Mason Workshop',description:'Broad stone workshop with an open entrance, masonry chimney and timber gable.',house:true,stone:true,houseParams:{buildingWidth:8,buildingDepth:5,buildingStoreys:1,buildingBays:4},doorParams:{doorWidth:2.4,doorHeight:2.5,doorStyle:'open'},stoneParams:{medievalStoneColor:'#a3977c'},roofParams:{roofStyle:'shingles',roofRise:2}},
 {id:33,name:'Stone and Timber Inn',description:'Two-storey inn with stone below, decorative wall bracing and windows on both floors.',house:true,stone:true,houseParams:{buildingWidth:8,buildingDepth:7,buildingStoreys:2,buildingBays:4},windowParams:{windowCount:2,windowStyle:'shutters'},stoneParams:{medievalStoneColor:'#998c78'},roofParams:{roofStyle:'scalloped',roofRise:2.6}},
 {id:34,name:'Fire-Damaged Cottage',description:'Scorched timber framing, broken plaster panels and surviving roof patches. No active fire.',ruin:true,params:{ruinConstruction:'timber-plaster',ruinWidth:5,ruinDepth:4,ruinHeight:4.5,ruinDamage:.35,ruinBurn:.8}},
 {id:35,name:'Burned-Out Workshop',description:'Blackened timber posts, broken bracing and a skeletal roof without stone walls.',ruin:true,params:{ruinConstruction:'timber',ruinWidth:8,ruinDepth:6,ruinHeight:5.5,ruinDamage:.7,ruinBurn:1}},
 {id:36,name:'Collapsed Stone Homestead',description:'Low surviving wall sections, broken roof timbers and scattered rubble.',ruin:true,params:{ruinWidth:7,ruinDepth:8,ruinHeight:6,ruinDamage:.95,ruinBurn:.65}},
 {id:37,name:'Charred Hall Ruin',description:'A large timber-and-plaster hall with torn wall infill and a damaged roof frame.',ruin:true,params:{ruinConstruction:'timber-plaster',ruinWidth:10,ruinDepth:12,ruinHeight:8,ruinDamage:.8,ruinBurn:.95}},
 {id:38,name:'Quarry Excavator',description:'Tracks, rotating upper body, articulated arm and open toothed bucket. Adjustable static pose.',type:'vehicleExcavator',params:{machineBoomAngle:45,machineStickAngle:-75,machineToolAngle:25},theme:{themeShape:'classic',themeCondition:'worn',themePaint:'#a48c48'}},
 {id:39,name:'Compact Yard Excavator',description:'Shorter tracks and arms for a compact industrial excavator.',type:'vehicleExcavator',params:{machineTrackLength:3,machineTrackGauge:1.8,machineTrackRadius:.4,machineBoomLength:2,machineStickLength:1.2,machineBucketWidth:.6,machineBoomAngle:55,machineStickAngle:-100},theme:{themeShape:'round',themeCondition:'clean',themePaint:'#658779'}},
 {id:40,name:'Salvage Excavator',description:'Rust-tinted machinery with a turned upper body and extended working arm.',type:'vehicleExcavator',params:{machineYaw:35,machineBoomAngle:25,machineStickAngle:-55,machineToolAngle:45},theme:{themeShape:'classic',themeCondition:'rusty',themeWear:.7,themePaint:'#7f7052'}},
 {id:41,name:'Tracked Utility Carrier',description:'Unarmed tank-style tracked base with a cabin and rear utility platform.',type:'vehicleTrackedCarrier',params:{machineTrackLength:4.5,machineTrackWidth:.75,machineTrackGauge:2.3},theme:{themeShape:'square',themeCondition:'worn',themePaint:'#616e51'}},
 {id:42,name:'Caterpillar Undercarriage',description:'Reusable track pair with rollers, shoes and grousers for custom machinery.',type:'vehicleTracks',params:{machineTrackLength:4,machineTrackShoes:48},theme:{themeShape:'square',themeCondition:'clean'}},
 {id:43,name:'Yard Crane',description:'Rotating pedestal, extending boom, hanging hook and adjustable stabilizers.',type:'vehicleCrane',params:{machineBoomAngle:35,machineExtension:1.2,machineCable:1.8},theme:{themeShape:'classic',themeCondition:'worn',themePaint:'#a38743'}},
 {id:44,name:'Truck-Mounted Crane',description:'Classic flatbed and independent crane nodes sharing one theme. Geometry assembly, not a simulated lifting vehicle.',type:'vehicleCargoTruck',params:{vehicleBody:'flatbed',vehicleBedLength:4.4,vehicleWheelbase:4.6,vehicleRearAxles:2},theme:{themeShape:'classic',themeCondition:'worn',themePaint:'#74888a'},extras:[{type:'vehicleCrane',params:{assetOffsetX:.1,assetOffsetY:.15,machineYaw:180,machineBoomAngle:20,machineBoomLength:2.5,machineExtension:.5,machineCable:.6,machineOutriggerSpan:3.5}}]},
 {id:45,name:'Raised Tipping Body',description:'Separate tipping bed with a following lift ram and adjustable rear gate. Add your own chassis.',type:'vehicleTipper',params:{machineTipAngle:35,machineTailgateAngle:35},theme:{themeShape:'square',themeCondition:'worn',themePaint:'#826b52'}},
 {id:46,name:'Industrial Sideboard Trailer',description:'Three rear axles, cargo deck, sideboards, landing legs and a coupling.',type:'vehicleTrailer',params:{machineTrailerLength:8,machineTrailerAxles:3,machineTrailerSides:.7},theme:{themeShape:'square',themeCondition:'worn',themePaint:'#7d8a80'}},
 {id:47,name:'Open Cargo Trailer',description:'Long flat trailer deck without sideboards for custom cargo placement.',type:'vehicleTrailer',params:{machineTrailerLength:9,machineTrailerAxles:3,machineTrailerSides:0},theme:{themeShape:'classic',themeCondition:'rusty',themeWear:.3,themePaint:'#708273'}},
 {id:48,name:'Industrial Cab-over',description:'Standalone flat-front industrial cab with opening doors; ready to combine with chassis parts.',type:'vehicleCabOver',params:{machineDoorAngle:25},theme:{themeShape:'square',themeCondition:'worn',themePaint:'#8c7960'}},
 {id:65,name:'Container Semi - Closed Cargo',description:'Modern cab-over tractor and triple-axle trailer carrying a corrugated container with closed rear doors.',type:'vehicleContainerTruck',params:{machineTrailerLength:9,machineTrailerWidth:2.5,machineTrailerAxles:3,machineContainerHeight:2.6,machineContainerDoorAngle:0,machineCabWidth:2.3,machineCabHeight:2.7},theme:{themeShape:'square',themeCondition:'clean',themePaint:'#54778a'}},
 {id:66,name:'Container Semi - Open Rear',description:'Modern cab-over container semi with a triple-axle trailer and rear container doors hinged open to 110 degrees.',type:'vehicleContainerTruck',params:{machineTrailerLength:9,machineTrailerWidth:2.5,machineTrailerAxles:3,machineContainerHeight:2.6,machineContainerDoorAngle:110,machineCabWidth:2.3,machineCabHeight:2.7},theme:{themeShape:'square',themeCondition:'clean',themePaint:'#54778a'}},
 {id:67,name:'Knuckleboom Cargo Truck',description:'Cargo truck with a folding knuckleboom behind the cab, hanging hook and deployed outriggers. Editable static crane pose.',type:'vehicleKnuckleTruck',params:{machineYaw:0,machineBoomLength:3,machineBoomAngle:45,machineStickLength:2,machineKnuckleAngle:-145,machineCable:1,machineOutriggerSpan:4.5},theme:{themeShape:'square',themeCondition:'clean',themePaint:'#a86538'}},
 {id:68,name:'Folding Pedestal Crane',description:'Standalone pedestal crane with a folding outer arm, hanging hook and adjustable stabilizer span.',type:'vehiclePedestalCrane',params:{machineYaw:0,machineBoomLength:3,machineBoomAngle:45,machineStickLength:2,machineKnuckleAngle:-145,machineCable:1,machineOutriggerSpan:4.5},theme:{themeShape:'square',themeCondition:'clean',themePaint:'#b39746'}},
 {id:69,name:'Mobile Telescopic Crane',description:'Wheeled mobile crane with an elevated extending boom, hanging hook and deployed outriggers.',type:'vehicleMobileCrane',params:{machineYaw:0,machineBoomLength:5,machineBoomAngle:45,machineExtension:2,machineCable:1.4,machineOutriggerSpan:5},theme:{themeShape:'square',themeCondition:'clean',themePaint:'#b59a45'}},
 {id:70,name:'Crawler Telescopic Crane',description:'Tracked crane with a raised telescopic boom and hanging hook on a broad crawler undercarriage.',type:'vehicleCrawlerCrane',params:{machineYaw:0,machineBoomLength:5,machineBoomAngle:45,machineExtension:2,machineCable:1.4,machineTrackLength:5,machineTrackGauge:2.5},theme:{themeShape:'square',themeCondition:'clean',themePaint:'#9c6545'}},
 {id:71,name:'Container Reach Stacker',description:'Wheeled container handler with an elevated telescopic boom and six-metre spreader. Adjust extension, elevation and spreader yaw.',type:'vehicleReachStacker',params:{machineYaw:0,machineBoomLength:5,machineBoomAngle:45,machineExtension:2,machineCable:1.4,machineSpreaderLength:6,machineToolAngle:0},theme:{themeShape:'square',themeCondition:'clean',themePaint:'#a46e38'}},
 {id:72,name:'Lattice Tower Crane',description:'Twelve-metre lattice tower with a horizontal jib, counterjib, counterweight, movable trolley and hanging cable.',type:'vehicleTowerCrane',params:{machineTowerHeight:12,machineJibLength:12,machineTrolleyPosition:.65,machineCable:4,machineYaw:0},theme:{themeShape:'square',themeCondition:'clean',themePaint:'#b69a48'}}
];

// Nature presets use registered mesh generators, not renamed vehicle recipes.
entries.push(
 {id:73,name:'Broad Oak',nature:'trees',type:'detailedTree',description:'Wide mature oak with a thick branching trunk and a full, spreading crown.',params:{treeSpecies:'oak',treeHeight:6.5,treeCrownWidth:6,treeFullness:1.5,treeBarkColor:'#66503b',treeLeafColor:'#496b35'}},
 {id:74,name:'Tiered Pine',nature:'trees',type:'detailedTree',description:'Tall evergreen with seven tapered foliage tiers and a narrow conical silhouette.',params:{treeSpecies:'pine',treeHeight:8,treeCrownWidth:3.6,treeFullness:1,treeBarkColor:'#725840',treeLeafColor:'#405f39'}},
 {id:75,name:'Silver Birch',nature:'trees',type:'detailedTree',description:'Slender pale trunk with dark bark scars and an upright, airy broadleaf crown.',params:{treeSpecies:'birch',treeHeight:7,treeCrownWidth:3.1,treeFullness:.7,treeLeafColor:'#718a46'}},
 {id:76,name:'Bare Dead Tree',nature:'trees',type:'detailedTree',description:'Leafless branching skeleton with exposed forks and fine terminal twigs.',params:{treeSpecies:'deadTree',treeHeight:5.8,treeCrownWidth:4.4,treeBarkColor:'#766b5c'}},
 {id:77,name:'Orchard-Style Broadleaf',nature:'trees',type:'detailedTree',description:'Low, broad oak-derived crown for orchard layouts. A shape preset, without fruit or species-specific pruning.',params:{treeSpecies:'oak',treeHeight:2.8,treeCrownWidth:3.5,treeFullness:1.2,treeBarkColor:'#715640',treeLeafColor:'#638044'}},
 {id:78,name:'Young Broadleaf Sapling',nature:'trees',type:'detailedTree',description:'Small oak-derived tree with a thin trunk, narrow crown and sparse foliage clusters.',params:{treeSpecies:'oak',treeHeight:1.6,treeCrownWidth:.85,treeFullness:.4,treeBarkColor:'#807052',treeLeafColor:'#71924b'}},
 {id:79,name:'Rounded Boulder',nature:'rocks',type:'detailedRock',description:'Broad, low-weathering closed boulder with softly varying faceted surfaces.',params:{stoneStyle:'boulder',stoneSize:1.6,stoneWeathering:.15,stoneColor:'#85867e'}},
 {id:80,name:'Angular Granite-Style Rock',nature:'rocks',type:'detailedRock',description:'Compact, irregular crag with pronounced angular faces and cool grey stone tones.',params:{stoneStyle:'crag',stoneSize:1.3,stoneWeathering:1,stoneColor:'#777e84'}},
 {id:81,name:'Flat Slate Slab',nature:'rocks',type:'detailedRock',description:'Thin, broad slate-style hull with a low profile. No simulated moss coating.',params:{stoneStyle:'slate',stoneSize:2.1,stoneWeathering:.55,stoneColor:'#626f70'}},
 {id:82,name:'Tall Crag Outcrop',nature:'rocks',type:'detailedRock',description:'Large upright weathered outcrop, substantially taller than the boulder and slab presets.',params:{stoneStyle:'crag',stoneSize:3.6,stoneWeathering:.75,stoneColor:'#837c6c'}},
 {id:83,name:'Scattered Fieldstones',nature:'rocks',type:'detailedRock',description:'Six individually editable flattened stones with different sizes, weathering and spaced positions.',params:{stoneStyle:'fieldstone',stoneSize:.8,stoneWeathering:.65,stoneColor:'#7b8270'},extras:[
  {type:'detailedRock',params:{stoneStyle:'fieldstone',stoneSize:.55,stoneWeathering:.8,stoneColor:'#828675',assetOffsetX:1.8,assetOffsetZ:.3}},
  {type:'detailedRock',params:{stoneStyle:'fieldstone',stoneSize:1.1,stoneWeathering:.45,stoneColor:'#707b6b',assetOffsetX:-2.2,assetOffsetZ:.6}},
  {type:'detailedRock',params:{stoneStyle:'fieldstone',stoneSize:.65,stoneWeathering:.95,stoneColor:'#8d8c7c',assetOffsetX:.4,assetOffsetZ:2}},
  {type:'detailedRock',params:{stoneStyle:'fieldstone',stoneSize:.45,stoneWeathering:.6,stoneColor:'#697667',assetOffsetX:1.8,assetOffsetZ:-1.5}},
  {type:'detailedRock',params:{stoneStyle:'fieldstone',stoneSize:.9,stoneWeathering:.7,stoneColor:'#78806f',assetOffsetX:-1.5,assetOffsetZ:-1.8}}
 ]}
);

export function mountRecipeCatalog({host,createGraph,buildPreview,loadRecipe}){
 // Explicit source/id pairs keep published recipe numbers stable forever.
 const burnedHouses=[[6,55],[25,56],[26,57],[27,58],[28,59],[29,60],[30,61],[31,62],[32,63],[33,64]].map(([sourceId,id])=>{
  const source=entries.find(entry=>entry.id===sourceId);
  return {...source,id,name:'Burned '+source.name,description:'Fire-damaged variant of #'+sourceId+'. Retains the original house layout and surviving architectural details.',fire:{fireDamage:.35+(id%3)*.12,fireScorch:.85,fireSeed:id}};
 });
 // Retire broken vehicle presets without renumbering recipes or invalidating saved graphs.
 const catalogEntries=[...entries,...burnedHouses].filter(entry=>!(entry.type?.startsWith('vehicle')&&(entry.theme?.themeCondition==='broken'||entry.params?.vehicleCondition==='broken'))).sort((a,b)=>a.id-b.id);
 const style=document.createElement('style');
 style.textContent=`.gn-catalog{margin:16px 0;border:1px solid #476358;border-radius:8px;background:linear-gradient(130deg,#1c302d,#142125);padding:14px}.gn-catalog summary{cursor:pointer;font-size:18px;color:#a8d4bd}.gn-catalog-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));gap:14px;margin-top:14px}.gn-catalog article{background:#101e20;border:1px solid #385149;border-radius:7px;overflow:hidden}.gn-catalog img{display:block;width:100%;aspect-ratio:360/240;object-fit:contain;background:#142125}.gn-catalog h3,.gn-catalog p{margin:12px}.gn-catalog article button{margin:0 12px 14px}.gn-catalog p{line-height:1.5}.gn-catalog-status{color:#adc3b8}`;
 document.head.append(style);
 const panel=document.createElement('details');panel.className='gn-catalog';
 const title=document.createElement('summary');title.textContent='Recipe Catalog / Vehicles, Buildings and Nature';panel.append(title);
 const intro=document.createElement('p');intro.textContent='Green previews show the real generated shapes. Recipe numbers are permanent: quote the number when reporting an issue. Use a recipe to add editable nodes without replacing existing recipes or workspace models. GN 0.8.1 or newer. Save Geometry Nodes to keep your changes.';panel.append(intro);
 const status=document.createElement('p');status.className='gn-catalog-status';status.setAttribute('role','status');panel.append(status);
 const grid=document.createElement('div');grid.className='gn-catalog-grid';panel.append(grid);host.before(panel);
 const navigation=document.createElement('div');navigation.setAttribute('role','group');navigation.setAttribute('aria-label','Recipe categories');navigation.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin-top:12px';panel.insertBefore(navigation,grid);
 const hiddenStyle=document.createElement('style');hiddenStyle.textContent='.gn-catalog article[hidden]{display:none}.gn-catalog [aria-pressed="true"]{background:#347763;color:#fff;border-color:#8dc6ad}';document.head.append(hiddenStyle);
 let category='all';const categoryButtons=[];
 for(const [value,label] of [['all','All recipes'],['vehicles','Vehicles'],['buildings','Buildings'],['trees','Trees'],['rocks','Rocks']]){
  const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-pressed',String(value===category));
  button.addEventListener('click',()=>{category=value;for(const [key,b] of categoryButtons)b.setAttribute('aria-pressed',String(key===value));for(const card of grid.children)card.hidden=value!=='all'&&card.dataset.category!==value;});
  categoryButtons.push([value,button]);navigation.append(button);
 }
 let rendered=false,renderer;
 const recipes=catalogEntries.map(entry=>{
  const recipeName='#'+entry.id+' '+entry.name;
  const graph=createGraph(recipeName);
  if(entry.nature)graph.seed=entry.id*7919;
  const storeys=entry.houseParams?.buildingStoreys||1;
  const windows=Array.from({length:storeys},(_,i)=>i?'window::'+(i+1):'window');
  graph.nodeOrder=entry.nature?['seed',entry.type,'output']:entry.house?['seed','houseLayout','floor',...windows,'door','diagonalBracing','foundation','facadeDetails',...(entry.stone?['medievalStyle']:[]),'roof','chimney','output']:entry.ruin?['seed','ruinedHouse','output']:['seed','vehicleTheme',entry.type,...(entry.load?['forkCargoVolume','primitive','placePart']:[]),'output'];
  graph.connections=[];graph.nodeParams={};graph.nodePositions={};graph.smoothNodes=[];graph.generatedIds=[];graph.centerOutput=false;
  const link=(from,to,index=0)=>graph.connections.push({id:crypto.randomUUID(),fromNodeId:from,toNodeId:to,toInputIndex:index});
  const extras=(entry.extras||[]).map((extra,i)=>({...extra,id:extra.type+'::'+(i+2)}));
  if(entry.fire)graph.nodeOrder.splice(graph.nodeOrder.length-1,0,'buildingFireDamage');
  graph.nodeOrder.splice(graph.nodeOrder.length-1,0,...extras.map(extra=>extra.id));
  if(entry.house){
   graph.nodeOrder.slice(0,-1).forEach((id,i)=>link(id,graph.nodeOrder[i+1]));
   graph.nodeParams.houseLayout={...graph.params,buildingStoreys:1,...entry.houseParams};
   windows.forEach((id,i)=>graph.nodeParams[id]={...graph.params,...entry.windowParams,windowLevel:i+1});
   graph.nodeParams.door={...graph.params,...entry.doorParams};
   graph.nodeParams.roof={...graph.params,...entry.roofParams};
   graph.nodeParams.diagonalBracing={...graph.params,braceStyle:'alternating',braceWidth:.12};
   graph.nodeParams.foundation={...graph.params,foundationHeight:.45,foundationCourses:3,foundationCorners:true};
   graph.nodeParams.facadeDetails={...graph.params,facadeBelts:true,facadeSills:true,facadeCanopy:true};
   graph.nodeParams.chimney={...graph.params,chimneyHeight:1.1};
   if(entry.fire)graph.nodeParams.buildingFireDamage={...graph.params,...entry.fire};
   if(entry.stone)graph.nodeParams.medievalStyle={...graph.params,medievalStoneGround:true,medievalGableTimber:true,medievalLeadedGlass:true,medievalStoneCourses:10,...entry.stoneParams};
  }
  else if(entry.ruin){graph.nodeParams.ruinedHouse={...graph.params,...entry.params};link('seed','ruinedHouse');link('ruinedHouse','output');}
  else if(entry.nature){
   graph.nodeParams[entry.type]={...graph.params,...entry.params};link('seed',entry.type);link(entry.type,'output');
   extras.forEach((extra,i)=>{graph.nodeParams[extra.id]={...graph.params,...extra.params};link('seed',extra.id);link(extra.id,'output',i+1);});
  }
  else{
   graph.nodeParams[entry.type]={...graph.params,...entry.params};graph.nodeParams.vehicleTheme={...graph.params,...entry.theme};
   link('seed',entry.type);link('vehicleTheme',entry.type,2);
   if(entry.load){
    graph.nodeParams.primitive={...graph.params,primitiveShape:'box',primitiveSizeX:.5,primitiveSizeY:.5,primitiveSizeZ:.5,primitiveColor:'#8b6b46',...entry.payload};
    // Span both complete tine surfaces; the forks anchor seats the box bottom on their top.
    graph.nodeParams.primitive.primitiveSizeZ=Math.max(graph.nodeParams.primitive.primitiveSizeZ,(graph.nodeParams[entry.type].vehicleForkSpread??.65)+.12);
    graph.nodeParams.placePart={...graph.params,placeAnchor:'forks'};
    graph.nodeParams.forkCargoVolume={...graph.params,volumeDebug:false,itemWidth:Math.max(graph.params.itemWidth||1,graph.nodeParams.primitive.primitiveSizeX),itemDepth:Math.max(graph.params.itemDepth||1,graph.nodeParams.primitive.primitiveSizeZ)};
    link(entry.type,'forkCargoVolume');link('forkCargoVolume','placePart');link('primitive','placePart',1);link('placePart','output');
   }else link(entry.type,'output');
   extras.forEach((extra,i)=>{
    graph.nodeParams[extra.id]={...graph.params,...extra.params};
    link('seed',extra.id);link('vehicleTheme',extra.id,2);link(extra.id,'output',i+1);
   });
  }
  graph.nodeOrder.forEach((id,i)=>graph.nodePositions[id]=[40+i*230,id==='vehicleTheme'?360:40]);
  const card=document.createElement('article'),img=document.createElement('img');img.alt=recipeName+' generated mesh preview';
  card.dataset.category=entry.nature||(entry.house||entry.ruin?'buildings':'vehicles');
  const h=document.createElement('h3');h.textContent=recipeName;
  const p=document.createElement('p');p.textContent=entry.description;
  const button=document.createElement('button');button.type='button';button.textContent='Use these Geometry Nodes';
  button.addEventListener('click',()=>{try{loadRecipe(structuredClone(graph));status.textContent='Added '+recipeName+'. Existing recipes and workspace models were kept.';}catch(error){status.textContent=error.message;}});
  card.append(img,h,p,button);grid.append(card);return {graph,img};
 });
 panel.addEventListener('toggle',async()=>{
  if(!panel.open||rendered)return;rendered=true;
  try{
   renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(360,240);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
   for(const {graph,img} of recipes){
    status.textContent='Rendering '+graph.name+'...';await new Promise(resolve=>requestAnimationFrame(resolve));
    let meshes=[];
    try{
     meshes=buildPreview(structuredClone(graph));const scene=new THREE.Scene();scene.background=new THREE.Color('#142125');
     scene.add(new THREE.HemisphereLight('#e4f2df','#33423b',2.5));const light=new THREE.DirectionalLight('#ffffff',3);light.position.set(-4,8,5);scene.add(light);
     const bounds=new THREE.Box3();
     for(const mesh of meshes){mesh.material.color.set('#74888a');mesh.material.roughness=.78;scene.add(mesh);mesh.updateMatrixWorld(true);bounds.expandByObject(mesh);}
     if(bounds.isEmpty())throw Error('No geometry for thumbnail');
     const center=bounds.getCenter(new THREE.Vector3()),radius=Math.max(.1,bounds.getSize(new THREE.Vector3()).length()/2);
     const camera=new THREE.PerspectiveCamera(35,1.5,.01,10000);camera.position.copy(center).addScaledVector(new THREE.Vector3(-1,.65,1).normalize(),radius/Math.sin(THREE.MathUtils.degToRad(17.5))*1.12);camera.lookAt(center);
     renderer.render(scene,camera);img.src=renderer.domElement.toDataURL('image/png');
    }catch(error){img.alt=graph.name+': preview unavailable';}
    finally{for(const mesh of meshes){mesh.geometry.dispose();for(const material of(Array.isArray(mesh.material)?mesh.material:[mesh.material]))material.dispose();}}
   }
   status.textContent='Choose a recipe. Preview colour is intentionally muted green; actual recipes retain their materials.';
  }catch(error){status.textContent='Preview rendering unavailable: '+error.message+'. Recipes can still be loaded.';}
  finally{renderer?.dispose();renderer?.forceContextLoss();}
 });
}
