import './style.css';
import { Simulation, VEHICLES } from './simulation';
import { World } from './world';
import { GameAudio } from './audio';
import { SPEED_CAP, STAGES, type Neighborhood } from './campaign';
import { loadProgress, completeStage, availableStage } from './progress';
import { STOMACH_SECONDS } from './pickups';
import { bankRide, buyLook, buyUpgrade, describePurchases, equippedHorn, LOOKS, powerUpStats, ridePayout, toggleLook, vehicleLook } from './economy';
import { isRepeatTap, renderShop, type ShopTab, type Tap } from './shop';
import { sendFeedback, type FeedbackKind } from './feedback';
import { freshSeed } from './seed';
import { SwipeRecognizer } from './controls';
import { heartsLabel, raceBar, shavesChip } from './hud';
import { districtCall, passCue } from './soundscape';
import { SOUNDS, type SoundId } from './soundbank';
import { VOICE_LINES } from './voices';

const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const crown='<svg viewBox="0 0 32 28" fill="none"><path d="m3 7 6 6L16 3l7 10 6-6-4 17H7L3 7Z" stroke="currentColor" stroke-width="2"/><path d="M8 20h16" stroke="currentColor" stroke-width="2"/></svg>';
const sound='<svg viewBox="0 0 24 24" fill="none"><path d="M11 5 6 9H3v6h3l5 4V5Z" stroke="currentColor" stroke-width="1.7"/><path d="M15 8q6 4 0 8m3-11q9 7 0 14" stroke="currentColor" stroke-width="1.5"/></svg>';
const pauseIcon='<svg viewBox="0 0 24 24"><path d="M7 5v14M17 5v14" stroke="currentColor" stroke-width="3"/></svg>';
const bell='<svg viewBox="0 0 32 32" fill="none"><path d="M7 21c4-3 0-13 9-13s5 10 9 13H7Zm6 4h6M16 5v3" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/></svg>';
const heart='<svg viewBox="0 0 24 22"><path d="M12 21C5 15.6 1.5 12 1.5 7.9 1.5 4.6 4 2 7.1 2 9.2 2 11 3.2 12 5.1 13 3.2 14.8 2 16.9 2 20 2 22.5 4.6 22.5 7.9 22.5 12 19 15.6 12 21Z"/><path class="shine" d="M5.2 6.6q.9-2 3-2.1"/></svg>';
const flag='<svg viewBox="0 0 22 30"><path d="M3 29V2" stroke="#fff1d4" stroke-width="2.6" stroke-linecap="round"/><path d="M4 3h16v12H4z" fill="#fff1d4"/><path d="M4 3h4v4H4zm8 0h4v4h-4zM8 7h4v4H8zm8 0h4v4h-4zM4 11h4v4H4zm8 0h4v4h-4z" fill="#14231f"/></svg>';
const stopwatch='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="13.5" r="7.8"/><path d="M12 9.5v4.4l2.8 1.8M9.4 2.6h5.2M12 2.8v2.8"/></svg>';
function vehicleIcon(i:number){
 if(i<3)return `<svg viewBox="0 0 64 40" fill="none"><circle cx="14" cy="28" r="9"/><circle cx="50" cy="28" r="9"/><path d="m14 28 10-17 12 17H14Zm10-17h20l6 17M36 28l8-22h7M20 8h10"/>${i===1?'<path d="M32 7q8-13 22 0v9H32V7Z"/>':''}${i===2?'<path d="m25 14 11 2 4 7H25Z"/>':''}</svg>`;
 return `<svg viewBox="0 0 64 40" fill="none"><circle cx="15" cy="31" r="6"/><circle cx="49" cy="31" r="6"/><path d="M9 31H5V18l9-10h${i===4?'17v17h28V10H34':'28l10 10h7v13h-4'}M21 31h22M15 11l-5 10h38L40 11H15Z"/></svg>`;
}
const reviewMode=import.meta.env.DEV&&new URLSearchParams(location.search).has('review');
function readSave(){try{return loadProgress(localStorage.getItem('dhaka-streets-v3')??localStorage.getItem('dhaka-streets-v2'),localStorage.getItem('dhaka-streets-v1'),matchMedia('(prefers-reduced-motion: reduce)').matches);}catch{return loadProgress(null,null);}}
const save=readSave();
const persist=()=>{if(reviewMode)return;try{localStorage.setItem('dhaka-streets-v3',JSON.stringify(save));}catch{/* A full or private store never prevents play. */}};
let selected=Math.floor(availableStage(save)/3),lesson=availableStage(save)%3,sim=new Simulation(selected,27,lesson),world:World|undefined;
const stageId=()=>selected*3+lesson;
const districts:Record<Neighborhood,{name:string;bangla:string;tag:string}>={bazaar:{name:'Shankhari Bazaar',bangla:'শাঁখারীবাজার',tag:'Balconies, bakarkhani & bicycle bells'},riverfront:{name:'Sadarghat',bangla:'সদরঘাট',tag:'Launch horns over the Buriganga'},boulevard:{name:'Karwan Bazar',bangla:'কারওয়ান বাজার',tag:'Wholesale hustle. Rush-hour nerve.'}};
const deference=['Find your own gap','A little room for a rickshaw','Small traffic starts to yield','Your presence opens a lane','The city makes way for the king'];
const audio=new GameAudio();audio.setMuted(save.muted);audio.onCaption=line=>{if(line.reaction)return;$('#street-caption').innerHTML=`<b lang="bn">${line.bangla}</b><span>${line.caption}</span>`;$('#hud').style.setProperty('--flavour-top',`${Math.round(innerHeight-$('#authority-hud').getBoundingClientRect().top)}px`);$('#street-caption').classList.add('shown');captionUntil=performance.now()+3200;};
let leftHeld=false,rightHeld=false;
let steer=0,brake=false,desired=0,accumulator=0,last=performance.now(),screen='menu',toastUntil=0,feedbackUntil=0,nudgeUntil=0,seed=27,ending=false,nextVendor=12,splashUntil=0,swerveUntil=0,hornUntil=0,comboUntil=0,districtUntil=0,lastDistrict:Neighborhood=sim.neighborhood,toastPriority=0,lastFailure='',passes=0,callCount=0,shaveCalls=0,nextDistrict='',captionUntil=0;
const clearCaption=()=>{captionUntil=0;$('#street-caption').classList.remove('shown');};
const chipKinds=[['cha','☕','Cha speed'],['magnet','🧲','Taka magnet'],['belly','🍢','Full belly'],['stomach','🤢','পেট গুড়গুড়!']] as const;
const keys=new Set<string>();const swipe=new SwipeRecognizer(innerWidth);
let renderDirty=true,renderedSimulation:Simulation|undefined,renderedStatus='';
$('#app').innerHTML=`
 <canvas id="game" aria-label="Three-dimensional Old Dhaka street"></canvas>
 <div class="vignette" aria-hidden="true"></div><div id="impact" aria-hidden="true"></div><div id="paan-splash" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
 <section id="menu" class="screen menu">
  <div class="cover" aria-hidden="true"></div><div class="cover-shade" aria-hidden="true"></div>
  <header class="masthead"><a class="brand" href="#" aria-label="King of Dhaka Streets home">${crown}<span>ঢাকার রাজা</span></a><div class="top-actions"><span class="edition">15 missions · One city · Your crown</span><button class="beta-btn feedback-open" aria-label="Beta tester feedback">💡<span>Beta ideas</span></button><button class="icon-btn sound-toggle" aria-label="Toggle sound">${sound}</button><button id="shop-open" class="beta-btn" aria-label="Open the Bazaar"><i class="bag" aria-hidden="true">🛍</i><span>Bazaar</span><b class="purse"><i class="coin" aria-hidden="true"></i><em id="wallet">0</em></b></button><button id="settings-open" class="icon-btn" aria-label="Settings">⚙</button></div></header>
  <div class="menu-content"><div class="little-route"><span class="sun-dot"></span>Old Dhaka, golden hour</div>
   <h1><span>KING OF</span><strong>DHAKA</strong><span class="streets">STREETS</span></h1>
   <p class="intro">Small bell. Big dreams.<br>Earn your wheels in the city that never gives way.</p>
   <div class="play-row"><button id="start" class="primary">Let's ride <span>↗</span></button><span id="ride-label">Bicycle · Chapter 1</span></div>
   <p class="menu-tip">Best with sound. Better with a little nerve.</p>
  </div>
  <aside class="mission-board" id="mission-board" aria-label="Choose a mission"></aside>
  <footer class="garage"><div class="garage-heading"><span>Your road to royalty</span><span id="garage-progress">1 / 5 rides unlocked</span></div><div id="vehicles" class="vehicles"></div></footer>
  <div class="credit">Concept art shown · Play to enter the 3D world</div>
 </section>
 <section id="hud" class="hidden" aria-label="Ride dashboard">
  <div class="hud-top"><div id="hearts" class="hearts" role="img" aria-label="3 of 3 hearts left">${heart.repeat(3)}</div>
   <div class="hud-right"><div class="hud-taka"><i class="coin" aria-hidden="true"></i><strong id="taka">0</strong><small>taka</small></div><div class="hud-buttons"><button class="icon-btn sound-toggle" aria-label="Toggle sound">${sound}</button><button id="pause" class="icon-btn" aria-label="Pause ride">${pauseIcon}</button></div><div class="hud-score"><b id="score">0000</b> street rep</div></div>
   <div id="race" class="race ahead" role="group" aria-label="Route"><div class="race-road" aria-hidden="true"><i class="race-fill"></i><i class="race-gold"></i><span class="race-flag">${flag}</span><span id="race-marker" class="race-marker"></span></div><div class="race-labels"><strong id="remaining">650 m to go</strong><span class="gold-clock">${stopwatch}<b id="gold-clock">74 s for gold</b></span></div></div>
   <div class="hud-chips"><span class="hud-chip" id="district-name">Shankhari Bazaar</span><span class="hud-chip shaves" id="shaves">Close shaves 0/2</span></div>
   <div id="effects" class="effects">${chipKinds.map(([kind,icon,label])=>`<span class="chip ${kind}" hidden><i>${icon}</i><b>${label}</b><em></em></span>`).join('')}</div></div>
  <div id="rear-alert" class="rear-alert hidden" role="status" aria-live="polite"><span id="rear-title">Bus behind!</span><div class="rear-road"><i id="rear-vehicle"></i><b id="rear-player"></b></div><small>Leave the highlighted line</small></div><div id="district-banner"><small>NOW ENTERING</small><strong></strong><span></span></div><div id="toast" role="status" aria-live="polite"></div><div id="combo"></div><div id="authority-hud"></div><div id="street-caption" aria-hidden="true"></div>
  <div class="hud-bottom"><div class="steer-controls"><span class="control-label">Steer</span><div class="steer-pad" id="steer-pad"><button id="left" aria-label="Steer left">‹</button><span class="steer-line"></span><button id="right" aria-label="Steer right">›</button></div></div>
   <div class="speedometer"><strong id="speed">0</strong><span>km/h</span></div>
   <div class="action-controls"><button id="jump" class="brake-btn jump-btn" aria-label="Jump"><svg viewBox="0 0 30 30" fill="none"><path d="M15 24V8m-7 7 7-7 7 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg><span>Jump</span></button><button id="brake" class="brake-btn" aria-label="Hold to brake"><svg viewBox="0 0 30 30" fill="none"><circle cx="15" cy="15" r="9" stroke="currentColor" stroke-width="2"/><path d="M4 8q-5 7 0 14M26 8q5 7 0 14M15 9v8m0 3v1" stroke="currentColor" stroke-width="2"/></svg><span>Brake</span></button><button id="horn" class="horn-btn" aria-label="Ring bell">${bell}<span id="horn-label">Bell</span></button></div>
  </div><div id="tutorial">Hold arrows to steer · Brake for space · Watch behind</div>
 </section>
 <section id="overlay" class="overlay hidden" role="dialog" aria-modal="true" aria-label="Ride menu"><div class="panel" id="panel"></div></section>
 <section id="settings" class="overlay hidden" role="dialog" aria-modal="true" aria-label="Ride settings"><div class="panel settings-panel"><span class="panel-kicker">Make yourself comfortable</span><h2>Your ride, your way.</h2><label>Graphics <select id="quality"><option value="auto">Adaptive</option><option value="low">Battery saver</option><option value="high">Detailed</option></select></label><label>Gentler camera <input type="checkbox" id="reduced"/></label><label>Controls <select id="controls-mode"><option value="swipe">Swipe</option><option value="buttons">Buttons</option></select></label><label>Sound <input type="checkbox" id="sound-setting"/></label><label>Music <input type="checkbox" id="music-setting"/></label><p class="small-note">Real street ambience, original sound effects and AI-generated Bangla voices. Captions always stay on. <a href="${import.meta.env.BASE_URL}audio/credits.html" target="_blank" rel="noopener">Sound credits</a></p><p class="small-note">A fictional route inspired by Old Dhaka. Progress saves on this device. Keyboard: ← → to steer, ↓ or Space to brake, H to honk, Esc to pause.</p><button id="settings-close" class="primary">Back to the street</button></div></section>
 <section id="shop" class="overlay hidden" role="dialog" aria-modal="true" aria-labelledby="shop-title"><div class="panel shop-panel"><div class="awning" aria-hidden="true"></div><div class="shop-head"><div><span class="panel-kicker">ঢাকার বাজার</span><h2 id="shop-title">The Bazaar</h2></div><p id="shop-wallet"></p></div><div class="shop-tabs" role="group" aria-label="Bazaar sections"><button class="shop-tab" data-tab="looks">Looks</button><button class="shop-tab" data-tab="power-ups">Power-ups</button></div><p id="shop-note" role="status" aria-live="polite"></p><div id="shop-list" class="shop-grid"></div><div class="shop-foot"><button id="shop-close" class="primary">Back to the garage</button></div></div></section>
 <section id="feedback" class="overlay hidden" role="dialog" aria-modal="true" aria-labelledby="feedback-title"><form id="feedback-form" class="panel feedback-panel" novalidate><span class="panel-kicker">Beta tester HQ</span><h2 id="feedback-title">Make the game better.</h2><p>What should we add, fix or keep? Every note goes straight to the game maker.</p>
  <fieldset class="feedback-kinds"><legend>This is…</legend><label><input type="radio" name="kind" value="idea" checked/><span>💡 A new idea</span></label><label><input type="radio" name="kind" value="bug"/><span>🛠 Something broken</span></label><label><input type="radio" name="kind" value="love"/><span>❤️ Something I love</span></label></fieldset>
  <label class="field">Your idea<textarea id="feedback-message" rows="4" maxlength="2000" placeholder="A boat race at Sadarghat! A mango truck! Faster rickshaws!"></textarea></label>
  <label class="field">Your first name <small>(optional)</small><input id="feedback-name" maxlength="40" autocomplete="off"/></label>
  <input id="feedback-botcheck" class="botcheck" type="text" tabindex="-1" autocomplete="off" aria-hidden="true"/>
  <p id="feedback-status" role="status" aria-live="polite"></p><button type="submit" id="feedback-send" class="primary">Send to the game maker <span>↗</span></button><button type="button" id="feedback-close" class="secondary">Back to the game</button></form></section>
 <div id="rotate-hint">↻ Turn your phone for a wider view</div>
`;
const stars=(count:number)=>Array.from({length:3},(_,i)=>`<span class="${i<count?'earned':''}">★</span>`).join('');
function drawWallet(){$('#wallet').textContent=String(save.taka);$('#shop-open').setAttribute('aria-label',`Open the Bazaar — you have ৳${save.taka}`);}
function drawGarage(){drawWallet();
 const unlocked=availableStage(save),unlockedVehicle=Math.floor(unlocked/3),id=stageId(),stage=STAGES[id];
 $('#garage-progress').textContent=`${save.stars.filter(n=>n>0).length} / 15 missions · ${save.stars.reduce((a,b)=>a+b,0)} stars`;
 $('#vehicles').innerHTML=VEHICLES.map((v,i)=>`<button class="vehicle ${i===selected?'selected':''} ${i>unlockedVehicle?'locked':''}" data-vehicle="${i}" aria-label="${v.name}${i>unlockedVehicle?', preview locked chapter':''}" aria-pressed="${i===selected}"><span class="vehicle-art">${vehicleIcon(i)}</span><span class="vehicle-name">${v.name}</span><span class="vehicle-detail">${i>unlockedVehicle?'Locked chapter':`${save.stars.slice(i*3,i*3+3).filter(n=>n>0).length}/3 missions`}</span></button>`).join('');
 $('#mission-board').innerHTML=`<div class="mission-heading"><span>CHAPTER ${selected+1} · ${VEHICLES[selected].bangla}</span><strong>${VEHICLES[selected].name}</strong></div><div class="authority-preview"><div class="authority-bars">${VEHICLES.map((_,i)=>`<i class="${i<=selected?'on':''}"></i>`).join('')}</div><span>${deference[selected]}</span></div><div class="mission-list">${STAGES.slice(selected*3,selected*3+3).map(m=>`<button data-mission="${m.lessonIndex}" class="mission-choice ${m.id===id?'selected':''}" ${m.id>unlocked?'disabled':''}><b>${String(m.lessonIndex+1).padStart(2,'0')}</b><span>${m.name}<small>${m.id>unlocked?'Complete the previous mission':m.lessonIndex===0?'Read the city':m.lessonIndex===1?'React to the street':'Master the chaos'}</small></span><em class="stars" aria-label="${save.stars[m.id]} of 3 stars">${stars(save.stars[m.id])}</em></button>`).join('')}</div><p class="mission-objective">${stage.objective}</p>`;
 $('#ride-label').textContent=`Mission ${lesson+1} / 3 · ${districts[stage.neighborhood].name}`;
 const startButton=$<HTMLButtonElement>('#start');startButton.disabled=id>unlocked;
 startButton.innerHTML=id>unlocked?'Chapter locked':`${save.stars[id]?'Ride again':"Let's ride"} <span>↗</span>`;
 document.querySelectorAll<HTMLButtonElement>('[data-vehicle]').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.vehicle);lesson=Math.max(0,Math.min(2,unlocked-selected*3));sim=new Simulation(selected,seed,lesson);drawGarage();});
 document.querySelectorAll<HTMLButtonElement>('[data-mission]').forEach(b=>b.onclick=()=>{lesson=Number(b.dataset.mission);sim=new Simulation(selected,seed,lesson);drawGarage();});
}
function updateSound(){document.querySelectorAll<HTMLButtonElement>('.sound-toggle').forEach(b=>{b.classList.toggle('muted',save.muted);b.setAttribute('aria-label',save.muted?'Turn sound on':'Mute sound');});$<HTMLInputElement>('#sound-setting').checked=!save.muted;}
function clearInput(){keys.clear();swipe.clear();leftHeld=rightHeld=false;desired=steer=0;brake=false;nudgeUntil=0;document.querySelectorAll('.held').forEach(b=>b.classList.remove('held'));}
async function start(){
 if(!reviewMode&&stageId()>availableStage(save))return;
 if(!world){$('#start').textContent='Opening the street…';return;}
 clearInput();audio.resetRide();lastFailure='';passes=callCount=0;nextDistrict='';toastPriority=0;toastUntil=feedbackUntil=splashUntil=swerveUntil=hornUntil=comboUntil=0;$('#toast').classList.remove('shown');$('#combo').classList.remove('visible');$('#impact').classList.remove('hit');$('#paan-splash').classList.remove('splashed');world.setLook(vehicleLook(save,VEHICLES[selected].id));sim=new Simulation(selected,reviewMode?seed++:freshSeed(),lesson,powerUpStats(save.upgrades));sim.start();screen='playing';ending=false;nextVendor=12;lastDistrict=sim.neighborhood;announceDistrict();
 $('#hud').inert=false;$('#menu').classList.add('hidden');$('#overlay').classList.add('hidden');$('#hud').classList.remove('hidden');
 $('#race-marker').innerHTML=vehicleIcon(selected);$('#hud').classList.toggle('calm',calm());$('#horn-label').textContent=selected<2?'Bell':'Horn';$('#horn').setAttribute('aria-label',selected<2?'Ring bell':'Sound horn');
 $('#authority-hud').textContent=deference[selected];showToast(`${sim.stage.name} · ${sim.stage.objective}`);
 try{await audio.init();void audio.prepareDistrict(sim.neighborhood);nextDistrict='';}catch{showToast('Sound unavailable. Captions are on.');}
}
function showToast(text:string,urgent=false){const now=performance.now();if(!urgent&&toastPriority&&now<toastUntil)return;toastPriority=urgent?1:0;$('#toast').textContent=text;$('#toast').classList.toggle('urgent',urgent);$('#toast').classList.add('shown');toastUntil=now+(urgent?3000:3200);}
function announceDistrict(){const district=districts[sim.neighborhood];$('#district-name').textContent=district.name;$('#district-banner strong').textContent=district.bangla;$('#district-banner span').textContent=district.name;$('#district-banner').classList.add('visible');districtUntil=performance.now()+2200;}
function horn(){if(sim.status!=='playing')return;sim.horn();}
function togglePause(){if(screen!=='playing')return;if(sim.status==='playing'){sim.pause();clearInput();$('#hud').inert=true;$('#panel').innerHTML=`<span class="panel-kicker">Take a breather</span><h2>The city can wait.</h2><p>Your ride is paused.</p><button id="resume" class="primary">Keep riding ↗</button><button id="quit" class="secondary">Back to the garage</button><button class="secondary feedback-open">💡 Share an idea</button>`;$('#overlay').classList.remove('hidden');$('#resume').focus();bindFeedbackButtons();$('#resume').onclick=()=>{$('#hud').inert=false;sim.resume();$('#overlay').classList.add('hidden');void audio.init();};$('#quit').onclick=menu;}else if(sim.status==='paused'){$('#hud').inert=false;sim.resume();$('#overlay').classList.add('hidden');}}
function menu(){if(screen==='playing'&&sim.status!=='won'&&sim.status!=='lost'&&sim.status!=='ready'){bankRide(save,sim,{won:false,coins:sim.taka,stars:0,firstClear:false});persist();}clearInput();audio.resetRide();$('#rear-alert').classList.add('hidden');$('#district-banner').classList.remove('visible');$('#hud').inert=false;screen='menu';$('#hud').classList.add('hidden');$('#overlay').classList.add('hidden');$('#menu').classList.remove('hidden');sim=new Simulation(selected,seed,lesson);drawGarage();}
const payoutRow=(label:string,value:string)=>`<div class="payout-row"><span>${label}</span><b>${value}</b></div>`;
function payoutCard(p:ReturnType<typeof ridePayout>,snacks:number){return `<div class="payout" role="group" aria-label="Taka from this ride">${payoutRow('Coins collected',`৳${p.coins}`)}${p.finish?payoutRow('Finish bonus',`+৳${p.finish}`):''}${p.firstClear?payoutRow('First clear bonus',`+৳${p.firstClear}`):''}<div class="payout-total"><span><i class="coin" aria-hidden="true"></i>You earned</span><strong id="payout-total">৳${p.total}</strong></div><div class="payout-foot"><span>${snacks?`${snacks} street snack${snacks===1?'':'s'} eaten`:'No snacks this ride'}</span><span>Wallet now <b>৳${save.taka}</b></span></div></div>`;}
// The total counts up once when the results open; reduced motion shows it straight away.
function countUp(el:HTMLElement,total:number){if(total<=0||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const begin=performance.now(),tick=(now:number)=>{const t=Math.min(1,(now-begin)/700);el.textContent=`৳${Math.round(total*(1-(1-t)**3))}`;if(t<1&&el.isConnected)requestAnimationFrame(tick);};requestAnimationFrame(tick);}
function finish(){
 if(ending)return;ending=true;clearInput();audio.resetRide();$('#hud').inert=true;$('#rear-alert').classList.add('hidden');
 const won=sim.status==='won',id=stageId(),previousBest=save.best[id],graduated=won&&lesson===2&&selected<4,nextId=Math.min(14,id+1);
 const firstClear=won&&save.stars[id]===0;if(won){completeStage(save,id,sim.score,sim.stars);audio.finish();audio.medal(id===14);}else audio.loss();
 const ride={won,coins:sim.taka,stars:won?sim.stars:0,firstClear},payout=bankRide(save,sim,ride)??ridePayout(ride);persist();
 const next=STAGES[nextId],title=won?(id===14?'ঢাকার রাজা!':graduated?`${VEHICLES[selected+1].name} unlocked!`:'Made it, boss.'):'The city got you.';
 const cause=lastFailure;
 $('#panel').innerHTML=`<span class="panel-kicker">${won?sim.rank:'Take a breath. Find a new gap.'}</span><h2>${title}</h2>${won?`<div class="result-stars stars">${stars(sim.stars)}</div>`:''}<p>${won?(graduated?`${VEHICLES[selected+1].bangla} · ${deference[selected+1]}`:id===14?'Fifteen missions. Five rides. One city that finally makes way.':`Next: ${next.name}. Complete all three missions to earn your next ride.`):(cause||'Watch the warning, leave its line, and brake to make space.')}</p><div class="result-row"><div class="result-stats"><div><strong>${sim.score.toLocaleString()}</strong><span>${sim.score>previousBest?'personal best':'street rep'}</span></div><div><strong>${sim.nearMisses}</strong><span>close shaves</span></div><div><strong>×${sim.maxCombo}</strong><span>best chain</span></div></div>${payoutCard(payout,sim.effects.snacksEaten)}</div>${won?`<p class="medal-note">Gold needs all 3 hearts, ${sim.stage.nearMissTarget} close shaves and a finish within ${sim.stage.parTime}s. A slower finish still advances.</p>`:''}<button id="again" class="primary">${won&&id<14?(graduated?`Take the ${VEHICLES[selected+1].name.toLowerCase()}`:'Next mission'):'Try again'} ↗</button><button id="garage" class="secondary">Back to the garage</button>`;
 $('#overlay').classList.remove('hidden');$('#overlay').scrollTop=0;$('#again').focus({preventScroll:true});countUp($('#payout-total'),payout.total);$('#again').onclick=()=>{if(won&&id<14){selected=next.vehicleIndex;lesson=next.lessonIndex;}void start();};$('#garage').onclick=menu;
}
$('#start').onclick=()=>void start();$('#pause').onclick=togglePause;$('#horn').onclick=horn;
$('.brand').onclick=e=>{e.preventDefault();menu();};
const closeSettings=()=>{$('#settings').classList.add('hidden');$('#menu').inert=false;$('#settings-open').focus();persist();};
$('#settings-open').onclick=()=>{$('#settings').classList.remove('hidden');$('#menu').inert=true;$('#quality').focus();};$('#settings-close').onclick=closeSettings;
let shopTab:ShopTab='looks',lastTap:Tap|undefined;const BROKE_NOTE='Not enough taka yet — ride and collect more!';
function drawShop(note=''){$('#shop-wallet').innerHTML=`<i class="coin" aria-hidden="true"></i><span>Your wallet</span><b>৳${save.taka}</b>`;$('#shop-note').textContent=note;$('#shop-list').innerHTML=renderShop(save,VEHICLES[selected].id,shopTab,selected<=Math.floor(availableStage(save)/3));document.querySelectorAll<HTMLButtonElement>('.shop-tab').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===shopTab)));drawWallet();}
const closeShop=()=>{$('#shop').classList.add('hidden');$('#menu').inert=false;$('#shop-open').focus();};
$('#shop-open').onclick=()=>{drawShop();$('#shop').classList.remove('hidden');$('#menu').inert=true;$('#shop-close').focus();};$('#shop-close').onclick=closeShop;
$('#shop').addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(!b||b.id==='shop-close')return;let note='';
 if(b.dataset.hear){const item=LOOKS.find(i=>i.id===b.dataset.hear);if(item?.horn)void audio.init().then(()=>audio.preview(item.horn!));return;}
 // A double tap must not buy twice or undo the purchase; the row redraws, so put focus back on its button.
 const row=b.dataset.look?`[data-look="${b.dataset.look}"]`:b.dataset.upgrade?`[data-upgrade="${b.dataset.upgrade}"]`:'',now=performance.now();if(row&&isRepeatTap(lastTap,row,now))return;if(row)lastTap={key:row,at:now};
 if(b.dataset.tab)shopTab=b.dataset.tab==='power-ups'?'power-ups':'looks';
 else if(b.dataset.look){const id=b.dataset.look;if(save.owned.includes(id))toggleLook(save,id);else{const r=buyLook(save,id);note=r==='bought'?'Bought and equipped — enjoy the ride!':r==='too-poor'?BROKE_NOTE:'';}}
 else if(b.dataset.upgrade){const r=buyUpgrade(save,b.dataset.upgrade as 'cha'|'jhalmuri'|'chaap');note=r==='bought'?'Upgraded!':r==='too-poor'?BROKE_NOTE:'';}
 persist();world?.setLook(vehicleLook(save,VEHICLES[selected].id));drawShop(note);
 const again=row?$('#shop-list').querySelector<HTMLButtonElement>(row):null;if(again)(again.disabled?$('.shop-tab[aria-pressed="true"]'):again).focus({preventScroll:true});});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#shop').classList.contains('hidden')){e.preventDefault();closeShop();}if(e.key==='Escape'&&!$('#settings').classList.contains('hidden')){e.preventDefault();closeSettings();}if(e.key==='Escape'&&feedbackOpen()){e.preventDefault();closeFeedback();}});
