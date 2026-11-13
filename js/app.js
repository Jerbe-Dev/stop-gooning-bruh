(function(){
'use strict';
var KEY='cleanslate.v1', DAY=864e5, MIN=6e4;
var RANKS=[
  {d:0,n:'Day one'},{d:1,n:'Locked in'},{d:3,n:'Finding footing'},{d:7,n:'Steady'},
  {d:14,n:'Two weeks in'},{d:30,n:'Disciplined'},{d:60,n:'Unshaken'},
  {d:90,n:'Ninety days'},{d:180,n:'Half a year'},{d:365,n:'One year'}
];
var TRIGGERS=['Boredom','Stress','Late night','Loneliness','Social media','Alone in my room','Just woke up','Anxiety','Tired'];
var MOODS=['Rough','Low','Okay','Good','Great'];
var ACTS=[
  {n:'Go for a walk',h:'Out the door for 10 minutes'},
  {n:'Play a game',h:'Something with a clear end'},
  {n:'Read',h:'10 pages of anything'},
  {n:'Work out',h:'20 pushups or squats, then more'},
  {n:'Take a shower',h:'Change rooms, reset your head'},
  {n:'Draw or write',h:'Sketch, journal, or doodle'},
  {n:'Play music',h:'An instrument or a loud playlist'},
  {n:'Tidy up',h:'One drawer, one desk, one corner'},
  {n:'Text a friend',h:'Say hi or ask for a call'},
  {n:'Cook or snack',h:'Make something small'},
  {n:'Study or code',h:'Pick one small task and start'},
  {n:'Meditate',h:'Sit and follow your breath'}
];
var CHECK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

var $=function(s,r){return (r||document).querySelector(s);};
var pad=function(n){return String(n).padStart(2,'0');};
var esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
var dayKey=function(ts){var d=new Date(ts);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
var fmtDate=function(ts){return new Date(ts).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});};
var storageOK=true;

function fresh(){var now=Date.now();return {v:1,_generation:0,start:now,_startUpdatedAt:now,_updatedAt:now,reasons:[],_reasonAddedAt:{},_reasonDeletedAt:{},checkins:{},relapses:[],urges:[],activities:[],_activityAddedAt:{},_activityDeletedAt:{},tab:'today'};}
function norm(o){
  var s=Object.assign(fresh(),o||{});
  ['reasons','relapses','urges','activities'].forEach(function(k){if(!Array.isArray(s[k]))s[k]=[];});
  if(!s.checkins||typeof s.checkins!=='object'||Array.isArray(s.checkins))s.checkins={};
  ['_reasonAddedAt','_reasonDeletedAt','_activityAddedAt','_activityDeletedAt'].forEach(function(k){if(!s[k]||typeof s[k]!=='object'||Array.isArray(s[k]))s[k]={};});
  if(typeof s.start!=='number'||!isFinite(s.start))s.start=Date.now();
  s._generation=Number.isSafeInteger(Number(s._generation))&&Number(s._generation)>=0?Number(s._generation):0;
  if(!isFinite(Number(s._updatedAt)))s._updatedAt=0;
  if(!isFinite(Number(s._startUpdatedAt)))s._startUpdatedAt=Number(s._updatedAt||0);
  return s;
}
function load(){
  try{var r=localStorage.getItem(KEY);if(r)return norm(JSON.parse(r));}catch(e){}
  return fresh();
}
var S=load();
function hasLocalCopy(){try{var raw=localStorage.getItem(KEY);if(!raw)return false;var data=JSON.parse(raw);return !!data&&typeof data==='object'&&!Array.isArray(data);}catch(e){return false;}}
function finishUnlock(c){
  c.owner='Jerbe-Dev';c.repo='stop-gooning-bruh-cloud';c.branch='main';
  saveSyncConfig(c);cloudSyncReady=true;
  document.body.classList.remove('locked');
  var lock=$('#lockScreen');if(lock)lock.remove();
  renderAll();setTab(['today','urge','journey','log','more'].indexOf(S.tab)>-1?S.tab:'today');
  startCloudPolling();
  toast('Cloud data loaded. Automatic sync is on.');
}
function unlockApp(token){
  var status=$('#unlockStatus'),btn=$('#unlockForm button[type="submit"]');
  if(status)status.textContent='Connecting and syncing your data…';
  if(btn)btn.disabled=true;
  var c=syncConfig();c.owner='Jerbe-Dev';c.repo='stop-gooning-bruh-cloud';c.branch='main';c.token=token||c.token;
  return syncInitialCloud(c).then(function(remoteSha){
    c.sha=remoteSha||'';finishUnlock(c);
  }).catch(function(err){
    if(status)status.textContent='Could not sync: '+(err&&err.message?err.message:'check your connection and GitHub token permissions')+'.';
    if(btn)btn.disabled=false;throw err;
  });
}
function initAccess(){
  var c=syncConfig(),form=$('#unlockForm'),tokenWrap=$('#tokenEntry');
  if(!form)return false;
  if(c.token){
    if(tokenWrap)tokenWrap.hidden=true;
    unlockApp(c.token).catch(function(){if(tokenWrap)tokenWrap.hidden=false;});
  }else if(tokenWrap){tokenWrap.hidden=false;}
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var token=$('#unlockToken').value.trim()||syncConfig().token;
    var status=$('#unlockStatus');
    if(!token){if(tokenWrap)tokenWrap.hidden=false;status.textContent='Paste your GitHub token to connect this device.';$('#unlockToken').focus();return;}
    unlockApp(token).catch(function(){if(tokenWrap)tokenWrap.hidden=false;});
  });
  return false;
}
function save(){
  S._updatedAt=Date.now();
  try{localStorage.setItem(KEY,JSON.stringify(S));storageOK=true;}catch(e){storageOK=false;}

  if(cloudSyncReady)queueCloudBackup();
}

function elapsed(){return Math.max(0,Date.now()-S.start);}
function bestMs(){return Math.max.apply(null,[elapsed()].concat(S.relapses.map(function(r){return r.streakMs||0;})));}
function fmtDur(ms){
  ms=Math.max(0,ms);
  var d=Math.floor(ms/DAY),h=Math.floor(ms%DAY/36e5),m=Math.floor(ms%36e5/MIN);
  if(d>0)return d+'d '+h+'h';
  if(h>0)return h+'h '+m+'m';
  return m+'m';
}
function stage(el){
  var prev=RANKS[0],next=null;
  for(var i=0;i<RANKS.length;i++){
    if(el/DAY>=RANKS[i].d)prev=RANKS[i];else{next=RANKS[i];break;}
  }
  return {prev:prev,next:next};
}
function toast(msg){
  var t=$('#toast');t.textContent=msg;t.classList.add('show');
  clearTimeout(toast._t);toast._t=setTimeout(function(){t.classList.remove('show');},2600);
}
function copyText(text,src){
  function fallback(){
    var field=document.createElement('textarea');
    field.value=text;field.setAttribute('readonly','');
    field.style.position='fixed';field.style.opacity='0';field.style.pointerEvents='none';
    document.body.appendChild(field);field.focus();field.select();field.setSelectionRange(0,field.value.length);
    var ok=false;try{ok=document.execCommand('copy');}catch(e){}
    document.body.removeChild(field);
    toast(ok?'Copied':'Copy failed. Please copy the link manually.');
  }
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){toast('Copied');},fallback);
  }else fallback();
}

