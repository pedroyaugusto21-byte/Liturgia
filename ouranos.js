/* ======================================================================
   URANO — ANIMA MUNDI (Ouranos)
   CONSTELLATIONS, NAMED_STARS e SYMBOL_CATALOG vêm de ouranos-data.js
   ====================================================================== */
const Ouranos = (function () {
const D2R = Math.PI / 180;
const W = 700, H = 560, CX2 = 350, CY2 = 280;

const ZODIAC = [
  {name:'Áries',sym:'♈',sd:0,col:'#E05555'},{name:'Touro',sym:'♉',sd:30,col:'#6DBF6D'},
  {name:'Gêmeos',sym:'♊',sd:60,col:'#E0C855'},{name:'Câncer',sym:'♋',sd:90,col:'#B0B0D0'},
  {name:'Leão',sym:'♌',sd:120,col:'#E0A030'},{name:'Virgem',sym:'♍',sd:150,col:'#80B060'},
  {name:'Libra',sym:'♎',sd:180,col:'#D080C0'},{name:'Escorpião',sym:'♏',sd:210,col:'#C04040'},
  {name:'Sagitário',sym:'♐',sd:240,col:'#8060D0'},{name:'Capricórnio',sym:'♑',sd:270,col:'#607080'},
  {name:'Aquário',sym:'♒',sd:300,col:'#40A0D0'},{name:'Peixes',sym:'♓',sd:330,col:'#70B0A0'},
];
const INNER_RINGS = [
  {name:'Trópico de Câncer',col:'#CC6B6B',lw:1.8,plane:'parallel',latDeg:23.5,al:.85},
  {name:'Trópico de Capricórnio',col:'#B07AC9',lw:1.8,plane:'parallel',latDeg:-23.5,al:.85},
  {name:'Círculo Ártico',col:'#4FC9C9',lw:1.5,plane:'parallel',latDeg:66.5,al:.8},
  {name:'Círculo Antártico',col:'#E07040',lw:1.5,plane:'parallel',latDeg:-66.5,al:.8},
  {name:'Horizonte',col:'#A0A0B8',lw:2,plane:'horizon',al:.8},
  {name:'Coluro dos Equinócios',col:'#9CB87A',lw:1.5,plane:'colure',colureAngle:0,al:.75},
  {name:'Coluro dos Solstícios',col:'#D4C07A',lw:1.5,plane:'colure',colureAngle:Math.PI/2,al:.75},
];
const OUTER_RINGS = [
  {name:'Equador Celeste',col:'#5B8FD8',lw:2.5,plane:'equatorial',al:1},
  {name:'Meridiano',col:'#7AC97A',lw:2,plane:'meridian',al:1},
];
const OUTER_SCALE = 1.18;
const PLANETS_DEF = [
  {name:'Lua',sym:'☽',orbR:.18,col:'#E8E8D0'},{name:'Mercúrio',sym:'☿',orbR:.28,col:'#CCB888'},
  {name:'Vênus',sym:'♀',orbR:.36,col:'#E8C8A0'},{name:'Sol',sym:'☉',orbR:.46,col:'#F5D060'},
  {name:'Marte',sym:'♂',orbR:.56,col:'#D06040'},{name:'Júpiter',sym:'♃',orbR:.71,col:'#D4A87A'},
  {name:'Saturno',sym:'♄',orbR:.86,col:'#B8A070'},
];
const PHASE_NAMES = ['Lua Nova','Crescente Côncava','Quarto Crescente','Crescente Convexa','Lua Cheia','Minguante Convexa','Quarto Minguante','Minguante Côncava'];

function ha(hex,a){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return`rgba(${r},${g},${b},${Math.max(0,Math.min(1,a))})`}
function reduceDeg(d){return((d%360)+360)%360}
function sinD(d){return Math.sin(d*Math.PI/180)}
function cosD(d){return Math.cos(d*Math.PI/180)}
function matMul(a,b){return[a[0]*b[0]+a[1]*b[3]+a[2]*b[6],a[0]*b[1]+a[1]*b[4]+a[2]*b[7],a[0]*b[2]+a[1]*b[5]+a[2]*b[8],a[3]*b[0]+a[4]*b[3]+a[5]*b[6],a[3]*b[1]+a[4]*b[4]+a[5]*b[7],a[3]*b[2]+a[4]*b[5]+a[5]*b[8],a[6]*b[0]+a[7]*b[3]+a[8]*b[6],a[6]*b[1]+a[7]*b[4]+a[8]*b[7],a[6]*b[2]+a[7]*b[5]+a[8]*b[8]]}
function rotX(a){const c=Math.cos(a),s=Math.sin(a);return[1,0,0,0,c,-s,0,s,c]}
function rotY(a){const c=Math.cos(a),s=Math.sin(a);return[c,0,s,0,1,0,-s,0,c]}
function applyMat(m,v){return[m[0]*v[0]+m[1]*v[1]+m[2]*v[2],m[3]*v[0]+m[4]*v[1]+m[5]*v[2],m[6]*v[0]+m[7]*v[1]+m[8]*v[2]]}
function proj(v,aX,aY,z,CX,CY){const m=matMul(rotX(aX),rotY(aY));const xyz=applyMat(m,v);return{x:CX+xyz[0]*z,y:CY-xyz[1]*z,z:xyz[2]}}
function raDecXYZ(raH,decD){const ra=(raH/24)*2*Math.PI,dec=(decD/180)*Math.PI;return[Math.cos(dec)*Math.cos(ra),Math.sin(dec),Math.cos(dec)*Math.sin(ra)]}
function magR(m){return Math.max(1.2,4-m*0.7)}
function magO(m){return Math.max(0.3,Math.min(1,1.2-m*0.15))}
function getRingPts(ring,N=120,sc=1){
  const pts=[];
  if(ring.plane==='equatorial'||ring.plane==='horizon'){for(let i=0;i<=N;i++){const a=2*Math.PI*i/N;pts.push([Math.cos(a)*sc,0,Math.sin(a)*sc]);}}
  else if(ring.plane==='ecliptic'){const cosT=Math.cos(ring.tilt),sinT=Math.sin(ring.tilt);for(let i=0;i<=N;i++){const a=2*Math.PI*i/N;pts.push([Math.cos(a)*sc,sinT*Math.sin(a)*sc,Math.sin(a)*cosT*sc]);}}
  else if(ring.plane==='meridian'){for(let i=0;i<=N;i++){const a=2*Math.PI*i/N;pts.push([0,Math.sin(a)*sc,Math.cos(a)*sc]);}}
  else if(ring.plane==='parallel'){const lat=ring.latDeg*Math.PI/180,r=Math.cos(lat)*sc,y=Math.sin(lat)*sc;for(let i=0;i<=N;i++){const a=2*Math.PI*i/N;pts.push([r*Math.cos(a),y,r*Math.sin(a)]);}}
  else if(ring.plane==='colure'){const cosO=Math.cos(ring.colureAngle),sinO=Math.sin(ring.colureAngle);for(let i=0;i<=N;i++){const a=2*Math.PI*i/N;pts.push([cosO*Math.sin(a)*sc,Math.cos(a)*sc,sinO*Math.sin(a)*sc]);}}
  return pts;
}

function julianDay(date){const y=date.getUTCFullYear(),m=date.getUTCMonth()+1;const d=date.getUTCDate()+date.getUTCHours()/24+date.getUTCMinutes()/1440+date.getUTCSeconds()/86400;let Y=y,M=m;if(M<=2){Y--;M+=12;}const A=Math.floor(Y/100),B=2-A+Math.floor(A/4);return Math.floor(365.25*(Y+4716))+Math.floor(30.6001*(M+1))+d+B-1524.5;}
function centuries(date){return (julianDay(date)-2451545)/36525;}
function sunLon(T){const L0=reduceDeg(280.46646+36000.76983*T+0.0003032*T*T);const M=reduceDeg(357.52911+35999.05029*T-0.0001537*T*T);const C=(1.914602-0.004817*T-0.000014*T*T)*sinD(M)+(0.019993-0.000101*T)*sinD(2*M)+0.000289*sinD(3*M);return reduceDeg(L0+C);}
function moonLon(T){const Lp=reduceDeg(218.3164477+481267.88123421*T-0.0015786*T*T);const D=reduceDeg(297.8501921+445267.1114034*T-0.0018819*T*T);const M=reduceDeg(357.5291092+35999.0502909*T-0.0001536*T*T);const Mp=reduceDeg(134.9633964+477198.8675055*T+0.0087414*T*T);const F=reduceDeg(93.2720950+483202.0175233*T-0.0036539*T*T);
  return reduceDeg(Lp+6.288750*sinD(Mp)+1.274018*sinD(2*D-Mp)+0.658309*sinD(2*D)+0.213616*sinD(2*Mp)-0.185596*sinD(M)-0.114336*sinD(2*F)
    +0.058793*sinD(2*D-2*Mp)+0.057212*sinD(2*D-M-Mp)+0.053320*sinD(2*D+Mp)+0.045874*sinD(2*D-M)-0.040978*sinD(M)
    +0.034720*sinD(D)+0.030465*sinD(M+Mp)-0.024710*sinD(2*D-Mp+2*F)-0.023210*sinD(2*F)-0.022540*sinD(2*D-M-2*Mp));}
const ELEMENTS = {
  mercury:{a:[0.38709927,0.00000037],e:[0.20563593,0.00001906],I:[7.00497902,-0.00594749],L:[252.25032350,149472.67411175],w:[77.45779628,0.16047689],O:[48.33076593,-0.12534081]},
  venus:{a:[0.72333566,0.00000390],e:[0.00677672,-0.00004107],I:[3.39467605,-0.00078890],L:[181.97909950,58517.81538729],w:[131.60246718,0.00268329],O:[76.67984255,-0.27769418]},
  earth:{a:[1.00000261,0.00000562],e:[0.01671123,-0.00004392],I:[-0.00001531,-0.01294668],L:[100.46457166,35999.37244981],w:[102.93768193,0.32327364],O:[0,0]},
  mars:{a:[1.52371034,0.00001847],e:[0.09339410,0.00007882],I:[1.84969142,-0.00813131],L:[-4.55343205,19140.30268499],w:[-23.94362959,0.44441088],O:[49.55953891,-0.29257343]},
  jupiter:{a:[5.20288700,-0.00011607],e:[0.04838624,-0.00013253],I:[1.30439695,-0.00183714],L:[34.39644051,3034.74612775],w:[14.72847983,0.21252668],O:[100.47390909,0.20469106]},
  saturn:{a:[9.53667594,-0.00125060],e:[0.05386179,-0.00050991],I:[2.48599187,0.00193609],L:[49.95424423,1222.49362201],w:[92.59887831,-0.41897216],O:[113.66242448,-0.28867794]},
};
function helioXYZ(key,T){
  const el=ELEMENTS[key];
  const a=el.a[0]+el.a[1]*T, e=el.e[0]+el.e[1]*T, inc=(el.I[0]+el.I[1]*T)*D2R;
  const L=reduceDeg(el.L[0]+el.L[1]*T), peri=el.w[0]+el.w[1]*T, node=el.O[0]+el.O[1]*T;
  const M=reduceDeg(L-peri)*D2R;
  let E=M;
  for(let i=0;i<8;i++) E = E - (E - e*Math.sin(E) - M)/(1 - e*Math.cos(E));
  const xp=a*(Math.cos(E)-e), yp=a*Math.sqrt(1-e*e)*Math.sin(E);
  const w=(peri-node)*D2R, O=node*D2R;
  const cw=Math.cos(w), sw=Math.sin(w), cO=Math.cos(O), sO=Math.sin(O), ci=Math.cos(inc), si=Math.sin(inc);
  return [
    (cw*cO - sw*sO*ci)*xp + (-sw*cO - cw*sO*ci)*yp,
    (cw*sO + sw*cO*ci)*xp + (-sw*sO + cw*cO*ci)*yp,
    (sw*si)*xp + (cw*si)*yp
  ];
}
/* Os elementos de Standish/JPL dão longitudes na eclíptica J2000; Sol e Lua (Meeus) já estão na eclíptica DA DATA.
   Soma-se a precessão geral em longitude (IAU 1976: 5029,0966″ por século juliano em J2000 = 1,3969713°/século;
   Fricke 1977; IAU/IERS) para pôr os planetas no mesmo referencial. Termo de 2ª ordem (~1,1″/século²) desprezível. */
function geoLon(T,key,earth){ const e=earth||helioXYZ('earth',T), p=helioXYZ(key,T); return reduceDeg(Math.atan2(p[1]-e[1], p[0]-e[0])/D2R + 1.3969713 * T); }
function computePositions(date){
  const T=centuries(date), earth=helioXYZ('earth',T);
  const elong=reduceDeg(moonLon(T)-sunLon(T));
  return {
    moon:moonLon(T), mercury:geoLon(T,'mercury',earth), venus:geoLon(T,'venus',earth), sun:sunLon(T),
    mars:geoLon(T,'mars',earth), jupiter:geoLon(T,'jupiter',earth), saturn:geoLon(T,'saturn',earth),
    elongation:elong, illum:(1-Math.cos(elong*D2R))/2
  };
}
function phaseIndex(elong){return Math.floor((((elong%360)+360)%360 + 22.5)/45)%8;}
function phaseName(elong){return PHASE_NAMES[phaseIndex(elong)];}
function zodiacPos(lon){
  const l=reduceDeg(lon), s=Math.floor(l/30), dd=l-s*30, dg=Math.floor(dd);
  let mn=Math.round((dd-dg)*60), d2=dg;
  if(mn===60){mn=0;d2++;}
  return {sign:s,deg:d2,min:mn,text:`${d2}°${String(mn).padStart(2,'0')}′ ${ZODIAC[s].sym} ${ZODIAC[s].name}`};
}
function zodiacSign(lon){return ZODIAC[Math.floor(reduceDeg(lon)/30)%12];}
function eclXYZ(lon,r){const l=lon*D2R,t=23.5*D2R;return[Math.cos(l)*r,Math.sin(l)*Math.sin(t)*r,Math.sin(l)*Math.cos(t)*r];}

const START=new Date();
const KEYS=['moon','mercury','venus','sun','mars','jupiter','saturn'];
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

/* ===================== MAPA ASTRAL (modo "astral") =====================
   Mapa do momento: signos no anel externo, os 7 astros nas órbitas e, no centro,
   um mostrador de 24 h em hora solar verdadeira do local. O mapa inteiro gira
   para que o Sol (longitude real) caia no ângulo da hora solar:
   meio-dia no topo, meia-noite embaixo, nascente à esquerda, poente à direita.
   Os signos crescem em sentido anti-horário (convenção das cartas astrais). */
const loc={lat:null,lon:-new Date().getTimezoneOffset()/4,src:'fuso',acc:null,pending:false,asked:false};
let astralHover=false,astralInfoText='';
const SYMF='\uFE0E';
/* escapa texto vindo de dados antes de entrar em innerHTML ou em atributo (data-info, alt, style) */
const ESC_MAP={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>ESC_MAP[c]);
const AS={cx:500,cy:500,rD:108,rO0:146,rO1:360,rS0:394,rS1:452};
const zText=lon=>{const z=zodiacPos(lon);return `${z.deg}°${String(z.min).padStart(2,'0')}′ ${ZODIAC[z.sign].sym}${SYMF} ${ZODIAC[z.sign].name}`;};
const zPlain=lon=>{const z=zodiacPos(lon);return `${z.deg}°${String(z.min).padStart(2,'0')}′ de ${ZODIAC[z.sign].name}`;};
const dd=(v,n=1)=>v.toFixed(n).replace('.',',');
const sgn=(v,n=1)=>(v<0?'−':'+')+dd(Math.abs(v),n);
function fmtH(h,sec){h=((h%24)+24)%24;const t=Math.floor(h*3600+1e-6),p=n=>String(n).padStart(2,'0');return sec?`${p(Math.floor(t/3600))}:${p(Math.floor(t%3600/60))}:${p(t%60)}`:`${p(Math.floor(t/3600))}:${p(Math.floor(t%3600/60))}`;}
function equationOfTime(T){
  const e=0.016708634-0.000042037*T,eps=(23.439291-0.0130042*T)*D2R;
  const L0=reduceDeg(280.46646+36000.76983*T)*D2R,M=reduceDeg(357.52911+35999.05029*T)*D2R,y=Math.tan(eps/2)**2;
  const E=y*Math.sin(2*L0)-2*e*Math.sin(M)+4*e*y*Math.sin(M)*Math.cos(2*L0)-0.5*y*y*Math.sin(4*L0)-1.25*e*e*Math.sin(2*M);
  return E/D2R*4; /* minutos */
}
function computeAstralRaw(date,L){
  const T=centuries(date),pos=computePositions(date),later=computePositions(new Date(date.getTime()+3600000));
  const utcH=date.getUTCHours()+date.getUTCMinutes()/60+(date.getUTCSeconds()+date.getUTCMilliseconds()/1000)/3600;
  const civilH=date.getHours()+date.getMinutes()/60+(date.getSeconds()+date.getMilliseconds()/1000)/3600;
  const eot=equationOfTime(T);
  const solarH=(((utcH+L.lon/15+eot/60)%24)+24)%24;
  const dec=Math.asin(Math.sin(23.4393*D2R)*Math.sin(pos.sun*D2R));
  const known=L.lat!=null,phi=(known?L.lat:0)*D2R;
  let rise=null,set=null,polar=null,alt=null;
  const den=Math.cos(phi)*Math.cos(dec);
  if(Math.abs(den)<1e-9)polar=(phi*dec>0)?'dia':'noite';
  else{
    const c0=(Math.sin(-0.833*D2R)-Math.sin(phi)*Math.sin(dec))/den;
    if(c0>1)polar='noite';else if(c0<-1)polar='dia';
    else{const H0=Math.acos(c0)/D2R;rise=12-H0/15;set=12+H0/15;}
  }
  if(known)alt=Math.asin(Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos((solarH-12)*15*D2R))/D2R;
  let off=civilH-solarH;off=(((off+12)%24)+24)%24-12;
  const bodies=PLANETS_DEF.map((p,i)=>{
    const lon=pos[KEYS[i]],d=((later[KEYS[i]]-lon+540)%360)-180;
    return {...p,lon,retro:i!==0&&i!==3&&d<0,z:zodiacPos(lon)};
  });
  return {date,solarH,civilH,eot,dec:dec/D2R,rise,set,polar,alt,known,off,bodies,laterLons:KEYS.map(k=>later[k]),sunLon:pos.sun,elong:pos.elongation,sunAng:180+solarH*15,lat:known?L.lat:null,lon:L.lon};
}
/* Memoização do mapa astral (C1): a chave é o instante arredondado ao segundo + a localização.
   Guarda poucas entradas (as consultas de velocidade do astral.js usam instantes vizinhos e não
   podem expulsar o instante principal). O objeto devolvido é compartilhado: não o modifique. */
const ASTRAL_CACHE=new Map(),ASTRAL_CACHE_MAX=8;
function computeAstral(date,L){
  const key=Math.floor(date.getTime()/1000)+'|'+L.lat+'|'+L.lon;
  let A=ASTRAL_CACHE.get(key);
  if(A)return A;
  A=computeAstralRaw(date,L);
  ASTRAL_CACHE.set(key,A);
  if(ASTRAL_CACHE.size>ASTRAL_CACHE_MAX)ASTRAL_CACHE.delete(ASTRAL_CACHE.keys().next().value);
  return A;
}
function buildAstralSVG(A){
  const cx=AS.cx,cy=AS.cy,rD=AS.rD,rS0=AS.rS0,rS1=AS.rS1;
  const ang=lon=>A.sunAng-(lon-A.sunLon);
  const P=(r,a)=>[cx+r*Math.sin(a*D2R),cy-r*Math.cos(a*D2R)];
  const f=v=>v.toFixed(1);
  const rOrb=b=>AS.rO0+(b.orbR-.18)/.68*(AS.rO1-AS.rO0);
  const SYM="font-family:'Noto Sans Symbols','Noto Sans Symbols 2','Segoe UI Symbol',serif";
  const UI="font-family:'Inter',system-ui,sans-serif";
  const arc=(r1,r2,a1,a2)=>{const lg=(a2-a1)>180?1:0,[x1,y1]=P(r2,a1),[x2,y2]=P(r2,a2),[x3,y3]=P(r1,a2),[x4,y4]=P(r1,a1);
    return `M${f(x1)} ${f(y1)}A${r2} ${r2} 0 ${lg} 1 ${f(x2)} ${f(y2)}L${f(x3)} ${f(y3)}A${r1} ${r1} 0 ${lg} 0 ${f(x4)} ${f(y4)}Z`;};
  let s=`<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(`Mapa astral do momento. Sol em ${zPlain(A.sunLon)}; Lua em ${zPlain(A.bodies[0].lon)}. A leitura completa de cada astro, em texto, está nos cartões abaixo do mapa.`)}">`;
  s+=`<defs><radialGradient id="aDay" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#f3d08a" stop-opacity=".08"/><stop offset="1" stop-color="#f3d08a" stop-opacity=".38"/></radialGradient>`+
     `<radialGradient id="aEarth" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#5599EE" stop-opacity=".55"/><stop offset="1" stop-color="#5599EE" stop-opacity="0"/></radialGradient>`+
     `<filter id="aGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
  s+=`<circle cx="${cx}" cy="${cy}" r="466" fill="rgba(10,14,20,.6)" stroke="${ha('#4a7dd8',.22)}"/><circle cx="${cx}" cy="${cy}" r="460" fill="none" stroke="${ha('#c9a84c',.2)}"/>`;

  /* anel dos 12 signos (o mais externo) */
  const sunSign=Math.floor(A.sunLon/30);
  for(let k=0;k<12;k++){
    const z=ZODIAC[k],a1=ang(z.sd+30),[x,y]=P((rS0+rS1)/2,ang(z.sd+15));
    s+=`<g data-info="${esc(`${z.sym}${SYMF} ${z.name} — ${z.sd}°–${z.sd+30}° da eclíptica`)}"><path d="${arc(rS0,rS1,a1,a1+30)}" fill="${ha(z.col,k===sunSign?.3:.14)}" stroke="${ha(z.col,.55)}" stroke-width="1"/>`+
       `<text x="${f(x)}" y="${f(y)}" text-anchor="middle" dominant-baseline="central" font-size="34" fill="${ha(z.col,.95)}" style="${SYM}">${z.sym}${SYMF}</text></g>`;
  }
  s+=`<circle cx="${cx}" cy="${cy}" r="${rS0}" fill="none" stroke="${ha('#c9a84c',.45)}"/>`;
  /* escala de graus (1°, 5°, 10°) e raios nos limites dos signos */
  let t1='',t5='',t10='',rays='';
  for(let d=0;d<360;d++){
    const a=ang(d),len=d%10===0?11:d%5===0?7:3.5,[x1,y1]=P(rS0,a),[x2,y2]=P(rS0-len,a),seg=`M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;
    if(d%10===0)t10+=seg;else if(d%5===0)t5+=seg;else t1+=seg;
    if(d%30===0){const [r1x,r1y]=P(rD+6,a);rays+=`M${f(r1x)} ${f(r1y)}L${f(x1)} ${f(y1)}`;}
  }
  s+=`<path d="${rays}" stroke="rgba(100,120,180,.16)" stroke-dasharray="3 6" fill="none"/>`+
     `<path d="${t1}" stroke="${ha('#c8d8ea',.22)}" fill="none"/><path d="${t5}" stroke="${ha('#c8d8ea',.4)}" fill="none"/><path d="${t10}" stroke="${ha('#c8d8ea',.65)}" fill="none"/>`;

  /* órbitas */
  A.bodies.forEach(b=>{s+=`<circle cx="${cx}" cy="${cy}" r="${f(rOrb(b))}" fill="none" stroke="${ha(b.col,.3)}" stroke-width="1.3"/>`;});

  /* mostrador de 24 h (hora solar verdadeira) */
  s+=`<g data-info="${esc(`Mostrador solar — hora solar verdadeira ${fmtH(A.solarH,true)}`)}"><circle cx="${cx}" cy="${cy}" r="${rD}" fill="#0b1220" stroke="${ha('#c9a84c',.85)}" stroke-width="1.5"/>`;
  let rimMarks='';
  if(A.polar==='dia')s+=`<circle cx="${cx}" cy="${cy}" r="${rD}" fill="url(#aDay)"/>`;
  else if(A.rise!=null){
    const a1=180+A.rise*15,a2=180+A.set*15,[x1,y1]=P(rD,a1),[x2,y2]=P(rD,a2);
    s+=`<path d="M${cx} ${cy}L${f(x1)} ${f(y1)}A${rD} ${rD} 0 ${(a2-a1)>180?1:0} 1 ${f(x2)} ${f(y2)}Z" fill="url(#aDay)"/>`;
    [a1,a2].forEach(a=>{const [p1x,p1y]=P(rD-3,a),[p2x,p2y]=P(rD+11,a);rimMarks+=`<line x1="${f(p1x)}" y1="${f(p1y)}" x2="${f(p2x)}" y2="${f(p2y)}" stroke="#f3d08a" stroke-width="2.2" stroke-linecap="round"/>`;});
  }
  for(let h=0;h<24;h++){
    const a=180+h*15,len=h%6===0?14:h%3===0?9:5,[x1,y1]=P(rD-len,a),[x2,y2]=P(rD,a);
    s+=`<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="#e8dcc0" stroke-opacity="${h%3===0?.7:.4}"/>`;
    if(h%3===0){const [tx,ty]=P(rD-28,a),major=h%6===0;
      s+=`<text x="${f(tx)}" y="${f(ty)}" text-anchor="middle" dominant-baseline="central" font-size="${major?13:10}" fill="${major?'#f3d08a':'#c8d8ea'}" opacity="${major?.95:.7}" style="${UI};font-weight:${major?600:400}">${String(h).padStart(2,'0')}</text>`;}
  }
  s+=rimMarks+`</g>`;

  /* haste do Sol: do centro até a órbita do Sol, no ângulo da hora solar */
  const sunB=A.bodies[3],[hx,hy]=P(rOrb(sunB),A.sunAng),[tx2,ty2]=P(rD,A.sunAng);
  s+=`<line x1="${cx}" y1="${cy}" x2="${f(hx)}" y2="${f(hy)}" stroke="#f3d08a" stroke-width="2.6" stroke-linecap="round" filter="url(#aGlow)"/>`;
  s+=`<circle cx="${f(tx2)}" cy="${f(ty2)}" r="6" fill="#f3d08a" stroke="#0b1120" stroke-width="1" filter="url(#aGlow)"/>`;
  s+=`<circle cx="${cx}" cy="${cy}" r="26" fill="url(#aEarth)"/><circle cx="${cx}" cy="${cy}" r="6" fill="#5599EE" stroke="#0b1120" stroke-width="1.5"/>`;

  /* astros: linha-guia até a escala de graus + marcador na própria órbita */
  A.bodies.forEach((b,i)=>{
    const a=ang(b.lon),r=rOrb(b),[x,y]=P(r,a),[g1x,g1y]=P(r+13,a),[g2x,g2y]=P(rS0,a),[k1x,k1y]=P(rS0-12,a),[lx,ly]=P(r+23,a);
    s+=`<line x1="${f(g1x)}" y1="${f(g1y)}" x2="${f(g2x)}" y2="${f(g2y)}" stroke="${ha(b.col,i===3?.55:.35)}" stroke-width="1" stroke-dasharray="${i===3?'none':'2 5'}"/>`+
       `<line x1="${f(k1x)}" y1="${f(k1y)}" x2="${f(g2x)}" y2="${f(g2y)}" stroke="${b.col}" stroke-width="3" stroke-linecap="round"/>`;
    const lit=Math.round((1-Math.cos(A.elong*D2R))/2*100);
    const info=`${b.sym}${SYMF} ${b.name} — ${zText(b.lon)}${b.retro?' · retrógrado':''}${i===0?` · ${phaseName(A.elong)} (${lit}% iluminada)`:''}`;
    s+=`<g data-info="${esc(info)}"><circle cx="${f(x)}" cy="${f(y)}" r="24" fill="transparent"/>`;
    if(i===0){
      const R=13,cE=Math.cos(A.elong*D2R),rx=Math.abs(R*cE).toFixed(2);
      s+=`<g transform="translate(${f(x)} ${f(y)})${A.elong>180?' scale(-1 1)':''}"><circle r="${R}" fill="#141a26" stroke="${ha('#9FB0C8',.6)}"/>`+
         `<path d="M0 ${-R}A${R} ${R} 0 0 1 0 ${R}A${rx} ${R} 0 0 ${cE>0?0:1} 0 ${-R}Z" fill="#F0EBD8"/></g>`;
    }else if(i===3){
      let ry='';for(let k=0;k<8;k++){const t=k*Math.PI/4;ry+=`<line x1="${f(x+13*Math.sin(t))}" y1="${f(y-13*Math.cos(t))}" x2="${f(x+17.5*Math.sin(t))}" y2="${f(y-17.5*Math.cos(t))}" stroke="#f3d08a" stroke-width="1.6" stroke-linecap="round"/>`;}
      s+=`<g filter="url(#aGlow)">${ry}<circle cx="${f(x)}" cy="${f(y)}" r="10.5" fill="#f3d08a" stroke="#0b1120"/></g>`+
         `<text x="${f(x)}" y="${f(y)}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="700" fill="#0a0e14" style="${SYM}">${b.sym}${SYMF}</text>`;
    }else{
      s+=`<circle cx="${f(x)}" cy="${f(y)}" r="11" fill="${ha(b.col,.92)}" stroke="#0a0e14" stroke-width="1.5"/>`+
         `<text x="${f(x)}" y="${f(y)}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="700" fill="#0a0e14" style="${SYM}">${b.sym}${SYMF}</text>`;
    }
    s+=`<text x="${f(lx)}" y="${f(ly)}" text-anchor="middle" dominant-baseline="central" font-size="10" fill="${ha(b.col,.95)}" stroke="#0a0e14" stroke-width="3" paint-order="stroke" style="${UI}">${b.z.deg}°${b.retro?'℞':''}</text></g>`;
  });

  /* estrelas fixas em conjunção — desenho vindo do módulo astral (astral.js) */
  if(window.AstralStars){try{s+=AstralStars.svg(A,{ang:ang,P:P,f:f,rOrb:rOrb,ha:ha,rS0:rS0});}catch(e){}}
  /* Ascendente e Meio do Céu — desenho vindo do módulo astral (astral.js) */
  if(window.AstralPoints){try{s+=AstralPoints.svg(A,{ang:ang,P:P,f:f,ha:ha,rS0:rS0,rS1:rS1});}catch(e){}}

  /* rótulos das direções do mostrador */
  const lab=`font-size="12" letter-spacing="3" fill="#5b7183" text-anchor="middle" dominant-baseline="central" style="${UI};font-style:italic"`;
  s+=`<text x="500" y="18" ${lab}>MEIO-DIA</text><text x="500" y="982" ${lab}>MEIA-NOITE</text>`+
     `<text transform="translate(18 500) rotate(-90)" ${lab}>NASCENTE</text><text transform="translate(982 500) rotate(90)" ${lab}>POENTE</text>`;
  return s+`</svg>`;
}
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
    astralInfoText=`✦ Mapa astral · ${fmtH(A.civilH)} (hora solar ${fmtH(A.solarH)}) · ☉ ${zText(A.sunLon)}`;
  }
  if(!astralHover&&infoBar.textContent!==astralInfoText)infoBar.textContent=astralInfoText;
  if(window.AstralPanel){try{AstralPanel.frame(A,!!force);}catch(e){}}
}
function requestLocation(force){
  if(loc.pending||(loc.asked&&!force))return;
  loc.asked=true;
  if(!navigator.geolocation)return;
  loc.pending=true;
  navigator.geolocation.getCurrentPosition(p=>{
    loc.lat=p.coords.latitude;loc.lon=p.coords.longitude;loc.acc=p.coords.accuracy;loc.src='gps';loc.pending=false;
    if(state.viewMode==='astral')renderAstral(true);
  },()=>{
    loc.pending=false;
    if(state.viewMode==='astral')renderAstral(true);
  },{enableHighAccuracy:false,timeout:10000,maximumAge:600000});
  if(state.viewMode==='astral')renderAstral(true);
}
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

function setMode(m){state.viewMode=m;document.querySelectorAll('#ou-mode-group .ou-pill').forEach(b=>{const on=b.dataset.mode===m;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on?'true':'false');});document.getElementById('ouranosView').classList.toggle('astral-on',m==='astral');buildLegend();if(m==='astral'){astralHover=false;requestLocation();renderAstral(true);}else{infoBar.textContent=defaultInfo();}}
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

let started=false;
function init(){
  if(started)return;started=true;
  setMode(state.viewMode);setSpeed(state.simSpeed);
  canvas.width=W;canvas.height=H;buildLegend();buildCatalog();
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
  setLocation(lat,lon){loc.lat=lat;loc.lon=lon;loc.src='gps';loc.asked=true;if(state.viewMode==='astral')renderAstral(true);},
  activate(){init();state.active=true;infoBar.textContent=defaultInfo();if(state.viewMode==='astral')renderAstral(true);},
  deactivate(){state.active=false;},
  /* usado pelo astral.js após mudar o relógio: redesenha já (sem esperar o animLoop) */
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