const feedbackOpen=()=>!$('#feedback').classList.contains('hidden');
let feedbackReturn:HTMLElement|null=null,feedbackBehind:HTMLElement=$('#menu');
function openFeedback(from:HTMLElement){feedbackReturn=from;feedbackBehind=screen==='playing'?$('#overlay'):$('#menu');feedbackBehind.inert=true;$('#feedback-status').textContent='';$('#feedback-status').className='';$('#feedback').classList.remove('hidden');$('#feedback-message').focus();}
function closeFeedback(){$('#feedback').classList.add('hidden');feedbackBehind.inert=false;feedbackReturn?.focus();}
function bindFeedbackButtons(){document.querySelectorAll<HTMLButtonElement>('.feedback-open').forEach(b=>b.onclick=()=>openFeedback(b));}
bindFeedbackButtons();$('#feedback-close').onclick=closeFeedback;
$<HTMLFormElement>('#feedback-form').onsubmit=async e=>{e.preventDefault();const send=$<HTMLButtonElement>('#feedback-send'),status=$('#feedback-status');if(send.disabled)return;
 const kind=($<HTMLInputElement>('#feedback-form input[name="kind"]:checked').value) as FeedbackKind,message=$<HTMLTextAreaElement>('#feedback-message');
 send.disabled=true;status.className='';status.textContent='Sending…';
 const result=await sendFeedback(import.meta.env.VITE_WEB3FORMS_KEY,{name:$<HTMLInputElement>('#feedback-name').value,kind,message:message.value,botcheck:$<HTMLInputElement>('#feedback-botcheck').value},{vehicle:VEHICLES[selected].name,mission:STAGES[stageId()].name,purchases:describePurchases(save),progress:`${save.stars.filter(n=>n>0).length} / ${STAGES.length} missions`,device:`${navigator.userAgent} · ${innerWidth}×${innerHeight}`});
 send.disabled=false;status.className=result.ok?'sent':'error';status.textContent=result.ok?'Got it — thank you, beta tester! 🎉 Send another any time.':result.reason;if(result.ok)message.value='';else message.focus();};
