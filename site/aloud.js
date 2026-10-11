/* Ave read-aloud text, shared by the app (site/app.js, loaded before it) and
   the voice server (api/_voice.js, which loads this file in a sandbox).
   Every word Ave reads aloud is built here and nowhere else: the prayers and
   mysteries, the step texts of the rosary, and the read-aloud parts of a Mass
   reading. The server builds its list of speakable texts by calling these same
   functions over every rosary step and every day's readings, and refuses
   anything else, so the app and the server cannot drift apart.
   scripts/test/voice.test.mjs checks that they agree. */
(function(g){
"use strict";
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

/* The Spanish table (site/i18n.js) is read when needed, so load order does not matter. */
const ES=()=>(g.AVE_I18N&&g.AVE_I18N.es)||{ui:{}};

/* The AI voice. Changing any field changes every cache key, so old audio is
   never served for a new voice. */
const VOICE={voice_id:"JBFqnCBsd6RMkjVDRZzb",model_id:"eleven_multilingual_v2",
  voice_settings:{stability:0.6,similarity_boost:0.75,speed:0.92},output_format:"mp3_44100_64"};
/* What a cache key hashes: the voice, the language and the exact text. */
const keyInput=(lang,text)=>JSON.stringify([VOICE,lang,text]);

function sentences(text){ return String(text).replace(/\s+/g," ").match(/[^.!?;:]+[.!?;:]+["”’)]*|[^.!?;:]+$/g)||[text]; }
/* A long text is sent to the voice in pieces of whole sentences, at most CHUNK
   characters each, so the first piece comes back quickly and no reply is large. */
const CHUNK=300; /* a 391-character piece took 5.5 s to make; the app waits 8 s */
function chunks(text){
  const out=[]; let cur="";
  for(let s of sentences(text).map(x=>x.trim()).filter(Boolean)){
    while(s.length>CHUNK){
      let i=s.lastIndexOf(", ",CHUNK-1); if(i<CHUNK/2) i=s.lastIndexOf(" ",CHUNK); if(i<1) i=CHUNK-1;
      const head=s.slice(0,i+1).trim(); s=s.slice(i+1).trim();
      if(cur){ out.push(cur); cur=""; } out.push(head);
    }
    if(cur&&cur.length+1+s.length>CHUNK){ out.push(cur); cur=s; } else cur=cur?cur+" "+s:s;
  }
  if(cur) out.push(cur);
  return out;
}
/* [[text, lang], ...] -> the same parts cut into voice-sized pieces, in order. */
const pieces=parts=>parts.flatMap(([text,lang])=>chunks(text).map(c=>[c,lang]));

/* "Isaiah 5:1-7" -> "Isaías 5, 1-7": Spanish book name, comma after the chapter,
   a period between verse groups. The Lectionary's numbers are kept as they are. */
function esCite(r){
  const m=String(r.c).replace(/ /g," ").match(/^((?:Cf\.|See)\s+)?((?:[1-3]\s)?[A-Z][A-Za-z]*(?:\s(?:of\s)?[A-Z][a-z]+)*)\s+(.+)$/);
  if(!m) return r.c;
  const pre=m[1]?"Cf. ":"", book=(ES().bookName||{})[r.b]||m[2];
  return pre+book+" "+m[3].replace(/, /g,". ").replace(/(\w+):/g,"$1, ").replace(/ or /g," o ");
}

/* Everything that depends on the language, for "en" or "es". */
const byLang={};
function forLang(lang){
  if(byLang[lang]) return byLang[lang];
  const es=lang==="es";
  /* t("English") returns the Spanish entry from site/i18n.js when lang is "es";
     {name} placeholders are filled from vars. Always pass a literal string
     (scripts/test/i18n.test.mjs reads them). */
  function t(s,vars){
    const E=ES(); let o=es&&E.ui[s]!=null?E.ui[s]:s;
    if(vars) o=o.replace(/\{(\w+)\}/g,(m,k)=>k in vars?vars[k]:m);
    return o;
  }
  const capFirst=s=>s?s.charAt(0).toLocaleUpperCase(lang)+s.slice(1):s;
  /* Localized prayers, mysteries and ordinals. Spanish ordinals agree with the noun:
     misterio is masculine (primer, segundo...), decena feminine (primera, segunda...).
     A Spanish prayer left empty (awaiting review) falls back to the English text. */
  const pr=k=>{ const E=ES(); return es&&E.prayers&&E.prayers[k]&&E.prayers[k].x?E.prayers[k]:PR[k]; };
  const setOf=k=>es?ES().sets[k]:Object.assign({Adj:cap(SETS[k].adj)},SETS[k]);
  const ordM=d=>es?ES().ord.m[d]:ORD[d], ordF=d=>es?ES().ord.f[d]:ORD[d];
  /* Reading labels in the data are English keys ("Reading 1"). */
  function readingLabel(l){
    switch(l){
      case "Reading 1": return t("First reading"); case "Reading 2": return t("Second reading"); case "Reading 3": return t("Third reading");
      case "Reading 4": return t("Fourth reading"); case "Reading 5": return t("Fifth reading"); case "Reading 6": return t("Sixth reading");
      case "Reading 7": return t("Seventh reading"); case "Reading": return t("Reading"); case "Epistle": return t("Epistle");
      case "Responsorial Psalm": return t("Responsorial Psalm"); case "Alleluia": return t("Gospel acclamation"); case "Gospel": return t("Gospel");
    }
    return l;
  }
  /* What the rosary reads for one step of a set; st null means the rosary is complete. */
  function stepText(setKey,st){
    if(!st) return t("The rosary is complete. Go in peace.");
    const set=setOf(setKey);
    if(st.key==="mystery"){ const m=set.m[st.d]; return `${capFirst(t("The {ord} {adj} mystery",{ord:ordM(st.d),adj:set.adj}))}. ${m[0]}. ${m[3]} ${t("Fruit of the mystery:")} ${m[2]}.`; }
    const P=pr(st.key); return P.x+(P.vr?" "+P.vr.map(v=>v[1]).join(" "):"");
  }
  /* Read aloud reads what is on the screen in its own language, as [text, lang] parts:
     in English the label and book, then the text; in Spanish the label and citation,
     then the English text in an English voice when it is shown (showEn). */
  function readingParts(r,showEn){
    const verses=r.t.length?[[r.t.map(e=>e[2]).join(" "),"en"]]:[];
    if(!es) return [[`${readingLabel(r.l)}. ${r.c.split(/\s\d/)[0].replace(/^(Cf\.|See)\s+/,"")}.`,"en"],...verses];
    return [[`${readingLabel(r.l)}. ${esCite(r).replace(/[-–—]/g," al ").replace(/^Cf\. /,"")}.`,"es"],...(showEn?verses:[])];
  }
  return (byLang[lang]={t,capFirst,pr,setOf,ordM,ordF,readingLabel,stepText,readingParts});
}

/* Every text the rosary can read: each set, each step kind, both languages.
   A superset of what build() in app.js lays out, whatever the Fatima setting. */
function rosaryParts(){
  const out=[];
  for(const lang of ["en","es"]){ const L=forLang(lang);
    for(const k of Object.keys(SETS)){
      out.push([L.stepText(k,null),lang]);
      for(let d=0;d<5;d++) out.push([L.stepText(k,{key:"mystery",d}),lang]);
      for(const key of Object.keys(PR)) out.push([L.stepText(k,{key}),lang]);
    } }
  return out;
}
/* Every text the Mass tab can read for one day ({r:[...]}): the English Listen
   buttons, and the Spanish ones with and without the English text shown. */
function readingDayParts(day){
  const en=forLang("en"), es=forLang("es");
  return [...day.r.filter(r=>r.t.length).flatMap(r=>en.readingParts(r,false)),
          ...day.r.flatMap(r=>es.readingParts(r,true))];
}

g.AVE_ALOUD={PR,SETS,ORD,cap,VOICE,CHUNK,keyInput,sentences,chunks,pieces,esCite,forLang,rosaryParts,readingDayParts};
})(typeof window!=="undefined"?window:globalThis);