/* ---------- state for UI ---------- */
var draft=null, editingCheckin=false, reasonIdx=Math.floor(Date.now()/DAY);
var slip={triggers:[],note:''};
var URGE_KEY='cleanslate.urge.timer.v1';
var urge={mode:'idle',startedAt:0,endsAt:0,done:[],picked:''}, urgeTimer=null;
function persistUrge(){try{if(urge.mode==='active'||urge.mode==='ended')localStorage.setItem(URGE_KEY,JSON.stringify({mode:urge.mode,startedAt:urge.startedAt,endsAt:urge.endsAt,picked:urge.picked||''}));else localStorage.removeItem(URGE_KEY);}catch(e){}}
function restoreUrge(){try{var raw=localStorage.getItem(URGE_KEY);if(!raw)return;var saved=JSON.parse(raw);if(!saved||!['active','ended'].includes(saved.mode)||!Number.isFinite(saved.endsAt)||!Number.isFinite(saved.startedAt))return;urge={mode:saved.endsAt<=Date.now()?'ended':saved.mode,startedAt:saved.startedAt,endsAt:saved.endsAt,done:[],picked:saved.picked||''};persistUrge();}catch(e){}}
var restoreArmed=false, resetArmed=false, lastDay=dayKey(Date.now());
var currentTab='today';
var calendarMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);
var selectedLogDate=dayKey(Date.now());

function getDraft(){
  var k=dayKey(Date.now());
  if(!draft||draft.k!==k){
    var c=S.checkins[k];
    draft=c?{k:k,mood:c.mood,urge:c.urge,triggers:(c.triggers||[]).slice(),note:c.note||''}:{k:k,mood:0,urge:3,triggers:[],note:''};
  }
  return draft;
}
function chips(sel,forWhat){
  return '<div class="chips">'+TRIGGERS.map(function(t){
    var on=sel.indexOf(t)>-1;
    return '<button type="button" class="chip'+(on?' on':'')+'" data-act="trig" data-for="'+forWhat+'" data-v="'+esc(t)+'" aria-pressed="'+on+'">'+esc(t)+'</button>';
  }).join('')+'</div>';
}

/* ---------- Today ---------- */
function reasonCard(){
  if(!S.reasons.length){
    return '<div class="card"><h3>Write your why</h3><p class="muted">One line you can read when it gets hard. It shows up here and in urge mode.</p>'+
      '<div class="row"><input type="text" id="reasonInToday" class="reason-in" maxlength="140" placeholder="e.g. I want my focus back" aria-label="Your reason"><button class="btn btn-primary" type="button" data-act="addReason" data-src="reasonInToday">Add</button></div></div>';
  }
  var r=S.reasons[reasonIdx%S.reasons.length];
  return '<div class="card why"><div class="lbl">Why you are doing this</div><p class="quote">'+esc(r)+'</p>'+
    (S.reasons.length>1?'<button class="btn-quiet" type="button" data-act="nextReason">Another reason</button>':'')+'</div>';
}
function checkinCard(){
  var k=dayKey(Date.now()),c=S.checkins[k],dr=getDraft();
  if(c&&!editingCheckin){
    return '<div class="card"><div class="lbl">Today\'s check-in</div><h3>Done. Mood: '+MOODS[c.mood-1]+', strongest urge '+c.urge+'/10</h3>'+
      (c.triggers&&c.triggers.length?'<div class="pills">'+c.triggers.map(function(t){return '<span class="pill pm">'+esc(t)+'</span>';}).join('')+'</div>':'')+
      (c.note?'<p class="muted">'+esc(c.note)+'</p>':'')+
      '<button class="btn btn-ghost" type="button" data-act="editCheckin">Edit check-in</button></div>';
  }
  return '<div class="card"><h3>Daily check-in</h3>'+
    '<div class="lbl">How are you feeling</div>'+
    '<div class="seg" role="radiogroup" aria-label="Mood">'+MOODS.map(function(m,i){
      var on=dr.mood===i+1;
      return '<button type="button" class="seg-b'+(on?' on':'')+'" data-act="mood" data-v="'+(i+1)+'" role="radio" aria-checked="'+on+'">'+m+'</button>';
    }).join('')+'</div>'+
    '<label class="lbl" for="urgeRange">Strongest urge today: <span id="urgeVal">'+dr.urge+'</span>/10</label>'+
    '<input type="range" id="urgeRange" min="0" max="10" value="'+dr.urge+'">'+
    '<div class="lbl">What set it off</div>'+chips(dr.triggers,'draft')+
    '<label class="lbl" for="ciNote">Note (optional)</label>'+
    '<textarea id="ciNote" rows="2" maxlength="300" placeholder="Anything worth remembering about today">'+esc(dr.note)+'</textarea>'+
    '<button class="btn btn-primary wide" type="button" data-act="saveCheckin">Save check-in</button></div>';
}
function renderToday(){
  var h='';
  if(!storageOK)h+='<div class="warn">This browser is not letting the app save. Your streak will be lost when you close it. Copy a backup from the More tab.</div>';
  h+='<div class="card streak"><div class="ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ring-track" cx="60" cy="60" r="54"/><circle id="ringArc" class="ring-arc" cx="60" cy="60" r="54" transform="rotate(-90 60 60)"/></svg>'+
    '<div class="ring-mid"><div class="big" id="sDays">0</div><div class="lbl">days clean</div></div></div>'+
    '<div class="clock" id="sClock">00:00:00</div>'+
    '<div class="rankline"><span class="pill" id="sRank"></span><span class="muted" id="sNext"></span></div></div>';
  h+='<button class="btn btn-urge wide" type="button" data-act="goUrge">I have an urge right now</button>';
  h+=checkinCard();
  h+=reasonCard();
  h+='<button class="btn-quiet" type="button" data-act="openSlip">I slipped</button>';
  $('#tab-today').innerHTML=h;
  tick();
}
function tick(){
  var el=elapsed(),st=stage(el);
  var d=Math.floor(el/DAY),hh=Math.floor(el%DAY/36e5),mm=Math.floor(el%36e5/MIN),ss=Math.floor(el%MIN/1000);
  var a=$('#sDays');if(!a)return;
  a.textContent=d;
  $('#sClock').textContent=pad(hh)+':'+pad(mm)+':'+pad(ss);
  $('#sRank').textContent=st.prev.n;
  $('#sNext').textContent=st.next?('Next: '+st.next.n+' in '+fmtDur(st.next.d*DAY-el)):'Every milestone reached';
  var p=st.next?(el-st.prev.d*DAY)/((st.next.d-st.prev.d)*DAY):1;
  p=Math.min(1,Math.max(0,p));
  $('#ringArc').style.strokeDashoffset=String(339.292*(1-p));
  var k=dayKey(Date.now());
  if(k!==lastDay){lastDay=k;renderAll();}
  $('#hdrDate').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'});
}