$('#quality').addEventListener('change',e=>{const q=(e.target as HTMLSelectElement).value;save.quality=q==='low'||q==='high'?q:'auto';world?.setQuality(save.quality);});
$('#reduced').addEventListener('change',e=>{save.reduced=(e.target as HTMLInputElement).checked;world?.setReduced(save.reduced);});
$('#sound-setting').addEventListener('change',e=>{save.muted=!(e.target as HTMLInputElement).checked;audio.setMuted(save.muted);if(!save.muted)void audio.init();updateSound();persist();});
$('#quality').setAttribute('value',save.quality);($('#quality') as HTMLSelectElement).value=save.quality;($('#reduced') as HTMLInputElement).checked=save.reduced;
for(const b of document.querySelectorAll<HTMLButtonElement>('.sound-toggle'))b.onclick=()=>{save.muted=!save.muted;audio.setMuted(save.muted);void audio.init();persist();updateSound();};
$<HTMLInputElement>('#music-setting').checked=save.music;audio.setMusicOn(save.music);
$('#music-setting').addEventListener('change',e=>{save.music=(e.target as HTMLInputElement).checked;audio.setMusicOn(save.music);persist();});
// The menu theme needs one gesture first; pointerup (not pointerdown) is what unlocks audio for a touch on iOS.
addEventListener('pointerup',()=>{if(!save.muted)void audio.init();},{once:true,capture:true});
const touchFirst=matchMedia('(pointer: coarse)').matches;
const controlMode=()=>save.controls??(touchFirst?'swipe':'buttons');
function applyControlMode(){const mode=controlMode();$('#hud').classList.toggle('swipe-mode',mode==='swipe');$<HTMLSelectElement>('#controls-mode').value=mode;$('#tutorial').textContent=mode==='swipe'?'Drag to steer · Flick up to jump · Swipe down to brake':'Arrows to steer · ↑ to jump · Brake for space';}
applyControlMode();
$('#controls-mode').addEventListener('change',e=>{const v=(e.target as HTMLSelectElement).value;save.controls=v==='swipe'?'swipe':'buttons';swipe.clear();persist();applyControlMode();});
function jump(){if(sim.status==='playing')sim.jump();}
// The canvas is the swipe surface; HUD buttons sit above it and keep working.
const surface=$('#game');
surface.addEventListener('pointerdown',e=>{if(controlMode()!=='swipe'||sim.status!=='playing')return;e.preventDefault();surface.setPointerCapture(e.pointerId);swipe.down(e.pointerId,e.clientX,e.clientY,e.timeStamp);});
surface.addEventListener('pointermove',e=>swipe.move(e.pointerId,e.clientX,e.clientY,e.timeStamp));
surface.addEventListener('pointerup',e=>swipe.up(e.pointerId,e.clientX,e.clientY,e.timeStamp));
for(const type of ['pointercancel','lostpointercapture'] as const)surface.addEventListener(type,e=>swipe.cancel(e.pointerId));
$('#jump').addEventListener('pointerdown',e=>{e.preventDefault();jump();});$('#jump').addEventListener('click',e=>{if(e.detail===0)jump();});
function hold(id:string,on:()=>void,off:()=>void){const b=$(id);b.addEventListener('pointerdown',e=>{if(sim.status!=='playing')return;e.preventDefault();b.setPointerCapture(e.pointerId);nudgeUntil=0;on();b.classList.add('held');});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>{off();b.classList.remove('held');});}
const heldSteer=()=>desired=Number(rightHeld)-Number(leftHeld);
hold('#left',()=>{leftHeld=true;heldSteer();},()=>{leftHeld=false;heldSteer();});hold('#right',()=>{rightHeld=true;heldSteer();},()=>{rightHeld=false;heldSteer();});hold('#brake',()=>brake=true,()=>brake=false);
// Click also gives keyboard/assistive activation a brief, predictable steering nudge.
$('#left').addEventListener('click',e=>{if(e.detail===0){desired=-1;nudgeUntil=performance.now()+180;}});$('#right').addEventListener('click',e=>{if(e.detail===0){desired=1;nudgeUntil=performance.now()+180;}});
window.addEventListener('keydown',e=>{if(feedbackOpen()||e.defaultPrevented)return;if(screen!=='playing'||!['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','a','d','s','w',' ','h','Escape'].includes(e.key))return;e.preventDefault();keys.add(e.key);if(e.key==='Escape'&&!e.repeat)togglePause();if(e.key==='h'&&!e.repeat)horn();if((e.key==='ArrowUp'||e.key==='w')&&!e.repeat)jump();});window.addEventListener('keyup',e=>keys.delete(e.key));
window.addEventListener('blur',()=>{clearInput();if(sim.status==='playing')togglePause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&sim.status==='playing')togglePause();});window.addEventListener('resize',()=>{world?.resize();placeAlerts();swipe.resize(innerWidth);renderDirty=true;});
$('#game').addEventListener('webglcontextlost',e=>{e.preventDefault();if(sim.status==='playing')togglePause();showToast('Graphics interrupted. Waiting for the street to return…');});
$('#game').addEventListener('webglcontextrestored',()=>{renderDirty=true;showToast('Graphics restored. You can keep riding.');});
let lastChips='',shownTaka=0,takaPulse=0,boosting=false,shownHealth=3;
const calm=()=>save.reduced||matchMedia('(prefers-reduced-motion: reduce)').matches;
const setText=(el:HTMLElement,text:string)=>{if(el.textContent!==text)el.textContent=text;};
// The race bar: the vehicle marker moves by distance, the gold line by the clock; the ring turns green while ahead of gold pace.
function drawRace(){const r=raceBar({distance:sim.distance,routeLength:sim.routeLength,elapsed:sim.elapsed,parTime:sim.stage.parTime}),bar=$('#race'),shaves=shavesChip(sim.nearMisses,sim.stage.nearMissTarget);
 bar.style.setProperty('--covered',r.covered.toFixed(4));bar.style.setProperty('--pace',r.pace.toFixed(4));bar.classList.toggle('ahead',r.ahead);bar.classList.toggle('gold-gone',r.goldGone);
 setText($('#remaining'),r.distanceLabel);setText($('#gold-clock'),r.clockLabel);setText($('#shaves'),shaves.text);$('#shaves').classList.toggle('done',shaves.done);}
