(function(){
"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const store=(k,v)=>{ try{ if(v===undefined) return JSON.parse(localStorage.getItem(k)||"null"); if(v===null) localStorage.removeItem(k); else localStorage.setItem(k,JSON.stringify(v)); }catch(e){ return null; } };
let toastT; function toast(m){ const t=$("toast"); t.textContent=m; t.classList.add("show"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),3600); }

/* ---------- who is here ---------- */
const qp=new URLSearchParams(location.search);
if(qp.get("t")) store("ave-review-token",qp.get("t"));
if(qp.get("a")) store("ave-owner-token",qp.get("a"));
if(qp.get("practice")!==null){ store("ave-review-token",null); }
if(qp.get("t")||qp.get("a")) history.replaceState(null,"",location.pathname+(qp.get("practice")!==null?"?practice":""));
const TOKEN=store("ave-review-token"), OWNER=store("ave-owner-token");

const ED={plain:"Plain",kids:"Kids",family:"Family"};
const EDS=["plain","kids","family"];
const STATUS={approved:"Approved",changes:"Sent back",rejected:"Rejected",waiting:"To review",redrafted:"Redrafted"};
const ICON={approved:"✓",changes:"↺",rejected:"✕",waiting:"•",redrafted:"↻"};
const fmtDay=new Intl.DateTimeFormat("en-US",{weekday:"short",month:"short",day:"numeric",timeZone:"UTC"});
const fmtLong=new Intl.DateTimeFormat("en-US",{weekday:"long",month:"long",day:"numeric",timeZone:"UTC"});
const fmtMonth=new Intl.DateTimeFormat("en-US",{month:"long",year:"numeric",timeZone:"UTC"});
const D=k=>new Date(k+"T12:00:00Z");
const today=new Date().toISOString().slice(0,10);

async function api(path,opts={}){
  const headers={"Content-Type":"application/json"}; if(TOKEN) headers["x-review-token"]=TOKEN;
  const r=await fetch(path,{...opts,headers:{...headers,...(opts.headers||{})}});
  let body=null; try{ body=await r.json(); }catch(e){}
  if(!r.ok) throw new Error((body&&body.error)||`The server answered ${r.status}.`);
  return body;
}
const months={}; async function readings(day){ const m=day.slice(0,7); if(!months[m]) months[m]=fetch(`data/readings/${m}.json`).then(r=>r.json()).catch(()=>({})); return (await months[m])[day]; }

/* ---------- practice decisions stay in this browser ---------- */
const practice=()=>store("ave-practice")||{};
function practiceDecide(date,ed,decision){ const p=practice(); (p[date]||={})[ed]={status:decision,by:"You (practice)",at:new Date().toISOString()}; store("ave-practice",p); }

let Q=null, CUR=null;
async function loadQueue(){
  Q=await api("api/review");
  if(Q.practice){ const p=practice(); for(const d of Q.days) for(const ed of EDS) if(p[d.date]?.[ed]) d.editions[ed]=p[d.date][ed]; }
  $("practiceBar").hidden=!Q.practice;
  $("who").textContent=Q.me?Q.me.name:(OWNER?"Owner view (practice)":"Practice");
}

/* ---------- home ---------- */
function monthStats(days){ let done=0; for(const d of days) for(const ed of EDS) if(d.editions[ed].status==="approved") done++; return {done,total:days.length*3}; }
function chip(ed,s){ return `<span class="chip ${s.status}" title="${ED[ed]}: ${STATUS[s.status]||s.status}">${ICON[s.status]||"•"} ${ED[ed]}</span>`; }

function renderHome(){
  CUR=null; $("actionbar").hidden=true;
  const byMonth={}; for(const d of Q.days) (byMonth[d.date.slice(0,7)]||=[]).push(d);
  const sched=Q.schedule.filter(s=>monthStats(byMonth[s.month]||[]).done<(byMonth[s.month]||[]).length*3);
  const next=sched.find(s=>s.due>=today)||sched[0];
  let h=`<section class="card">
    <p class="eyebrow">How reviewing works</p>
    <ol class="steps">
      <li>Open a Sunday below. Each edition shows the reading next to the plain-words guide.</li>
      <li>Fix any wording right in the text boxes. Changed text turns yellow.</li>
      <li>Approve it, or send it back with a note. An approved guide appears in the Ave app within a minute.</li>
    </ol>
    ${Q.practice?`<p class="meta">This is practice. Try every step; nothing is saved. Your personal review link saves your decisions.</p>`:""}
  </section>`;
  if(next){
    const st=monthStats(byMonth[next.month]||[]), first=(byMonth[next.month]||[]).find(d=>EDS.some(ed=>d.editions[ed].status!=="approved"));
    h+=`<section class="card next">
      <div class="row"><h2>${fmtMonth.format(D(next.month+"-01"))} guides</h2><span class="due">Due ${fmtLong.format(D(next.due))}</span></div>
      <div class="bar-prog"><span style="width:${Math.round(st.done/st.total*100)}%"></span></div>
      <p class="meta">${st.done} of ${st.total} texts approved · ${next.days.length} Sundays and holy days, three editions each</p>
      ${first?`<button class="btn gold" data-open="${first.date}" type="button">Start with ${fmtDay.format(D(first.date))}</button>`:""}
    </section>`;
  }
  for(const s of Q.schedule){
    const ds=byMonth[s.month]||[], st=monthStats(ds);
    h+=`<div class="month"><h2>${fmtMonth.format(D(s.month+"-01"))}</h2><span class="meta">${s.due<today?"Past due":"Due"} ${fmtDay.format(D(s.due))} · ${st.done}/${st.total}</span></div>`;
    for(const d of ds){
      const claim=d.claims.length?`<span class="claimed">Claimed by ${d.claims.map(c=>esc(c.name)).join(", ")}</span>`:"";
      h+=`<button class="day" data-open="${d.date}" type="button"><span><span class="d">${fmtDay.format(D(d.date))}${d.flagged?` · ${d.flagged} flagged line${d.flagged>1?"s":""}`:""}</span><br><span class="t" data-title="${d.date}"></span></span>
        <span class="chips">${EDS.map(ed=>chip(ed,d.editions[ed])).join("")}</span>${claim}</button>`;
    }
  }
  $("main").innerHTML=h;
  $("main").querySelectorAll("[data-open]").forEach(b=>b.addEventListener("click",()=>openDay(b.dataset.open)));
  $("main").querySelectorAll("[data-title]").forEach(async el=>{ const r=await readings(el.dataset.title); el.textContent=r?.title||""; });
  window.scrollTo(0,0);
}

/* ---------- one Sunday ---------- */
const shown=e=>{ const n=e[3]; if(n==null) return [e[0],e[1]]; const m=String(n).split(":"); return m.length>1?[m[0],m[1]]:[e[0],m[0]]; };
function versesHtml(list){ let last=null; return list.map(e=>{ const [c,v]=shown(e); const s=`<sup>${last!==null&&c!==last?c+":":""}${v}</sup>${esc(e[2])} `; last=c; return s; }).join(""); }
function chunkVerses(r,ch){ const k=t=>t[0]+":"+t[1]; const i=r.t.findIndex(t=>k(t)===ch.from), j=r.t.findIndex(t=>k(t)===ch.to); return r.t.slice(i,j+1); }
const LBL={"Reading 1":"First reading","Reading 2":"Second reading"};

function field(path,value,label,rows){
  return `${label?`<span class="label">${esc(label)}</span>`:""}<textarea class="ed" rows="${rows||2}" data-path="${esc(path)}" data-orig="${esc(value)}">${esc(value)}</textarea>`;
}
function readingsSection(text,day,ro){
  let h="";
  for(const r of day.r.filter(r=>r.l!=="Alleluia")){
    const g=text.readings[r.l]; if(!g) continue;
    h+=`<section class="sec card"><p class="eyebrow">${esc(LBL[r.l]||r.l)}</p><p class="cite">${esc(r.c)}</p>`;
    if(r.l==="Responsorial Psalm"||!g.chunks){
      if(r.t.length) h+=`<p class="verses">${versesHtml(r.t)}</p>`;
      h+=ro?`<div class="fixed">${esc(g.box)}</div>`:field(`readings.${r.l}.box`,g.box,"In plain words",3);
    } else {
      h+=ro?`<span class="label">In plain words</span><div class="fixed">${esc(g.box)}</div>`:field(`readings.${r.l}.box`,g.box,"In plain words (box after the reading)",3);
      g.chunks.forEach((ch,i)=>{ h+=`<div class="pair"><p class="verses">${versesHtml(chunkVerses(r,ch))}</p>${ro?`<div class="fixed">${esc(ch.text)}</div>`:field(`readings.${r.l}.chunks.${i}.text`,ch.text,"",3)}</div>`; });
    }
    h+=`</section>`;
  }
  return h;
}
function editionHtml(ed,G,day){
  const t=G.guide[ed], p=G.guide.plain;
  let h=`<details class="check"><summary>What to check</summary><ul>
    <li>Faithful to the Church’s teaching and to how the Church reads the passage.</li>
    <li>No mistakes of fact: names, places, dates, background.</li>
    <li>The plain words add nothing to the reading and leave out nothing important.</li>
    ${ed==="kids"?"<li>Honest about hard parts, gentle, and not babyish.</li>":""}
    <li>Nothing a parent or catechist would object to.</li></ul></details>`;
  if(ed==="family"){
    h+=`<section class="sec card"><p class="eyebrow">Family page</p>
      ${field("opener",t.opener,"Opening line a parent reads aloud",2)}
      ${t.questions.map((q,i)=>field(`questions.${i}`,q,`Question ${i+1}`,2)).join("")}
      ${field("try",t.try,"Try this week",2)}${field("pray",t.pray,"Family prayer",2)}</section>
      <section class="card"><p class="meta">The Family booklet prints the Plain edition’s readings guide. Review that in the Plain tab; it is shown here read-only.</p></section>`;
    h+=`<section class="sec card"><p class="eyebrow">Cover</p><span class="label">Headline (from Plain)</span><div class="fixed">${esc(p.headline)}</div></section>`;
    h+=readingsSection(p,day,true);
  } else {
    h+=`<section class="sec card"><p class="eyebrow">Cover</p>${field("headline",t.headline,"Headline",1)}${field("intro",t.intro,"Introduction",3)}${field("listen",t.listen,"Listen for…",2)}</section>`;
    h+=readingsSection(t,day,false);
    if(ed==="plain") h+=`<section class="sec card"><p class="eyebrow">Back page</p>${field("carry",t.carry,"Carry this week",2)}</section>`;
    else h+=`<section class="sec card"><p class="eyebrow">Kids page</p>${field("word.term",t.word.term,"Word of the day",1)}${field("word.meaning",t.word.meaning,"What it means",2)}${field("draw",t.draw,"Drawing prompt",2)}${field("ask",t.ask,"Question to think about",2)}</section>`;
  }
  const hist=G.history[ed]||[];
  if(hist.length) h+=`<section class="card history"><p class="eyebrow">History</p><ul>${hist.map(x=>`<li>${esc(STATUS[x.decision]||x.decision)} by ${esc(x.by)}, ${new Date(x.at).toLocaleDateString()}${x.edits?` · ${x.edits} edit${x.edits>1?"s":""}`:""}${x.notes?`: “${esc(x.notes)}”`:""}</li>`).join("")}</ul></section>`;
  return h;
}

async function openDay(date,ed){
  $("main").innerHTML=`<p class="loading">Opening ${fmtLong.format(D(date))}…</p>`; window.scrollTo(0,0);
  const [G,day]=await Promise.all([api(`api/review?date=${date}`),readings(date)]);
  const qd=Q.days.find(d=>d.date===date);
  CUR={date,ed:ed||EDS.find(e=>qd.editions[e].status!=="approved")||"plain",G,day,qd};
  renderDay();
}
function renderDay(){
  const {date,ed,G,day,qd}=CUR, mine=Q.me&&qd.claims.some(c=>c.id===Q.me.id);
  const s=qd.editions[ed];
  let h=`<button class="back" id="backHome" type="button">← All Sundays</button>
    <div class="dayhead"><div><p class="eyebrow">${fmtLong.format(D(date))}</p><h1>${esc(day?.title||"")}</h1>
      <p class="meta">${qd.claims.length?`Claimed by ${qd.claims.map(c=>esc(c.name)).join(", ")}`:"Nobody has claimed this day yet."}</p></div>
      <button class="pill" id="claimBtn" type="button">${mine?"Release":"Claim this day"}</button></div>`;
  if(G.flagged.length) h+=`<section class="card flags"><p class="eyebrow">Lines the drafts flag for you</p><ul>${G.flagged.map(f=>`<li>${esc(f)}</li>`).join("")}</ul></section>`;
  h+=`<div class="tabs" role="tablist">${EDS.map(e=>`<button role="tab" data-ed="${e}" aria-selected="${e===ed}" type="button">${ED[e]}<small>${ICON[qd.editions[e].status]||"•"} ${STATUS[qd.editions[e].status]||""}</small></button>`).join("")}</div>`;
  if(s.status!=="waiting") h+=`<p class="status-line ${s.status}">${STATUS[s.status]}${s.by?` by ${esc(s.by)}`:""}${s.status==="redrafted"?". The draft changed after approval, so it needs a fresh look.":""}</p>`;
  h+=editionHtml(ed,G,day);
  $("main").innerHTML=h;
  $("backHome").addEventListener("click",()=>renderHome());
  $("claimBtn").addEventListener("click",()=>claim(mine));
  $("main").querySelectorAll(".tabs button").forEach(b=>b.addEventListener("click",()=>{ CUR.ed=b.dataset.ed; renderDay(); window.scrollTo(0,0); }));
  $("main").querySelectorAll("textarea.ed").forEach(t=>{ fit(t); t.addEventListener("input",()=>{ fit(t); t.classList.toggle("changed",t.value!==t.dataset.orig); updateBar(); }); });
  $("abNotes").hidden=true; $("notes").value=""; $("actionbar").hidden=false; updateBar();
}
function fit(t){ t.style.height="auto"; t.style.height=(t.scrollHeight+2)+"px"; }
function edits(){ const o={}; $("main").querySelectorAll("textarea.ed.changed").forEach(t=>o[t.dataset.path]=t.value); return o; }
function updateBar(){ const n=Object.keys(edits()).length; $("approve").textContent=n?`Approve with ${n} edit${n>1?"s":""}`:`Approve ${ED[CUR.ed]}`; }

async function claim(mine){
  if(Q.practice){ toast("In practice, claiming shows your name on the day so the team knows you have it."); return; }
  try{ await api("api/review",{method:"POST",body:JSON.stringify({action:mine?"unclaim":"claim",date:CUR.date})}); await loadQueue(); CUR.qd=Q.days.find(d=>d.date===CUR.date); renderDay(); toast(mine?"Released. Someone else can take this day.":"Claimed. The team sees your name on this day."); }
  catch(e){ toast(e.message); }
}
async function decide(decision){
  const notes=$("notes").value.trim();
  if(decision!=="approved"&&!notes){ $("abNotes").hidden=false; $("notes").focus(); toast("Add a note about what needs to change, then tap again."); return; }
  const body={action:"decide",date:CUR.date,edition:CUR.ed,decision,notes,edits:edits()};
  if(Q.practice){
    practiceDecide(CUR.date,CUR.ed,decision); CUR.qd.editions[CUR.ed]={status:decision,by:"You (practice)"};
    toast(decision==="approved"?"Practice: this edition would now appear in the app.":"Practice: this would go back to Clark with your note.");
  } else {
    try{ await api("api/review",{method:"POST",body:JSON.stringify(body)}); }catch(e){ toast(e.message); return; }
    await loadQueue(); CUR.qd=Q.days.find(d=>d.date===CUR.date);
    toast(decision==="approved"?"Approved. It appears in the Ave app within a minute.":"Sent back with your note. Thank you.");
    CUR.G=await api(`api/review?date=${CUR.date}`);
  }
  const nextEd=EDS.find(e=>CUR.qd.editions[e].status==="waiting"||CUR.qd.editions[e].status==="redrafted");
  if(nextEd){ CUR.ed=nextEd; renderDay(); window.scrollTo(0,0); }
  else { const nd=Q.days.find(d=>d.date>CUR.date&&EDS.some(e=>d.editions[e].status==="waiting")); nd?openDay(nd.date):renderHome(); }
}
$("approve").addEventListener("click",()=>decide("approved"));
$("sendBack").addEventListener("click",()=>{ if($("abNotes").hidden){ $("abNotes").hidden=false; $("notes").focus(); return; } decide("changes"); });
$("reject").addEventListener("click",()=>{ if($("abNotes").hidden){ $("abNotes").hidden=false; $("notes").focus(); toast("Say why, then tap Reject again."); return; } decide("rejected"); });

/* ---------- reminders ---------- */
$("calBtn").addEventListener("click",()=>{
  const host=location.host, b=$("calBody");
  if(TOKEN){
    b.innerHTML=`<div class="cal-actions"><a class="gold" href="webcal://${host}/api/calendar?t=${encodeURIComponent(TOKEN)}">Add to my calendar</a>
      <a class="quiet" href="https://${host}/api/calendar?t=${encodeURIComponent(TOKEN)}">Download the calendar file</a></div>
      <p class="meta" style="margin-top:8px">The calendar updates itself when new months are added.</p>`;
  } else b.innerHTML=`<p class="meta">With your personal review link, one tap adds these deadlines to your phone’s calendar. Here is what you would see:</p>`;
  $("calDues").innerHTML=(Q?.schedule||[]).filter(s=>s.due>=today).map(s=>`<li><span>${fmtMonth.format(D(s.month+"-01"))} guides</span><span>due ${fmtDay.format(D(s.due))}</span></li>`).join("");
  $("calSheet").showModal();
});
$("calClose").addEventListener("click",()=>$("calSheet").close());

/* ---------- team ---------- */
$("teamBtn").addEventListener("click",async()=>{
  const b=$("teamBody"); b.innerHTML=`<p class="loading">Loading…</p>`; $("teamSheet").showModal();
  const claims=(Q?.days||[]).filter(d=>d.claims.length).map(d=>`<li><span>${fmtDay.format(D(d.date))}</span><span>${d.claims.map(c=>esc(c.name)).join(", ")}</span></li>`).join("");
  let h=`<p>Several priests can share the work. Each has a personal link, and anyone can claim a Sunday so two people do not review the same day. One approval is enough for an edition to appear in the app, and every decision stays on record.</p>`;
  if(OWNER){
    try{
      const t=await fetch(`api/admin?a=${encodeURIComponent(OWNER)}`).then(r=>r.json());
      if(t.error) throw new Error(t.error);
      h+=`<p class="eyebrow" style="margin-top:12px">Your team</p>${t.team.length?t.team.map(p=>`<div class="person"><span><span class="n">${esc(p.name)}</span><br><span class="s">${esc(p.email||"")}</span></span><span class="s">${p.decisions.approved} approved · ${p.decisions.changes} sent back</span></div>`).join(""):`<p class="meta">No reviewers yet.</p>`}
        <p class="eyebrow" style="margin-top:14px">Invite a reviewer</p>
        <form class="form" id="inviteForm"><input id="invName" placeholder="Name, for example Fr. John Smith" required><input id="invEmail" type="email" placeholder="Email (optional)"><button class="btn gold" type="submit">Create review link</button></form>
        <div id="invOut"></div>`;
    }catch(e){ h+=`<p class="meta">${esc(e.message)}</p>`; }
  } else if(Q?.team?.length){
    h+=`<p class="eyebrow" style="margin-top:12px">On the team</p>${Q.team.map(p=>`<div class="person"><span class="n">${esc(p.name)}</span></div>`).join("")}`;
  } else h+=`<p class="meta">Clark sends each priest a personal link. Opening it signs you in on that phone or computer; there is no password.</p>`;
  if(claims) h+=`<p class="eyebrow" style="margin-top:14px">Who has which day</p><ul class="dues">${claims}</ul>`;
  b.innerHTML=h;
  const f=$("inviteForm");
  if(f) f.addEventListener("submit",async ev=>{
    ev.preventDefault();
    try{
      const r=await fetch("api/admin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({a:OWNER,action:"invite",name:$("invName").value,email:$("invEmail").value})}).then(r=>r.json());
      if(r.error) throw new Error(r.error);
      $("invOut").innerHTML=`<p>Send ${esc(r.name)} this link. It is theirs alone; anyone with it can review as them.</p>
        <div class="copybox"><input readonly value="${esc(r.link)}" id="invLink"><button class="pill" type="button" id="invCopy">Copy</button></div>`;
      $("invCopy").addEventListener("click",async()=>{ try{ await navigator.clipboard.writeText(r.link); toast("Copied"); }catch(e){ $("invLink").select(); toast("Selected. Copy it from your menu."); } });
      f.reset();
    }catch(e){ toast(e.message); }
  });
});
$("teamClose").addEventListener("click",()=>$("teamSheet").close());

/* ---------- start ---------- */
const setBar=()=>document.documentElement.style.setProperty("--barh",document.querySelector(".bar").offsetHeight+"px");
addEventListener("resize",setBar); setBar();
(async()=>{
  try{ await loadQueue(); renderHome(); }
  catch(e){
    if(/not valid/.test(e.message)){ store("ave-review-token",null); $("main").innerHTML=`<p class="empty">${esc(e.message)} <a href="review?practice">Try practice mode</a>.</p>`; }
    else $("main").innerHTML=`<p class="empty">${esc(e.message)}</p>`;
  }
})();
})();
