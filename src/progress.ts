export interface Upgrades { cha:number; jhalmuri:number; chaap:number }
export interface Progress {
 version:3; stars:number[];best:number[];muted:boolean;quality:'auto'|'low'|'high';reduced:boolean;controls?:'swipe'|'buttons';
 taka:number;owned:string[];equipped:Record<string,string>;upgrades:Upgrades;
}
const number=(v:unknown,max=Number.MAX_SAFE_INTEGER)=>typeof v==='number'&&Number.isFinite(v)?Math.min(max,Math.max(0,Math.floor(v))):0;
const parse=(raw:string|null):Record<string,unknown>=>{try{const v=JSON.parse(raw||'null');return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}catch{return{};}};
const ids=(v:unknown)=>Array.isArray(v)?[...new Set(v.filter((x):x is string=>typeof x==='string'&&x.length>0&&x.length<=40))].slice(0,200):[];
const slots=(v:unknown)=>{const out:Record<string,string>={};if(v&&typeof v==='object'&&!Array.isArray(v))for(const [k,x] of Object.entries(v).slice(0,50))if(typeof x==='string'&&k.length<=40&&x.length<=40)out[k]=x;return out;};
export function loadProgress(raw:string|null,legacy:string|null,reducedDefault=false):Progress {
 const modern=parse(raw),old=parse(legacy),hasModern=Array.isArray(modern.stars),source=hasModern?modern:old;
 const stars=Array.from({length:15},(_,i)=>hasModern?number((modern.stars as unknown[])[i],3):i<number(old.unlocked,4)*3?1:0);
 const best=Array.from({length:15},(_,i)=>hasModern?number((Array.isArray(modern.best)?modern.best:[])[i]):i%3===2?number((Array.isArray(old.best)?old.best:[])[Math.floor(i/3)]):0);
 const up=(source.upgrades&&typeof source.upgrades==='object'?source.upgrades:{}) as Record<string,unknown>;
 return {version:3,stars,best,muted:source.muted===true,quality:source.quality==='low'||source.quality==='high'?source.quality:'auto',reduced:typeof source.reduced==='boolean'?source.reduced:reducedDefault,controls:source.controls==='swipe'||source.controls==='buttons'?source.controls:undefined,
  taka:number(source.taka),owned:ids(source.owned),equipped:slots(source.equipped),upgrades:{cha:number(up.cha,4),jhalmuri:number(up.jhalmuri,4),chaap:number(up.chaap,4)}};
}
export function availableStage(progress:Progress):number {const next=progress.stars.findIndex(n=>n===0);return next<0?14:next;}
export function completeStage(progress:Progress,index:number,score:number,stars:number):void {
 if(!Number.isInteger(index)||index<0||index>=15||index>availableStage(progress)||!Number.isFinite(stars)||stars<1)return;
 progress.stars[index]=Math.max(progress.stars[index],number(stars,3));progress.best[index]=Math.max(progress.best[index],number(score));
}