/* ---------- Urge ---------- */
function reasonsBlock(){
  if(!S.reasons.length)return '<div class="card"><div class="lbl">Your why</div><p class="muted">Add a reason in the More tab and it will show up here when you need it.</p></div>';
  return '<div class="card why"><div class="lbl">Remember why</div>'+S.reasons.slice(0,3).map(function(r){return '<p class="quote">'+esc(r)+'</p>';}).join('')+'</div>';
}
function renderUrge(){
  var week=S.urges.filter(function(u){return u.t>=Date.now()-7*DAY;}).length;
  var h='';
  if(urge.mode==='idle'){
    h='<div class="card"><h2>Ride it out</h2><p>An urge rises, peaks, and passes. It usually passes sooner than it feels like it will. Start the reset and do the next small thing.</p>'+
      '<button class="btn btn-urge wide" type="button" data-act="urgeStart">Start 10-minute reset</button></div>'+
      pickerCard()+'<div class="card"><div class="lbl">Urges you got through</div><div class="stat-row"><div><div class="num">'+S.urges.length+'</div><div class="muted sm">all time</div></div><div><div class="num">'+week+'</div><div class="muted sm">last 7 days</div></div></div></div>'+
      reasonsBlock();
  }else if(urge.mode==='active'){
    h='<div class="card center"><div class="lbl">Time left</div><div class="clock2" id="urgeClock">10:00</div>'+
      '<div class="bar-track"><div class="bar-fill" id="urgeBar" style="width:0%"></div></div>'+
      '<div class="breath-wrap"><div class="breath"></div><div class="breath-text" id="breathText">Breathe in</div></div></div>'+
      pickerCard()+
      reasonsBlock()+
      '<div class="row2"><button class="btn btn-primary" type="button" data-act="urgeWin">The urge passed</button><button class="btn btn-ghost" type="button" data-act="urgeStop">Cancel</button></div>'+
      '<button class="btn-quiet" type="button" data-act="openSlip">I slipped</button>';
  }else if(urge.mode==='ended'){
    h='<div class="card center"><h2>Ten minutes done</h2><p>Did you get through the urge without giving in?</p>'+
      '<button class="btn btn-primary wide" type="button" data-act="urgeWin">Yes, I resisted</button>'+
      '<button class="btn btn-ghost wide" type="button" data-act="urgeStart">No, not yet — another 10 minutes</button></div>'+pickerCard()+reasonsBlock()+
      '<button class="btn-quiet" type="button" data-act="openSlip">I slipped</button>';
  }else{
    h='<div class="card center"><h2>You got through it</h2><p>That is '+S.urges.length+' urge'+(S.urges.length===1?'':'s')+' you rode out. Go do something else for a while.</p>'+
      '<button class="btn btn-primary wide" type="button" data-act="urgeReset">Done</button></div>';
  }
  $('#tab-urge').innerHTML=h;
}
function allActs(){return ACTS.concat(S.activities.map(function(n){return {n:n,h:'Your own pick'};}));}
function pickerHtml(){
  var all=allActs(),p=urge.picked||'';
  var cur=all.filter(function(x){return x.n===p;})[0];
  return (cur?'<div class="now"><div class="lbl">Doing now</div><b>'+esc(cur.n)+'</b><span>'+esc(cur.h)+'</span></div>':'')+
    '<div class="picks">'+all.map(function(x){
      var on=x.n===p;
      return '<button type="button" class="pk'+(on?' on':'')+'" data-act="pick" data-v="'+esc(x.n)+'" aria-pressed="'+on+'"><b>'+esc(x.n)+'</b><span>'+esc(x.h)+'</span></button>';
    }).join('')+'</div>'+
    '<button class="btn btn-ghost wide" type="button" data-act="surprise">Surprise me</button>'+
    '<div class="row"><input type="text" id="actIn" class="act-in" maxlength="40" placeholder="Add your own" aria-label="Add your own distraction"><button class="btn btn-primary" type="button" data-act="addAct">Add</button></div>';
}
function pickerCard(){
  return '<div class="card"><h3>Pick something to do</h3><p class="muted sm">Choose one and do it until the timer ends. Tap it again to unpick.</p><div id="pickerBox">'+pickerHtml()+'</div></div>';
}
function renderPicker(){var b=$('#pickerBox');if(b)b.innerHTML=pickerHtml();}
function addAct(inp){
  var v=(inp&&inp.value||'').trim();
  if(!v){toast('Write an activity first');return;}
  if(S.activities.length>=10){toast('Ten of your own is plenty. Remove one in More.');return;}
  var dup=allActs().some(function(x){return x.n.toLowerCase()===v.toLowerCase();});
  if(dup){toast('That one is already in the list');return;}
  S.activities.push(v.slice(0,40));S._activityAddedAt[v.slice(0,40)]=Date.now();save();
  urge.picked=v.slice(0,40);renderPicker();renderMore();
}
function actBars(){
  var cnt={};
  S.urges.forEach(function(u){if(u.act)cnt[u.act]=(cnt[u.act]||0)+1;});
  var rows=Object.keys(cnt).map(function(k){return [k,cnt[k]];}).sort(function(a,b){return b[1]-a[1];}).slice(0,5);
  if(!rows.length)return '<p class="muted">Pick something in urge mode, then tap "The urge passed" to see what works for you.</p>';
  var mx=rows[0][1];
  return '<div class="trig">'+rows.map(function(r){return '<div class="trig-r"><span>'+esc(r[0])+'</span><div class="bar-track"><div class="bar-fill" style="width:'+(r[1]/mx*100)+'%"></div></div><span>'+r[1]+'</span></div>';}).join('')+'</div>';
}
function urgeStart(){
  clearInterval(urgeTimer);
  var now=Date.now();urge={mode:'active',startedAt:now,endsAt:now+10*MIN,done:[],picked:urge.picked||''};
  persistUrge();renderUrge();
  urgeTimer=setInterval(urgeTick,250);
  urgeTick();
}
function urgeTick(){
  var rem=urge.endsAt-Date.now();
  if(rem<=0){clearInterval(urgeTimer);urge.mode='ended';persistUrge();renderUrge();return;}
  var c=$('#urgeClock');if(!c)return;
  c.textContent=pad(Math.floor(rem/MIN))+':'+pad(Math.floor(rem%MIN/1000));
  $('#urgeBar').style.width=((1-rem/(10*MIN))*100)+'%';
  var s=((Date.now()-urge.startedAt)%10000)/1000;
  $('#breathText').textContent=s<4?'Breathe in':'Breathe out';
}
function urgeWin(){
  clearInterval(urgeTimer);persistUrge();
  S.urges.push({t:Date.now(),act:urge.picked||''});save();
  urge.mode='won';persistUrge();renderUrge();renderLog();
}