// Hearts redraw only when health changes; each lost heart pops and the pill shakes, unless motion is reduced.
function drawHearts(){if(sim.health===shownHealth)return;const before=shownHealth,hearts=$('#hearts'),icons=hearts.querySelectorAll('svg');shownHealth=sim.health;
 icons.forEach((h,i)=>h.classList.toggle('gone',i>=shownHealth));hearts.setAttribute('aria-label',heartsLabel(shownHealth));
 if(shownHealth>before||calm())return;hearts.animate([{transform:'translateX(0)'},{transform:'translateX(-7px)'},{transform:'translateX(6px)'},{transform:'translateX(-4px)'},{transform:'translateX(0)'}],{duration:380,easing:'ease-out'});
 for(let i=shownHealth;i<before;i++)icons[i]?.animate([{transform:'scale(1.7) rotate(-12deg)',opacity:.4},{transform:'scale(.85) rotate(6deg)',opacity:1},{transform:'scale(1)'}],{duration:480,easing:'cubic-bezier(.3,1.6,.6,1)'});}
// Toasts, the rear alert and the district banner sit just under the top HUD, whatever its height on this screen.
function placeAlerts(){if($('#hud').classList.contains('hidden'))return;const portrait=matchMedia('(orientation: portrait)').matches,bottom=(portrait?$('.hud-top'):$('#race')).getBoundingClientRect().bottom;$('#hud').style.setProperty('--hud-bottom',`${Math.round(bottom)}px`);}
new ResizeObserver(placeAlerts).observe($('.hud-top'));
// Chips update in place once a second; CSS drains each timer bar smoothly between updates.
function drawChips(){const e=sim.effects,p=sim.powerUps,timers={cha:[e.boost,p.chaSeconds],magnet:[e.magnet,p.magnetSeconds],belly:[e.belly?1:0,0],stomach:[e.stomach,STOMACH_SECONDS]};
 const key=chipKinds.map(([kind])=>Math.ceil(timers[kind][0])).join();if(key===lastChips)return;lastChips=key;
 for(const [kind] of chipKinds){const [left,total]=timers[kind],secs=Math.ceil(left),chip=$(`#effects .${kind}`);chip.hidden=left<=0;chip.querySelector('em')!.textContent=total?String(secs):'';chip.style.setProperty('--left',String(total?Math.max(0,secs-1)/total:1));}}
