/* ======================================================================
   URANO — ANIMA MUNDI (Ouranos)
   CONSTELLATIONS, NAMED_STARS e SYMBOL_CATALOG vêm de ouranos-data.js
   Cálculo (efemérides, projeção, Mapa Astral em SVG) vem de ouranos-calc.js (window.OuranosCalc);
   este arquivo guarda o estado, o canvas, a legenda, os controles e a API Ouranos.
   ====================================================================== */
const Ouranos = (function () {
const W = 700, H = 560, CX2 = 350, CY2 = 280;
const { D2R, ZODIAC, INNER_RINGS, OUTER_RINGS, OUTER_SCALE, PLANETS_DEF, ha, matMul, rotX, rotY, applyMat, proj, raDecXYZ, magR, magO, getRingPts, computePositions, phaseName, zodiacPos, eclXYZ, KEYS, SYMF, esc, zText, dd, sgn, fmtH, computeAstral, buildAstralSVG } = window.OuranosCalc;   /* cálculo: ver ouranos-calc.js */
const START=new Date();
const pos0=computePositions(START);
const state={
  aX:20*Math.PI/180,aY:30*Math.PI/180,zoom:155,autoRotate:true,
  viewMode:'both',simSpeed:1,
  planets:PLANETS_DEF.map((p,i)=>({...p,lon:pos0[KEYS[i]]})),
  elongation:pos0.elongation,simDays:0,ephDate:new Date(START),
  snap:false,snapPlanets:null,snapElongation:null,
  active:false,projStars:[],projPlanets:[],hovering:false,
};

const canvas=document.getElementById('ou-canvas');
const ctx=canvas.getContext('2d');
const infoBar=document.getElementById('ou-info-bar');
const legendEl=document.getElementById('ou-legend');
const snapBanner=document.getElementById('ou-snapshot-banner');
const snapLabel=document.getElementById('ou-snap-time');
const snapBtn=document.getElementById('ou-snap-btn');
const pauseBtn=document.getElementById('ou-pause-btn');
const zoomSlider=document.getElementById('ou-zoom');
/* movimento reduzido: a esfera não gira sozinha (a pessoa pode retomar no botão) */
const mqReduzido=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
const reduzido=()=>!!(mqReduzido&&mqReduzido.matches);
function aplicaReduzido(){if(reduzido()){state.autoRotate=false;pauseBtn.textContent='▶ Retomar';}}
aplicaReduzido();
if(mqReduzido&&mqReduzido.addEventListener)mqReduzido.addEventListener('change',aplicaReduzido);

function planetInfo(p){
  const z=zodiacPos(p.lon);
  const extra = p.index===0 ? ` · ${phaseName(state.snap?state.snapElongation:state.elongation)}` : '';
  return `${p.sym} ${p.name} — ${z.text}${extra}`;
}
function defaultInfo(){
  const elong=state.snap?state.snapElongation:state.elongation;
  const ilum=Math.round((1-Math.cos(elong*D2R))/2*100);
  return `✨ ${NAMED_STARS.length} estrelas nomeadas visíveis · Lua: ${phaseName(elong)} (${ilum}% iluminada)`;
}

function drawZodiacSeg(upper,lower,sign,front){
  if(upper.length<2)return;
  ctx.beginPath();ctx.moveTo(upper[0].x,upper[0].y);for(let j=1;j<upper.length;j++)ctx.lineTo(upper[j].x,upper[j].y);for(let j=lower.length-1;j>=0;j--)ctx.lineTo(lower[j].x,lower[j].y);ctx.closePath();ctx.fillStyle=ha(sign.col,front?.18:.06);ctx.fill();
  ctx.beginPath();ctx.moveTo(upper[0].x,upper[0].y);for(let j=1;j<upper.length;j++)ctx.lineTo(upper[j].x,upper[j].y);ctx.strokeStyle=ha(sign.col,front?.45:.12);ctx.lineWidth=front?1.2:.6;if(!front)ctx.setLineDash([3,3]);ctx.stroke();ctx.setLineDash([]);
  ctx.beginPath();ctx.moveTo(lower[0].x,lower[0].y);for(let j=1;j<lower.length;j++)ctx.lineTo(lower[j].x,lower[j].y);ctx.strokeStyle=ha(sign.col,front?.45:.12);ctx.lineWidth=front?1.2:.6;if(!front)ctx.setLineDash([3,3]);ctx.stroke();ctx.setLineDash([]);
}
function drawZodiacBand(timeu){
  const eclT=23.5*Math.PI/180,cosT=Math.cos(eclT),sinT=Math.sin(eclT),bHW=8;
  for(let si=0;si<ZODIAC.length;si++){
    const sign=ZODIAC[si],sD=sign.sd,eD=sD+30,N=30;
    const uPts=[],lPts=[],mPts=[];
    for(let i=0;i<=N;i++){const deg=sD+(eD-sD)*i/N,a=deg*Math.PI/180,cx3=Math.cos(a),cz3=Math.sin(a);
      mPts.push(proj([cx3,cz3*sinT,cz3*cosT],state.aX,state.aY,state.zoom,CX2,CY2));
      const off=bHW/state.zoom;
      uPts.push(proj([cx3,cz3*sinT+cosT*off,cz3*cosT+(-sinT)*off],state.aX,state.aY,state.zoom,CX2,CY2));
      lPts.push(proj([cx3,cz3*sinT-cosT*off,cz3*cosT-(-sinT)*off],state.aX,state.aY,state.zoom,CX2,CY2));}
    for(let pass=0;pass<2;pass++){const front=pass===1,su=[],sl=[];for(let i=0;i<=N;i++){if(front?mPts[i].z>=0:mPts[i].z<0){su.push(uPts[i]);sl.push(lPts[i]);}else{drawZodiacSeg(su,sl,sign,front);su.length=0;sl.length=0;}}drawZodiacSeg(su,sl,sign,front);}
    const a=sD*Math.PI/180,cx3=Math.cos(a),cz3=Math.sin(a);const off=bHW/state.zoom;
    const pUp=proj([cx3,cz3*sinT+cosT*off,cz3*cosT+(-sinT)*off],state.aX,state.aY,state.zoom,CX2,CY2),
          pDn=proj([cx3,cz3*sinT-cosT*off,cz3*cosT-(-sinT)*off],state.aX,state.aY,state.zoom,CX2,CY2),
          pM=proj([cx3,cz3*sinT,cz3*cosT],state.aX,state.aY,state.zoom,CX2,CY2);
    ctx.beginPath();ctx.moveTo(pUp.x,pUp.y);ctx.lineTo(pDn.x,pDn.y);ctx.strokeStyle=ha('#FFFFFF',pM.z>=0?.2:.06);ctx.lineWidth=pM.z>=0?.8:.4;if(pM.z<0)ctx.setLineDash([2,2]);ctx.stroke();ctx.setLineDash([]);
    if(!timeu){const a2=(sD+15)*Math.PI/180,p2=proj([Math.cos(a2),Math.sin(a2)*sinT,Math.sin(a2)*cosT],state.aX,state.aY,state.zoom,CX2,CY2);if(p2.z>=0){ctx.font='bold 13px "Noto Sans Symbols","Segoe UI Symbol",sans-serif';ctx.fillStyle=ha(sign.col,.9);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(sign.sym,p2.x,p2.y);}}
  }
}
function drawRing(ring,sc=1,isOuter=false){
  const pts=getRingPts(ring,isOuter?120:undefined,sc).map(p=>proj(p,state.aX,state.aY,state.zoom,CX2,CY2));
  const back=[],front2=[];let curB=[],curF=[];
  for(const p of pts){if(p.z<0){if(curF.length>1)front2.push([...curF]);curF=[];curB.push(p);}else{if(curB.length>1)back.push([...curB]);curB=[];curF.push(p);}}
  if(curF.length>1)front2.push(curF);if(curB.length>1)back.push(curB);
  for(const seg of back){ctx.beginPath();ctx.moveTo(seg[0].x,seg[0].y);for(let j=1;j<seg.length;j++)ctx.lineTo(seg[j].x,seg[j].y);ctx.strokeStyle=ha(ring.col,ring.al*.25);ctx.lineWidth=ring.lw*.7;ctx.setLineDash([4,4]);ctx.stroke();ctx.setLineDash([]);}
  for(const seg of front2){ctx.beginPath();ctx.moveTo(seg[0].x,seg[0].y);for(let j=1;j<seg.length;j++)ctx.lineTo(seg[j].x,seg[j].y);ctx.strokeStyle=ha(ring.col,ring.al);ctx.lineWidth=ring.lw;ctx.stroke();if(isOuter){ctx.strokeStyle=ha(ring.col,.1);ctx.lineWidth=ring.lw+4;ctx.stroke();}}
}
function drawMoonDisc(prj,front,elong){
  const r=front?7:4, alpha=front?.95:.35;
  ctx.save();
  ctx.beginPath();ctx.arc(prj.x,prj.y,r,0,Math.PI*2);ctx.fillStyle=ha('#141a26',alpha);ctx.fill();
  const lit=(1-Math.cos(elong*D2R))/2;
  if(lit>0.02){
    const cosE=Math.cos(elong*D2R);
    ctx.save();
    ctx.beginPath();ctx.arc(prj.x,prj.y,r,0,Math.PI*2);ctx.clip();
    ctx.translate(prj.x,prj.y);
    if(elong>180)ctx.scale(-1,1);
    ctx.translate(-prj.x,-prj.y);
    ctx.beginPath();
    ctx.arc(prj.x,prj.y,r,-Math.PI/2,Math.PI/2,false);
    ctx.ellipse(prj.x,prj.y,Math.abs(r*cosE),r,0,Math.PI/2,-Math.PI/2,cosE>0);
    ctx.closePath();
    ctx.fillStyle=ha('#F0EBD8',alpha);ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();ctx.arc(prj.x,prj.y,r,0,Math.PI*2);ctx.strokeStyle=ha('#9FB0C8',alpha*.45);ctx.lineWidth=1;ctx.stroke();
  ctx.restore();
}

function draw(){
  ctx.clearRect(0,0,W,H);
  const seg=36;
  for(let lat=-80;lat<=80;lat+=20){const lr=lat*Math.PI/180,r=Math.cos(lr),y=Math.sin(lr);ctx.beginPath();let ff=true;for(let i=0;i<=seg;i++){const a=2*Math.PI*i/seg,v=applyMat(matMul(rotX(state.aX),rotY(state.aY)),[r*Math.cos(a),y,r*Math.sin(a)]);ff?(ctx.moveTo(CX2+v[0]*state.zoom,CY2-v[1]*state.zoom),ff=false):ctx.lineTo(CX2+v[0]*state.zoom,CY2-v[1]*state.zoom);}ctx.strokeStyle='rgba(100,120,180,0.06)';ctx.lineWidth=.5;ctx.stroke();}
  for(let lon=0;lon<360;lon+=20){const lr=lon*Math.PI/180;ctx.beginPath();let ff=true;for(let i=0;i<=seg;i++){const l2=Math.PI*(i/seg-.5),v=applyMat(matMul(rotX(state.aX),rotY(state.aY)),[Math.cos(l2)*Math.cos(lr),Math.sin(l2),Math.cos(l2)*Math.sin(lr)]);ff?(ctx.moveTo(CX2+v[0]*state.zoom,CY2-v[1]*state.zoom),ff=false):ctx.lineTo(CX2+v[0]*state.zoom,CY2-v[1]*state.zoom);}ctx.strokeStyle='rgba(100,120,180,0.05)';ctx.lineWidth=.5;ctx.stroke();}
  const vm=state.viewMode,showS=vm==='stars'||vm==='both',showR=vm==='rings'||vm==='both',showT=vm==='timeu';
  if(showR||showT){
    for(let lat=-60;lat<=60;lat+=30){const lr=lat*Math.PI/180,r=Math.cos(lr)*OUTER_SCALE,y=Math.sin(lr)*OUTER_SCALE;ctx.beginPath();let ff=true;for(let i=0;i<=seg;i++){const a=2*Math.PI*i/seg,v=applyMat(matMul(rotX(state.aX),rotY(state.aY)),[r*Math.cos(a),y,r*Math.sin(a)]);ff?(ctx.moveTo(CX2+v[0]*state.zoom,CY2-v[1]*state.zoom),ff=false):ctx.lineTo(CX2+v[0]*state.zoom,CY2-v[1]*state.zoom);}ctx.strokeStyle='rgba(80,140,200,0.04)';ctx.lineWidth=.4;ctx.stroke();}
    for(const ring of INNER_RINGS)drawRing(ring);
    drawZodiacBand(showT);
    for(const ring of OUTER_RINGS)drawRing(ring,OUTER_SCALE,true);
    if(showT){const eclT=23.5*Math.PI/180,cosT=Math.cos(eclT),sinT=Math.sin(eclT);const dXYZ=[Math.cos(Math.PI/2),sinT*Math.sin(Math.PI/2),Math.sin(Math.PI/2)*cosT];const dP=proj(dXYZ,state.aX,state.aY,state.zoom,CX2,CY2);if(dP.z>=-.2){ctx.font='italic 10px Inter,sans-serif';ctx.fillStyle=ha('#D4A843',Math.max(.3,Math.min(1,dP.z+.5)));ctx.textAlign='center';ctx.fillText('Faixa do Diferente',dP.x,dP.y-18);}const sXYZ=[Math.cos(3*Math.PI/2)*OUTER_SCALE,0,Math.sin(3*Math.PI/2)*OUTER_SCALE];const sP=proj(sXYZ,state.aX,state.aY,state.zoom,CX2,CY2);if(sP.z>=-.2){ctx.font='italic 10px Inter,sans-serif';ctx.fillStyle=ha('#5B8FD8',Math.max(.3,Math.min(1,sP.z+.5)));ctx.textAlign='center';ctx.fillText('Faixa do Mesmo',sP.x,sP.y-14);}}
  }
  state.projStars=[];
  if(showS){
    for(const con of CONSTELLATIONS){
      const sps=con.stars.map(st=>{const xyz=raDecXYZ(st.ra,st.dec);return{...proj(xyz,state.aX,state.aY,state.zoom,CX2,CY2),mag:st.mag};});
      for(const [ai,bi] of con.lines){const a=sps[ai],b=sps[bi];const front=(a.z+b.z)/2>=0;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=ha('#6688AA',front?.3:.08);ctx.lineWidth=.8;if(!front)ctx.setLineDash([3,3]);ctx.stroke();ctx.setLineDash([]);}
      for(const sp of sps){const front=sp.z>=0,r=magR(sp.mag)*(front?1:.6),op=magO(sp.mag)*(front?1:.25);if(front&&r>2){const g=ctx.createRadialGradient(sp.x,sp.y,0,sp.x,sp.y,r*4);g.addColorStop(0,ha('#AACCFF',op*.3));g.addColorStop(1,'rgba(170,204,255,0)');ctx.beginPath();ctx.arc(sp.x,sp.y,r*4,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();}ctx.beginPath();ctx.arc(sp.x,sp.y,r,0,Math.PI*2);ctx.fillStyle=ha(sp.mag<1?'#FFFFFF':sp.mag<2.5?'#DDEEFF':'#AABBCC',op);ctx.fill();}
      const fs=sps.filter(s=>s.z>=0);if(fs.length){let cx3=0,cy3=0;for(const f of fs){cx3+=f.x;cy3+=f.y;}ctx.font='10px Inter,sans-serif';ctx.fillStyle=ha('#8899BB',Math.min(.55,.2+fs[0].z*.5));ctx.textAlign='center';ctx.fillText(con.abbr,cx3/fs.length,cy3/fs.length-10);}
    }
    ctx.textAlign='center';ctx.textBaseline='bottom';
    for(const st of NAMED_STARS){
      const p=proj(raDecXYZ(st.ra,st.dec),state.aX,state.aY,state.zoom,CX2,CY2);
      const front=p.z>=0;
      const r=Math.max(1.3,Math.min(4,1.6+(2.6-st.m)*0.8));
      const rr=front?r:r*.7;
      if(front&&r>2.2){const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*4);g.addColorStop(0,ha(st.c||'#FFFFFF',.28));g.addColorStop(1,'rgba(0,0,0,0)');ctx.beginPath();ctx.arc(p.x,p.y,r*4,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();}
      ctx.beginPath();ctx.arc(p.x,p.y,rr,0,Math.PI*2);ctx.fillStyle=ha(st.c||'#FFFFFF',front?.95:.2);ctx.fill();
      if(front){if(st.m<=2.15){ctx.font='9px Inter,sans-serif';ctx.fillStyle=ha('#DCE8FF',.32+.38*Math.min(1,p.z));ctx.fillText(st.n,p.x,p.y-rr-2);}state.projStars.push({x:p.x,y:p.y,z:p.z,name:st.n,desig:st.d,mag:st.m});}
    }
  }
  state.projPlanets=[];
  const dp=state.snap?state.snapPlanets:state.planets,dmph=state.snap?state.snapElongation:state.elongation;
  if(showR&&dp){
    const eclT=23.5*Math.PI/180,sinET=Math.sin(eclT),cosET=Math.cos(eclT);
    for(const p of dp){const oR=p.orbR;const back=[],front2=[];let bPts=[],fPts=[];for(let i=0;i<=120;i++){const a=2*Math.PI*i/120,pt=proj([oR*Math.cos(a),oR*Math.sin(a)*sinET,oR*Math.sin(a)*cosET],state.aX,state.aY,state.zoom,CX2,CY2);if(pt.z<0){if(fPts.length>1)front2.push([...fPts]);fPts=[];bPts.push(pt);}else{if(bPts.length>1)back.push([...bPts]);bPts=[];fPts.push(pt);}}if(fPts.length>1)front2.push(fPts);if(bPts.length>1)back.push(bPts);for(const s of back){ctx.beginPath();ctx.moveTo(s[0].x,s[0].y);for(let j=1;j<s.length;j++)ctx.lineTo(s[j].x,s[j].y);ctx.strokeStyle=ha(p.col,.18);ctx.lineWidth=1;ctx.setLineDash([5,5]);ctx.stroke();ctx.setLineDash([]);}for(const s of front2){ctx.beginPath();ctx.moveTo(s[0].x,s[0].y);for(let j=1;j<s.length;j++)ctx.lineTo(s[j].x,s[j].y);ctx.strokeStyle=ha(p.col,.4);ctx.lineWidth=1.3;ctx.stroke();}}
    for(let pi=0;pi<dp.length;pi++){const p=dp[pi],xyz=eclXYZ(p.lon,p.orbR),pr2=proj(xyz,state.aX,state.aY,state.zoom,CX2,CY2),front2=pr2.z>=0;
      if(pi===0)drawMoonDisc(pr2,front2,dmph);
      else{const r=front2?5:3.5,o=front2?.9:.35;ctx.beginPath();ctx.arc(pr2.x,pr2.y,r,0,Math.PI*2);ctx.fillStyle=ha(p.col,o);ctx.fill();if(front2){const g=ctx.createRadialGradient(pr2.x,pr2.y,r*.3,pr2.x,pr2.y,r*2.5);g.addColorStop(0,ha(p.col,.4));g.addColorStop(1,'rgba(0,0,0,0)');ctx.beginPath();ctx.arc(pr2.x,pr2.y,r*2.5,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();}}
      if(front2||pr2.z>-.3){ctx.font='bold 15px "Noto Sans Symbols","Segoe UI Symbol",sans-serif';ctx.fillStyle=ha('#FFFFFF',front2?.9:.35);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(p.sym,pr2.x,pr2.y-(pi===0?7:5)-11);ctx.font='9px Inter,sans-serif';ctx.fillStyle=ha(p.col,(front2?.9:.35)*.8);ctx.fillText(p.name,pr2.x,pr2.y-(pi===0?7:5)-23);}
      state.projPlanets.push({x:pr2.x,y:pr2.y,z:pr2.z,sym:p.sym,name:p.name,col:p.col,lon:p.lon,index:pi});
    }
    const ep=proj([0,0,0],state.aX,state.aY,state.zoom,CX2,CY2);if(ep.z>=0){const eg=ctx.createRadialGradient(ep.x,ep.y,2,ep.x,ep.y,18);eg.addColorStop(0,'rgba(80,140,240,.45)');eg.addColorStop(.5,'rgba(40,100,220,.15)');eg.addColorStop(1,'rgba(0,0,0,0)');ctx.beginPath();ctx.arc(ep.x,ep.y,18,0,Math.PI*2);ctx.fillStyle=eg;ctx.fill();}
    ctx.beginPath();ctx.arc(ep.x,ep.y,ep.z>=0?5:3,0,Math.PI*2);ctx.fillStyle=ha('#5599EE',ep.z>=0?1:.4);ctx.fill();
  }
  const pN=proj([0,1.12*OUTER_SCALE,0],state.aX,state.aY,state.zoom,CX2,CY2),pS=proj([0,-1.12*OUTER_SCALE,0],state.aX,state.aY,state.zoom,CX2,CY2);
  ctx.strokeStyle='rgba(150,160,200,.25)';ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(pN.x,pN.y);ctx.lineTo(pS.x,pS.y);ctx.stroke();ctx.setLineDash([]);
  ctx.font='11px Inter,sans-serif';ctx.fillStyle='rgba(180,190,220,.6)';ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillText('N',pN.x,pN.y-8);ctx.fillText('S',pS.x,pS.y+14);
}

const loc={lat:null,lon:-new Date().getTimezoneOffset()/4,src:'fuso',acc:null,pending:false,asked:false};
let astralHover=false,astralInfoText='';
function buildAstralCards(A){
  const card=(label,val,sub,col)=>`<div class="ou-ai"${col?` style="border-left:3px solid ${esc(col)}"`:''}><b${col?` style="color:${esc(col)}"`:''}>${esc(label)}</b><span>${esc(val)}</span>${sub?`<small>${esc(sub)}</small>`:''}</div>`;
  const hemi=(v,p,n)=>`${dd(Math.abs(v),2)}° ${v>=0?p:n}`;
  let locVal,locSub;
  if(loc.src==='gps'){locVal=`${hemi(loc.lat,'N','S')}, ${hemi(loc.lon,'L','O')}`;locSub=`GPS do navegador${loc.acc?` · ±${Math.round(loc.acc)} m`:''}`;}
  else{locVal=`${hemi(loc.lon,'L','O')} (fuso)`;locSub=loc.pending?'Obtendo localização…':'Aproximado pelo fuso horário · latitude indisponível';}
  let sunVal,sunSub;
  if(A.polar==='dia'){sunVal='Sol da meia-noite';sunSub='O Sol não se põe hoje neste local';}
  else if(A.polar==='noite'){sunVal='Noite polar';sunSub='O Sol não nasce hoje neste local';}
  else{sunVal=`${fmtH(A.rise+A.off)} · ${fmtH(A.set+A.off)}`;sunSub=`Hora solar ${fmtH(A.rise)} · ${fmtH(A.set)}${A.known?'':' (aprox., sem latitude)'}`;}
  const lit=Math.round((1-Math.cos(A.elong*D2R))/2*100);
  let h=card('Hora civil',fmtH(A.civilH,true),A.date.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}))+
        card('Hora solar verdadeira',fmtH(A.solarH,true),`Equação do tempo ${sgn(A.eot)} min`)+
        card('Localização',locVal,locSub)+
        card('Nascer · Pôr do Sol',sunVal,sunSub)+
        card('Altura do Sol',A.known?`${sgn(A.alt)}°`:'—',A.known?(A.alt>=0?'acima do horizonte':'abaixo do horizonte'):'requer a latitude')+
        card('☽ Lua',phaseName(A.elong),`${lit}% iluminada`);
  A.bodies.forEach(b=>{h+=card(`${b.sym}${SYMF} ${b.name}`,`${zText(b.lon)}${b.retro?' ℞':''}`,b.retro?'movimento retrógrado':'',b.col);});
  return h;
}
/* C2: o SVG e a grade só são reconstruídos quando o instante (em segundos) ou a localização mudam.
   `force` ignora a verificação (troca de modo, nova localização, ações do painel de tempo).
   C1: depois de desenhar, entrega o mesmo A ao painel do astral.js (AstralPanel.frame), que
   atualiza o relógio e a leitura sem recalcular nada nem manter um laço próprio. */
let astralKey='';
function renderAstral(force){
  const host=document.getElementById('ou-astral-svg');if(!host)return;
  const A=computeAstral(window.AstralClock?AstralClock.date():new Date(),loc);
  const key=Math.floor(A.date.getTime()/1000)+'|'+loc.src+'|'+loc.lat+'|'+loc.lon+'|'+loc.acc+'|'+loc.pending;
  if(force||key!==astralKey){
    astralKey=key;
    host.innerHTML=buildAstralSVG(A);
    document.getElementById('ou-astral-grid').innerHTML=buildAstralCards(A);
    if(window.MansoesLunares){try{MansoesLunares.setAstral(A.date,A.bodies[0].lon);}catch(e){}}
    astralInfoText=`✦ Mapa astral · ${fmtH(A.civilH)} (hora solar ${fmtH(A.solarH)}) · ☉ ${zText(A.sunLon)}`;
  }
  if(!astralHover&&infoBar.textContent!==astralInfoText)infoBar.textContent=astralInfoText;
  if(window.AstralPanel){try{AstralPanel.frame(A,!!force);}catch(e){}}
}
/* Outras abas (ex.: o amanhecer real da Liturgia, liturgy.js) reaproveitam esta mesma geolocalização:
   o resultado é anunciado por eventos no document, sem dados pessoais além de lat/lon/precisão.
   · calendarium:localizacao        detail { lat, lon, acc }
   · calendarium:localizacao-erro   detail { code, negado, indisponivel }   (code 1 = negou; 2 = indisponível; 3 = tempo esgotado) */
function emite(nome,detail){try{document.dispatchEvent(new CustomEvent(nome,{detail}));}catch(e){}}
function requestLocation(force){
  if(loc.pending||(loc.asked&&!force))return;
  loc.asked=true;
  if(!navigator.geolocation){emit_erro({code:2,message:'sem suporte'});return;}
  loc.pending=true;
  navigator.geolocation.getCurrentPosition(p=>{
    loc.lat=p.coords.latitude;loc.lon=p.coords.longitude;loc.acc=p.coords.accuracy;loc.src='gps';loc.pending=false;
    emite('calendarium:localizacao',{lat:loc.lat,lon:loc.lon,acc:loc.acc});
    if(state.viewMode==='astral')renderAstral(true);
  },err=>{
    loc.pending=false;
    emit_erro(err);
    if(state.viewMode==='astral')renderAstral(true);
  },{enableHighAccuracy:false,timeout:10000,maximumAge:600000});
  if(state.viewMode==='astral')renderAstral(true);
}
function emit_erro(err){const code=err&&err.code||2;emite('calendarium:localizacao-erro',{code,negado:code===1,indisponivel:code!==1});}
function buildAstralLegend(sec,item){
  nowDateEl=nowSunEl=nowMoonEl=null;
  sec('Signos — sentido anti-horário',ZODIAC.map(z=>item(`<span class="leg-sym" style="color:${esc(z.col)}">${esc(z.sym)}${SYMF}</span>${esc(z.name)}`)).join(''));
  sec('Órbitas (do centro para fora)',PLANETS_DEF.map(p=>item(`<span class="leg-sym">${esc(p.sym)}${SYMF}</span><span class="leg-dot" style="background:${esc(p.col)}"></span>${esc(p.name)}`)).join(''));
  const n=document.createElement('p');n.className='ou-note';
  n.textContent='O mostrador central marca a hora solar verdadeira do local (meio-dia no topo, meia-noite embaixo) e a haste dourada é o Sol. O mapa inteiro gira para manter o Sol na posição dessa hora; os demais astros ficam nas suas longitudes eclípticas reais. Os raios das órbitas são simbólicos.';
  legendEl.appendChild(n);
}

let nowDateEl=null,nowSunEl=null,nowMoonEl=null,legendFrame=0;
function buildNowSection(){
  const sec=document.createElement('div');sec.className='leg-section';
  sec.innerHTML='<div class="leg-title">Céu agora</div><div class="leg-items">'+
    '<span class="leg-item"><span class="ou-now-date"></span></span>'+
    '<span class="leg-item"><span class="leg-sym">☉</span><span class="ou-now-sun"></span></span>'+
    '<span class="leg-item"><span class="leg-sym">☽</span><span class="ou-now-moon"></span></span>'+
    '</div>';
  legendEl.appendChild(sec);
  nowDateEl=sec.querySelector('.ou-now-date');
  nowSunEl=sec.querySelector('.ou-now-sun');
  nowMoonEl=sec.querySelector('.ou-now-moon');
  updateNowSection();
}
function updateNowSection(){
  if(!nowDateEl)return;
  const pad2=n=>String(n).padStart(2,'0');
  const d=state.ephDate;
  const elong=state.snap?state.snapElongation:state.elongation;
  nowDateEl.textContent=`${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  nowSunEl.textContent=`Sol em ${zodiacPos(state.planets[3].lon).text}`;
  nowMoonEl.textContent=`${phaseName(elong)} — ${Math.round((1-Math.cos(elong*D2R))/2*100)}% iluminada`;
}
function buildLegend(){
  const vm=state.viewMode;legendEl.innerHTML='';
  const sec=(title,html)=>{const d=document.createElement('div');d.className='leg-section';d.innerHTML=`<div class="leg-title">${title}</div><div class="leg-items">${html}</div>`;legendEl.appendChild(d);};
  const item=(html)=>`<span class="leg-item">${html}</span>`;
  if(vm==='astral'){buildAstralLegend(sec,item);return;}
  buildNowSection();
  if(vm==='rings'||vm==='both'||vm==='timeu'){
    sec(vm==='timeu'?'Faixa do Diferente (Eclíptica/Zodíaco)':'Faixa do Zodíaco',ZODIAC.map(z=>item(`<span class="leg-sym" style="color:${z.col}">${z.sym}</span>${z.name}`)).join(''));
    sec('Anéis — Esfera Interior',INNER_RINGS.map(r=>item(`<span class="leg-dot" style="background:${r.col}"></span>${r.name}`)).join(''));
    sec('Anéis — Esfera Exterior',OUTER_RINGS.map(r=>item(`<span class="leg-dot" style="background:${r.col}"></span>${r.name}${vm==='timeu'&&r.name==='Equador Celeste'?'<span style="color:#4a7dd8;margin-left:4px">— Faixa do Mesmo</span>':''}`)).join(''));
    if(vm==='timeu'){const n=document.createElement('p');n.className='ou-note';n.innerHTML='No Timeu, Platão descreve a Alma do Mundo como duas faixas em X: a <span style="color:#4a7dd8">Faixa do Mesmo</span> (Equador Celeste) e a <span style="color:#c9a84c">Faixa do Diferente</span> (Eclíptica/Zodíaco), dividida em 7 círculos pelas proporções do <strong>Λ Lambda</strong> (1·2·4·8 e 1·3·9·27).';legendEl.appendChild(n);}
    if(vm!=='timeu')sec('Órbitas Planetárias',PLANETS_DEF.map(p=>item(`<span class="leg-sym">${p.sym}</span><span class="leg-dot" style="background:${p.col}"></span>${p.name}`)).join(''));
  }
  if(vm==='stars'||vm==='both'){
    sec(`Constelações (${CONSTELLATIONS.length})`,CONSTELLATIONS.map(c=>item(`<span style="font-family:monospace;color:#4a7dd8;font-size:.65rem">${c.abbr}</span>${c.name}`)).join(''));
    sec(`Estrelas Nomeadas (${NAMED_STARS.length})`,item('passe o mouse sobre uma estrela para identificá-la'));
  }
}
function buildCatalog(){
  const grid=document.getElementById('ou-cat-grid');
  grid.innerHTML=SYMBOL_CATALOG.map(c=>`<figure class="ou-cat">
    <span class="ou-cat-sym"><img src="https://www.suberic.net/~dmm/astro/img/calli/${esc(c.f)}.png" alt="Símbolo da constelação ${esc(c.n)}" width="34" height="34" loading="lazy"></span>
    <figcaption><b>${esc(c.a)}</b>${esc(c.p)}<em>${esc(c.n)}</em></figcaption>
  </figure>`).join('');
}

function animLoop(){
  requestAnimationFrame(animLoop);
  if(!state.active)return;
  if(state.viewMode==='astral'){const t=performance.now();if(t-(animLoop.lastA||0)>=(window.AstralClock?AstralClock.interval():1000)){animLoop.lastA=t;renderAstral();}return;}
  if(state.autoRotate){
    if(!state.snap){
      state.aY+=.004;
      const step=(1/60)*state.simSpeed;
      state.simDays+=step;
      state.ephDate=new Date(START.getTime()+state.simDays*86400000);
      const pos=computePositions(state.ephDate);
      for(let i=0;i<state.planets.length;i++)state.planets[i].lon=pos[KEYS[i]];
      state.elongation=pos.elongation;
    }else state.aY+=.002;
  }
  draw();
  legendFrame++;
  if(legendFrame%20===0){updateNowSection();if(!state.hovering)infoBar.textContent=defaultInfo();}
}

function setMode(m){state.viewMode=m;document.querySelectorAll('#ou-mode-group .ou-pill').forEach(b=>{const on=b.dataset.mode===m;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on?'true':'false');});document.getElementById('ouranosView').classList.toggle('astral-on',m==='astral');buildLegend();if(m==='astral'){astralHover=false;requestLocation();renderAstral(true);}else{infoBar.textContent=defaultInfo();if(started)ajustaCanvas();}}
function setSpeed(v){state.simSpeed=v;document.querySelectorAll('#ou-speed-group .ou-pill').forEach(b=>{const on=+b.dataset.spd===v;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on?'true':'false');});}
function togglePause(){state.autoRotate=!state.autoRotate;pauseBtn.textContent=state.autoRotate?'⏸ Pausar':'▶ Retomar';}
function takeSnapshot(){
  if(state.snap){clearSnapshot();return;}
  const d=new Date();const pos=computePositions(d);
  state.snapPlanets=PLANETS_DEF.map((p,i)=>({...p,lon:pos[KEYS[i]]}));
  state.snapElongation=pos.elongation;state.snap=true;
  const pad=n=>String(n).padStart(2,'0');
  snapLabel.textContent=`${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} · ${phaseName(pos.elongation)}`;
  snapBanner.classList.add('visible');snapBtn.textContent='📌 Céu Congelado';snapBtn.classList.add('active');snapBtn.setAttribute('aria-pressed','true');buildLegend();
}
function clearSnapshot(){state.snap=false;state.snapPlanets=null;state.snapElongation=null;snapBanner.classList.remove('visible');snapBtn.textContent='📌 Posição Atual';snapBtn.classList.remove('active');snapBtn.setAttribute('aria-pressed','false');buildLegend();}
function resetAll(){
  const d=new Date();
  state.aX=20*Math.PI/180;state.aY=30*Math.PI/180;state.zoom=155;state.autoRotate=!reduzido();state.simSpeed=1;
  state.simDays=0;state.ephDate=new Date(d);
  const pos=computePositions(d);
  state.planets=PLANETS_DEF.map((p,i)=>({...p,lon:pos[KEYS[i]]}));
  state.elongation=pos.elongation;
  state.snap=false;state.snapPlanets=null;state.snapElongation=null;
  zoomSlider.value=155;setMode('both');setSpeed(1);pauseBtn.textContent=state.autoRotate?'⏸ Pausar':'▶ Retomar';snapBanner.classList.remove('visible');snapBtn.textContent='📌 Posição Atual';snapBtn.classList.remove('active');
}

/* Resolução do canvas (etapa C). As coordenadas de desenho seguem lógicas (700×560, como antes); o que muda é quantos
   pixels reais há por trás: tamanho exibido × devicePixelRatio, nunca abaixo de 1 (a resolução original) e até NITIDEZ_MAX.
   NITIDEZ_MAX = 1 devolve exatamente o comportamento anterior (sempre 700×560). Redesenha logo após mudar. */
const NITIDEZ_MAX=2;
let kCanvas=0;
function ajustaCanvas(forcar){
  const w=canvas.getBoundingClientRect().width;
  if(!(w>0)&&!forcar)return false;                 /* escondido (Mapa Astral aberto): mantém e refaz ao voltar */
  const dpr=window.devicePixelRatio||1;
  const k=Math.round(Math.min(NITIDEZ_MAX,Math.max(1,(w>0?w:W)*dpr/W))*100)/100;
  if(k===kCanvas&&!forcar)return false;
  kCanvas=k;
  canvas.width=Math.round(W*k);canvas.height=Math.round(H*k);   /* zera a matriz; setTransform (não scale) evita acumular */
  ctx.setTransform(k,0,0,k,0,0);
  return true;
}
let started=false;
function init(){
  if(started)return;started=true;
  setMode(state.viewMode);setSpeed(state.simSpeed);
  ajustaCanvas(true);buildLegend();buildCatalog();
  if(window.CalendariumResize)window.CalendariumResize.aoRedimensionar(()=>{if(ajustaCanvas()&&state.viewMode!=='astral')draw();});
  document.querySelectorAll('#ou-mode-group .ou-pill').forEach(b=>{b.onclick=()=>setMode(b.dataset.mode);});
  document.querySelectorAll('#ou-speed-group .ou-pill').forEach(b=>{b.onclick=()=>setSpeed(+b.dataset.spd);});
  zoomSlider.oninput=()=>{state.zoom=+zoomSlider.value;};
  pauseBtn.onclick=togglePause;snapBtn.onclick=takeSnapshot;
  document.getElementById('ou-reset-btn').onclick=resetAll;
  document.getElementById('ou-clear-snap').onclick=clearSnapshot;
  let dragging=false,lastMX=0,lastMY=0;
  canvas.addEventListener('mousedown',e=>{dragging=true;lastMX=e.clientX;lastMY=e.clientY;state.autoRotate=false;});
  window.addEventListener('mousemove',e=>{if(!dragging)return;state.aY+=(e.clientX-lastMX)*.008;state.aX+=(e.clientY-lastMY)*.008;state.aX=Math.max(-Math.PI/2,Math.min(Math.PI/2,state.aX));lastMX=e.clientX;lastMY=e.clientY;});
  window.addEventListener('mouseup',()=>dragging=false);
  canvas.addEventListener('touchstart',e=>{if(e.touches.length===1){dragging=true;lastMX=e.touches[0].clientX;lastMY=e.touches[0].clientY;state.autoRotate=false;}},{passive:true});
  canvas.addEventListener('touchmove',e=>{if(!dragging||e.touches.length!==1)return;e.preventDefault();state.aY+=(e.touches[0].clientX-lastMX)*.008;state.aX+=(e.touches[0].clientY-lastMY)*.008;state.aX=Math.max(-Math.PI/2,Math.min(Math.PI/2,state.aX));lastMX=e.touches[0].clientX;lastMY=e.touches[0].clientY;},{passive:false});
  canvas.addEventListener('touchend',()=>dragging=false);
  function hover(e){
    state.hovering=true;
    const rect=canvas.getBoundingClientRect();
    const mx=(e.clientX-rect.left)*(W/rect.width),my=(e.clientY-rect.top)*(H/rect.height);
    let info=defaultInfo(),hit=false;
    for(const p of state.projPlanets){if(p.z>=0&&Math.hypot(p.x-mx,p.y-my)<14){info=planetInfo(p);hit=true;break;}}
    if(!hit){let best=null,bd=13;for(const s of state.projStars){const d=Math.hypot(s.x-mx,s.y-my);if(d<bd){bd=d;best=s;}}if(best)info=`★ ${best.name} — ${best.desig} · magnitude ${best.mag.toFixed(2)}`;}
    if(!hit){const ep=proj([0,0,0],state.aX,state.aY,state.zoom,CX2,CY2);if(ep.z>=0&&Math.hypot(ep.x-mx,ep.y-my)<14)info='🌍 Terra (centro)';}
    infoBar.textContent=info;
  }
  canvas.addEventListener('mousemove',hover);
  canvas.addEventListener('mouseleave',()=>{state.hovering=false;infoBar.textContent=defaultInfo();});
  canvas.addEventListener('touchmove',hover,{passive:true});
  const aw=document.getElementById('ou-astral-wrap');
  const aShow=e=>{const t=e.target.closest&&e.target.closest('[data-info]');if(t){astralHover=true;infoBar.textContent=t.getAttribute('data-info');}};
  aw.addEventListener('mouseover',aShow);aw.addEventListener('touchstart',aShow,{passive:true});
  aw.addEventListener('mouseleave',()=>{astralHover=false;infoBar.textContent=astralInfoText;});
  document.getElementById('ou-loc-btn').onclick=()=>requestLocation(true);
  infoBar.textContent=defaultInfo();animLoop();
}

return {
  astral:(d,l)=>computeAstral(d||new Date(),l||loc),
  astralSVG:(d,l)=>buildAstralSVG(computeAstral(d||new Date(),l||loc)),
  setLocation(lat,lon){loc.lat=lat;loc.lon=lon;loc.src='gps';loc.asked=true;emite('calendarium:localizacao',{lat,lon,acc:null});if(state.viewMode==='astral')renderAstral(true);},
  /* leitura da localização em uso (src 'gps' = latitude conhecida; 'fuso' = só longitude aproximada) e novo pedido ao navegador */
  location(){return {lat:loc.lat,lon:loc.lon,acc:loc.acc,src:loc.src,pending:loc.pending};},
  requestLocation,
  activate(){init();state.active=true;infoBar.textContent=defaultInfo();if(state.viewMode==='astral')renderAstral(true);},
  deactivate(){state.active=false;},
  /* usado pelo astral.js após mudar o relógio: redesenha já (sem esperar o animLoop) */
  /* estado visual (zoom, ângulos, modo) e resolução do canvas: usado pelos testes de redimensionamento */
  estadoVisual(){return {zoom:state.zoom,aX:state.aX,aY:state.aY,mode:state.viewMode,escala:kCanvas,canvasW:canvas.width,canvasH:canvas.height,ephDate:state.ephDate.toISOString()};},
  astralRefresh(){if(state.active&&state.viewMode==='astral'){animLoop.lastA=performance.now();renderAstral(true);}},
  info(){
    const elong=state.snap?state.snapElongation:state.elongation;
    const shown=state.snap?state.snapPlanets:state.planets;
    const moon=state.projPlanets.filter(p=>p.index===0)[0]||{x:null,y:null,z:0};
    return {
      date:state.ephDate.toISOString(),frozen:state.snap,mode:state.viewMode,
      moon:{elong:+elong.toFixed(2),illum:+((1-Math.cos(elong*D2R))/2).toFixed(4),phase:phaseName(elong),x:moon.x,y:moon.y},
      planets:shown.map(p=>{const z=zodiacPos(p.lon);return{name:p.name,sym:p.sym,lon:+p.lon.toFixed(3),sign:ZODIAC[z.sign].name,deg:z.deg,min:z.min,text:z.text};}),
      stars:{named:NAMED_STARS.length,visible:state.projStars.length,visibleNames:state.projStars.slice(0,6).map(s=>s.name)},
      catalog:SYMBOL_CATALOG.length,defaultInfo:defaultInfo(),
    };
  },
};
})();