/* ---------- Journey ---------- */
function renderJourney(){
  var el=elapsed(),items=RANKS.filter(function(r){return r.d>0;}),curFound=false;
  var h='<div class="card"><h2>Milestones</h2><p class="muted">Your current streak: <b>'+fmtDur(el)+'</b>. Best so far: <b>'+fmtDur(bestMs())+'</b>.</p></div><ol class="miles">';
  items.forEach(function(r){
    var done=el>=r.d*DAY,cur=!done&&!curFound;
    if(cur)curFound=true;
    var cls=done?'done':(cur?'cur':'lock');
    var label=r.d===1?'1 day':(r.d>=365?'1 year':r.d+' days');
    var body='<div class="mile-t"><b>'+r.n+'</b><span class="muted sm">'+label+'</span></div>';
    if(cur){
      var p=Math.min(100,el/(r.d*DAY)*100);
      body+='<div class="bar-track"><div class="bar-fill" style="width:'+p.toFixed(1)+'%"></div></div><span class="muted sm">'+fmtDur(r.d*DAY-el)+' to go</span>';
    }else if(done){body+='<span class="muted sm">Reached</span>';}
    h+='<li class="mile '+cls+'"><div class="mk">'+(done?CHECK:r.d)+'</div><div class="mile-b">'+body+'</div></li>';
  });
  h+='</ol>';
  $('#tab-journey').innerHTML=h;
}