// The taka counter rolls up to the real amount and the coin gives a little hop for each gain.
function drawTaka(dt:number){if(sim.taka===shownTaka)return;if(sim.taka<shownTaka){shownTaka=sim.taka;$('#taka').textContent=String(shownTaka);return;}const now=performance.now();shownTaka=Math.min(sim.taka,shownTaka+Math.max(1,Math.ceil((sim.taka-shownTaka)*Math.min(1,dt*10))));$('#taka').textContent=String(shownTaka);if(now>takaPulse){takaPulse=now+160;$('.hud-taka .coin').animate([{transform:'translateY(0) rotateY(0)'},{transform:'translateY(-5px) rotateY(180deg)'},{transform:'translateY(0) rotateY(360deg)'}],{duration:320,easing:'ease-out'});}}
function frame(now:number){const dt=Math.min((now-last)/1000,.05);last=now;
 if(nudgeUntil&&now>nudgeUntil){desired=0;nudgeUntil=0;}
 const keyboard=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0);
 if(swipe.takeJump())jump();steer+=((keyboard||swipe.steer||desired)-steer)*(1-Math.exp(-dt*17));
 accumulator+=dt;while(accumulator>=1/60){sim.update(1/60,{steer,brake:brake||swipe.brake||keys.has('ArrowDown')||keys.has('s')||keys.has(' ')});accumulator-=1/60;}
 const rear=sim.rearThreats.reduce<typeof sim.rearThreats[number]|undefined>((closest,t)=>!closest||t.timeToContact<closest.timeToContact?t:closest,undefined);
 audio.setMusic({scene:screen==='playing'?sim.neighborhood:'menu',speed:Math.min(1,sim.speed/SPEED_CAP),combo:sim.combo,boost:sim.effects.boost>0,playing:screen!=='playing'||sim.status==='playing'});
 audio.update(sim.speed,VEHICLES[selected].id,sim.status==='playing',{neighborhood:sim.neighborhood,intensity:.5+lesson*.22,rear:rear?{kind:rear.kind,urgency:rear.urgency,x:rear.x}:undefined,traffic:sim.traffic,playerZ:sim.z,effects:{boost:sim.effects.boost,boostFraction:sim.effects.boost/Math.max(1,sim.powerUps.chaSeconds),magnet:sim.effects.magnet}});
 if(sim.status==='playing'&&sim.neighborhood!==lastDistrict){lastDistrict=sim.neighborhood;announceDistrict();}
 if(now>districtUntil||rear)$('#district-banner').classList.remove('visible');
 $('#rear-alert').classList.toggle('hidden',!rear||sim.status!=='playing');
 if(rear){const swerving=now<swerveUntil;$('#rear-title').textContent=`${rear.kind==='bus'?'BUS':'TRUCK'} ${swerving?'SWERVES ROUND YOU!':'BEHIND!'}`;$('#rear-alert small').textContent=swerving?'Hold your line':'Leave the highlighted line';$('#rear-alert').style.setProperty('--urgency',String(rear.urgency));$('#rear-vehicle').style.left=`${Math.max(8,Math.min(92,(rear.x+5.3)/10.6*100))}%`;$('#rear-player').style.left=`${(sim.x+5.3)/10.6*100}%`;}
 if(sim.status==='playing'&&sim.elapsed>nextVendor){nextVendor+=18;if(now>toastUntil&&!rear){audio.say(districtCall(sim.neighborhood,callCount++));}}
 // Fetch the voices of the district 120 m ahead (and, on the first frame, the current one) before the rider gets there.
 if(screen==='playing'&&sim.status==='playing'){const ahead=sim.neighborhoodAt(sim.distance+120);if(ahead!==nextDistrict){nextDistrict=ahead;void audio.prepareDistrict(ahead);}}
 const events=sim.events.splice(0);
 for(const event of events){
  if(event.type==='jump')audio.jump(VEHICLES[selected].id);if(event.type==='land')world?.land();if(event.type==='bump'){world?.shake(.35);world?.land();audio.bump();audio.say('pothole-uff');}
  if(event.type==='horn'){hornUntil=now+250;$('#horn').classList.add('ringing');audio.horn(VEHICLES[selected].id,equippedHorn(save,VEHICLES[selected].id));if(!rear)showToast(event.text);}
  if(event.type==='warning'){showToast(event.text);if(event.text.includes('Ostad'))audio.say('bus-helper-plastic');if(/cow|goru/i.test(event.text))audio.warning('cow',(event.x??0)/5.3);}
  // The rear alert card itself carries these, so no toast stacks under it onto the rider on a short landscape screen.
  if(event.type==='rear-warning'){clearCaption();audio.warning('rear',(event.x??0)/5.3);}if(event.type==='rear-swerve'){clearCaption();audio.warning('rear',(event.x??0)/5.3);swerveUntil=now+2500;}
  if(event.type==='paan-warning'){clearCaption();audio.warning('paan',(event.x??0)/5.3);showToast(event.text,true);}
  if(event.type==='crash'){lastFailure=event.text;if(/paan/i.test(event.text)){splashUntil=now+1900;$('#paan-splash').classList.add('splashed');}audio.impact();audio.say('crash-chokhe');showToast(event.text,true);$('#impact').classList.add('hit');feedbackUntil=now+260;}
  if(event.type==='coin')audio.coin(event.chain??1,event.value===5?5:1);if(event.type==='snack'){audio.snack(event.kind??'cha');if(event.kind==='cha')audio.say('cha-ah');showToast(event.text);}if(event.type==='stomach'){audio.stomach();audio.say('stomach-gurgur');showToast(event.text,true);}if(event.type==='belly'){audio.belly();showToast(event.text);}
  if(event.type==='near-miss'){audio.nearMiss(sim.combo);audio.say(++shaveCalls%2?'easy-brother':'near-miss-banchlam');$('#combo').innerHTML=`<small>বাঁচলাম!</small>${event.text}`;$('#combo').classList.add('visible','close-shave');comboUntil=now+1500;}
  if(event.type==='pass'){const kind=sim.traffic.find(t=>t.id===event.actorId)?.kind;if(kind)audio.cue(passCue(kind,++passes));}
  if(event.type==='pass'&&now>comboUntil){$('#combo').textContent=event.text;$('#combo').classList.remove('close-shave');$('#combo').classList.add('visible');comboUntil=now+900;}
  if(event.type==='win'||event.type==='lose'){if(event.type==='lose')lastFailure=event.text;finish();}
 }
 if(now>comboUntil)$('#combo').classList.remove('visible');if(now>splashUntil)$('#paan-splash').classList.remove('splashed');if(now>hornUntil)$('#horn').classList.remove('ringing');
 if(now>captionUntil)$('#street-caption').classList.remove('shown');
 if(now>toastUntil)$('#toast').classList.remove('shown');if(now>feedbackUntil)$('#impact').classList.remove('hit');
 $('#speed').textContent=String(Math.round(sim.speed*3.6));$('#score').textContent=String(sim.score).padStart(4,'0');drawTaka(dt);drawChips();if(boosting!==sim.effects.boost>0){boosting=!boosting;$('#hud').classList.toggle('boosting',boosting);}drawRace();drawHearts();
 $('#horn').style.setProperty('--cooldown',String(sim.hornCooldown>0?.55:1));$('#tutorial').classList.toggle('hidden',sim.elapsed>9||screen!=='playing');
 if(screen==='playing'&&(sim.status==='playing'||renderDirty||renderedSimulation!==sim||renderedStatus!==sim.status)){world?.render(sim,dt,steer);renderDirty=false;renderedSimulation=sim;renderedStatus=sim.status;}
 if(reviewMode&&world)$('#review-stats').textContent=JSON.stringify({...world.getStats(),status:sim.status,vehicle:VEHICLES[sim.vehicleIndex].id,stage:sim.stage.id,neighborhood:sim.neighborhood,nearMisses:sim.nearMisses,rearThreats:sim.rearThreats.length,projectiles:sim.projectiles.length,distance:Math.round(sim.distance),health:sim.health,x:Number(sim.x.toFixed(2)),speed:Number(sim.speed.toFixed(2)),activeActors:world.actors.size});
 requestAnimationFrame(frame);
}
if(reviewMode){
 const review=document.createElement('details');review.id='review-tools';review.innerHTML='<summary>Review scenes</summary><div id="review-scenes"></div><output id="review-stats"></output>';document.body.append(review);
 const scenes=[['Bicycle',0,0,0],['Rickshaw',1,0,0],['Motorbike',2,0,0],['Car',3,0,0],['Truck',4,0,0],['Bazaar',0,0,0],['Riverfront',0,0,230],['Boulevard',0,0,440],['Hard bicycle',0,2,0]] as const;
 for(const [name,index,mission,distance] of scenes){const b=document.createElement('button');b.textContent=name;b.onclick=()=>{selected=index;lesson=mission;void start();sim.distance=distance;sim.z=-distance;sim.remaining=sim.routeLength-distance;sim.speed=VEHICLES[index].maxSpeed;sim.elapsed=distance/13;sim.pause();lastDistrict=sim.neighborhood;announceDistrict();toastUntil=districtUntil=0;$('#toast').classList.remove('shown');$('#district-banner').classList.remove('visible');};$('#review-scenes').append(b);}
 for(const name of ['Cow encounter','Broken road','Paan encounter','Paan flight','Rear bus encounter']){const b=document.createElement('button');b.textContent=name;b.onclick=()=>{selected=0;lesson=1;void start();sim.traffic=[];sim.speed=8;if(name==='Cow encounter')sim.traffic.push({id:9001,kind:'cow',x:1.2,z:-8,speed:0,width:1.7,length:2.4,passed:false,warn:false});if(name==='Broken road')sim.traffic.push({id:9010,kind:'pothole',x:-.8,z:-8,speed:0,width:2,length:2.3,passed:false,warn:false});if(name==='Paan encounter'||name==='Paan flight'){sim.traffic.push({id:9003,kind:'pedestrian',behavior:'paan-thrower',x:5.75,z:-11,speed:0,width:.65,length:.65,passed:false,warn:true});}if(name==='Paan encounter'||name==='Paan flight')sim.projectiles.push({id:9002,sourceId:9003,phase:name==='Paan flight'?'flying':'telegraph',sourceX:5.8,sourceZ:-11,targetX:0,targetZ:-11,x:name==='Paan flight'?2.5:5.8,y:1.4,z:-11,radius:.8,progress:name==='Paan flight'?.5:0,remaining:2});if(name==='Rear bus encounter'){sim.traffic.push({id:9004,kind:'bus',x:0,z:30,speed:18,width:2.4,length:6.5,passed:false,warn:true,behavior:'rear-threat',phase:'warning',warningRemaining:3});sim.rearThreats.push({actorId:9004,kind:'bus',x:0,z:30,urgency:.4,timeToContact:3,warningRemaining:3,phase:'warning'});}sim.pause();toastUntil=districtUntil=0;$('#toast').classList.remove('shown');$('#district-banner').classList.remove('visible');};$('#review-scenes').append(b);}
 {const b=document.createElement('button');b.textContent='Street caption';b.onclick=()=>{audio.say('boatman-nouka');};$('#review-scenes').append(b);}
 for(const name of ['Street food','Coin magnet']){const b=document.createElement('button');b.textContent=name;b.onclick=()=>{selected=name==='Coin magnet'?1:0;lesson=0;void start();sim.traffic=[];sim.speed=6;let id=9100;const coin=(x:number,z:number,value:1|5)=>sim.coins.push({id:id++,group:1,x,y:.55,z,value,trail:'safe',collected:false});sim.coins=[];sim.snacks=[];for(let k=0;k<8;k++){coin(-1.6,-6-k*1.2,1);coin(1.8,-9-k*1.2,5);}if(name==='Street food')(['cha','jhalmuri','chaap'] as const).forEach((kind,i)=>sim.snacks.push({id:id++,kind,x:(i-1)*2.2,z:-7-i*.5,eaten:false}));sim.taka=48;Object.assign(sim.effects,name==='Street food'?{boost:3.4,magnet:5.6,belly:true,stomach:2.5}:{boost:0,magnet:5.6,belly:false,stomach:0});sim.pause();toastUntil=districtUntil=0;$('#toast').classList.remove('shown');$('#district-banner').classList.remove('visible');};$('#review-scenes').append(b);}
 // Mid-ride HUD states: [name, vehicle, mission, distance, elapsed, health, close shaves].
 const hudScenes=[['Ahead of gold',2,0,300,14,3,1],['Lost heart',0,1,230,26,2,1],['Behind gold',3,1,140,60,3,0],['Gold time gone',4,2,520,140,1,6],['HUD toast',1,0,90,8,3,2],['Rear bus + toast',0,1,180,20,2,0]] as const;
 for(const [name,index,mission,distance,elapsed,health,shaves] of hudScenes){const b=document.createElement('button');b.textContent=name;b.onclick=()=>{selected=index;lesson=mission;void start();sim.distance=distance;sim.z=-distance;sim.remaining=sim.routeLength-distance;sim.speed=VEHICLES[index].maxSpeed*.8;sim.elapsed=elapsed;sim.health=health;sim.nearMisses=shaves;sim.score=1240;sim.taka=86;lastDistrict=sim.neighborhood;$('#district-name').textContent=districts[sim.neighborhood].name;sim.pause();districtUntil=0;$('#district-banner').classList.remove('visible');toastUntil=0;$('#toast').classList.remove('shown');
  if(name.includes('toast')){toastPriority=0;showToast('এই, চা! গরম চা! · Hot tea, fresh from the kettle.');toastUntil=performance.now()+6e5;$('#combo').innerHTML='<small>বাঁচলাম!</small>Close shave ×2';$('#combo').classList.add('visible','close-shave');comboUntil=performance.now()+6e5;Object.assign(sim.effects,{boost:3.4,magnet:5.6});}
  if(name.startsWith('Rear')){sim.traffic.push({id:9004,kind:'bus',x:0,z:30,speed:18,width:2.4,length:6.5,passed:false,warn:true,behavior:'rear-threat',phase:'warning',warningRemaining:3});sim.rearThreats.push({actorId:9004,kind:'bus',x:0,z:30,urgency:.6,timeToContact:3,warningRemaining:3,phase:'warning'});toastPriority=0;showToast('Bus behind! Move out of its lane.',true);toastUntil=performance.now()+6e5;sim.resume();}};$('#review-scenes').append(b);}
 // Dev-only sound check: play each bank sound by itself to judge it by ear.
 const check=document.createElement('details');check.innerHTML='<summary>Sound check</summary>';for(const id of Object.keys(SOUNDS) as SoundId[]){const b=document.createElement('button');b.textContent=id;b.onclick=()=>{void audio.init().then(()=>audio.audition(id));};check.append(b);}$('#review-tools').append(check);
 const status=document.createElement('output');status.id='sound-check-status';check.append(status);let clock=0;const say=(t:string)=>{status.textContent=t;};
 const voices=document.createElement('p');voices.textContent='Voices:';check.append(voices);for(const line of VOICE_LINES){const b=document.createElement('button');b.textContent=`${line.bangla} (${line.id})`;b.onclick=()=>{void audio.init().then(()=>audio.auditionVoice(line.id)).then(ok=>say(ok?`Playing ${line.id}`:`${line.id}: no audio yet (caption only)`));};check.append(b);}
 const field=document.createElement('p');field.textContent='Street recording (38 s loop):';check.append(field);for(const from of [0,5,10,15,20,25,30,35]){const b=document.createElement('button');b.textContent=`from ${from}s`;b.onclick=()=>{void audio.init().then(()=>{const t0=performance.now();if(!audio.auditionField(from)){say('Recording not loaded yet — tap again in a moment');return;}clearInterval(clock);clock=window.setInterval(()=>say(`Street recording at ${(from+(performance.now()-t0)/1000).toFixed(1)} s`),100);});};check.append(b);}
 const stop=document.createElement('button');stop.textContent='Stop';stop.onclick=()=>{clearInterval(clock);audio.stopAudition();say('Stopped');};check.append(stop);
 for(const outcome of ['won','lost'] as const){const b=document.createElement('button');b.textContent=`Test ${outcome}`;b.onclick=()=>{if(screen!=='playing')void start();sim.status=outcome;sim.stars=outcome==='won'?2:0;sim.speed=0;ending=false;finish();};$('#review-scenes').append(b);}
}
drawGarage();updateSound();requestAnimationFrame(()=>{
 try{world=new World($('#game'));world.setQuality(save.quality);world.setReduced(save.reduced);requestAnimationFrame(frame);}
 catch(error){console.error(error);$('#start').setAttribute('disabled','');$('.intro').textContent='This browser could not start 3D graphics. Try opening the game in Safari or Chrome with WebGL2 enabled.';$('#start').textContent='3D graphics unavailable';}
});
