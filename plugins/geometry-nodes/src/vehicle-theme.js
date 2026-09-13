export const VEHICLE_THEME_FIELDS={
 themeShape:['Shape style','classic',['classic','round','square','futuristic']],
 themeCondition:['Condition','clean',['clean','worn','rusty','broken']],
 themeWear:['Wear amount',.45,0,1,.05]
};
export const VEHICLE_THEME_NODE={title:'Vehicle Theme',category:'Inputs',attachment:true,inputSockets:[],fields:{
 ...VEHICLE_THEME_FIELDS,themePaint:['Shared paint','#74888a']
}};

// A theme is opt-in through a dedicated socket, never a global mutable setting.
export function resolveVehicleTheme(graph,id,typeOf,local,sanitize){
 if(local.vehicleThemeOverride)return local;
 const links=graph.connections.filter(c=>c.toNodeId===id&&c.toInputIndex===2);
 if(!links.length)return local;
 if(links.length!==1||typeOf(links[0].fromNodeId)!=='vehicleTheme')throw Error('Connect one Vehicle Theme to the Theme socket.');
 const theme=sanitize(graph.nodeParams?.[links[0].fromNodeId]||graph.params);
 return {...local,themeShape:theme.themeShape,themeCondition:theme.themeCondition,themeWear:theme.themeWear,vehiclePaint:theme.themePaint};
}