/* ---------- Log ---------- */
function monday(d){var x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-((x.getDay()+6)%7));return x;}
function heatmap(){
  var rel={},won={};
  S.relapses.forEach(function(r){var k=dayKey(r.t);rel[k]=(rel[k]||0)+1;});
  S.urges.forEach(function(u){var k=dayKey(u.t);won[k]=(won[k]||0)+1;});
  var now=new Date(),todayK=dayKey(now.getTime());
  var first=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),1);
  var offset=(first.getDay()+6)%7;
  var gridStart=new Date(first.getFullYear(),first.getMonth(),1-offset);
  var cells='',clean=0,slips=0,checkins=0;
  var monthPrefix=calendarMonth.getFullYear()+'-'+pad(calendarMonth.getMonth()+1);
  Object.keys(rel).forEach(function(k){if(k.indexOf(monthPrefix+'-')===0)slips+=rel[k];});
  Object.keys(S.checkins).forEach(function(k){if(k.indexOf(monthPrefix+'-')===0)checkins++;});
  function isCleanDay(d,k){
    var s=new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
    var e=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1).getTime();
    if(s>now.getTime()||rel[k])return false;
    var intervals=[[S.start,now.getTime()]].concat(S.relapses.map(function(r){return [r.t-(r.streakMs||0),r.t];}));
    return intervals.some(function(v){return v[0]<e&&v[1]>s;});
  }
  for(var i=0;i<42;i++){
    var d=new Date(gridStart.getFullYear(),gridStart.getMonth(),gridStart.getDate()+i),k=dayKey(d.getTime());
    var inMonth=d.getMonth()===calendarMonth.getMonth();
    var cls=inMonth?'':'c-outside';
    var cleanDay=inMonth&&isCleanDay(d,k);
    if(cleanDay){cls+=' c-clean';clean++;}
    if(inMonth&&rel[k])cls+=' c-relapse';
    if(inMonth&&d.getTime()>now.getTime())cls+=' c-future';
    if(k===selectedLogDate)cls+=' c-selected';
    var marks=(rel[k]?'<i class="slip-mark">'+rel[k]+'</i>':'')+(won[k]?'<i class="urge-mark">'+won[k]+'</i>':'');
    cells+='<button type="button" class="hc '+cls+(k===todayK?' today':'')+'" data-act="logDay" data-date="'+k+'" aria-pressed="'+(k===selectedLogDate)+'" aria-label="'+k+', '+(rel[k]||0)+' slips, '+(won[k]||0)+' won urges">'+d.getDate()+(marks?'<span class="marks">'+marks+'</span>':'')+'</button>';
  }
  return {cells:cells,clean:clean,slips:slips,checkins:checkins};
}
function urgeChart(){
  var W=320,H=132,L=24,B=20,T=8,n=14,slot=(W-L-4)/n,bw=Math.min(14,slot*.62),ph=H-B-T,bars='',lab='',has=false;
  for(var i=0;i<n;i++){
    var d=new Date();d.setDate(d.getDate()-(n-1-i));
    var c=S.checkins[dayKey(d.getTime())],x=L+i*slot+(slot-bw)/2;
    if(c){has=true;var bh=Math.max(2,c.urge/10*ph);bars+='<rect class="'+(c.urge>=7?'bu':'ba')+'" x="'+x.toFixed(1)+'" y="'+(T+ph-bh).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+bh.toFixed(1)+'" rx="3"/>';}
    else bars+='<circle class="bd" cx="'+(x+bw/2).toFixed(1)+'" cy="'+(T+ph-2)+'" r="1.6"/>';
    if(i%2===(n-1)%2)lab+='<text x="'+(x+bw/2).toFixed(1)+'" y="'+(H-5)+'" text-anchor="middle">'+d.getDate()+'</text>';
  }
  if(!has)return '<p class="muted">Check in each day and your urge strength will chart here.</p>';
  var grid=[0,5,10].map(function(v){var y=T+ph-v/10*ph;return '<line class="gl" x1="'+L+'" x2="'+W+'" y1="'+y+'" y2="'+y+'"/><text x="'+(L-6)+'" y="'+(y+3)+'" text-anchor="end">'+v+'</text>';}).join('');
  return '<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Urge strength per day for the last 14 days, scale 0 to 10">'+grid+bars+lab+'</svg>';
}
function triggerBars(){
  var cnt={};
  S.relapses.forEach(function(r){(r.triggers||[]).forEach(function(t){cnt[t]=(cnt[t]||0)+1;});});
  Object.keys(S.checkins).forEach(function(k){(S.checkins[k].triggers||[]).forEach(function(t){cnt[t]=(cnt[t]||0)+1;});});
  var rows=Object.keys(cnt).map(function(k){return [k,cnt[k]];}).sort(function(a,b){return b[1]-a[1];}).slice(0,5);
  if(!rows.length)return '<p class="muted">Pick triggers in check-ins and slips to see what sets you off most.</p>';
  var mx=rows[0][1];
  return '<div class="trig">'+rows.map(function(r){return '<div class="trig-r"><span>'+esc(r[0])+'</span><div class="bar-track"><div class="bar-fill" style="width:'+(r[1]/mx*100)+'%"></div></div><span>'+r[1]+'</span></div>';}).join('')+'</div>';
}
function renderLog(){
  var hm=heatmap(),monthName=calendarMonth.toLocaleDateString(undefined,{month:'long',year:'numeric'});
  var h='<div class="tiles">'+
    '<div class="tile"><div class="lbl">Clean days</div><div class="num">'+hm.clean+'</div></div>'+
    '<div class="tile"><div class="lbl">Slips</div><div class="num">'+hm.slips+'</div></div>'+
    '<div class="tile"><div class="lbl">Check-ins</div><div class="num">'+hm.checkins+'</div></div>'+
    '<div class="tile"><div class="lbl">Urges beaten</div><div class="num">'+S.urges.filter(function(u){return new Date(u.t).getFullYear()===calendarMonth.getFullYear()&&new Date(u.t).getMonth()===calendarMonth.getMonth();}).length+'</div></div></div>';
  h+='<div class="card"><div class="calendar-head"><button class="cal-nav" type="button" data-act="calendarPrev" aria-label="Previous month">‹</button><h3>'+monthName+'</h3><button class="cal-nav" type="button" data-act="calendarNext" aria-label="Next month">›</button></div><div class="heat">'+['M','T','W','T','F','S','S'].map(function(x){return '<div class="hd">'+x+'</div>';}).join('')+hm.cells+'</div>'+
    '<div class="legend"><span><b style="background:var(--accent-soft)"></b>Clean day</span><span><b style="background:#000000"></b>Slip</span><span><b style="background:#c9c7c7"></b>Won urge</span></div>'+
    '<p class="muted sm">'+hm.clean+' clean day'+(hm.clean===1?'':'s')+' in '+monthName+'. Empty days are not counted as clean.</p></div>';
  var selected=new Date(selectedLogDate+'T12:00:00');
  var events=[];
  S.relapses.forEach(function(r){if(dayKey(r.t)===selectedLogDate)events.push({t:r.t,type:'slip',title:'Slip recorded',sub:'After '+fmtDur(r.streakMs||0),triggers:r.triggers||[],note:r.note||''});});
  S.urges.forEach(function(u){if(dayKey(u.t)===selectedLogDate)events.push({t:u.t,type:'urge',title:'Urge beaten',sub:u.act?'Activity: '+u.act:'You got through an urge',triggers:[],note:''});});
  var ci=S.checkins[selectedLogDate];
  if(ci)events.push({t:ci.t||new Date(selectedLogDate+'T12:00:00').getTime(),type:'checkin',title:'Daily check-in',sub:'Mood: '+(MOODS[(ci.mood||1)-1]||'Recorded')+' · Urge '+(ci.urge==null?'—':ci.urge+'/10'),triggers:ci.triggers||[],note:ci.note||''});
  events.sort(function(a,b){return b.t-a.t;});
  h+='<div class="card day-records"><div class="day-record-head"><div><div class="lbl">Selected day</div><h3>'+selected.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'})+'</h3></div><span class="pill">'+events.length+' record'+(events.length===1?'':'s')+'</span></div>';
  if(!events.length)h+='<p class="muted">No records for this day. An empty day does not automatically count as a clean day.</p>';
  else h+='<ul class="hist day-hist">'+events.map(function(ev){
    var icon=ev.type==='slip'?'×':(ev.type==='urge'?'✓':'•');
    return '<li class="day-event '+ev.type+'"><div class="day-event-top"><span class="event-icon">'+icon+'</span><div class="event-main"><b>'+esc(ev.title)+'</b><span class="muted sm">'+new Date(ev.t).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})+' · '+esc(ev.sub)+'</span></div></div>'+
      (ev.triggers.length?'<div class="pills">'+ev.triggers.map(function(t){return '<span class="pill pm">'+esc(t)+'</span>';}).join('')+'</div>':'')+
      (ev.note?'<p class="muted">'+esc(ev.note)+'</p>':'')+'</li>';
  }).join('')+'</ul>';
  h+='</div>';
  h+='<div class="card"><h3>Urge strength, last 14 days</h3>'+urgeChart()+'</div>';
  h+='<div class="card"><h3>What sets you off</h3>'+triggerBars()+'</div>';
  h+='<div class="card"><h3>What works for you</h3>'+actBars()+'</div>';
  $('#tab-log').innerHTML=h;
}
/* ---------- More ---------- */
/* ---------- automatic GitHub sync ---------- */
var SYNC_KEY='cleanslate.github.sync.v1', syncMessage='Waiting for connection.', syncBusy=false;
function syncConfig(){
  try{var c=JSON.parse(localStorage.getItem(SYNC_KEY)||'{}');return Object.assign({owner:'Jerbe-Dev',repo:'stop-gooning-bruh-cloud',branch:'main',sha:'',token:''},c||{});}
  catch(e){return {owner:'Jerbe-Dev',repo:'stop-gooning-bruh-cloud',branch:'main',sha:'',token:''};}
}
function saveSyncConfig(c){localStorage.setItem(SYNC_KEY,JSON.stringify(c));}
var cloudSyncReady=false,cloudSyncTimer=null,cloudSyncBusy=false,cloudSyncAgain=false,cloudPollTimer=null,cloudDirty=false,cloudSyncedComparable=null;
function publicProgressCard(){
  var url='https://jerbe-dev.github.io/stop-gooning-bruh/progress.html';
  return '<div class="card"><h3>Public progress page</h3><p class="muted sm">Your progress page is updated automatically from the private cloud. Your streak and progress totals are published, along with slip times, won-urge times, and complete daily check-ins (mood, urge level, triggers, and notes). Slip notes, slip triggers, and selected won-urge activities are not published. The public progress snapshot updates daily at 12:05 AM Philippines time.</p><div class="share-controls"><p class="mono sm">'+url+'</p><button class="btn btn-ghost share-copy" type="button" data-act="copyPublicLink" aria-label="Copy progress link" title="Copy progress link"><span aria-hidden="true">▢</span></button></div></div>';
}
function syncStatus(msg){syncMessage=msg;var el=$('#syncStatus');if(el)el.textContent=msg;}
function textB64(value){return btoa(unescape(encodeURIComponent(value)));}
function syncApiUrl(c){return 'https://api.github.com/repos/'+encodeURIComponent(c.owner)+'/'+encodeURIComponent(c.repo)+'/contents/clean-slate.json';}
function syncHeaders(c){return {'Authorization':'Bearer '+c.token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'};}
function getSyncRemote(c,forceFull){
  var headers=syncHeaders(c);
  if(!forceFull&&c.etag)headers['If-None-Match']=c.etag;
  return fetch(syncApiUrl(c)+'?ref='+encodeURIComponent(c.branch),{headers:headers,keepalive:true,cache:'no-store'}).then(function(r){
    if(r.status===304)return {notModified:true,sha:c.sha||'',etag:c.etag||''};
    if(r.status===404)return null;
    return r.json().then(function(j){
      if(!r.ok)throw new Error(j.message||('GitHub returned '+r.status));
      var raw=decodeURIComponent(escape(atob((j.content||'').replace(/\s/g,''))));
      return {sha:j.sha,data:JSON.parse(raw),etag:r.headers.get('ETag')||''};
    });
  });
}
function mergeSyncStates(a,b){
  a=norm(a);b=norm(b);
  if(a._generation!==b._generation){
    var winner=a._generation>b._generation?a:b;
    return norm(winner);
  }
  var out=norm(a);
  ['reasons','activities','relapses','urges'].forEach(function(k){
    var seen={};out[k].concat(b[k]).forEach(function(v){var key=JSON.stringify(v);if(!seen[key])seen[key]=v;});
    out[k]=Object.keys(seen).map(function(k){return seen[k];});
  });
  ['_reasonAddedAt','_reasonDeletedAt','_activityAddedAt','_activityDeletedAt'].forEach(function(k){
    var merged={};Object.keys(a[k]).concat(Object.keys(b[k])).forEach(function(v){merged[v]=Math.max(Number(merged[v]||0),Number(a[k][v]||0),Number(b[k][v]||0));});out[k]=merged;
  });
  out.reasons=out.reasons.filter(function(v){return !out._reasonDeletedAt[v]||Number(out._reasonAddedAt[v]||0)>Number(out._reasonDeletedAt[v]||0);});
  out.activities=out.activities.filter(function(v){return !out._activityDeletedAt[v]||Number(out._activityAddedAt[v]||0)>Number(out._activityDeletedAt[v]||0);});
  Object.keys(b.checkins).forEach(function(k){
    var x=out.checkins[k],y=b.checkins[k];if(!x||Number(y.t||0)>Number(x.t||0))out.checkins[k]=y;
  });
  if(Number(b._startUpdatedAt||0)>Number(out._startUpdatedAt||0)){
    out.start=b.start;out._startUpdatedAt=Number(b._startUpdatedAt||0);
  }
  out._updatedAt=Math.max(Number(a._updatedAt||0),Number(b._updatedAt||0));
  return out;
}
function syncComparable(data){
  var x=norm(data);delete x.tab;delete x._updatedAt;delete x._startUpdatedAt;
  return JSON.stringify(x);
}
function startCloudPolling(){
  if(cloudPollTimer)clearInterval(cloudPollTimer);
  if(!window._cleanSlateVisibilitySync){window._cleanSlateVisibilitySync=true;document.addEventListener('visibilitychange',function(){if(!document.hidden&&cloudSyncReady)runCloudSync(false);});}
  cloudPollTimer=setInterval(function(){
    if(cloudSyncReady&&!document.hidden)runCloudSync(false);
  },30000);
  if(cloudSyncReady&&!document.hidden)runCloudSync(false);
}
function runCloudSync(pushLocal){
  if(!cloudSyncReady)return;
  if(cloudSyncBusy){cloudSyncAgain=true;return;}
  var c=syncConfig();if(!c.token)return;
  cloudSyncBusy=true;syncStatus('Uploading your latest changes…');
  var before=syncComparable(S);
  getSyncRemote(c,false).then(function(remote){
    if(remote&&remote.notModified){
      var currentComparable=syncComparable(S);
      if(cloudDirty&&currentComparable!==cloudSyncedComparable){
        return putSyncRemote(c,S,c.sha).then(function(sha){c.sha=sha;cloudSyncedComparable=syncComparable(S);cloudDirty=false;saveSyncConfig(c);syncStatus('Saved to cloud just now.');});
      }
      cloudDirty=false;
      syncStatus('Up to date with cloud.');
      return;
    }
    if(remote&&remote.data&&remote.data.alg==='AES-256-GCM')throw new Error('Old encrypted backup detected. Automatic sync stopped.');
    var remoteData=remote?norm(remote.data):null;
    var merged=remote?mergeSyncStates(S,remoteData):norm(S);
    var remoteNeedsUpdate=!remote||syncComparable(merged)!==syncComparable(remoteData);
    var localChanged=before!==syncComparable(merged);
    S=merged;persistLocal();
    if(localChanged){var tab=currentTab;renderAll();setTab(tab);}
    if(remoteNeedsUpdate){
      return putSyncRemote(c,S,remote?remote.sha:'').then(function(sha){c.sha=sha;cloudSyncedComparable=syncComparable(S);cloudDirty=false;saveSyncConfig(c);syncStatus('Saved to cloud just now.');});
    }
    cloudDirty=false;
    cloudSyncedComparable=syncComparable(remoteData);
    if(remote){c.sha=remote.sha;c.etag=remote.etag||c.etag||'';saveSyncConfig(c);}
    syncStatus('Up to date with cloud.');
  }).catch(function(err){
    syncStatus('Cloud sync paused: '+(err&&err.message?err.message:'check your connection.'));
  }).then(function(){
    cloudSyncBusy=false;
    if(cloudSyncAgain){cloudSyncAgain=false;if(cloudSyncReady&&!document.hidden)runCloudSync(false);}
  });
}
function putSyncRemote(c,data,sha){
  var body={message:'Sync Goon Logbook data',content:textB64(JSON.stringify(data,null,2)),branch:c.branch};if(sha)body.sha=sha;
  var bodyText=JSON.stringify(body),keepalive=false;
  try{keepalive=new Blob([bodyText]).size<60000;}catch(e){}
  return fetch(syncApiUrl(c),{method:'PUT',headers:syncHeaders(c),body:bodyText,keepalive:keepalive}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.message||('GitHub returned '+r.status));return j.content.sha;});});
}
function persistLocal(){try{localStorage.setItem(KEY,JSON.stringify(S));storageOK=true;}catch(e){storageOK=false;}}
function syncInitialCloud(c){
  if(!c.token)return Promise.reject(new Error('A GitHub token is required.'));
  var localExists=hasLocalCopy(),localState=norm(S),localTab=S.tab;
  return getSyncRemote(c,true).then(function(remote){
    if(remote&&remote.data&&remote.data.alg==='AES-256-GCM')throw new Error('The old encrypted backup format is still in the repository. Delete clean-slate.json and try again.');
    if(remote){
      var remoteData=norm(remote.data);
      S=localExists?mergeSyncStates(localState,remoteData):remoteData;
      S.tab=localTab||'today';
      persistLocal();
      c.etag=remote.etag||'';
      cloudSyncedComparable=syncComparable(remoteData);
      if(syncComparable(S)!==cloudSyncedComparable){
        return putSyncRemote(c,S,remote.sha).then(function(sha){c.sha=sha;cloudSyncedComparable=syncComparable(S);cloudDirty=false;saveSyncConfig(c);return sha;});
      }
      cloudDirty=false;
      return remote.sha;
    }
    S=localState;
    S._updatedAt=Date.now();S._startUpdatedAt=S._startUpdatedAt||S._updatedAt;persistLocal();
    return putSyncRemote(c,S,'').then(function(sha){c.sha=sha;cloudSyncedComparable=syncComparable(S);cloudDirty=false;saveSyncConfig(c);return sha;});
  });
}
function queueCloudBackup(){
  cloudDirty=true;
  clearTimeout(cloudSyncTimer);
  syncStatus('Saved on this device. Uploading to cloud…');
  cloudSyncTimer=setTimeout(function(){cloudSyncTimer=null;runCloudSync(true);},150);
}
function syncCard(){
  var c=syncConfig();
  return '<div class="card"><h3>Automatic cloud sync</h3><p class="muted sm">Your data syncs automatically through your private GitHub repository whenever you make changes. Connect each device once. Keep your GitHub token private.</p><p class="muted sm" id="syncStatus" aria-live="polite">'+esc(syncMessage)+'</p><p class="muted sm">'+(c.token?'This device is connected.':'This device is not connected.')+'</p></div>';
}
function renderMore(){
  var h='<div class="card"><h3>Your reasons</h3>'+
    (S.reasons.length?'<ul class="rs">'+S.reasons.map(function(r,i){return '<li><span>'+esc(r)+'</span><button class="x" type="button" data-act="delReason" data-i="'+i+'" aria-label="Remove reason">&times;</button></li>';}).join('')+'</ul>':'<p class="muted">Nothing yet. Add the reasons you want in front of you when it gets hard.</p>')+
    '<div class="row"><input type="text" id="reasonInMore" class="reason-in" maxlength="140" placeholder="Add a reason" aria-label="Add a reason"><button class="btn btn-primary" type="button" data-act="addReason" data-src="reasonInMore">Add</button></div></div>';
  h+='<div class="card"><h3>Your distractions</h3>'+(S.activities.length?'<ul class="rs">'+S.activities.map(function(r,i){return '<li><span>'+esc(r)+'</span><button class="x" type="button" data-act="delAct" data-i="'+i+'" aria-label="Remove">&times;</button></li>';}).join('')+'</ul>':'<p class="muted">Add your own in urge mode and they show up here. The built-in ones are always available.</p>')+'</div>';
  h+='<div class="card"><h3>Make it harder</h3><ul class="tips">'+
    '<li>Block adult sites on the whole phone with Private DNS. On Android, search Settings for Private DNS, choose the hostname option, and enter the address below.</li></ul>'+
    '<div class="row"><input type="text" id="dnsHost" class="mono" value="family.cloudflare-dns.com" readonly aria-label="Private DNS hostname"><button class="btn btn-ghost" type="button" data-act="copyDns">Copy</button></div>'+
    '<ul class="tips"><li>Charge your phone outside the bedroom. Late night and lying in bed are common high-risk moments.</li>'+
    '<li>Log out of accounts and remove apps that lead you there. A few extra steps are often enough.</li>'+
    '<li>Plan your riskiest hour ahead of time and decide what you will do instead.</li>'+
    '<li>Tell one person you trust what you are working on.</li></ul></div>';
  h+='<div class="card"><h3>Streak start</h3><p class="muted">Counting from '+new Date(S.start).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})+'. This timestamp changes when you record a slip.</p></div>';
  h+=syncCard();
  h+=publicProgressCard();
  h+='<div class="card"><h3>About</h3><p class="muted sm">No Goon Logbook account, ads, or tracking. A GitHub connection is required to open and sync your private cloud data. Your browser keeps a local copy for faster loading, but the app is not available offline. This is a self-help tool, not medical or mental health care. If this feels out of control, talk to a doctor or counselor.</p>'+
    '<button class="btn btn-ghost" type="button" data-act="reset" id="resetBtn">Erase all data</button></div>';
  $('#tab-more').innerHTML=h;
}

