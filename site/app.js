(async function(){
"use strict";
const $=id=>document.getElementById(id);

/* ---------- toast ---------- */
let toastT;
function toast(msg){ const t=$("toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),3200); }
function store(k,v){ try{ if(v===undefined) return JSON.parse(localStorage.getItem(k)||"null"); localStorage.setItem(k,JSON.stringify(v)); }catch(e){ return null; } }

/* =====================================================================
   TABS
   ===================================================================== */
const tabs=[...document.querySelectorAll(".tab")];
const TABS=["rosary","mass","booklets"];
function showTab(name){
  if(!TABS.includes(name)) name="rosary";
  tabs.forEach(t=>t.setAttribute("aria-selected",t.dataset.tab===name?"true":"false"));
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("on",v.id==="view-"+name));
  store("ave-tab",name);
  try{ history.replaceState(null,"","#"+name); }catch(e){}
  if(name==="booklets") renderBooklet();
}
tabs.forEach(t=>t.addEventListener("click",()=>showTab(t.dataset.tab)));

/* =====================================================================
   ROSARY
   ===================================================================== */
const PR = {
  sign:{t:"Sign of the Cross", x:"In the name of the Father, and of the Son, and of the Holy Spirit. Amen."},
  creed:{t:"Apostles\u2019 Creed", x:"I believe in God, the Father almighty, Creator of heaven and earth; and in Jesus Christ, his only Son, our Lord, who was conceived by the Holy Spirit, born of the Virgin Mary, suffered under Pontius Pilate, was crucified, died, and was buried. He descended into hell; the third day he rose again from the dead; he ascended into heaven, and sits at the right hand of God, the Father almighty; from thence he shall come to judge the living and the dead. I believe in the Holy Spirit, the holy catholic Church, the communion of saints, the forgiveness of sins, the resurrection of the body, and life everlasting. Amen."},
  our:{t:"Our Father", x:"Our Father, who art in heaven, hallowed be thy name; thy kingdom come; thy will be done on earth as it is in heaven. Give us this day our daily bread; and forgive us our trespasses, as we forgive those who trespass against us; and lead us not into temptation, but deliver us from evil. Amen."},
  hail:{t:"Hail Mary", x:"Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen."},
  glory:{t:"Glory Be", x:"Glory be to the Father, and to the Son, and to the Holy Spirit. As it was in the beginning, is now, and ever shall be, world without end. Amen."},
  fatima:{t:"Fatima Prayer", x:"O my Jesus, forgive us our sins, save us from the fires of hell; lead all souls to heaven, especially those in most need of thy mercy."},
  queen:{t:"Hail, Holy Queen", x:"Hail, holy Queen, Mother of mercy, our life, our sweetness, and our hope. To thee do we cry, poor banished children of Eve. To thee do we send up our sighs, mourning and weeping in this valley of tears. Turn then, most gracious advocate, thine eyes of mercy toward us; and after this our exile, show unto us the blessed fruit of thy womb, Jesus. O clement, O loving, O sweet Virgin Mary.",
    vr:[["V.","Pray for us, O holy Mother of God."],["R.","That we may be made worthy of the promises of Christ."]]},
  closing:{t:"Closing Prayer", x:"Let us pray. O God, whose only-begotten Son, by his life, death, and resurrection, has purchased for us the rewards of eternal life; grant, we beseech thee, that meditating upon these mysteries of the most holy Rosary of the Blessed Virgin Mary, we may imitate what they contain and obtain what they promise, through the same Christ our Lord. Amen."}
};
const SETS = {
  joyful:{name:"Joyful mysteries", adj:"joyful", days:"Mondays and Saturdays", dow:[1,6], m:[
    ["The Annunciation","Luke 1:26\u201338","humility","The angel Gabriel brings God\u2019s message, and Mary answers yes."],
    ["The Visitation","Luke 1:39\u201356","love of neighbor","Mary hurries to help her cousin Elizabeth, and the child in Elizabeth leaps for joy."],
    ["The Nativity","Luke 2:1\u201320","poverty of spirit","Jesus is born in Bethlehem and laid in a manger."],
    ["The Presentation in the Temple","Luke 2:22\u201338","obedience","Mary and Joseph bring the child to the Temple, and old Simeon knows him."],
    ["The Finding in the Temple","Luke 2:41\u201352","joy in finding Jesus","After three days of searching, they find Jesus among the teachers."]]},
  sorrowful:{name:"Sorrowful mysteries", adj:"sorrowful", days:"Tuesdays and Fridays", dow:[2,5], m:[
    ["The Agony in the Garden","Matthew 26:36\u201346","sorrow for sin","Jesus prays in Gethsemane: not my will, but yours be done."],
    ["The Scourging at the Pillar","John 19:1","purity","Jesus is bound and whipped, and he bears it in silence."],
    ["The Crowning with Thorns","Matthew 27:27\u201331","courage","The soldiers mock Jesus as a king and press thorns onto his head."],
    ["The Carrying of the Cross","Luke 23:26\u201332","patience","Jesus carries the cross to Calvary, and Simon helps him."],
    ["The Crucifixion","Luke 23:33\u201346","perseverance","Jesus forgives, gives us his mother, and gives up his spirit."]]},
  glorious:{name:"Glorious mysteries", adj:"glorious", days:"Wednesdays and Sundays", dow:[3,0], m:[
    ["The Resurrection","Matthew 28:1\u201310","faith","The tomb is empty. Christ is risen, as he said."],
    ["The Ascension","Acts 1:6\u201311","hope","Jesus blesses his friends and goes up to the Father."],
    ["The Descent of the Holy Spirit","Acts 2:1\u201313","love of God","Tongues of fire rest on the apostles, and they speak with boldness."],
    ["The Assumption of Mary","Revelation 11:19\u201312:1","the grace of a holy death","Mary is taken up, body and soul, into heaven."],
    ["The Coronation of Mary","Revelation 12:1","trust in Mary\u2019s prayers","Mary is crowned Queen of heaven and earth."]]},
  luminous:{name:"Luminous mysteries", adj:"luminous", days:"Thursdays", dow:[4], m:[
    ["The Baptism in the Jordan","Matthew 3:13\u201317","openness to the Holy Spirit","The heavens open, and the Father says: this is my beloved Son."],
    ["The Wedding at Cana","John 2:1\u201311","to Jesus through Mary","Mary says, do whatever he tells you, and the water becomes wine."],
    ["The Proclamation of the Kingdom","Mark 1:14\u201315","conversion","Jesus calls all people to turn back to God and believe."],
    ["The Transfiguration","Luke 9:28\u201336","desire for holiness","On the mountain, Jesus shines with the glory of God."],
    ["The Institution of the Eucharist","Luke 22:14\u201320","adoration","At the Last Supper, Jesus gives us his Body and Blood."]]}
};
const ORD=["first","second","third","fourth","fifth"];
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const todaySet=()=>{ const d=new Date().getDay(); return Object.keys(SETS).find(k=>SETS[k].dow.includes(d)); };

const KEY="rosary-v1";
const FS=[16,17.5,19,21,23.5,26];
const S={set:todaySet(),cur:0,fatima:true,words:true,wake:true,fs:2,t:0,seen:false};
let resumed=false;
(function(){ const o=store(KEY); if(o){
  ["fatima","words","wake","fs","seen"].forEach(k=>{ if(k in o) S[k]=o[k]; });
  if(o.cur>0 && SETS[o.set] && Date.now()-o.t<6*3600e3){ S.set=o.set; S.cur=o.cur; resumed=true; }
}})();
function save(){ S.t=Date.now(); store(KEY,S); }

let steps=[], firstIdx={};
function build(){
  const s=[]; const add=(bead,key,o)=>s.push(Object.assign({bead,key},o||{}));
  add("cross","sign",{ph:"open"}); add("cross","creed",{ph:"open"}); add("p1","our",{ph:"open"});
  ["faith","hope","charity"].forEach((v,i)=>add("p"+(2+i),"hail",{ph:"open",n:i+1,of:3,intent:v}));
  add("p5","glory",{ph:"open"});
  for(let d=0;d<5;d++){
    const big=d===0?"p5":"L"+d;
    add(big,"mystery",{d}); add(big,"our",{d});
    for(let i=0;i<10;i++) add("D"+d+"-"+i,"hail",{d,n:i+1,of:10});
    const after=d<4?"L"+(d+1):"medal";
    add(after,"glory",{d}); if(S.fatima) add(after,"fatima",{d});
  }
  add("medal","queen",{ph:"close"}); add("medal","closing",{ph:"close"}); add("cross","sign",{ph:"close",last:true});
  steps=s; firstIdx={}; s.forEach((st,i)=>{ if(!(st.bead in firstIdx)) firstIdx[st.bead]=i; });
}

const NS="http://www.w3.org/2000/svg";
const CX=150, CY=140, R=118, GAP=15*Math.PI/180, RS=4.3, RL=6.6;
const pos={};
function el(tag,attrs,parent){ const e=document.createElementNS(NS,tag); for(const k in attrs) e.setAttribute(k,attrs[k]); if(parent) parent.appendChild(e); return e; }
function loopPositions(cx,cy,r,gap,rs,rl){
  const loop=[], out={};
  for(let d=0;d<5;d++){ for(let i=0;i<10;i++) loop.push({id:"D"+d+"-"+i,r:rs}); if(d<4) loop.push({id:"L"+(d+1),r:rl}); }
  const total=loop.reduce((a,b)=>a+2*b.r,0), avail=r*(2*Math.PI-2*gap), sp=(avail-total)/(loop.length-1);
  let a=0; loop.forEach(b=>{ const th=gap+(a+b.r)/r; out[b.id]={x:cx+r*Math.sin(th),y:cy+r*Math.cos(th),r:b.r}; a+=2*b.r+sp; });
  return out;
}
function layout(){
  Object.assign(pos,loopPositions(CX,CY,R,GAP,RS,RL));
  pos.medal={x:150,y:263,r:8}; pos.p5={x:150,y:290,r:RL}; pos.p4={x:150,y:306,r:RS};
  pos.p3={x:150,y:319,r:RS}; pos.p2={x:150,y:332,r:RS}; pos.p1={x:150,y:350,r:RL}; pos.cross={x:150,y:383,r:10};
}
const beadEls={};
function drawRosary(){
  const chain=$("chainLayer"), layer=$("beadLayer");
  const p0={x:CX-R*Math.sin(GAP),y:CY+R*Math.cos(GAP)}, p1={x:CX+R*Math.sin(GAP),y:CY+R*Math.cos(GAP)};
  el("path",{class:"chain",d:`M${p0.x} ${p0.y} A${R} ${R} 0 1 1 ${p1.x} ${p1.y}`},chain);
  el("path",{class:"chain",d:`M${p0.x} ${p0.y} L150 ${pos.medal.y-6} L${p1.x} ${p1.y}`},chain);
  el("line",{class:"chain",x1:150,y1:pos.medal.y,x2:150,y2:364},chain);
  Object.keys(pos).forEach(id=>{ if(id==="cross"||id==="medal") return; const p=pos[id];
    beadEls[id]=el("circle",{class:"bead",cx:p.x.toFixed(2),cy:p.y.toFixed(2),r:p.r},layer); });
  el("ellipse",{class:"medal",cx:150,cy:pos.medal.y,rx:7,ry:9},layer);
  el("path",{d:`M150 ${pos.medal.y-4} l1.1 2.9 2.9 1.1 -2.9 1.1 -1.1 2.9 -1.1 -2.9 -2.9 -1.1 2.9 -1.1z`,fill:"var(--on-gold)","fill-opacity":".8"},layer);
  const g=el("g",{class:"cross-shape"},layer); beadEls.cross=g;
  el("rect",{x:147.4,y:364,width:5.2,height:38,rx:1.2},g); el("rect",{x:135,y:373,width:30,height:5.2,rx:1.2},g);
  [[150,363],[150,403],[134,375.6],[166,375.6]].forEach(c=>el("circle",{cx:c[0],cy:c[1],r:3.3},g));
}
function wrap(text,max){ const words=text.split(" "), lines=[]; let line="";
  words.forEach(w=>{ if((line+" "+w).trim().length>max && line){ lines.push(line); line=w; } else line=(line+" "+w).trim(); });
  if(line) lines.push(line); return lines.slice(0,3); }
function drawCenter(small,title,count){
  const g=$("centerText"); g.textContent="";
  const lines=wrap(title,19), lh=19, y0=CY-((lines.length-1)*lh)/2+5;
  el("text",{class:"c-small",x:CX,y:y0-26},g).textContent=small;
  const t=el("text",{class:"c-title",x:CX,y:y0},g);
  lines.forEach((l,i)=>{ el("tspan",{x:CX,dy:i?lh:0},t).textContent=l; });
  if(count) el("text",{class:"c-count",x:CX,y:y0+(lines.length-1)*lh+26},g).textContent=count;
}
function stepName(st){
  if(st.key==="mystery") return {main:cap(ORD[st.d])+" mystery",sub:SETS[S.set].m[st.d][0]};
  if(st.key==="hail") return {main:"Hail Mary",sub:st.n+" of "+st.of};
  return {main:PR[st.key].t,sub:""};
}
function rubricFor(st){
  const set=SETS[S.set];
  switch(st.key){
    case "sign": return st.last?"End on the crucifix":"Begin on the crucifix";
    case "creed": return "On the crucifix";
    case "our": return st.ph==="open"?"On the first large bead":"On the large bead, "+ORD[st.d]+" decade";
    case "hail": return st.ph==="open"?"For an increase in "+st.intent+", "+st.n+" of 3":cap(ORD[st.d])+" decade, "+st.n+" of 10";
    case "glory": return st.ph==="open"?"On the large bead":"End of the "+ORD[st.d]+" decade";
    case "fatima": return "End of the "+ORD[st.d]+" decade";
    case "mystery": return "The "+ORD[st.d]+" "+set.adj+" mystery";
    case "queen": case "closing": return "On the medal";
  }
  return "";
}
let lastCur=-1;
function render(){
  const set=SETS[S.set], done=S.cur>=steps.length;
  document.documentElement.style.setProperty("--fs",FS[S.fs]+"px");
  $("setName").textContent=set.name; $("setDays").textContent=set.days;
  const curBead=done?null:steps[S.cur].bead;
  Object.keys(beadEls).forEach(id=>{
    const isDone=done||(firstIdx[id]<S.cur&&id!==curBead)||(id==="cross"&&S.cur>0);
    const e=beadEls[id], was=e.classList.contains("done");
    e.classList.toggle("done",isDone);
    e.classList.toggle("cur",id===curBead&&id!=="cross");
    if(isDone&&!was&&S.cur===lastCur+1&&id!=="cross"){ e.classList.remove("just"); try{ void e.getBBox(); }catch(_){} e.classList.add("just"); }
  });
  const halo=$("haloG");
  if(done) halo.style.opacity="0"; else { const p=pos[curBead]; halo.style.opacity="1"; halo.style.transform=`translate(${p.x}px,${p.y}px)`; }
  const card=$("card"), body=$("pbody");
  card.classList.remove("fresh"); void card.offsetWidth; card.classList.add("fresh");
  card.scrollTop=0; body.textContent="";
  if(done){
    drawCenter("Amen","The rosary is complete","");
    $("rubric").textContent="Amen"; $("ptitle").textContent="The rosary is complete";
    const p=document.createElement("p"); p.className="ptext"; p.textContent="You prayed the "+set.name.toLowerCase()+". Go in peace."; body.appendChild(p);
    $("nextMain").textContent="Pray again"; $("nextSub").textContent=""; $("nextBtn").setAttribute("aria-label","Pray the rosary again");
  } else {
    const st=steps[S.cur];
    if(st.ph==="open") drawCenter("Opening prayers","The "+cap(set.adj)+" Mysteries",st.key==="hail"?st.n+" of 3":"");
    else if(st.ph==="close") drawCenter("Closing prayers",PR[st.key].t,"");
    else drawCenter(cap(ORD[st.d])+" decade",set.m[st.d][0],st.key==="hail"?st.n+" of 10":"");
    $("rubric").textContent=rubricFor(st);
    if(st.key==="mystery"){
      const m=set.m[st.d]; $("ptitle").textContent=m[0];
      const p=document.createElement("p"); p.className="ptext"; p.textContent=m[3]; body.appendChild(p);
      const meta=document.createElement("p"); meta.className="meta";
      meta.innerHTML="<span></span><span>Fruit of the mystery: <i></i></span>";
      meta.children[0].textContent=m[1]; meta.querySelector("i").textContent=m[2]; body.appendChild(meta);
    } else {
      const pr=PR[st.key]; $("ptitle").textContent=pr.t;
      if(S.words){
        const p=document.createElement("p"); p.className="ptext"; p.textContent=pr.x;
        (pr.vr||[]).forEach(v=>{ const s=document.createElement("span"); s.className="vr"; s.innerHTML="<b></b>"; s.firstChild.textContent=v[0]; s.appendChild(document.createTextNode(v[1])); p.appendChild(s); });
        body.appendChild(p);
      } else {
        const p=document.createElement("p"); p.className="hidden-words";
        p.textContent=st.d!=null?"Think about "+set.m[st.d][0].replace(/^The /,"the ")+".":"Pray the words from your heart."; body.appendChild(p);
      }
      if(st.key==="hail"&&st.d!=null&&S.words){
        const meta=document.createElement("p"); meta.className="meta";
        meta.innerHTML="<span>Think about <i></i></span>"; meta.querySelector("i").textContent=set.m[st.d][0].replace(/^The /,"the "); body.appendChild(meta);
      }
    }
    const nx=S.cur+1<steps.length?stepName(steps[S.cur+1]):{main:"Finish",sub:""};
    $("nextMain").textContent=nx.main; $("nextSub").textContent=nx.sub;
    $("nextBtn").setAttribute("aria-label","Next: "+nx.main+(nx.sub?", "+nx.sub:""));
  }
  $("backBtn").disabled=S.cur===0; lastCur=S.cur;
}
function buzz(ms){ try{ navigator.vibrate&&navigator.vibrate(ms); }catch(e){} }
function next(){
  if(S.cur>=steps.length){ S.cur=0; lastCur=-1; render(); save(); return; }
  const st=steps[S.cur]; S.cur++;
  buzz(st.key==="hail"&&st.n===10?[12,60,12]:(S.cur>=steps.length?[20,80,20,80,40]:10));
  render(); save(); wakeOn();
}
function back(){ if(S.cur>0){ S.cur--; lastCur=S.cur+1; buzz(6); render(); save(); } }
$("nextBtn").addEventListener("click",next);
$("backBtn").addEventListener("click",back);
$("stage").addEventListener("click",next);
function swipe(node,onLeft,onRight){
  let sx=0,sy=0;
  node.addEventListener("touchstart",e=>{ sx=e.touches[0].clientX; sy=e.touches[0].clientY; },{passive:true});
  node.addEventListener("touchend",e=>{ const dx=e.changedTouches[0].clientX-sx, dy=e.changedTouches[0].clientY-sy;
    if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.6){ dx<0?onLeft():onRight(); } },{passive:true});
}
swipe($("card"),next,back); swipe($("stage"),next,back);
document.addEventListener("keydown",e=>{
  if(document.querySelector("dialog[open]")) return;
  if(e.target.tagName==="BUTTON"&&(e.key===" "||e.key==="Enter")) return;
  const tab=document.querySelector(".tab[aria-selected=true]").dataset.tab;
  if(tab==="rosary"){
    if(e.key==="ArrowRight"||e.key===" "||e.key==="Enter"){ e.preventDefault(); next(); }
    else if(e.key==="ArrowLeft"){ e.preventDefault(); back(); }
  } else if(tab==="mass"){
    if(e.key==="ArrowRight") goDay(1); else if(e.key==="ArrowLeft") goDay(-1);
  }
});
let lock=null;
async function wakeOn(){ if(!S.wake||!("wakeLock" in navigator)||lock) return;
  try{ lock=await navigator.wakeLock.request("screen"); lock.addEventListener("release",()=>{ lock=null; }); }catch(e){} }
function wakeOff(){ if(lock){ lock.release().catch(()=>{}); lock=null; } }
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible") wakeOn(); });

const sheet=$("sheet");
function setSwitch(id,on){ $(id).setAttribute("aria-checked",on?"true":"false"); }
function renderSheet(){
  const box=$("setOpts"); box.textContent=""; const today=todaySet();
  Object.keys(SETS).forEach(k=>{
    const b=document.createElement("button"); b.className="set-opt"; b.setAttribute("aria-pressed",k===S.set?"true":"false");
    b.innerHTML='<span class="n"></span><span class="d"></span>'+(k===today?'<span class="t">Today</span>':"");
    b.querySelector(".n").textContent=cap(SETS[k].adj); b.querySelector(".d").textContent=SETS[k].days;
    b.addEventListener("click",()=>{ S.set=k; renderSheet(); render(); save(); }); box.appendChild(b);
  });
  setSwitch("swFatima",S.fatima); setSwitch("swWords",S.words); setSwitch("swWake",S.wake);
  $("fsVal").textContent=S.fs+1;
  if(!("wakeLock" in navigator)){ $("wakeNote").textContent="This browser cannot keep the screen on"; $("swWake").disabled=true; }
}
function bindSheet(d,closeId){ d.addEventListener("click",e=>{ if(e.target===d) d.close(); }); if(closeId) $(closeId).addEventListener("click",()=>d.close()); }
$("setBtn").addEventListener("click",()=>{ renderSheet(); sheet.showModal(); });
$("optBtn").addEventListener("click",()=>{ renderSheet(); sheet.showModal(); });
bindSheet(sheet,"doneBtn");
$("swFatima").addEventListener("click",()=>{
  const old=steps[S.cur]; S.fatima=!S.fatima; build();
  if(old){ let i=steps.findIndex(x=>x.bead===old.bead&&x.key===old.key&&x.n===old.n&&x.d===old.d&&x.ph===old.ph&&!!x.last===!!old.last); if(i<0) i=firstIdx[old.bead]||0; S.cur=i; } else S.cur=steps.length;
  lastCur=S.cur; renderSheet(); render(); save();
});
$("swWords").addEventListener("click",()=>{ S.words=!S.words; renderSheet(); render(); save(); });
$("swWake").addEventListener("click",()=>{ S.wake=!S.wake; S.wake?wakeOn():wakeOff(); renderSheet(); save(); });
$("fsDown").addEventListener("click",()=>{ S.fs=Math.max(0,S.fs-1); renderSheet(); render(); save(); });
$("fsUp").addEventListener("click",()=>{ S.fs=Math.min(FS.length-1,S.fs+1); renderSheet(); render(); save(); });
$("restartBtn").addEventListener("click",()=>{ S.cur=0; lastCur=-1; sheet.close(); render(); save(); });

/* =====================================================================
   MASS
   ===================================================================== */
const RD={}, TITLES={}, MONTHS={};
let DAYS=[], COMP={};
async function getJSON(u){ const r=await fetch(u,{cache:"no-cache"}); if(!r.ok) throw new Error(u+" "+r.status); return r.json(); }
function loadMonth(m){
  if(!MONTHS[m]) MONTHS[m]=getJSON("data/readings/"+m+".json").then(o=>{ Object.assign(RD,o); return o; }).catch(e=>{ delete MONTHS[m]; throw e; });
  return MONTHS[m];
}
async function ensureDay(k){ if(!RD[k]&&TITLES[k]) await loadMonth(k.slice(0,7)); return RD[k]||null; }
try{ Object.assign(TITLES,await getJSON("data/days.json")); DAYS=Object.keys(TITLES).sort(); }catch(e){}
try{ COMP=await getJSON("data/companion.json"); }catch(e){ COMP={}; }
try{ await loadMonth(iso(new Date()).slice(0,7)); }catch(e){}
const BOOK={
  GEN:"Genesis tells of creation, the fall, and God\u2019s first promises to Abraham and his family.",
  EXO:"Exodus tells how God frees Israel from slavery in Egypt and gives the Law on Mount Sinai.",
  NUM:"Numbers follows Israel through forty years in the desert on the way to the promised land.",
  JDG:"Judges tells of leaders God raises up when Israel falls away and cries out for help.",
  "1SA":"First Samuel tells of the prophet Samuel, King Saul, and the young shepherd David.",
  "2SA":"Second Samuel tells of King David\u2019s reign and God\u2019s promise that his house will last forever.",
  "2CH":"Second Chronicles retells the story of the kings of Judah, with the Temple at the center.",
  JDT:"Judith is the story of a faithful widow whom God uses to save her people.",
  JOB:"Job asks why the just suffer. Job loses everything but does not let go of God.",
  PRO:"Proverbs is a collection of short sayings about how to live wisely before God.",
  SNG:"The Song of Songs is a love poem. The Church reads it as a picture of God\u2019s love for his people.",
  WIS:"Wisdom was written shortly before Christ. It praises God\u2019s wisdom and speaks of life after death.",
  SIR:"Sirach is a book of practical wisdom from a teacher in Jerusalem, about two centuries before Christ.",
  ISA:"Isaiah is the great prophet of hope. Advent listens to him closely because he speaks of the Messiah.",
  JER:"Jeremiah is a prophet who suffers for telling the truth, and who promises a new covenant.",
  EZK:"Ezekiel is a prophet in exile who sees the glory of God and promises a new heart.",
  ZEP:"Zephaniah warns of the day of the Lord and promises joy to a humble, faithful remnant.",
  ZEC:"Zechariah encourages the people who came back from exile to rebuild, and looks forward to the coming King.",
  MAL:"Malachi is the last book of the Old Testament. It promises a messenger who prepares the way of the Lord.",
  MAT:"Matthew writes for Jewish Christians. He shows Jesus as the new Moses and the King promised to Israel.",
  MRK:"Mark is the shortest Gospel. It moves quickly and asks again and again: who is this man?",
  LUK:"Luke shows the mercy of Jesus to the poor, to sinners, and to outsiders. He also wrote Acts.",
  JHN:"John is the last Gospel. It shows Jesus as the eternal Word, through signs and long talks.",
  ACT:"Acts tells how the Holy Spirit leads the first Church from Jerusalem out to the whole world.",
  ROM:"Paul\u2019s letter to Rome is his fullest teaching on sin, grace, faith and life in Christ.",
  "1CO":"Paul writes to a gifted but divided church in Corinth about unity, love and the resurrection.",
  "2CO":"Paul writes again to Corinth about his ministry, weakness, and the strength of God.",
  GAL:"Paul writes to the Galatians that we are made right with God by grace through faith in Christ.",
  EPH:"Ephesians teaches about the Church as the body of Christ, one in him.",
  PHP:"Philippians is a letter of joy, written by Paul from prison.",
  COL:"Colossians teaches that Christ is first over all creation and head of the Church.",
  "1TH":"First Thessalonians is probably Paul\u2019s first letter. It speaks of Christ\u2019s return.",
  "2TH":"Second Thessalonians tells a worried church to stay calm and keep working while it waits for the Lord.",
  "1TI":"First Timothy is Paul\u2019s advice to a young bishop on leading the Church well.",
  "2TI":"Second Timothy is Paul\u2019s last letter, written near his death. Keep the faith, he says.",
  TIT:"Titus is Paul\u2019s advice to a church leader on Crete about good teaching and good living.",
  PHM:"Philemon is a short, personal letter. Paul asks a master to welcome his runaway slave as a brother.",
  HEB:"Hebrews shows Jesus as the great high priest whose one sacrifice is greater than all others.",
  "1PE":"First Peter encourages Christians who suffer for their faith.",
  "2PE":"Second Peter warns against false teachers and says the Lord is patient with us.",
  "1JN":"First John says: God is love, and whoever loves lives in God.",
  "2JN":"Second John is a short letter about truth and love.",
  "3JN":"Third John is a short letter that praises a Christian for his welcome to traveling missionaries.",
  REV:"Revelation is a vision of Christ\u2019s victory, told in symbols. It ends with a new heaven and a new earth."
};
const NOTES={
 "2026-10-04":["God plants a vineyard and gives it every care, but it gives sour grapes. In the Gospel, the tenants refuse to give the owner his fruit and kill his son.","the vineyard, in both the first reading and the Gospel. What fruit does God look for in your life?"],
 "2026-10-11":["Isaiah sees a great feast on God\u2019s mountain for all peoples. Jesus tells of a king\u2019s wedding feast: many people refuse the invitation, and one guest comes without a wedding garment.","the invitation. It is free, but it asks for an answer."],
 "2026-10-18":["God works even through Cyrus, a king who does not know him. Jesus answers a trap: give to Caesar what belongs to Caesar, and to God what belongs to God.","the image on the coin. You carry the image of God."],
 "2026-10-25":["The first reading names the people God protects: the stranger, the widow, the orphan and the poor. Jesus names the greatest commandment: love God, and love your neighbor.","the two commandments. You cannot keep one without the other."],
 "2026-11-01":["John sees a great crowd that no one can count, from every nation, standing before God. Jesus gives the Beatitudes, the road they walked.","\u201cblessed.\u201d Holiness is a call for everyone, not only for famous saints."],
 "2026-11-02":["Today the Church prays for all who have died. The souls of the just are in the hand of God, and Jesus promises to lose none of those the Father gives him.","the promise of the resurrection. Bring the names of your dead to this Mass."],
 "2026-11-08":["Wisdom is easy to find for those who look for her. Ten bridesmaids wait for the bridegroom, but only five bring extra oil for their lamps.","the call to stay awake. You cannot borrow readiness at the last minute."],
 "2026-11-15":["A master gives his servants talents and goes away. Two put them to work. The third is afraid and buries his in the ground.","the reason the third servant gives. What gift has God given you to use?"],
 "2026-11-22":["This is the last Sunday of the Church\u2019s year. Christ is a shepherd king. At the end, he judges by love: what you did for the least of his brothers and sisters, you did for him.","the list: hungry, thirsty, stranger, naked, sick, in prison."],
 "2026-11-29":["A new Church year starts today, and the Sunday Gospels now come mostly from Mark. Advent prepares for two comings of Christ: at Christmas, and at the end of time.","Isaiah: we are the clay, and you are the potter. Jesus: be watchful, be alert."],
 "2026-12-06":["\u201cComfort, give comfort to my people.\u201d John the Baptist appears in the desert and calls people to prepare the way of the Lord.","the voice in the desert. What path in your heart needs to be made straight?"],
 "2026-12-08":["Mary was kept free from original sin from the first moment of her life, to prepare her to be the Mother of God. The Gospel is the Annunciation, where she says yes.","the greeting of the angel: \u201cfull of grace.\u201d"],
 "2026-12-13":["This is Gaudete Sunday. Gaudete means \u201crejoice,\u201d and the priest may wear rose. Christmas is near. John says he is not the light; he points to the light.","the joy in all three readings."],
 "2026-12-20":["David wants to build a house for God, but God promises to build a house for David. In the Gospel, the promise comes true in Mary\u2019s yes.","the angel\u2019s words about the throne of David."],
 "2026-12-25":["\u201cThe Word became flesh and lived among us.\u201d At the Mass during the day, the Gospel is the opening of John: the child in the manger is the eternal Word of God.","the word \u201clight.\u201d At the Creed, we kneel at the words about the Incarnation."],
 "2026-12-27":["The Son of God grows up in a family. Mary and Joseph bring Jesus to the Temple, and old Simeon and Anna see in him the salvation of God.","Simeon\u2019s words to Mary about a sword that will pierce her heart."],
 "2027-01-01":["On the eighth day of Christmas, the Church honors Mary as Mother of God. It is also New Year\u2019s Day and the World Day of Peace. The first reading is the old priestly blessing.","the blessing: \u201cThe LORD bless you and keep you.\u201d Mary treasures all these things in her heart."],
 "2027-01-03":["Magi come from the East, led by a star, to worship the newborn King. At Epiphany, Christ is shown to all the nations, not only to Israel.","the three gifts: gold for a king, frankincense for God, myrrh for one who will die."],
 "2027-01-10":["Jesus is baptized in the Jordan, and the Father says: you are my beloved Son. This feast ends the Christmas season.","the Father\u2019s words. At your baptism, God said them about you too."]
};
const OBL={"2026-12-08":1,"2026-12-25":1,"2027-01-01":1};
const COLORS={green:["Green","#3E7D4F"],violet:["Violet","#6A3E8C"],rose:["Rose","#D98AA0"],white:["White","#F4EFE0"],red:["Red","#B3262E"]};
function iso(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function fromIso(s){ const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); }
function season(k){ if(k>="2026-11-29"&&k<="2026-12-24") return k>="2026-12-17"?"late-advent":"advent"; if(k>="2026-12-25"&&k<="2027-01-10") return "christmas"; return "ordinary"; }
function litColor(title,k){
  const t=title.toLowerCase();
  if(/third sunday of advent/.test(t)) return "rose";
  if(/advent|faithful departed/.test(t)) return "violet";
  if(/john, apostle and evangelist/.test(t)) return "white";
  if(/martyr|apostle|holy innocents|stephen|evangelist/.test(t)) return "red";
  if(/ordinary time/.test(t)) return "green";
  if(season(k)==="ordinary" && !/memorial|feast|solemnity|saint|blessed|our lady|dedication|lord/.test(t)) return "green";
  return "white";
}
function isSunday(k){ return fromIso(k).getDay()===0; }
function hasGloria(k,title){ const t=title.toLowerCase(); const s=season(k);
  if(/faithful departed/.test(t)) return false;
  if(/solemnity|feast|nativity|epiphany of the lord|baptism of the lord|holy family|immaculate|king of the universe|all saints/.test(t)) return true;
  if(s==="christmas" && k<="2027-01-01") return true;
  return isSunday(k) && !/advent/.test(t); }
function hasCreed(k,title){ return isSunday(k)||/solemnity|nativity|immaculate|mother of god/.test(title.toLowerCase()); }
const SEASON_NOTE={
  ordinary:["Ordinary Time","The Church walks with Jesus through his public life, week by week. \u201cOrdinary\u201d comes from the counted weeks, not from \u201cplain.\u201d The color is green, for growth."],
  advent:["Advent","Four weeks of hope and preparation for Christ\u2019s coming: at Christmas, and at the end of time. The color is violet. The Gloria is not sung until Christmas."],
  "late-advent":["The last days of Advent","From December 17, the readings turn to the events just before the birth of Jesus. At evening prayer the Church sings the ancient \u201cO\u201d antiphons."],
  christmas:["Christmas","The Church celebrates the birth of the Son of God for more than two weeks, until the Baptism of the Lord. The color is white or gold."]
};
let mDay=iso(new Date()); if(!TITLES[mDay]) mDay=DAYS.find(k=>k>=mDay)||DAYS[DAYS.length-1]||mDay;
let mPart="r";
const fmtLong=new Intl.DateTimeFormat("en-US",{weekday:"long",month:"long",day:"numeric"});
/* Verse number to show: the Lectionary's (4th field, "ch:v" or "v") when present, else the World English Bible's. */
function shownNum(e){ const n=e[3]; if(n==null) return [e[0],e[1]]; const m=String(n).split(":"); return m.length>1?[+m[0]||m[0],m[1]]:[e[0],m[0]]; }
function txt(tag,cls,text){ const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
function goDay(n){ const i=DAYS.indexOf(mDay)+n; if(i>=0&&i<DAYS.length){ mDay=DAYS[i]; renderMass(); $("massScroll").scrollTop=0; } }
$("dPrev").addEventListener("click",()=>goDay(-1));
$("dNext").addEventListener("click",()=>goDay(1));
$("dToday").addEventListener("click",()=>{ const t=iso(new Date()); if(TITLES[t]){ mDay=t; renderMass(); } });
$("segR").addEventListener("click",()=>{ mPart="r"; renderMass(); });
$("segO").addEventListener("click",()=>{ mPart="o"; renderMass(); });
swipe($("massScroll"),()=>goDay(1),()=>goDay(-1));

function usccbUrl(k){ const [y,m,d]=k.split("-"); return "https://bible.usccb.org/bible/readings/"+m+d+y.slice(2)+".cfm"; }
let massSeq=0;
async function renderMass(){
  const seq=++massSeq, date=fromIso(mDay), today=iso(new Date());
  let day=null; try{ day=await ensureDay(mDay); }catch(e){}
  if(seq!==massSeq) return;
  if(!day){ $("dLabel").textContent=fmtLong.format(date); $("dSub").textContent="";
    const box=$("massScroll"); box.textContent=""; box.appendChild(txt("p","empty",DAYS.length?"These readings need an internet connection. Connect and try again.":"The readings could not load. Check your connection and try again.")); return; }
  $("dLabel").textContent=fmtLong.format(date);
  const sub=$("dSub"); sub.className="d2"+(mDay===today?" today":"");
  sub.textContent=mDay===today?"Today":(mDay<today?"Past day":"Coming up")+", tap for today";
  $("dPrev").disabled=DAYS.indexOf(mDay)<=0; $("dNext").disabled=DAYS.indexOf(mDay)>=DAYS.length-1;
  $("segR").setAttribute("aria-pressed",mPart==="r"); $("segO").setAttribute("aria-pressed",mPart==="o");
  const box=$("massScroll"); box.textContent="";
  /* liturgical header */
  const head=txt("div","lit-head");
  head.appendChild(txt("h1","lit-title",day.title));
  const meta=txt("div","lit-meta"); const col=litColor(day.title,mDay);
  const c=txt("span"); const sw=txt("span","swatch"); sw.style.background=COLORS[col][1]; c.appendChild(sw); c.appendChild(document.createTextNode(COLORS[col][0]+" vestments")); meta.appendChild(c);
  meta.appendChild(txt("span","",SEASON_NOTE[season(mDay)][0]));
  if(OBL[mDay]) meta.appendChild(txt("span","obl","Holy day of obligation (USA)"));
  head.appendChild(meta); box.appendChild(head);
  if(mPart==="o"){ renderOrder(box,day); return; }

  /* before Mass */
  const intro=txt("div","block intro"); intro.appendChild(txt("h2","","Before Mass"));
  const note=NOTES[mDay];
  if(note){
    intro.appendChild(txt("p","",note[0]));
    const l=txt("p","listen"); l.appendChild(document.createTextNode("Listen for ")); l.appendChild(txt("i","",note[1])); intro.appendChild(l);
  } else {
    const sn=SEASON_NOTE[season(mDay)]; intro.appendChild(txt("p","",sn[1]));
    const saint=day.title.match(/^(Memorial|Feast|Solemnity) of (.+)$/);
    if(saint) intro.appendChild(txt("p","","Today the Church also remembers "+saint[2]+"."));
  }
  box.appendChild(intro);

  /* readings */
  day.r.forEach(r=>{
    const b=txt("section","block");
    b.appendChild(txt("p","blabel",r.l.replace("Reading 1","First reading").replace("Reading 2","Second reading").replace("Alleluia","Gospel acclamation")));
    b.appendChild(txt("h2","bcite",r.c));
    if(BOOK[r.b] && !/Alleluia/.test(r.l)) b.appendChild(txt("p","about",BOOK[r.b]));
    if(r.t.length){
      const p=txt("p","rtext"); let lastCh=null;
      r.t.forEach(e=>{ const [ch,v]=shownNum(e), t=e[2]; const sup=txt("sup","",(lastCh!==null&&ch!==lastCh?ch+":":"")+v); lastCh=ch; p.appendChild(sup); p.appendChild(document.createTextNode(t+" ")); });
      b.appendChild(p);
      if(r.l==="Responsorial Psalm") b.appendChild(txt("p","psalm-note","At Mass the cantor sings these verses, and everyone sings the response from your parish booklet."));
    } else if(r.b==="PSA"){
      b.appendChild(txt("p","psalm-note","The cantor sings the verses of this psalm, and everyone sings the response. Your parish booklet has the response."));
    }
    box.appendChild(b);
  });
  const f=txt("p","foot");
  f.innerHTML='Bible text: World English Bible (public domain). At Mass you will hear a different translation, so some words differ. <a target="_blank" rel="noopener">Open the official readings</a>.';
  f.querySelector("a").href=usccbUrl(mDay);
  box.appendChild(f);
}

const ORDER=[
 ["Introductory Rites",[
  ["Entrance","Stand","The priest and ministers walk to the altar while we sing. The priest kisses the altar, a sign of Christ."],
  ["Greeting","Stand","We make the Sign of the Cross. The priest greets us, and we answer him."],
  ["Penitential Act","Stand","We admit that we have sinned and ask for God\u2019s mercy: \u201cLord, have mercy.\u201d"],
  ["Gloria","Stand","An old hymn of praise that starts with the song of the angels at Bethlehem.","gloria"],
  ["Collect","Stand","The opening prayer. The priest \u201ccollects\u201d the silent prayers of everyone into one. We answer Amen."]]],
 ["Liturgy of the Word",[
  ["First Reading","Sit","Usually from the Old Testament. It often prepares for the Gospel of the day."],
  ["Responsorial Psalm","Sit","We answer God\u2019s word with his own words, sung from the Psalms."],
  ["Second Reading","Sit","From the letters of the apostles.","reading2"],
  ["Gospel Acclamation","Stand","We stand and sing Alleluia to greet Christ, who speaks to us in the Gospel."],
  ["Gospel","Stand","With the thumb we trace small crosses on the forehead, lips and heart: may the Word be in my mind, on my lips, and in my heart."],
  ["Homily","Sit","The priest or deacon explains the readings and shows how to live them this week."],
  ["Profession of Faith","Stand","Together we say the Creed. We bow at the words about Jesus becoming man.","creed"],
  ["Universal Prayer","Stand","We pray for the Church, the world, people in need, and the dead."]]],
 ["Liturgy of the Eucharist",[
  ["Preparation of the Gifts","Sit","Bread and wine are brought to the altar. The collection is taken. Offer your own week to God with the gifts."],
  ["Prayer over the Offerings","Stand","The priest prays over the gifts, and we answer Amen."],
  ["Eucharistic Prayer","Kneel","After the Holy, Holy, Holy, the priest says the words of Jesus at the Last Supper. The bread and wine become the Body and Blood of Christ. Look at the Host and the chalice when the priest raises them. The prayer ends with the Great Amen."]]],
 ["Communion Rite",[
  ["The Lord\u2019s Prayer","Stand","We pray the Our Father together."],
  ["Sign of Peace","Stand","We give a sign of peace to the people near us."],
  ["Lamb of God","Stand","We sing \u201cLamb of God\u201d while the priest breaks the Host. In the United States, people then kneel."],
  ["Communion","Walk forward","Catholics who are free from serious sin and who fasted for one hour may receive. Bow before you receive and answer Amen. If you do not receive, you can stay and make a spiritual communion, or come forward for a blessing where the parish allows it."],
  ["Prayer after Communion","Stand","After a short silence of thanks, the priest prays, and we answer Amen."]]],
 ["Concluding Rites",[
  ["Blessing and Dismissal","Stand","The priest blesses us and sends us out. Mass ends, and the mission starts: go and live what you received."]]]
];
function renderOrder(box,day){
  const has={gloria:hasGloria(mDay,day.title), creed:hasCreed(mDay,day.title), reading2:day.r.some(r=>/Reading 2/.test(r.l))};
  const why={gloria:season(mDay).includes("advent")?"No Gloria today: Advent.":"No Gloria today: it is for Sundays, feasts and solemnities.",
    creed:"No Creed today: it is for Sundays and solemnities.", reading2:"No second reading today: weekdays have one reading before the Gospel."};
  const wrapEl=txt("div","block oom");
  ORDER.forEach(([sec,parts])=>{
    wrapEl.appendChild(txt("h2","",sec));
    parts.forEach(([name,pos,text,flag])=>{
      const p=txt("div","part"+(flag&&!has[flag]?" off":""));
      p.appendChild(txt("h3","",name)); p.appendChild(txt("span","pos",pos)); p.appendChild(txt("p","",text));
      if(flag) p.appendChild(txt("span","tag",has[flag]?"Today: yes":why[flag]));
      wrapEl.appendChild(p);
    });
  });
  box.appendChild(wrapEl);
  box.appendChild(txt("p","foot","Postures follow the custom in the United States. Follow what your parish does."));
}

/* =====================================================================
   BOOKLETS
   Pages are set at true size in a hidden host, then cloned into the
   preview at a smaller scale and into the print file at full size.
   Half-letter pages fold: a sheet of letter paper holds four pages.
   ===================================================================== */
const CDAYS=Object.keys(COMP).sort();
const HAS_COMP=CDAYS.length>0;
const ED={plain:"Plain edition",kids:"Kids edition",family:"Family edition",readings:"Daily readings"};
const LY={pocket:{size:"half",dim:"5½ × 8½ in, folded"},side:{size:"letter",dim:"8½ × 11 in, stapled"},facing:{size:"half",dim:"5½ × 8½ in, folded"}};
const PAGE_PX={half:[528,816],letter:[816,1056]};
const PSALM_NOTE="At Mass the cantor sings the verses, and everyone sings the response from your parish booklet.";
const BK=Object.assign({day:iso(new Date()),ed:HAS_COMP?"plain":"readings",ly:"pocket"},store("ave-bk")||{});
if(!HAS_COMP) BK.ed="readings";
if(!TITLES[BK.day]||BK.day<iso(new Date())) BK.day=iso(new Date());
const fmtFull=new Intl.DateTimeFormat("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
const fmtShort=new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric"});
const fmtMonth=new Intl.DateTimeFormat("en-US",{month:"long",year:"numeric"});
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const host=document.createElement("div");
host.style.cssText="position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none";
host.setAttribute("aria-hidden","true"); host.setAttribute("data-uncommentable","");
document.body.appendChild(host);

function div(cls,html){ const d=document.createElement("div"); if(cls) d.className=cls; if(html!=null) d.innerHTML=html; return d; }
function addDays(k,n){ const d=fromIso(k); d.setDate(d.getDate()+n); return iso(d); }

/* ---------- content ---------- */
function compText(day,ed){ if(ed==="readings"||!COMP[day]) return null; return ed==="kids"?COMP[day].kids:COMP[day].plain; }
function readingsOf(day){ return RD[day].r.filter(r=>r.l!=="Alleluia"); }
function labelOf(r){ return {"Reading 1":"First reading","Reading 2":"Second reading"}[r.l]||r.l; }
function spans(list){ let last=null; return list.map(e=>{ const [ch,v]=shownNum(e); const s=`<span><sup>${last!==null&&ch!==last?ch+":":""}${v}</sup>${esc(e[2])} </span>`; last=ch; return s; }); }
function chunkVerses(r,ch){ const key=t=>t[0]+":"+t[1]; const i=r.t.findIndex(t=>key(t)===ch.from), j=r.t.findIndex(t=>key(t)===ch.to); return r.t.slice(i,j+1); }
function headHtml(r){ return `<p class="eyebrow">${labelOf(r)}</p><p class="cite">${esc(r.c)}</p>`; }

function coverParts(day,ed){
  const d=RD[day], col=litColor(d.title,day);
  const o={date:fmtFull.format(fromIso(day)), title:ed==="readings"?"":d.title, ed:ED[ed], head:d.title, intro:"", listen:""};
  if(ed!=="readings"){ const c=COMP[day];
    if(ed==="kids"){ o.head=c.kids.headline; o.intro=c.kids.intro; o.listen=c.kids.listen; }
    else { o.head=c.plain.headline; o.intro=ed==="family"?c.family.opener:c.plain.intro; o.listen=c.plain.listen; } }
  o.meta=`<span><i class="sw" style="background:${COLORS[col][1]}"></i>${COLORS[col][0]} vestments</span><span>${SEASON_NOTE[season(day)][0]}</span>${OBL[day]?"<span>Holy day of obligation</span>":""}`;
  return o;
}
const SOURCE_LINE=`<p class="ftn">Bible text: World English Bible (public domain). The words you hear at Mass will differ.</p>`;
function coverHtml(day,ed){
  const o=coverParts(day,ed);
  return `<div class="cv"><div class="cv-date">${o.date}</div>${o.title?`<div class="cv-title">${esc(o.title)}</div>`:""}<div class="cv-rule"></div>
  <div class="cv-ed">${o.ed}</div><div class="cv-head">${esc(o.head)}</div>${o.intro?`<p class="cv-intro">${esc(o.intro)}</p>`:""}
  ${o.listen?`<div class="cv-listen"><b>Listen for</b><i>${esc(o.listen)}</i></div>`:""}<div class="cv-meta">${o.meta}</div>${SOURCE_LINE}</div>`;
}
function mastItems(day,ed){
  const o=coverParts(day,ed), out=[];
  out.push({html:`<div class="mast"><div><div class="cv-date">${o.date}</div><div class="cv-ed" style="margin-top:.5em">${o.ed}</div><div class="cv-head">${esc(o.head)}</div></div>
    <div class="mast-r">${o.title?`<div class="cv-title">${esc(o.title)}</div>`:""}<div class="cv-meta" style="justify-content:flex-end;padding-top:.4em">${o.meta}</div></div></div>`});
  if(o.intro) out.push({html:`<p class="cv-intro">${esc(o.intro)}</p>`});
  if(o.listen) out.push({html:`<div class="cv-listen" style="margin:0 0 .6em"><b>Listen for</b><i>${esc(o.listen)}</i></div>`});
  out.push({html:SOURCE_LINE});
  return out;
}
function atMassHtml(day){
  const d=RD[day], r2=d.r.some(r=>/Reading 2/.test(r.l));
  const rows=[["Gloria","Stand",hasGloria(day,d.title)],["First reading","Sit",true],["Psalm","Sit",true],["Second reading","Sit",r2],["Gospel","Stand",true],["Creed","Stand",hasCreed(day,d.title)],["Eucharistic Prayer","Kneel",true],["Communion","Walk forward",true]];
  return `<h4>At Mass today</h4><div class="oom-mini">${rows.map(([n,p,on])=>`<span class="${on?"":"off"}">${n}</span><span>${on?p:"Not today"}</span>`).join("")}</div>`;
}
function backItems(day,ed){
  const c=COMP[day], b=html=>({cls:"bk-back",html});
  if(ed==="kids"){ const k=c.kids; return [
    b(`<h3>Your page</h3><div class="word"><span class="eyebrow">Word of the day</span><br><b>${esc(k.word.term)}</b>. ${esc(k.word.meaning)}</div>`),
    b(`<h4>Draw it</h4><p>${esc(k.draw)}</p><div class="draw">draw here</div>`),
    b(`<h4>Think about it</h4><p>${esc(k.ask)}</p>`)]; }
  if(ed==="family"){ const f=c.family; return [
    b(`<h3>Talk about it</h3><p>${esc(f.opener)}</p>`),
    b(`<h4>Questions for everyone</h4><ol>${f.questions.map(q=>`<li>${esc(q)}</li>`).join("")}</ol>`),
    b(`<h4>Try this week</h4><p>${esc(f.try)}</p>`),
    b(`<h4>Pray together</h4><p><i>${esc(f.pray)}</i></p>`),
    b(atMassHtml(day))]; }
  if(ed==="plain") return [b(`<h3>Carry this week</h3><p><i>${esc(c.plain.carry)}</i></p>`),b(atMassHtml(day))];
  return [b(atMassHtml(day))];
}
/* single-column items: readings with an "in plain words" box after each */
function flowItems(day,ed){
  const c=compText(day,ed), out=[];
  readingsOf(day).forEach(r=>{
    out.push({type:"head",cls:"rh",html:headHtml(r)});
    if(r.l==="Responsorial Psalm"&&!r.t.length){ out.push({html:`<p class="psalm">${PSALM_NOTE}</p>`}); }
    else { out.push({type:"verses",spans:spans(r.t)}); if(r.l==="Responsorial Psalm") out.push({html:`<p class="psalm">${PSALM_NOTE}</p>`}); }
    if(c&&c.readings[r.l]) out.push({html:`<div class="box plain"><span class="lbl">In plain words</span>${esc(c.readings[r.l].box)}</div>`});
  });
  return out;
}
/* paired items: source on the left, plain words on the right */
function pairItems(day,ed){
  const c=compText(day,ed), out=[];
  readingsOf(day).forEach(r=>{
    out.push({head:true,L:headHtml(r),R:`<p class="colhd">In plain words</p><p class="cite">${esc(r.c)}</p>`,contL:labelOf(r)+", continued",contR:"In plain words, continued"});
    if(r.l==="Responsorial Psalm"){ out.push({L:r.t.length?`<p class="vs">${spans(r.t).join("")}</p><p class="psalm">${PSALM_NOTE}</p>`:`<p class="psalm">${PSALM_NOTE}</p>`,R:`<p class="plain">${esc(c.readings[r.l].box)}</p>`}); return; }
    c.readings[r.l].chunks.forEach(ch=>out.push({L:`<p class="vs">${spans(chunkVerses(r,ch)).join("")}</p>`,R:`<p class="plain">${esc(ch.text)}</p>`}));
  });
  return out;
}

/* ---------- pagination ---------- */
function newPage(size){ const pg=div("pg "+size), body=div("pg-body"); pg.appendChild(body); host.appendChild(pg); return {pg,body}; }
function used(body){ const c=body.lastElementChild; return c?c.offsetTop+c.offsetHeight:0; }
function over(body){ return used(body)>body.clientHeight+0.5; }
const KEEP=90; /* a heading needs this much room under it, or it moves to the next page */

function flow(items,size,pages,start){
  let cur=start; if(!cur){ cur=newPage(size); pages.push(cur); }
  const fresh=()=>{ cur=newPage(size); pages.push(cur); };
  for(const it of items){
    if(it.type==="verses"){
      let p=div("vs"); cur.body.appendChild(p);
      for(const s of it.spans){
        p.insertAdjacentHTML("beforeend",s);
        if(over(cur.body)&&p.childElementCount>0){
          if(p.childElementCount===1&&cur.body.firstElementChild===p) continue;
          p.lastElementChild.remove(); if(!p.firstElementChild) p.remove();
          fresh(); p=div("vs"); cur.body.appendChild(p); p.insertAdjacentHTML("beforeend",s);
        }
      }
      continue;
    }
    const b=div(it.cls||"",it.html); cur.body.appendChild(b);
    const bad=over(cur.body)||(it.type==="head"&&used(cur.body)+KEEP>cur.body.clientHeight);
    if(bad&&cur.body.firstElementChild!==b){ b.remove(); fresh(); cur.body.appendChild(b); }
  }
  return cur;
}
function rows(pairs,size,pages,start){
  let cur=start, lastHead=null;
  const row=pr=>div("row2"+(pr.head?" hd":""),`<div>${pr.L}</div><div>${pr.R}</div>`);
  for(const pr of pairs){
    if(pr.head) lastHead=pr;
    const r=row(pr); cur.body.appendChild(r);
    const bad=over(cur.body)||(pr.head&&used(cur.body)+KEEP>cur.body.clientHeight);
    if(bad&&cur.body.firstElementChild!==r){
      r.remove(); cur=newPage(size); pages.push(cur);
      if(!pr.head&&lastHead) cur.body.appendChild(div("row2 hd",`<div class="cont">${lastHead.contL}</div><div class="cont">${lastHead.contR}</div>`));
      cur.body.appendChild(r);
    }
  }
  return cur;
}
function spreads(pairs,size,pages){
  let L,R,lastHead=null;
  const open=()=>{ L=newPage(size); R=newPage(size); pages.push(L,R); };
  const put=pr=>{ const a=div(pr.head?"rh":"fc",pr.L), b=div(pr.head?"rh":"fc",pr.R); L.body.appendChild(a); R.body.appendChild(b);
    const h=Math.max(a.offsetHeight,b.offsetHeight)+"px"; a.style.minHeight=h; b.style.minHeight=h; return [a,b]; };
  open();
  for(const pr of pairs){
    if(pr.head) lastHead=pr;
    const [a,b]=put(pr);
    const bad=over(L.body)||over(R.body)||(pr.head&&Math.max(used(L.body),used(R.body))+KEEP>L.body.clientHeight);
    if(bad&&L.body.firstElementChild!==a){
      a.remove(); b.remove(); open();
      if(!pr.head&&lastHead){ L.body.appendChild(div("cont",lastHead.contL)); R.body.appendChild(div("cont",lastHead.contR)); }
      put(pr);
    }
  }
}
function notesPage(size){ const p=newPage(size); p.body.innerHTML=`<p class="notes-h">Notes</p><div class="lines" style="height:calc(100% - 2.2em)"></div>`; return p; }
function approved(day){ const r=COMP[day]&&COMP[day].review; return !!(r&&r.status==="approved"); }
function stamp(page){ page.pg.insertAdjacentHTML("beforeend",`<div class="stamp">Draft · not reviewed</div>`); }

function buildBooklet(day,ed,ly){
  host.textContent="";
  const size=LY[ly].size, pages=[], folded=size==="half";
  if(folded){
    const cv=newPage(size); pages.push(cv); cv.body.innerHTML=coverHtml(day,ed); if(ed!=="readings"&&!approved(day)) stamp(cv);
    if(ly==="facing") spreads(pairItems(day,ed),size,pages); else flow(flowItems(day,ed),size,pages);
    flow(backItems(day,ed),size,pages,ly==="facing"?null:pages[pages.length-1]);
    while(pages.length%4) pages.push(notesPage(size));
  } else {
    const p1=newPage(size); pages.push(p1); if(ed!=="readings"&&!approved(day)) stamp(p1);
    let cur=flow(mastItems(day,ed),size,pages,p1);
    cur=ed==="readings"?flow(flowItems(day,ed),size,pages,cur):rows(pairItems(day,ed),size,pages,cur);
    flow(backItems(day,ed),size,pages,cur);
  }
  const foot=`${fmtShort.format(fromIso(day))} · ${ED[ed]}`;
  pages.forEach((p,i)=>{ if(folded&&i===0) return; p.pg.insertAdjacentHTML("beforeend",`<div class="pg-foot"><span>${foot}</span><span>${i+1}</span></div>`); });
  const res={size,folded,html:pages.map(p=>p.pg.outerHTML)};
  host.textContent="";
  return res;
}

const CACHE={}; let fontsReady=null;
function ensureFonts(){
  if(!fontsReady) fontsReady=Promise.all(['14.5px "EB Garamond"','italic 14.5px "EB Garamond"','600 9px "EB Garamond"','13.5px "Alegreya Sans"','700 10px "Alegreya Sans"']
    .map(f=>document.fonts.load(f).catch(()=>null))).then(()=>document.fonts.ready).catch(()=>null);
  return fontsReady;
}
async function getBooklet(day,ed,ly){ const k=day+"|"+ed+"|"+ly; if(!CACHE[k]){ await Promise.all([ensureFonts(),ensureDay(day)]); CACHE[k]=buildBooklet(day,ed,ly); } return CACHE[k]; }

/* ---------- preview ---------- */
let lastRes=null;
function renderPreview(res){
  lastRes=res; const pv=$("pv"); pv.textContent="";
  const W=Math.max(260,pv.clientWidth||340), [pw,ph]=PAGE_PX[res.size], n=res.html.length;
  const groups=[];
  if(BK.ly==="facing"){ groups.push([0]); for(let i=1;i<n-1;i+=2) groups.push([i,i+1]); groups.push([n-1]); }
  else res.html.forEach((_,i)=>groups.push([i]));
  const single=res.size==="half"?Math.min(W,380):Math.min(W,520);
  groups.forEach(g=>{
    const target=g.length===1?single:W, s=Math.min(1,(target-(g.length-1)*2)/(pw*g.length));
    const row=div("pv-spread");
    g.forEach(i=>{ const w=div("pv-wrap"); w.style.width=Math.floor(pw*s)+"px"; w.style.height=Math.floor(ph*s)+"px"; w.innerHTML=res.html[i]; w.firstElementChild.style.transform=`scale(${s})`; row.appendChild(w); });
    pv.appendChild(row);
    pv.appendChild(txt("p","pv-num",g.length===1?"Page "+(g[0]+1):`Pages ${g[0]+1}–${g[1]+1}`));
  });
}
function allowedDays(){ const t=iso(new Date()), A=(BK.ed==="readings"?DAYS:CDAYS).filter(k=>k>=t); return A.length?A:(BK.ed==="readings"?DAYS:CDAYS); }
function renderBkControls(){
  const A=allowedDays();
  if(!A.includes(BK.day)) BK.day=A.find(k=>k>=BK.day)||A[A.length-1];
  if(BK.ed==="readings"&&BK.ly==="facing") BK.ly="pocket";
  const i=A.indexOf(BK.day);
  $("lblDate").textContent=BK.ed==="readings"?"Day":"Sunday or holy day";
  $("bLabel").textContent=fmtLong.format(fromIso(BK.day)); $("bSub").textContent=TITLES[BK.day]||"";
  $("bPrev").disabled=i<=0; $("bNext").disabled=i>=A.length-1;
  document.querySelectorAll("#edSeg button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.ed===BK.ed));
  document.querySelectorAll("#lySeg button").forEach(b=>{
    b.setAttribute("aria-pressed",b.dataset.ly===BK.ly);
    if(b.dataset.ly==="facing") b.disabled=BK.ed==="readings";
    if(b.dataset.ly==="side") b.textContent=BK.ed==="readings"?"Letter":"Side by side";
  });
  document.querySelectorAll("#edSeg button").forEach(b=>{ if(b.dataset.ed!=="readings") b.disabled=!HAS_COMP; });
  const rv=COMP[BK.day]&&COMP[BK.day].review;
  $("draftNote").textContent=!HAS_COMP
    ?"Plain, Kids and Family guides are on the way. A person reviews each one before it appears here."
    :BK.ed==="readings"?"The day’s readings, for any day."
    :rv&&rv.by?`Guide reviewed by ${rv.by}.`:"";
  $("pvSize").textContent=LY[BK.ly].dim; bkNote();
  store("ave-bk",BK);
}
let bkSeq=0;
async function renderBooklet(){
  renderBkControls();
  const seq=++bkSeq; $("pv").innerHTML='<p class="pv-loading">Setting the pages…</p>'; $("pvCount").textContent="";
  const res=await getBooklet(BK.day,BK.ed,BK.ly); if(seq!==bkSeq) return;
  renderPreview(res);
  const n=res.html.length;
  $("pvCount").textContent=res.folded?`${n} pages · ${n/4} sheet${n>4?"s":""} of paper`:`${n} page${n>1?"s":""}`;
}
$("bPrev").addEventListener("click",()=>{ const A=allowedDays(), i=A.indexOf(BK.day); if(i>0){ BK.day=A[i-1]; renderBooklet(); } });
$("bNext").addEventListener("click",()=>{ const A=allowedDays(), i=A.indexOf(BK.day); if(i<A.length-1){ BK.day=A[i+1]; renderBooklet(); } });
document.querySelectorAll("#edSeg button").forEach(b=>b.addEventListener("click",()=>{ BK.ed=b.dataset.ed; renderBooklet(); }));
document.querySelectorAll("#lySeg button").forEach(b=>b.addEventListener("click",()=>{ if(!b.disabled){ BK.ly=b.dataset.ly; renderBooklet(); } }));
let rzT; window.addEventListener("resize",()=>{ clearTimeout(rzT); rzT=setTimeout(()=>{ if(lastRes&&$("view-booklets").classList.contains("on")) renderPreview(lastRes); },150); });

/* ---------- print ---------- */
const pageSize=document.createElement("style"); document.head.appendChild(pageSize);
$("bkPrint").addEventListener("click",async()=>{
  const res=await getBooklet(BK.day,BK.ed,BK.ly), P=res.html, N=P.length;
  let h="";
  if(res.folded){ for(let i=0;i<N/4;i++) h+=`<div class="sheet">${P[N-1-2*i]}${P[2*i]}</div><div class="sheet">${P[2*i+1]}${P[N-2-2*i]}</div>`; }
  else h=P.map(x=>`<div class="sheet1">${x}</div>`).join("");
  $("printArea").innerHTML=h;
  pageSize.textContent=`@page{size:${res.folded?"11in 8.5in":"8.5in 11in"};margin:0}`;
  setTimeout(()=>window.print(),60);
});
function bkNote(){
  $("bkNote").textContent=BK.ly==="side"
    ?"Print double-sided, flip on long edge, at 100% scale. Staple the corner."
    :"Print double-sided, flip on short edge, at 100% scale (turn off “fit to page”). Fold the stack in half. The pages come out in folding order.";
}
$("orderBtn").addEventListener("click",()=>$("orderSheet").showModal());
bindSheet($("orderSheet"),"oClose");

/* =====================================================================
   START
   ===================================================================== */
build(); layout(); drawRosary();
if(S.cur>steps.length) S.cur=0;
const haloEl=$("haloG"); haloEl.style.transition="none";
showTab((location.hash||"").slice(1)||store("ave-tab")||"rosary");
lastCur=S.cur; render();
void haloEl.getBoundingClientRect(); haloEl.style.transition="";
renderMass();
if(resumed) toast("You continue from where you stopped");
else if(!S.seen&&$("view-rosary").classList.contains("on")){ toast("Tap the beads or Next to move on. Swipe right to go back."); S.seen=true; save(); }
document.addEventListener("pointerdown",wakeOn,{once:true});
})();
