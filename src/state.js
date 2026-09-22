import {courses,courseById,GOAL} from './data/courses.js';
export const STORAGE_KEY='purrs-lab-tracker:v1';
const validCount=n=>Number.isSafeInteger(n)&&n>=0;
const timestamp=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?x:null;
const add=(a,b)=>{if(!Number.isSafeInteger(a+b))throw new Error('걸음수가 너무 큽니다. 테스트 값을 초기화해 주세요.');return a+b};
export function initialState(){return {version:1,lifetimeSteps:0,unclaimedSteps:0,activeCourseId:'jeju',courseProgress:Object.fromEntries(courses.map(c=>[c.id,{accumulatedSteps:0,startedAt:null}])),collectedPostcards:{}}}
export function normalize(raw){
 const next=initialState();if(!raw||raw.version!==1)return next;
 for(const key of ['lifetimeSteps','unclaimedSteps'])if(validCount(raw[key]))next[key]=raw[key];
 if(raw.activeCourseId===null)next.activeCourseId=null;
 if(courseById[raw.activeCourseId]?.enabled)next.activeCourseId=raw.activeCourseId;
 const active=raw.courseProgress?.[next.activeCourseId];if(active){next.courseProgress[next.activeCourseId]={accumulatedSteps:validCount(active.accumulatedSteps)&&active.accumulatedSteps<GOAL?active.accumulatedSteps:0,startedAt:timestamp(active.startedAt)}}
 for(const c of courses)for(const w of c.waypoints){const key=`${c.id}_${w.id}`,date=timestamp(raw.collectedPostcards?.[key]?.unlockedAt);if(date)next.collectedPostcards[key]={unlockedAt:date}}
 return next;
}
// Domain operations are pure; storage writes occur once per user action.
export function transition(state,action,now=new Date().toISOString()){
 const next=structuredClone(state);const active=next.courseProgress[next.activeCourseId];let event=null;
 switch(action.type){
 case 'start': if(!active)throw new Error('먼저 여행을 골라 주세요.');if(!active.startedAt)active.startedAt=now;break;
 case 'add': if(!validCount(action.amount))throw new Error('올바른 걸음수를 입력해 주세요.');next.unclaimedSteps=add(next.unclaimedSteps,action.amount);break;
 case 'claim':{
   if(!active)throw new Error('먼저 여행을 골라 주세요.');
   if(next.unclaimedSteps===0)return {state,event:null};
   const claimed=next.unclaimedSteps,from=active.accumulatedSteps,to=Math.min(GOAL,add(from,claimed));
   next.lifetimeSteps=add(next.lifetimeSteps,claimed);next.unclaimedSteps=0;active.startedAt||=now;
   const crossed=courseById[next.activeCourseId].waypoints.filter(w=>w.steps>from&&w.steps<=to);const unlocked=[];
   for(const w of crossed){const key=`${next.activeCourseId}_${w.id}`;if(!next.collectedPostcards[key]){next.collectedPostcards[key]={unlockedAt:now};unlocked.push(w.id)}}
   event={courseId:next.activeCourseId,from,to,claimed,crossed:crossed.map(w=>w.id),unlocked,latest:crossed.at(-1)?.id||null,completed:to===GOAL,overflow:Math.max(0,from+claimed-GOAL)};
   active.accumulatedSteps=event.completed?0:to;if(event.completed)active.startedAt=null;break;
 }
 case 'switch':{
   if(!courseById[action.courseId]?.enabled)throw new Error('아직 준비 중인 코스예요.');
   if(action.courseId===next.activeCourseId)return {state,event:null};
   if(active){active.accumulatedSteps=0;active.startedAt=null;}next.activeCourseId=action.courseId;next.courseProgress[action.courseId]={accumulatedSteps:0,startedAt:now};break;
 }
 case 'abandon': if(active){active.accumulatedSteps=0;active.startedAt=null;}next.activeCourseId=null;break;
 case 'reset-pending': next.unclaimedSteps=0;break;
 case 'reset-course': if(!active)break;active.accumulatedSteps=0;active.startedAt=null;for(const w of courseById[next.activeCourseId].waypoints)delete next.collectedPostcards[`${next.activeCourseId}_${w.id}`];break;
 case 'reset-lifetime':next.lifetimeSteps=0;break;
 case 'reset-all':return {state:initialState(),event:null};
 default:throw new Error('알 수 없는 동작입니다.');
 }
 return {state:next,event};
}
export function createStore(storage,onStorageError=()=>{}){
 let value=initialState();
 try{const saved=storage?.getItem(STORAGE_KEY);if(saved)value=normalize(JSON.parse(saved))}catch{onStorageError('저장된 데이터를 읽지 못했어요. 이번 세션에서 다시 시작합니다.')}
 const subscribers=new Set();
 return {get:()=>value,subscribe(fn){subscribers.add(fn);return()=>subscribers.delete(fn)},dispatch(action){
   const result=transition(value,action);value=result.state;
   try{if(action.type==='reset-all')storage?.removeItem(STORAGE_KEY);else storage?.setItem(STORAGE_KEY,JSON.stringify(value))}catch{onStorageError('브라우저 저장 공간을 사용할 수 없어 현재 화면에서만 기록됩니다.')}
   subscribers.forEach(fn=>fn(value));return result.event;
 },reload(raw){try{value=raw?normalize(JSON.parse(raw)):initialState();subscribers.forEach(fn=>fn(value))}catch{/* A malformed external update must not erase a valid in-memory session. */}}};
}