/* ---------- sheets ---------- */
function openSheet(html){
  var w=$('#sheetWrap');
  w.innerHTML='<div class="sheet" role="dialog" aria-modal="true">'+html+'</div>';
  w.hidden=false;
  var f=w.querySelector('button,input,textarea');if(f)f.focus({preventScroll:true});
}
function closeSheet(){var w=$('#sheetWrap');w.hidden=true;w.innerHTML='';}
function slipHtml(){
  return '<h2>A slip is data, not a verdict</h2><p class="muted">Your streak resets. Your best streak and history stay. Noting what set it off helps you plan for next time.</p>'+
    '<div class="lbl">What set it off</div>'+chips(slip.triggers,'slip')+
    '<label class="lbl" for="slipNote">Note (optional)</label><textarea id="slipNote" rows="2" maxlength="300">'+esc(slip.note)+'</textarea>'+
    '<button class="btn btn-urge wide" type="button" data-act="slipConfirm">Reset my streak</button>'+
    '<button class="btn btn-ghost wide" type="button" data-act="closeSheet">Cancel</button>';
}

/* ---------- tabs / render ---------- */
function renderAll(){
  renderToday();renderJourney();renderLog();renderMore();
  renderUrge();
  if(urge.mode==='active'){if(!urgeTimer)urgeTimer=setInterval(urgeTick,250);urgeTick();}
}
function setTab(name){
  currentTab=name;
  ['today','urge','journey','log','more'].forEach(function(t){
    $('#tab-'+t).hidden=(t!==name);
  });
  Array.prototype.forEach.call(document.querySelectorAll('.nb'),function(b){
    var on=b.dataset.tab===name;
    b.classList.toggle('on',on);
    if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  });
  if(name==='journey')renderJourney();
  if(name==='log'){var today=new Date();calendarMonth=new Date(today.getFullYear(),today.getMonth(),1);selectedLogDate=dayKey(today.getTime());renderLog();}
  if(name==='more')renderMore();
  S.tab=name;persistLocal();
  try{window.scrollTo(0,0);}catch(e){}
}

