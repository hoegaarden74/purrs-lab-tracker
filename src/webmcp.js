export function readJourney(getState,input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('This read-only tool accepts an empty object.');
 const s=getState();return {activeCourseId:s.activeCourseId,courseSteps:s.courseProgress[s.activeCourseId]?.accumulatedSteps??0,unclaimedSteps:s.unclaimedSteps,lifetimeSteps:s.lifetimeSteps,collectedPostcards:Object.keys(s.collectedPostcards).length};
}
export function registerJourneyReader(getState){
 const context=document.modelContext;if(!context?.registerTool)return;
 const lifecycle=new AbortController();
 try{Promise.resolve(context.registerTool({name:'read_purrs_journey_status',title:'현재 여행 기록 확인',description:'Read the active course, pending steps, lifetime steps and postcard count. Does not change any data.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:input=>readJourney(getState,input)},{signal:lifecycle.signal})).catch(()=>{})}catch{/* Optional browser capability. */}
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
