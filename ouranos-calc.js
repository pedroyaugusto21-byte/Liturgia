/* ======================================================================
   URANO — CÁLCULO (OuranosCalc)
   Constantes, projeção 3D, efemérides (Sol/Lua de Meeus; planetas de Standish/JPL) e Mapa Astral
   (cálculo do momento + SVG em texto). SEM acesso ao DOM, ao canvas nem a estado de interface.
   Separado de ouranos.js sem mudar nenhuma fórmula: o código abaixo foi MOVIDO, não reescrito.
   Exporta um único global novo: window.OuranosCalc (lido por ouranos.js no início).
   Carregar DEPOIS de ouranos-data.js e ANTES de ouranos.js.
   ====================================================================== */
window.OuranosCalc = (function () {
const D2R = Math.PI / 180;

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

const KEYS=['moon','mercury','venus','sun','mars','jupiter','saturn'];
/* ===================== MAPA ASTRAL (modo "astral") =====================
   Mapa do momento: signos no anel externo, os 7 astros nas órbitas e, no centro,
   um mostrador de 24 h em hora solar verdadeira do local. O mapa inteiro gira
   para que o Sol (longitude real) caia no ângulo da hora solar:
   meio-dia no topo, meia-noite embaixo, nascente à esquerda, poente à direita.
   Os signos crescem em sentido anti-horário (convenção das cartas astrais). */
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
/* Nascer do Sol (etapa A do Calendarium): instante do nascer MAIS PRÓXIMO de refMs, no local (lat, lon).
   Usa as mesmas fórmulas de computeAstralRaw (declinação por sunLon, equação do tempo, altura -0,833°),
   mas sem calcular planetas e sem tocar no cache do mapa astral (é chamada várias vezes por segundo no relógio).
   Devolve { ms, polar }: ms = instante do nascer (epoch ms) ou null; polar = 'dia' (Sol não se põe),
   'noite' (Sol não nasce) ou null. Itera 3 vezes: a declinação e a equação do tempo são reavaliadas no
   instante encontrado, e o resultado estabiliza em menos de 1 s. */
function sunriseNear(refMs,lat,lon){
  const phi=lat*D2R;let t=refMs;
  for(let i=0;i<3;i++){
    const d=new Date(t),T=centuries(d);
    const dec=Math.asin(Math.sin(23.4393*D2R)*Math.sin(sunLon(T)*D2R));
    const den=Math.cos(phi)*Math.cos(dec);
    if(Math.abs(den)<1e-9)return {ms:null,polar:(phi*dec>0)?'dia':'noite'};
    const c0=(Math.sin(-0.833*D2R)-Math.sin(phi)*Math.sin(dec))/den;
    if(c0>1)return {ms:null,polar:'noite'};
    if(c0<-1)return {ms:null,polar:'dia'};
    const rise=12-Math.acos(c0)/D2R/15;
    const utcH=d.getUTCHours()+d.getUTCMinutes()/60+(d.getUTCSeconds()+d.getUTCMilliseconds()/1000)/3600;
    const solarH=(((utcH+lon/15+equationOfTime(T)/60)%24)+24)%24;
    const delta=(((rise-solarH+12)%24)+24)%24-12;   /* menor deslocamento, em horas, até a hora solar do nascer */
    t+=delta*3600000;
  }
  return {ms:t,polar:null};
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

return { D2R, ZODIAC, INNER_RINGS, OUTER_RINGS, OUTER_SCALE, PLANETS_DEF, PHASE_NAMES, ha, reduceDeg, sinD, cosD, matMul, rotX, rotY, applyMat, proj, raDecXYZ, magR, magO, getRingPts, julianDay, centuries, sunLon, moonLon, ELEMENTS, helioXYZ, geoLon, computePositions, phaseIndex, phaseName, zodiacPos, zodiacSign, eclXYZ, KEYS, SYMF, ESC_MAP, esc, AS, zText, zPlain, dd, sgn, fmtH, equationOfTime, computeAstralRaw, sunriseNear, ASTRAL_CACHE, computeAstral, buildAstralSVG, ASTRAL_CACHE_MAX };
})();