/* ---------- events ---------- */
function addReason(inp){
  var v=(inp&&inp.value||'').trim();
  if(!v){toast('Write a reason first');return;}
  if(S.reasons.length>=12){toast('Twelve reasons is plenty. Remove one first.');return;}
  S.reasons.push(v.slice(0,140));S._reasonAddedAt[v.slice(0,140)]=Date.now();save();renderToday();renderMore();if(urge.mode!=='active')renderUrge();
  toast('Reason added');
}
document.addEventListener('click',function(e){
  if(e.target.id==='sheetWrap'){closeSheet();return;}
  var t=e.target.closest('[data-act]');if(!t)return;
  var a=t.dataset.act;
  if(a==='tab'){setTab(t.dataset.tab);}
  else if(a==='calendarPrev'){calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1);selectedLogDate=dayKey(calendarMonth.getTime());renderLog();}
  else if(a==='calendarNext'){calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1);selectedLogDate=dayKey(calendarMonth.getTime());renderLog();}
  else if(a==='logDay'){selectedLogDate=t.dataset.date;renderLog();}
  else if(a==='goUrge'){setTab('urge');urgeStart();}
  else if(a==='mood'){getDraft().mood=+t.dataset.v;renderToday();}
  else if(a==='trig'){
    var list=t.dataset.for==='slip'?slip.triggers:getDraft().triggers,v=t.dataset.v,i=list.indexOf(v);
    if(i>-1)list.splice(i,1);else list.push(v);
    if(t.dataset.for==='slip')openSheet(slipHtml());else renderToday();
  }
  else if(a==='saveCheckin'){
    var dr=getDraft();
    if(!dr.mood){toast('Pick how you feel first');return;}
    S.checkins[dr.k]={mood:dr.mood,urge:dr.urge,triggers:dr.triggers.slice(),note:dr.note.trim().slice(0,300),t:Date.now()};
    editingCheckin=false;save();renderToday();renderLog();renderMore();toast('Checked in');
  }
  else if(a==='editCheckin'){editingCheckin=true;draft=null;renderToday();}
  else if(a==='nextReason'){reasonIdx++;renderToday();}
  else if(a==='addReason'){addReason(document.getElementById(t.dataset.src));}
  else if(a==='delReason'){var removedReason=S.reasons.splice(+t.dataset.i,1)[0];if(removedReason)S._reasonDeletedAt[removedReason]=Date.now();save();renderToday();renderMore();if(urge.mode!=='active')renderUrge();}
  else if(a==='openSlip'){slip={triggers:[],note:''};openSheet(slipHtml());}
  else if(a==='closeSheet'){closeSheet();}
  else if(a==='slipConfirm'){
    var now=Date.now();
    S.relapses.unshift({t:now,streakMs:elapsed(),triggers:slip.triggers.slice(),note:slip.note.trim().slice(0,300)});
    S.start=now;S._startUpdatedAt=now;
    save();
    clearInterval(urgeTimer);urge={mode:'idle',startedAt:0,endsAt:0,done:[]};persistUrge();persistUrge();
    closeSheet();renderAll();setTab('today');
    toast('Slip recorded. Syncing streak to cloud…');
  }
  else if(a==='urgeStart'){urgeStart();}
  else if(a==='urgeStop'){clearInterval(urgeTimer);urge.mode='idle';persistUrge();renderUrge();}
  else if(a==='urgeWin'){urgeWin();}
  else if(a==='urgeReset'){urge.mode='idle';urge.picked='';persistUrge();renderUrge();}
  else if(a==='pick'){urge.picked=(urge.picked===t.dataset.v)?'':t.dataset.v;persistUrge();renderPicker();}
  else if(a==='surprise'){
    var cand=allActs().filter(function(x){return x.n!==urge.picked;});
    urge.picked=cand[Math.floor(Math.random()*cand.length)].n;persistUrge();renderPicker();
  }
  else if(a==='addAct'){addAct(document.getElementById('actIn'));}
  else if(a==='delAct'){
    var gone=S.activities.splice(+t.dataset.i,1)[0];
    if(gone)S._activityDeletedAt[gone]=Date.now();
    if(urge.picked===gone)urge.picked='';
    save();renderMore();renderPicker();
  }
  else if(a==='copyDns'){copyText('family.cloudflare-dns.com',$('#dnsHost'));}
  else if(a==='copyPublicLink'){copyText('https://jerbe-dev.github.io/stop-gooning-bruh/progress.html',t);}
  else if(a==='reset'){
    if(!resetArmed){
      resetArmed=true;t.textContent='Tap again to erase everything';
      setTimeout(function(){resetArmed=false;var b=$('#resetBtn');if(b)b.textContent='Erase all data';},5000);
      return;
    }
    resetArmed=false;var nextGeneration=(Number(S._generation)||0)+1;S=fresh();S._generation=nextGeneration;save();draft=null;editingCheckin=false;
    clearInterval(urgeTimer);urge={mode:'idle',startedAt:0,endsAt:0,done:[]};
    renderAll();setTab('today');toast('All data erased');
  }
});
document.addEventListener('input',function(e){
  var id=e.target.id;
  if(id==='urgeRange'){getDraft().urge=+e.target.value;$('#urgeVal').textContent=e.target.value;}
  else if(id==='ciNote'){getDraft().note=e.target.value;}
  else if(id==='slipNote'){slip.note=e.target.value;}
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&!$('#sheetWrap').hidden)closeSheet();
  if(e.key==='Enter'&&e.target.classList&&e.target.classList.contains('reason-in'))addReason(e.target);
  if(e.key==='Enter'&&e.target.classList&&e.target.classList.contains('act-in'))addAct(e.target);
});
window.addEventListener('pagehide',function(){if(cloudSyncReady){clearTimeout(cloudSyncTimer);cloudSyncTimer=null;runCloudSync(true);}});
document.addEventListener('visibilitychange',function(){if(!document.hidden){tick();if(cloudSyncReady)runCloudSync(false);}});

restoreUrge();
if(initAccess()){
  renderAll();
  setTab(['today','urge','journey','log','more'].indexOf(S.tab)>-1?S.tab:'today');
}
setInterval(tick,1000);
setInterval(function(){if(currentTab==='journey')renderJourney();if(currentTab==='log')renderLog();},30000);
})();

/* Remove the old offline app cache. Goon Logbook requires a live cloud connection. */
if('serviceWorker' in navigator){
  navigator.serviceWorker.getRegistrations().then(function(registrations){registrations.forEach(function(registration){registration.unregister();});}).catch(function(){});
  if(window.caches&&caches.keys)caches.keys().then(function(keys){keys.filter(function(key){return key.indexOf('clean-slate-')===0;}).forEach(function(key){caches.delete(key);});}).catch(function(){});
}
