// ===================================
// RETRO ARCADE - UPGRADED GAME ENGINE
// Steering wheel • Analog gauges • Sound • Nitro
// ===================================
const $ = id => document.getElementById(id);

function openGame(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  if ($(name)) $(name).classList.add("active");
  if (name !== "race") stopRace();
}

function goHome() {
  stopRace();
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  if ($("home")) $("home").classList.add("active");
}

const canvas = $("gameCanvas");
if (!canvas) throw new Error("Could not find #gameCanvas. Check that your racing canvas has id='gameCanvas'.");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

let running=false, paused=false, animation=0, lastTime=0;
let score=0, coins=0, speed=0, nitro=100, nitroActive=false;
let roadOffset=0, spawnTimer=0, coinTimer=0, enemies=[], pickups=[];
let rpm=900, wheelAngle=0, steeringPointer=false, steerKeys={left:false,right:false};
let soundOn=true, audioCtx=null, engineOsc=null, engineGain=null, engineFilter=null;
let nitroTimeout=null;

const player={x:W/2-22,y:H-130,w:44,h:75,steer:0};
let best=Number(localStorage.getItem("retroBest")||0);
if ($("best")) $("best").textContent=best;

// Add dashboard and controls automatically
(function addRacingControls(){
  const host=canvas.parentElement;
  if (!host || $("raceUpgradePanel")) return;

  const panel=document.createElement("div");
  panel.id="raceUpgradePanel";
  panel.innerHTML=`
    <div class="rg-gauges">
      <div class="rg-gauge">
        <div class="rg-label">SPEED</div>
        <div class="rg-dial" id="rgSpeedDial">
          <div class="rg-needle" id="rgSpeedNeedle"></div>
          <div class="rg-hub"></div>
          <div class="rg-readout"><b id="rgSpeedValue">0</b><small>KM/H</small></div>
        </div>
        <div class="rg-scale">0　60　120　180　240　300</div>
      </div>
      <div class="rg-gauge">
        <div class="rg-label">ENGINE RPM</div>
        <div class="rg-dial rg-rpm" id="rgRpmDial">
          <div class="rg-needle" id="rgRpmNeedle"></div>
          <div class="rg-hub"></div>
          <div class="rg-readout"><b id="rgRpmValue">0.9</b><small>x1000 RPM</small></div>
        </div>
        <div class="rg-scale">0　2　4　6　8　10</div>
      </div>
    </div>
    <div class="rg-control-row">
      <div class="rg-wheel-area">
        <div class="rg-label">STEERING</div>
        <div class="rg-wheel" id="rgWheel" role="slider" aria-label="Steering wheel" aria-valuemin="-100" aria-valuemax="100" aria-valuenow="0">
          <div class="rg-wheel-ring"></div>
          <div class="rg-wheel-spoke rg-spoke-a"></div>
          <div class="rg-wheel-spoke rg-spoke-b"></div>
          <div class="rg-wheel-spoke rg-spoke-c"></div>
          <div class="rg-wheel-center">R</div>
        </div>
        <div class="rg-hint">Drag wheel left / right</div>
      </div>
      <div class="rg-buttons">
        <button id="rgLeft" type="button">◀ LEFT</button>
        <button id="rgRight" type="button">RIGHT ▶</button>
        <button id="rgBrake" type="button">▰ BRAKE</button>
        <button id="rgSound" type="button">🔊 SOUND ON</button>
      </div>
    </div>`;

  host.appendChild(panel);

  const style=document.createElement("style");
  style.textContent=`
  #raceUpgradePanel{width:min(100%,760px);margin:14px auto 20px;padding:14px;box-sizing:border-box;background:linear-gradient(145deg,#101629,#080d18);border:1px solid #263b5b;border-radius:18px;color:#eafaff;font-family:Arial,sans-serif;box-shadow:0 10px 35px #0008}
  .rg-gauges{display:flex;justify-content:center;gap:28px;flex-wrap:wrap}
  .rg-gauge{width:190px;text-align:center}
  .rg-label{font-size:12px;letter-spacing:3px;color:#6deaff;font-weight:900;margin:5px 0 8px}
  .rg-dial{width:160px;height:160px;margin:auto;position:relative;border-radius:50%;background:radial-gradient(circle at center,#18253b 0 52%,#080d19 53% 67%,#00cfff 68% 70%,#27354b 71% 100%);border:4px solid #263b58;box-shadow:inset 0 0 20px #000,0 0 16px #00cfff44}
  .rg-rpm{background:radial-gradient(circle at center,#18253b 0 52%,#080d19 53% 67%,#ff9c36 68% 70%,#27354b 71% 100%)}
  .rg-needle{position:absolute;width:4px;height:62px;background:#ff526d;left:calc(50% - 2px);top:17px;transform-origin:50% 63px;transform:rotate(-135deg);border-radius:5px;box-shadow:0 0 8px #ff526d;z-index:2}
  .rg-rpm .rg-needle{background:#ffc05a;box-shadow:0 0 8px #ffc05a}
  .rg-hub{position:absolute;left:calc(50% - 8px);top:calc(50% - 8px);width:16px;height:16px;background:#dcefff;border:3px solid #344c6a;border-radius:50%;z-index:3}
  .rg-readout{position:absolute;top:91px;left:0;width:100%;display:flex;flex-direction:column;align-items:center}
  .rg-readout b{font-size:22px;color:white}
  .rg-readout small{font-size:9px;color:#a9c4d9;letter-spacing:1px}
  .rg-scale{font-size:9px;color:#8ba6bd;margin-top:5px}
  .rg-control-row{display:flex;justify-content:space-around;align-items:center;gap:20px;flex-wrap:wrap;margin-top:16px;padding-top:14px;border-top:1px solid #263b58}
  .rg-wheel-area{text-align:center}
  .rg-wheel{width:132px;height:132px;position:relative;margin:auto;border:11px solid #53677c;border-radius:50%;background:radial-gradient(circle,#101a2a 0 25%,#273b51 26% 35%,#101722 36%);box-shadow:inset 0 0 12px #000,0 0 12px #00d9ff55;touch-action:none;cursor:grab;transform:rotate(0deg)}
  .rg-wheel:active{cursor:grabbing}
  .rg-wheel-ring{position:absolute;inset:8px;border:7px solid #b4c6d5;border-radius:50%;pointer-events:none}
  .rg-wheel-spoke{position:absolute;background:linear-gradient(90deg,#52677c,#d0dce5,#52677c);border-radius:5px;pointer-events:none}
  .rg-spoke-a{width:9px;height:48px;left:calc(50% - 4px);top:9px}
  .rg-spoke-b{width:47px;height:9px;left:10px;top:62px;transform:rotate(22deg)}
  .rg-spoke-c{width:47px;height:9px;right:10px;top:62px;transform:rotate(-22deg)}
  .rg-wheel-center{position:absolute;left:calc(50% - 19px);top:calc(50% - 19px);width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#00d9ff,#1265a4);font-weight:1000;color:#07101d;border:3px solid #c2eaff;pointer-events:none}
  .rg-hint{font-size:10px;color:#91a8bb;margin-top:8px}
  .rg-buttons{display:grid;grid-template-columns:repeat(2,minmax(105px,1fr));gap:9px}
  .rg-buttons button{border:1px solid #42617c;border-radius:10px;padding:12px 10px;color:#eaffff;background:linear-gradient(145deg,#1c3854,#101b2d);font-weight:900;letter-spacing:1px;cursor:pointer;touch-action:none}
  .rg-buttons button:active{background:#087eaa;transform:scale(.97)}
  #rgBrake{background:linear-gradient(145deg,#78303d,#351923)}
  #rgSound{background:linear-gradient(145deg,#275b58,#142d32)}
  @media(max-width:420px){.rg-gauge{width:145px}.rg-dial{width:135px;height:135px}.rg-needle{height:51px;transform-origin:50% 52px}.rg-readout{top:77px}.rg-wheel{width:115px;height:115px}.rg-buttons{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(style);
})();

// SOUND EFFECTS
function initAudio(){
  if(!soundOn)return;
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return;

  if(!audioCtx){
    audioCtx=new AC();
    engineOsc=audioCtx.createOscillator();
    engineOsc.type="sawtooth";
    engineFilter=audioCtx.createBiquadFilter();
    engineFilter.type="lowpass";
    engineFilter.frequency.value=420;
    engineGain=audioCtx.createGain();
    engineGain.gain.value=0;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(audioCtx.destination);
    engineOsc.start();
  }

  if(audioCtx.state==="suspended")audioCtx.resume();
}

function tone(freq=440,duration=.12,type="sine",volume=.08,slide=0){
  if(!soundOn)return;
  initAudio();
  if(!audioCtx)return;

  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.type=type;
  o.frequency.setValueAtTime(freq,audioCtx.currentTime);

  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),audioCtx.currentTime+duration);

  g.gain.setValueAtTime(volume,audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime+duration);
}

function noiseSound(duration=.18,volume=.06){
  if(!soundOn)return;
  initAudio();
  if(!audioCtx)return;

  const n=Math.floor(audioCtx.sampleRate*duration);
  const buffer=audioCtx.createBuffer(1,n,audioCtx.sampleRate);
  const data=buffer.getChannelData(0);

  for(let i=0;i<n;i++)data[i]=(Math.random()*2-1)*(1-i/n);

  const src=audioCtx.createBufferSource(),g=audioCtx.createGain();
  src.buffer=buffer;
  g.gain.value=volume;
  src.connect(g);
  g.connect(audioCtx.destination);
  src.start();
}

function updateEngineSound(){
  if(!audioCtx||!engineOsc||!engineGain)return;

  const target=running&&!paused&&soundOn?(.018+speed/300*.055):0;
  engineGain.gain.setTargetAtTime(target,audioCtx.currentTime,.08);
  engineOsc.frequency.setTargetAtTime(42+rpm*0.055,audioCtx.currentTime,.06);
  engineFilter.frequency.setTargetAtTime(180+rpm*.16,audioCtx.currentTime,.08);
}

function playCoin(){
  tone(880,.08,"sine",.08,260);
  setTimeout(()=>tone(1320,.1,"sine",.06,120),65);
}

function playCrash(){
  noiseSound(.32,.12);
  tone(110,.28,"sawtooth",.1,-65);
}

function playNitro(){
  tone(150,.35,"sawtooth",.08,650);
  noiseSound(.25,.04);
}

function toggleSound(){
  soundOn=!soundOn;
  const b=$("rgSound");
  if(b)b.textContent=soundOn?"🔊 SOUND ON":"🔇 SOUND OFF";

  if(!soundOn&&engineGain&&audioCtx)engineGain.gain.setTargetAtTime(0,audioCtx.currentTime,.04);
  if(soundOn)initAudio();
}

// CAR GRAPHICS
function drawCar(x,y,color,isPlayer=false){
  ctx.save();
  ctx.translate(x,y);

  ctx.fillStyle="#0009";
  ctx.beginPath();
  ctx.ellipse(22,39,26,39,0,0,Math.PI*2);
  ctx.fill();

  ctx.fillStyle="#05070d";
  ctx.fillRect(1,12,9,18);
  ctx.fillRect(34,12,9,18);
  ctx.fillRect(1,49,9,18);
  ctx.fillRect(34,49,9,18);

  ctx.fillStyle="#657487";
  ctx.fillRect(3,16,5,9);
  ctx.fillRect(36,16,5,9);
  ctx.fillRect(3,53,5,9);
  ctx.fillRect(36,53,5,9);

  ctx.fillStyle=color;
  ctx.beginPath();
  ctx.moveTo(12,3);
  ctx.lineTo(32,3);
  ctx.lineTo(40,17);
  ctx.lineTo(39,58);
  ctx.lineTo(33,72);
  ctx.lineTo(11,72);
  ctx.lineTo(5,58);
  ctx.lineTo(4,17);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle="#ffffff35";
  ctx.fillRect(10,9,24,12);
  ctx.fillStyle="#0a1729";
  ctx.fillRect(10,23,24,19);
  ctx.fillStyle="#253b55";
  ctx.fillRect(12,25,20,14);
  ctx.fillStyle="#ffffff20";
  ctx.fillRect(14,26,4,11);
  ctx.fillStyle="#101522";
  ctx.fillRect(10,47,24,14);

  ctx.fillStyle=isPlayer?"#bdfaff":"#ff304c";
  ctx.fillRect(7,5,9,5);
  ctx.fillRect(28,5,9,5);

  ctx.fillStyle="#ff304c";
  ctx.fillRect(8,62,8,5);
  ctx.fillRect(28,62,8,5);

  if(isPlayer){
    ctx.shadowColor="#00eaff";
    ctx.shadowBlur=18;
    ctx.fillStyle="#a8fbff";
    ctx.fillRect(18,69,8,5);
    ctx.fillStyle="#fff";
    ctx.fillRect(9,4,6,3);
    ctx.fillRect(29,4,6,3);
  }

  ctx.restore();
}

// ROAD GRAPHICS
function drawRoad(){
  ctx.fillStyle="#07151b";
  ctx.fillRect(0,0,W,H);

  ctx.fillStyle="#10291d";
  ctx.fillRect(0,0,62,H);
  ctx.fillRect(W-62,0,62,H);

  for(let i=0;i<50;i++){
    const y=(i*29+roadOffset*1.8)%H;
    ctx.fillStyle=i%2?"#1b3d28":"#0b211b";
    ctx.fillRect(5+(i*17)%48,y,3,8);
    ctx.fillRect(W-55+(i*13)%45,y,3,8);
  }

  ctx.fillStyle="#242633";
  ctx.fillRect(62,0,W-124,H);

  for(let i=0;i<75;i++){
    const x=70+(i*47)%(W-140);
    const y=(i*61+roadOffset*1.4)%H;
    ctx.fillStyle=i%2?"#ffffff0b":"#00000018";
    ctx.fillRect(x,y,2,5);
  }

  ctx.fillStyle="#e9f5ff";
  ctx.fillRect(62,0,5,H);
  ctx.fillRect(W-67,0,5,H);

  for(let y=-40;y<H+40;y+=40){
    const py=(y+roadOffset)%(H+40)-20;
    ctx.fillStyle="#ff32bd";
    ctx.fillRect(48,py,9,22);
    ctx.fillStyle="#00f5ff";
    ctx.fillRect(W-57,py,9,22);
  }

  ctx.strokeStyle="#ffffff88";
  ctx.lineWidth=4;
  ctx.setLineDash([30,35]);
  ctx.lineDashOffset=-roadOffset;
  ctx.beginPath();
  ctx.moveTo(W/2,0);
  ctx.lineTo(W/2,H);
  ctx.stroke();
  ctx.setLineDash([]);

  for(let y=0;y<H;y+=90){
    const py=(y+roadOffset*1.2)%H;
    ctx.fillStyle="#b8f7ff";
    ctx.fillRect(72,py,4,13);
    ctx.fillRect(W-76,py,4,13);
  }
}

// GAUGES
function updateGauges(){
  const sv=Math.round(speed);
  const rv=(rpm/1000).toFixed(1);

  if($("rgSpeedValue"))$("rgSpeedValue").textContent=sv;
  if($("rgRpmValue"))$("rgRpmValue").textContent=rv;

  if($("rgSpeedNeedle"))$("rgSpeedNeedle").style.transform=`rotate(${-135+Math.min(300,sv)/300*270}deg)`;
  if($("rgRpmNeedle"))$("rgRpmNeedle").style.transform=`rotate(${-135+Math.min(10000,rpm)/10000*270}deg)`;
  if($("rgWheel"))$("rgWheel").style.transform=`rotate(${wheelAngle}deg)`;
}

// GAME UPDATE
function updateRace(dt){
  const frame=Math.min(dt/16.67,2);
  const boosting=nitroActive&&nitro>0;
  const braking=!!window.rgBraking;

  const targetSpeed=braking?55:(boosting?285:190);
  speed+=(targetSpeed-speed)*Math.min(1,.035*frame);

  if(boosting)nitro=Math.max(0,nitro-.48*frame);
  else nitro=Math.min(100,nitro+.12*frame);

  rpm=850+(speed/300)*8200+(boosting?500:0);
  rpm=Math.min(10000,rpm);

  roadOffset=(roadOffset+speed*frame*.12)%75;

  player.x+=player.steer*(4.8+speed/100)*frame;
  player.x=Math.max(73,Math.min(W-117,player.x));

  wheelAngle=player.steer===0?wheelAngle*.82:Math.max(-135,Math.min(135,wheelAngle+player.steer*5*frame));
  if(Math.abs(wheelAngle)<1)wheelAngle=0;

  score+=Math.floor(speed*frame/160);
  spawnTimer+=dt;
  coinTimer+=dt;

  if(spawnTimer>Math.max(650,1350-speed*2.2)){
    spawnTimer=0;
    const lanes=[105,200,295];
    const lane=lanes[Math.floor(Math.random()*lanes.length)];
    enemies.push({
      x:lane,y:-90,w:44,h:75,
      color:["#ff315b","#ffb52e","#a56aff","#37e69a"][Math.floor(Math.random()*4)]
    });
  }

  if(coinTimer>1250){
    coinTimer=0;
    pickups.push({x:105+Math.random()*245,y:-25});
  }

  enemies.forEach(e=>e.y+=speed*frame*.055);
  pickups.forEach(c=>c.y+=speed*frame*.055);

  enemies=enemies.filter(e=>e.y<H+100);
  pickups=pickups.filter(c=>c.y<H+50);

  for(const e of enemies){
    if(
      player.x+8<e.x+e.w-8 &&
      player.x+player.w-8>e.x+8 &&
      player.y+8<e.y+e.h-8 &&
      player.y+player.h-8>e.y+8
    ){
      endRace();
      return;
    }
  }

  pickups=pickups.filter(c=>{
    if(Math.hypot(player.x+22-c.x,player.y+35-c.y)<37){
      coins++;
      score+=100;
      playCoin();
      return false;
    }
    return true;
  });

  if($("score"))$("score").textContent=String(score).padStart(6,"0");
  if($("coins"))$("coins").textContent=coins;
  if($("speed"))$("speed").textContent=Math.floor(speed)+" KM/H";
  if($("nitroFill"))$("nitroFill").style.width=nitro+"%";

  updateGauges();
  updateEngineSound();
}

// DRAW GAME
function drawRace(){
  drawRoad();

  pickups.forEach(c=>{
    ctx.save();
    ctx.fillStyle="#ffd83d";
    ctx.shadowColor="#ffd83d";
    ctx.shadowBlur=18;
    ctx.beginPath();
    ctx.arc(c.x,c.y,12,0,Math.PI*2);
    ctx.fill();
    ctx.strokeStyle="#fff5a0";
    ctx.lineWidth=3;
    ctx.stroke();
    ctx.restore();
  });

  enemies.forEach(e=>drawCar(e.x,e.y,e.color));

  if(nitroActive&&nitro>0&&running){
    ctx.save();
    ctx.shadowColor="#00eaff";
    ctx.shadowBlur=20;
    ctx.fillStyle="#00eaff";

    ctx.beginPath();
    ctx.moveTo(player.x+13,player.y+68);
    ctx.lineTo(player.x+17,player.y+100+Math.random()*15);
    ctx.lineTo(player.x+21,player.y+68);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(player.x+26,player.y+68);
    ctx.lineTo(player.x+30,player.y+100+Math.random()*15);
    ctx.lineTo(player.x+34,player.y+68);
    ctx.fill();

    ctx.restore();
  }

  drawCar(player.x,player.y,"#00bde9",true);
}

function raceLoop(time){
  if(!running||paused)return;

  const dt=lastTime?Math.min(time-lastTime,40):16;
  lastTime=time;

  updateRace(dt);
  if(!running)return;

  drawRace();
  animation=requestAnimationFrame(raceLoop);
}

// START RACE
function startRace(){
  cancelAnimationFrame(animation);
  initAudio();

  running=true;
  paused=false;
  score=0;
  coins=0;
  speed=0;
  nitro=100;
  nitroActive=false;
  window.rgBraking=false;

  roadOffset=0;
  spawnTimer=0;
  coinTimer=0;
  enemies=[];
  pickups=[];

  player.x=W/2-22;
  player.steer=0;
  wheelAngle=0;
  lastTime=0;

  if($("raceOverlay"))$("raceOverlay").classList.add("hidden");
  if($("score"))$("score").textContent="000000";
  if($("coins"))$("coins").textContent="0";
  if($("speed"))$("speed").textContent="0 KM/H";

  updateGauges();
  drawRace();
  tone(180,.25,"sawtooth",.08,240);

  animation=requestAnimationFrame(raceLoop);
}

function stopRace(){
  running=false;
  paused=false;
  nitroActive=false;
  window.rgBraking=false;
  cancelAnimationFrame(animation);

  if(engineGain&&audioCtx)engineGain.gain.setTargetAtTime(0,audioCtx.currentTime,.05);
}

function pauseRace(){
  if(!running)return;
  paused=!paused;

  if(paused){
    cancelAnimationFrame(animation);

    if($("raceOverlay")){
      $("raceOverlay").classList.remove("hidden");
      $("raceOverlay").innerHTML='<div class="overlay-box"><div class="big-icon">Ⅱ</div><h2>PAUSED</h2><button class="primary-btn" onclick="pauseRace()">RESUME</button></div>';
    }

    if(engineGain&&audioCtx)engineGain.gain.setTargetAtTime(0,audioCtx.currentTime,.05);
  }else{
    if($("raceOverlay"))$("raceOverlay").classList.add("hidden");
    lastTime=0;
    initAudio();
    animation=requestAnimationFrame(raceLoop);
  }
}

function endRace(){
  stopRace();
  playCrash();

  if(score>best){
    best=score;
    localStorage.setItem("retroBest",best);
  }

  if($("best"))$("best").textContent=best;

  if($("raceOverlay")){
    $("raceOverlay").classList.remove("hidden");
    $("raceOverlay").innerHTML=`<div class="overlay-box"><div class="big-icon">🏁</div><h2>RACE OVER!</h2><p>Score: ${score} • Coins: ${coins}</p><button class="primary-btn" onclick="startRace()">RACE AGAIN</button></div>`;
  }
}

function useNitro(){
  if(running&&!paused&&nitro>0){
    nitroActive=true;
    playNitro();

    if($("nitroButton"))$("nitroButton").textContent="⚡ BOOSTING!";

    clearTimeout(nitroTimeout);
    nitroTimeout=setTimeout(()=>{
      nitroActive=false;
      if($("nitroButton"))$("nitroButton").textContent="⚡ NITRO";
    },1400);
  }
}

function setSteer(value){
  player.steer=value;
}

function setButtonHold(id,down,fn){
  const b=$(id);
  if(!b)return;

  b.addEventListener("pointerdown",e=>{
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    fn(down);
  });

  ["pointerup","pointercancel","lostpointercapture"].forEach(ev=>{
    b.addEventListener(ev,()=>fn(0));
  });
}

// STEERING AND BRAKE BUTTONS
setButtonHold("rgLeft",-1,v=>{
  steerKeys.left=!!v;
  setSteer(v||(steerKeys.right?1:0));
});

setButtonHold("rgRight",1,v=>{
  steerKeys.right=!!v;
  setSteer(v||(steerKeys.left?-1:0));
});

setButtonHold("rgBrake",1,v=>{
  window.rgBraking=!!v;
  if(v)tone(240,.08,"triangle",.035,-80);
});

if($("rgSound"))$("rgSound").addEventListener("click",toggleSound);

// DRAGGABLE STEERING WHEEL
if($("rgWheel")){
  const wheel=$("rgWheel");

  const steerFromPointer=e=>{
    const r=wheel.getBoundingClientRect();
    const center=r.left+r.width/2;
    const delta=(e.clientX-center)/(r.width/2);

    setSteer(Math.max(-1,Math.min(1,delta)));
    wheelAngle=player.steer*125;
    wheel.style.transform=`rotate(${wheelAngle}deg)`;
    wheel.setAttribute("aria-valuenow",Math.round(player.steer*100));
  };

  wheel.addEventListener("pointerdown",e=>{
    steeringPointer=true;
    wheel.setPointerCapture(e.pointerId);
    steerFromPointer(e);
  });

  wheel.addEventListener("pointermove",e=>{
    if(steeringPointer)steerFromPointer(e);
  });

  const release=()=>{
    steeringPointer=false;
    setSteer(0);
  };

  wheel.addEventListener("pointerup",release);
  wheel.addEventListener("pointercancel",release);
  wheel.addEventListener("lostpointercapture",release);
}

// KEYBOARD CONTROLS
document.addEventListener("keydown",e=>{
  if(e.key==="ArrowLeft"||e.key.toLowerCase()==="a"){
    steerKeys.left=true;
    setSteer(-1);
    e.preventDefault();
  }

  if(e.key==="ArrowRight"||e.key.toLowerCase()==="d"){
    steerKeys.right=true;
    setSteer(1);
    e.preventDefault();
  }

  if(e.code==="Space"){
    e.preventDefault();
    useNitro();
  }

  if(e.key.toLowerCase()==="p")pauseRace();
});

document.addEventListener("keyup",e=>{
  if(e.key==="ArrowLeft"||e.key.toLowerCase()==="a")steerKeys.left=false;
  if(e.key==="ArrowRight"||e.key.toLowerCase()==="d")steerKeys.right=false;

  if(["ArrowLeft","ArrowRight","a","d","A","D"].includes(e.key)){
    setSteer(steerKeys.left?-1:(steerKeys.right?1:0));
  }
});

document.addEventListener("visibilitychange",()=>{
  if(document.hidden&&running&&!paused)pauseRace();
});

// ===================================
// QUIZ MASTER
// ===================================
const questions = [
  {
    q: "Which planet is known as the Red Planet?",
    a: ["Earth", "Mars", "Venus", "Jupiter"],
    correct: 1
  },
  {
    q: "What is the largest ocean?",
    a: ["Atlantic", "Indian", "Pacific", "Arctic"],
    correct: 2
  },
  {
    q: "How many sides does a hexagon have?",
    a: ["Five", "Six", "Seven", "Eight"],
    correct: 1
  },
  {
    q: "Which gas do plants absorb?",
    a: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"],
    correct: 2
  },
  {
    q: "What is the capital of Japan?",
    a: ["Seoul", "Tokyo", "Beijing", "Bangkok"],
    correct: 1
  },
  {
    q: "Which is the fastest land animal?",
    a: ["Lion", "Tiger", "Cheetah", "Horse"],
    correct: 2
  },
  {
    q: "How many continents are there?",
    a: ["Five", "Six", "Seven", "Eight"],
    correct: 2
  },
  {
    q: "Which organ pumps blood?",
    a: ["Lungs", "Heart", "Brain", "Kidney"],
    correct: 1
  },
  {
    q: "What is 12 × 8?",
    a: ["84", "92", "96", "108"],
    correct: 2
  },
  {
    q: "Which is the biggest planet?",
    a: ["Saturn", "Earth", "Jupiter", "Neptune"],
    correct: 2
  }
];

let quizIndex = 0;
let quizPoints = 0;
let quizClock = 15;
let quizInterval = null;
let quizLocked = false;

function startQuiz(){
  clearInterval(quizInterval);
  quizIndex=0;
  quizPoints=0;
  quizLocked=false;

  $("quizContent").innerHTML='<div class="quiz-emoji">🚀</div><h2>LET\'S PLAY!</h2><p>Choose the correct answer.</p>';
  showQuestion();
}

function showQuestion(){
  clearInterval(quizInterval);

  if(quizIndex>=questions.length){
    finishQuiz();
    return;
  }

  quizLocked=false;
  quizClock=15;

  const item=questions[quizIndex];

  $("quizLevel").textContent="LEVEL "+String(quizIndex+1).padStart(2,"0");
  $("quizTimer").textContent="TIME: "+quizClock;
  $("quizScore").textContent="SCORE: "+quizPoints;
  $("quizCount").textContent="QUESTION: "+(quizIndex+1)+" / "+questions.length;
  $("quizProgress").style.width=(quizIndex/questions.length*100)+"%";

  $("quizContent").innerHTML=`<h2>${item.q}</h2><p>Choose one answer below.</p>`;
  $("quizAnswers").innerHTML="";

  item.a.forEach((answer,index)=>{
    const button=document.createElement("button");
    button.className="answer-btn";
    button.textContent=String.fromCharCode(65+index)+". "+answer;
    button.onclick=()=>chooseAnswer(index,button);
    $("quizAnswers").appendChild(button);
  });

  quizInterval=setInterval(()=>{
    quizClock--;
    $("quizTimer").textContent="TIME: "+quizClock;

    if(quizClock<=0){
      clearInterval(quizInterval);
      quizLocked=true;
      showCorrectAnswer();
      setTimeout(nextQuestion,1100);
    }
  },1000);
}

function chooseAnswer(index,button){
  if(quizLocked)return;

  quizLocked=true;
  clearInterval(quizInterval);

  const item=questions[quizIndex];
  const buttons=[...$("quizAnswers").children];

  if(index===item.correct){
    quizPoints+=10;
    button.classList.add("correct");
    $("quizContent").innerHTML='<div class="quiz-emoji">🎉</div><h2>CORRECT!</h2><p>+10 POINTS</p>';
  }else{
    button.classList.add("wrong");
    buttons[item.correct].classList.add("correct");
    $("quizContent").innerHTML='<div class="quiz-emoji">💡</div><h2>NOT QUITE!</h2><p>Keep learning!</p>';
  }

  buttons.forEach(b=>b.disabled=true);
  $("quizScore").textContent="SCORE: "+quizPoints;

  setTimeout(nextQuestion,1100);
}

function showCorrectAnswer(){
  const item=questions[quizIndex];
  const buttons=[...$("quizAnswers").children];

  buttons.forEach((b,i)=>{
    b.disabled=true;
    if(i===item.correct)b.classList.add("correct");
  });

  $("quizContent").innerHTML='<div class="quiz-emoji">⏰</div><h2>TIME UP!</h2><p>Try the next question!</p>';
}

function nextQuestion(){
  quizIndex++;
  showQuestion();
}

function finishQuiz(){
  clearInterval(quizInterval);

  $("quizProgress").style.width="100%";
  $("quizTimer").textContent="FINISHED";
  $("quizCount").textContent=questions.length+" / "+questions.length;
  $("quizScore").textContent="SCORE: "+quizPoints;

  $("quizContent").innerHTML=
    `<div class="quiz-emoji">🏆</div>
     <h2>QUIZ COMPLETED!</h2>
     <p>You scored ${quizPoints} out of ${questions.length*10} points.</p>
     <button class="primary-btn" onclick="startQuiz()">PLAY AGAIN</button>`;

  $("quizAnswers").innerHTML="";
}

// INITIAL DISPLAY
drawRoad();
drawCar(player.x,player.y,"#00bde9",true);
