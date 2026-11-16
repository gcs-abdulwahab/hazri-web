(function(){
'use strict';

/* ---------- configuration ---------- */
var CFG={url:'https://egsdpjwcihfbqqciiwpt.supabase.co',key:'sb_publishable_4AcL7ZCJ7W42TFQVJGfoSA_CLG07nUO'};
var DOMAIN='gcslahore.edu.pk';
var GOOGLE_LOGIN=false; /* development: username + password. Set true to show Google sign-in. */
var sb=window.supabase.createClient(CFG.url,CFG.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});

var app=document.getElementById('app');
var toastEl=document.getElementById('toast');
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function pad(n){return String(n).padStart(2,'0');}
function iso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function todayISO(){return iso(new Date());}
function parseISO(s){var p=s.split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}
function addDays(s,n){var d=parseISO(s);d.setDate(d.getDate()+n);return iso(d);}
function fmtLong(s){return parseISO(s).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});}
function fmtShort(s){return parseISO(s).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});}
function fmtMonth(m){var p=m.split('-').map(Number);return new Date(p[0],p[1]-1,1).toLocaleDateString('en-GB',{month:'long',year:'numeric'});}
function newId(){
  if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16);});
}
var NAMES={P:'Present',A:'Absent',L:'Leave'};

/* ---------- state ---------- */
var S={classes:{},att:{}};
var ui={auth:'loading',email:'',userId:null,authError:'',loading:false,loadError:'',
  view:'home',cid:null,tab:'mark',mode:'tap',date:todayISO(),period:'all',shortOnly:false,
  quick:'',qWho:'present',qOthers:true,save:'idle',confirm:null,lastKey:'',
  asg:{email:'',from:'',msg:''},imp:null,admin:null,adm:{rows:null,loading:false,err:'',group:'section',teacher:'',list:null,newEmail:'',msg:''},admC:null,
  draft:null,lastTop:'home',cFilter:'First Year',tp:{list:null,err:'',name:'',dept:'',email:'',pass:'123456',msg:'',busy:false,open:'',cid:'',from:'',armed:'',secK:'',subSel:''},addText:'',gen:{from:'',to:'',step:'1',skip:''},
  secM:{filterProg:'all',filterYear:'First Year',openSec:'',createOpen:false,createHead:'',createName:'',createMsg:'',renameOpen:false,renameVal:'',renameMsg:'',delConfirm:false,stAddOpen:false,stRoll:'',stName:'',stMsg:'',bulkOpen:false,bulkText:'',editRoll:null,editRollVal:'',editNameVal:'',armedRoll:null,tPickOpen:false,tFrom:todayISO(),selectedTids:{},tMsg:'',subSel:''}};
var YEARS=['First Year','Second Year'];
var PROGRAMS_BUILTIN=['FSc Pre-Engineering','FSc Pre-Medical','ICS Physics','ICS Statistics','ICS Economics','I.Com','FA General Science','FA Humanities'];
var PROGRAM_SUBJECTS={'FSc Pre-Engineering':['Physics','Chemistry','Mathematics'],'FSc Pre-Medical':['Physics','Chemistry','Biology'],
  'ICS Physics':['Computer Science','Mathematics','Physics'],'ICS Statistics':['Computer Science','Mathematics','Statistics'],'ICS Economics':['Computer Science','Mathematics','Economics'],
  'I.Com':['Principles of Accounting','Principles of Economics','Principles of Commerce','Business Mathematics']};
/* Class names (programmes) come from the programs table once programs.sql has run; until then the built-in list. */
function progList(){
  if(S.programs&&S.programs.length)return S.programs;
  return PROGRAMS_BUILTIN.map(function(n,i){return {id:'',name:n,subjects:PROGRAM_SUBJECTS[n]||[],core:true,sort_no:i};});
}
function progNames(){return progList().map(function(p){return p.name;});}
function progByName(n){return progList().filter(function(p){return p.name===n;})[0]||null;}
/* ---------- monthly attendance: the registrar enables months; teachers enter totals per register ---------- */
function mtOf(cid,m){return (S.mt&&S.mt[cid]&&S.mt[cid][m])||null;}
function monthOpen(m){return !!(S.months&&S.months[m]);}
function seesAllMonths(){return isMgr()||!!ui.admin;}
function monthVisible(m){return seesAllMonths()||monthOpen(m);}
function isMine(c){return ui.noAssign||(c.assign||[]).some(function(a){return a.email===ui.email;});}
function canEditMonth(c,m){return isMgr()||(monthOpen(m)&&isMine(c));}
function sessionMonths(){
  var d=new Date(),y=d.getMonth()+1>=9?d.getFullYear():d.getFullYear()-1,out={};
  for(var i=0;i<12;i++){var x=new Date(y,8+i,1);out[x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')]=1;}
  Object.keys(S.months||{}).forEach(function(m){out[m]=1;});
  return Object.keys(out).sort();
}
function openMonths(){return Object.keys(S.months||{}).filter(monthOpen).sort();}
function curMonth(){var now=todayISO().slice(0,7),o=openMonths(),past=o.filter(function(m){return m<=now;});return past.length?past[past.length-1]:o.length?o[0]:now;}
/* entry status of one register for one month */
function mtStatus(c,m){
  var e=mtOf(c.id,m),n=c.students.length;
  if(!e)return {state:'none',filled:0,n:n,P:0,H:0};
  var filled=0,P=0,H=0;c.students.forEach(function(st){var v=e.att[st.id];if(v!=null&&v!==''){filled++;P+=+v;H+=e.delivered;}});
  return {state:e.delivered>0&&n>0&&filled===n?'done':'part',filled:filled,n:n,P:P,H:H,delivered:e.delivered};
}
function mtChip(c,m){
  var st=mtStatus(c,m);
  if(!st.n)return '<span class="chip">No students</span>';
  if(st.state==='none')return '<span class="chip">'+esc(fmtMonthShort(m))+': not entered</span>';
  if(st.state==='part')return '<span class="chip L">'+esc(fmtMonthShort(m))+': '+st.filled+'/'+st.n+'</span>';
  return '<span class="chip P">'+esc(fmtMonthShort(m))+': '+pctText(st.H?st.P/st.H*100:null)+'</span>';
}
function fmtMonthShort(m){var p=m.split('-').map(Number);return new Date(p[0],p[1]-1,1).toLocaleDateString('en-GB',{month:'short'});}
function monthProgress(list,m){
  var done=list.filter(function(c){return mtStatus(c,m).state==='done';}).length,all=list.length;
  return '<span class="prog"><span class="'+(all&&done===all?'t-yes':'t-no')+'">'+done+'/'+all+' entered</span><span class="bar"><i class="P" style="flex:'+done+'"></i><i class="U" style="flex:'+(all-done)+'"></i></span></span>';
}
function myRegs(){return classList().filter(function(c){return seesAllMonths()||isMine(c);});}
function viewAtt(){
  var mgr=isMgr(),h=topbar('Attendance',mgr?'Add months and open them for teachers':'Months open for entry',false),wait=loadingBody();
  if(wait)return h+wait;
  if(ui.noMonthly)return h+'<section class="empty"><h2>'+(mgr?'Attendance months are not available yet':'No month is open yet')+'</h2><p class="muted">'+(mgr?'Monthly attendance is being switched on for the college. Please check again shortly.':'The registrar opens a month when its attendance is due.')+'</p></section>';
  var months=seesAllMonths()?Object.keys(S.months||{}).sort():openMonths(),regs=myRegs(),A=ui.amf||(ui.amf={m:nextNewMonth(),open:true,del:''});
  h+='<div class="stack">';
  if(mgr)h+='<section class="card"><h3>Add a month</h3><div class="row" style="align-items:flex-end"><label class="lbl" style="flex:1;min-width:170px">Month<input class="field mono" id="amNew" type="month" value="'+esc(A.m)+'"></label>'+
    '<button class="btn primary" data-act="amadd">Add month</button></div>'+
    '<label class="chk"><input type="checkbox" id="amOpen"'+(A.open?' checked':'')+'><span>Open for teachers straight away</span></label></section>';
  if(!months.length)return h+'<section class="empty"><h2>'+(mgr?'No months yet':'No month is open yet')+'</h2><p class="muted">'+(mgr?'Add the first month above, for example September.':'The registrar opens a month when its attendance is due. It then appears here.')+'</p></section></div>';
  h+='<ul class="classes">'+months.map(function(m){
    var op=monthOpen(m),n=monthEntries(m),armed=A.del===m;
    return '<li class="card"><button class="tog" data-act="attmonth" data-m="'+m+'"><span><h2 style="margin:0">'+esc(fmtMonth(m))+'</h2><span class="hint">'+(seesAllMonths()?(op?'<b class="done">Open to teachers</b>':'Closed for teachers'):'')+'</span>'+monthProgress(regs,m)+'</span></button>'+
      '<div class="row" style="gap:6px;margin-top:10px">'+
      (mgr?'<button class="btn small'+(op?'':' primary')+'" data-act="attmtog" data-m="'+m+'">'+(op?'Close for teachers':'Open for teachers')+'</button>':'')+
      '<button class="btn small" data-act="attmonth" data-m="'+m+'">'+(canEditAny(m)?'Enter':'View')+'</button>'+
      (mgr?'<button class="btn small danger'+(armed?' armed':'')+'" data-act="amdel" data-m="'+m+'">'+(armed?(n?'Tap again: delete month and '+n+' entr'+(n===1?'y':'ies'):'Tap again to delete'):'Delete')+'</button>':'')+
      '</div></li>';
  }).join('')+'</ul></div>';
  return h;
}
function monthEntries(m){var n=0;Object.keys(S.mt||{}).forEach(function(cid){if(S.mt[cid][m])n++;});return n;}
function nextNewMonth(){
  var have=Object.keys(S.months||{}).sort(),now=todayISO().slice(0,7);
  if(!have.length)return now;
  var p=have[have.length-1].split('-').map(Number),d=new Date(p[0],p[1],1);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}
function addMonth(){
  if(!isMgr())return;var A=ui.amf,m=String(A.m||'').trim();
  if(!/^[0-9]{4}-[0-9]{2}$/.test(m)){toast('Choose a month first.');return;}
  if(S.months&&m in S.months){toast(fmtMonth(m)+' is already in the list.');return;}
  var op=!!A.open;S.months=S.months||{};S.months[m]=op;
  run(async function(){chk(await sb.from('attendance_months').insert({month:m,open:op,updated_by:ui.email}));});
  ui.amf={m:nextNewMonth(),open:A.open,del:''};render();
  toast(fmtMonth(m)+' added'+(op?' and open for teachers.':'. Open it when teachers should enter it.'));
}
function deleteMonth(m){
  if(!isMgr())return;var n=monthEntries(m);
  delete S.months[m];Object.keys(S.mt||{}).forEach(function(cid){delete S.mt[cid][m];});ui.amf.del='';
  run(async function(){
    if(n)chk(await sb.from('monthly_totals').delete().eq('month',m));
    chk(await sb.from('attendance_months').delete().eq('month',m));
  });
  render();toast(fmtMonth(m)+' deleted'+(n?' with its '+n+' entr'+(n===1?'y':'ies')+'.':'.'));
}
function canEditAny(m){return isMgr()||monthOpen(m);}
function toggleMonthOpen(m){
  if(!isMgr()||!m)return;var op=!monthOpen(m);S.months=S.months||{};S.months[m]=op;
  run(async function(){chk(await sb.from('attendance_months').upsert({month:m,open:op,updated_by:ui.email,updated_at:new Date().toISOString()},{onConflict:'month'}));});
  render();toast(fmtMonth(m)+(op?' is open. Teachers can now enter it.':' is closed. Teachers can no longer see it.'));
}
function viewAttMonth(){
  var m=ui.am,h=topbar(fmtMonth(m),seesAllMonths()?(monthOpen(m)?'Open to teachers':'Closed for teachers'):'Enter totals for each of your subjects','attback'),wait=loadingBody();
  if(wait)return h+wait;
  if(!monthVisible(m)){ui.view='att';return viewAtt();}
  var all=myRegs(),f=ui.cFilter||YEARS[0],list=seesAllMonths()?all.filter(function(c){return c.name.indexOf(f)===0;}):all;
  h+='<div class="stack">';
  if(seesAllMonths())h+='<div class="seg" role="group" aria-label="Year">'+YEARS.map(function(y){return '<button data-act="cfilter" data-v="'+y+'" aria-pressed="'+(f===y)+'">'+y+'</button>';}).join('')+'</div>';
  if(!list.length)return h+'<section class="empty"><p class="muted">'+(seesAllMonths()?'No '+esc(f)+' classes.':'No subjects are assigned to you yet.')+'</p></section></div>';
  h+='<div class="card">'+monthProgress(list,m)+'</div>';
  var byC={},num=function(a,b){return a.localeCompare(b,undefined,{numeric:true});};
  list.forEach(function(c){var sp=splitName(c.name),g=byC[sp.head]||(byC[sp.head]={});(g[sp.sec]||(g[sp.sec]=[])).push(c);});
  h+=Object.keys(byC).sort(num).map(function(hd){
    var g=byC[hd],secs=Object.keys(g).sort(num),regs=[].concat.apply([],secs.map(function(k){return g[k];})),key='am|'+hd,open=isOpen(key,!seesAllMonths());
    var head='<div class="headrow"><button class="tog" data-act="tog" data-k="'+esc(key)+'" aria-expanded="'+open+'"><span class="chev" aria-hidden="true"></span><span><h2 style="margin:0">'+esc(hd.indexOf(f+' · ')===0&&seesAllMonths()?hd.slice(f.length+3):hd)+'</h2>'+monthProgress(regs,m)+'</span></button></div>';
    if(!open)return '<section class="cgroup">'+head+'</section>';
    return '<section class="cgroup">'+head+'<div class="stack" style="gap:10px">'+secs.map(function(sn){
      return '<div class="card secbox">'+(sn?'<h3 style="margin:0 0 8px">'+esc(sn)+'</h3>':'')+'<ul class="subrows">'+g[sn].sort(function(a,b){return (a.subject||'').localeCompare(b.subject||'');}).map(function(c){
        var tch=currentTeacher(c,todayISO());
        return '<li><div class="subrow"><button class="subopen" data-act="attopen" data-cid="'+esc(c.id)+'"><span><b>'+esc(c.subject||'Register')+'</b><br><span class="tline '+(tch?'t-yes':'t-no')+'">'+(tch?esc(teacherLabel(tch)):'No teacher assigned')+'</span></span>'+mtChip(c,m)+'</button></div></li>';
      }).join('')+'</ul></div>';
    }).join('')+'</div></section>';
  }).join('');
  return h+'</div>';
}
function startEntry(cid,m){
  var c=S.classes[cid];if(!c)return;var e=mtOf(cid,m),att={};
  c.students.forEach(function(st){var v=e&&e.att[st.id];att[st.id]=v==null?'':String(v);});
  ui.ae={cid:cid,m:m,del:e&&e.delivered?String(e.delivered):'',att:att,dirty:false,warned:false};
  ui.cid=cid;ui.am=m;ui.view='attentry';window.scrollTo(0,0);render();
}
function aePct(E,sid,thr){
  var d=parseInt(E.del,10),raw=E.att[sid],v=parseInt(raw,10);
  if(raw===''||raw==null)return {t:'–',cls:''};
  if(isNaN(v)||String(v)!==String(raw).trim()||v<0)return {t:'Whole number',cls:'short'};
  if(!(d>0))return {t:'–',cls:''};
  if(v>d)return {t:'More than '+d,cls:'short'};
  var p=v/d*100;return {t:(Math.round(p*10)/10)+'%',cls:p<thr?'short':''};
}
function aeSummary(c,E){
  var d=parseInt(E.del,10),n=c.students.length,filled=0,P=0;
  c.students.forEach(function(st){var v=parseInt(E.att[st.id],10);if(E.att[st.id]!==''&&!isNaN(v)){filled++;P+=v;}});
  return filled+' of '+n+' entered'+(d>0&&filled?' · class average '+pctText(P/(filled*d)*100):'');
}
function viewAttEntry(){
  var E=ui.ae,c=E&&S.classes[E.cid];if(!c){ui.view='att';return viewAtt();}
  var m=E.m,ro=!canEditMonth(c,m),thr=c.threshold==null?75:c.threshold,e=mtOf(c.id,m);
  var h=topbar(c.subject||'Register',c.name+' · '+fmtMonth(m),'aeback');
  h+='<div class="stack">';
  if(ro)h+='<p class="hint warn" role="status">'+(monthOpen(m)?'This subject is not assigned to you, so you can only view it.':esc(fmtMonth(m))+' is closed. Only the registrar can change it.')+'</p>';
  if(!c.students.length)return h+'<section class="empty"><h2>No students yet</h2><p class="muted">Students are added by the registrar from Classes.</p></section></div>';
  h+='<section class="card"><div class="row" style="align-items:flex-end"><label class="lbl" style="flex:1;min-width:180px">Lectures delivered in '+esc(fmtMonth(m))+'<input class="field mono" id="aeDel" type="number" inputmode="numeric" min="0" max="500" value="'+esc(E.del)+'"'+(ro?' disabled':'')+'></label>'+
    (ro?'':'<button class="btn" data-act="aefill">Everyone attended all</button>')+'</div>'+
    '<p class="hint" id="aeSum">'+esc(aeSummary(c,E))+'</p>'+(e&&e.by?'<p class="hint">Last saved by '+esc(teacherLabel(e.by))+(e.at?' · '+esc(fmtShort(e.at.slice(0,10))):'')+'</p>':'')+'</section>';
  h+='<div class="tbl-wrap"><table><thead><tr><th>Student</th><th>Attended</th><th>%</th></tr></thead><tbody>'+c.students.map(function(st,i){
    var pc=aePct(E,st.id,thr);
    return '<tr><td class="nm" dir="auto"><span class="roll">'+esc(st.roll)+'</span> '+esc(st.name)+'</td><td><input class="field mono" style="width:90px" type="number" inputmode="numeric" min="0" data-ae="'+esc(st.id)+'" data-i="'+i+'" value="'+esc(E.att[st.id])+'" aria-label="Lectures attended by '+esc(st.name||st.roll)+'"'+(ro?' disabled':'')+'></td><td class="mono" id="aep'+i+'"><b class="'+pc.cls+'">'+esc(pc.t)+'</b></td></tr>';
  }).join('')+'</tbody></table></div>';
  if(!ro)h+='<div class="row"><button class="btn primary" data-act="aesave">Save</button><button class="btn" data-act="aeback">Back</button></div>';
  return h+'</div>';
}
function aeRefresh(){
  var E=ui.ae,c=E&&S.classes[E.cid];if(!c)return;var thr=c.threshold==null?75:c.threshold;
  c.students.forEach(function(st,i){var el=document.getElementById('aep'+i);if(el){var pc=aePct(E,st.id,thr);el.innerHTML='<b class="'+pc.cls+'">'+esc(pc.t)+'</b>';}});
  var sm=document.getElementById('aeSum');if(sm)sm.textContent=aeSummary(c,E);
}
function saveEntry(){
  var E=ui.ae,c=E&&S.classes[E.cid];if(!c||!canEditMonth(c,E.m))return;
  var d=parseInt(E.del,10);
  if(String(E.del).trim()===''||isNaN(d)||String(d)!==String(E.del).trim()||d<1||d>500){toast('Enter the lectures delivered this month (1 to 500).');var el=document.getElementById('aeDel');if(el)el.focus();return;}
  var att={},blank=0,bad='';
  c.students.forEach(function(st){var raw=String(E.att[st.id]==null?'':E.att[st.id]).trim();if(raw===''){blank++;return;}var v=parseInt(raw,10);
    if(isNaN(v)||String(v)!==raw||v<0)bad=bad||'Roll '+st.roll+': enter a whole number.';else if(v>d)bad=bad||'Roll '+st.roll+': '+v+' is more than the '+d+' lectures delivered.';else att[st.id]=v;});
  if(bad){toast(bad);return;}
  var oldAtt=(mtOf(c.id,E.m)&&mtOf(c.id,E.m).att)||{};
  var changes={};
  c.students.forEach(function(st){
    var oldV=oldAtt[st.id]==null?'':String(oldAtt[st.id]);
    var newV=att[st.id]==null?'':String(att[st.id]);
    if(oldV!==newV)changes[st.id]=(newV===''?null:parseInt(newV,10));
  });
  var row={delivered:d,att:att,by:ui.email,at:new Date().toISOString()},cid=c.id,m=E.m;
  (S.mt[cid]||(S.mt[cid]={}))[m]=row;E.dirty=false;
  run(async function(){chk(await sb.rpc('save_month',{p_class:cid,p_month:m,p_delivered:d,p_changes:changes}));});
  render();toast(blank?'Saved. '+blank+' student'+(blank===1?' is':'s are')+' still blank.':'Saved. '+c.students.length+' students entered.');
}
function regMonthsView(c){
  var months=Object.keys((S.mt&&S.mt[c.id])||{}).filter(monthVisible).sort();
  var open=openMonths().filter(function(m){return months.indexOf(m)<0;});
  var h='<div class="stack">';
  var btns=months.concat(open).filter(function(v,i,a){return a.indexOf(v)===i;}).sort();
  if(btns.length)h+='<div class="row">'+btns.map(function(m){return '<button class="btn small" data-act="attopen" data-cid="'+esc(c.id)+'" data-m="'+m+'">'+(canEditMonth(c,m)?'Enter ':'View ')+esc(fmtMonth(m))+'</button>';}).join('')+'</div>';
  if(!months.length||!c.students.length)return h+'<section class="empty"><h2>Nothing entered yet</h2><p class="muted">Open a month from Attendance and enter the totals. They appear here.</p></section></div>';
  var thr=c.threshold==null?75:c.threshold;
  h+='<div class="tbl-wrap"><table><thead><tr><th>Student</th>'+months.map(function(m){return '<th>'+esc(fmtMonthShort(m))+'</th>';}).join('')+'<th>Total</th></tr></thead><tbody>'+c.students.map(function(st){
    var P=0,H=0;
    var cells=months.map(function(m){var e=mtOf(c.id,m),v=e&&e.att[st.id];if(v==null)return '<td class="mono">–</td>';P+=+v;H+=e.delivered;return '<td class="mono">'+v+'/'+e.delivered+'</td>';}).join('');
    var pc=H?P/H*100:null;
    return '<tr><td class="nm" dir="auto"><span class="roll">'+esc(st.roll)+'</span> '+esc(st.name)+'</td>'+cells+'<td class="mono"><b class="'+(pc!=null&&pc<thr?'short':'')+'">'+pctText(pc)+'</b></td></tr>';
  }).join('')+'</tbody></table></div>';
  return h+'</div>';
}
function blankDraft(){return {year:'',prog:'',name:'',subjects:[],subIn:'',sections:[{name:'A',students:''}]};}
function isMgr(){return !!(ui.admin&&(ui.admin.manager||ui.admin.super));}
function myAssign(c,date){return (c.assign||[]).some(function(a){return a.email===ui.email&&a.from<=date&&(!a.to||date<=a.to);});}
function dayBy(cid,date){return (S.by&&S.by[cid]&&S.by[cid][date])||'';}
/* Months the registrar has closed: closed_months table does not exist. */
function isClosed(d){return false;}
function closedFor(d){return false;}
function closedNote(d){return '';}
function teacherMinDate(){return '';}
function canEdit(c,date){
  if(isMgr())return true;
  if(isFuture(date))return false;
  if(ui.noAssign)return true;
  return myAssign(c,date);
}
function lockReason(c,date){
  if(isFuture(date))return 'Future dates cannot be marked.';
  return 'You are not assigned to this class on this date, so you can only view it.';
}
function cls(){return ui.view==='adminclass'?ui.admC:S.classes[ui.cid];}
function isFuture(d){return d>todayISO();}
function activeClasses(){return Object.keys(S.classes).map(function(k){return S.classes[k];}).filter(function(c){return !c.archived;});}
function classList(){return activeClasses().filter(function(c){return isMgr()||!!ui.admin||ui.noAssign||(c.assign||[]).some(function(a){return a.email===ui.email;});}).sort(function(a,b){return (a.createdAt||0)-(b.createdAt||0);});}
function dayOf(cid,date){return (S.att[cid]&&S.att[cid][date])||{};}
function dayCounts(c,date){var m=dayOf(c.id,date),P=0,A=0,L=0;c.students.forEach(function(s){var v=m[s.id];if(v==='P')P++;else if(v==='A')A++;else if(v==='L')L++;});return {P:P,A:A,L:L,N:c.students.length,U:c.students.length-P-A-L};}

/* ---------- saving to Supabase ---------- */
function saveText(){return {idle:'',saving:'Saving…',saved:'Saved',error:'Not saved'}[ui.save]||'';}
function setSave(s){ui.save=s;var el=document.getElementById('saveState');if(el){el.textContent=saveText();el.className='save'+(s==='error'?' err':'');}}
var chain=Promise.resolve(),inflight=0,hadError=false,dayTimers={};
function chk(r){if(r&&r.error)throw r.error;return r;}
function settle(){if(!inflight&&!Object.keys(dayTimers).length)setSave(hadError?'error':'saved');}
function run(fn){
  inflight++;setSave('saving');
  chain=chain.then(fn).then(function(){inflight--;settle();},function(e){
    inflight--;hadError=true;console.error(e);setSave('error');
    toast('Could not save the last change. Check your connection, then reload the page.');
  });
}
function encodeDay(c,day){
  var len=0;c.students.forEach(function(s){if(day[s.id]&&s.idx+1>len)len=s.idx+1;});
  if(!len)return '';
  var arr=[];for(var i=0;i<len;i++)arr.push('-');
  c.students.forEach(function(s){if(day[s.id])arr[s.idx]=day[s.id];});
  return arr.join('');
}
var dayChanges={};
function recordDayChange(cid,date,sid,v){
  var k=cid+'|'+date;
  (dayChanges[k]||(dayChanges[k]={}))[sid]=v||'';
}
async function saveDay(cid,date){
  var k=cid+'|'+date;
  var currentChanges=dayChanges[k];
  if(!currentChanges||!Object.keys(currentChanges).length)return;
  var toSend=Object.assign({},currentChanges);
  try{
    chk(await sb.rpc('save_day',{p_class:cid,p_day:date,p_changes:toSend}));
    if(dayChanges[k]){
      Object.keys(toSend).forEach(function(sid){
        if(dayChanges[k][sid]===toSend[sid])delete dayChanges[k][sid];
      });
      if(!Object.keys(dayChanges[k]).length)delete dayChanges[k];
    }
    var bm=(S.by||(S.by={}));(bm[cid]||(bm[cid]={}));
    bm[cid][date]=ui.email;
  }catch(e){
    // Keep unsaved changes in dayChanges[k] and re-throw so run() displays error toast
    throw e;
  }
}
function persistDay(cid,date){
  var k=cid+'|'+date;setSave('saving');clearTimeout(dayTimers[k]);
  dayTimers[k]=setTimeout(function(){delete dayTimers[k];run(function(){return saveDay(cid,date);});},350);
}
function flushDays(){
  Object.keys(dayTimers).forEach(function(k){
    clearTimeout(dayTimers[k]);delete dayTimers[k];
    var p=k.split('|');run(function(){return saveDay(p[0],p[1]);});
  });
}
async function insertStudents(cid,list){
  for(var i=0;i<list.length;i+=400){
    var rows=list.slice(i,i+400).map(function(s){return {id:s.id,class_id:cid,idx:s.idx,roll:s.roll,name:s.name||''};});
    chk(await sb.from('students').insert(rows));
  }
}
function dbCreateClass(c){
  run(async function(){
    chk(await sb.from('classes').insert({id:c.id,name:c.name,subject:c.subject||'',threshold:c.threshold,leave_as_present:c.leaveAsPresent,next_idx:c.nextIdx}));
    await insertStudents(c.id,c.students);
  });
}
function dbUpdateClass(c){
  run(async function(){chk(await sb.from('classes').update({name:c.name,subject:c.subject||'',threshold:c.threshold,leave_as_present:c.leaveAsPresent}).eq('id',c.id));});
}
function dbUpdateStudent(s){
  run(async function(){chk(await sb.from('students').update({roll:s.roll,name:s.name||''}).eq('id',s.id));});
}
function dbDeleteClass(id){
  run(async function(){chk(await sb.from('classes').delete().eq('id',id));});
}

/* ---------- loading from Supabase ---------- */
async function fetchAll(table,orders){
  var out=[],from=0,step=1000;
  for(;;){
    var q=sb.from(table).select('*');
    orders.forEach(function(o){q=q.order(o);});
    var r=chk(await q.range(from,from+step-1));
    out=out.concat(r.data||[]);
    if(!r.data||r.data.length<step)break;
    from+=step;
  }
  return out;
}
async function loadAll(){
  var res=await Promise.all([
    fetchAll('classes',['id']),
    fetchAll('students',['id']),
    fetchAll('attendance_days',['class_id','day']),
    fetchAll('class_teachers',['id']).catch(function(){return null;}),
    fetchAll('programs',['sort_no','name']).catch(function(){return null;}),
    fetchAll('attendance_months',['month']).catch(function(){return null;}),
    fetchAll('monthly_totals',['class_id','month']).catch(function(){return null;})
  ]);
  var next={classes:{},att:{},by:{}};
  ui.noMonthly=(res[5]===null||res[6]===null);next.months={};next.mt={};
  (res[5]||[]).forEach(function(r){next.months[r.month]=!!r.open;});
  (res[6]||[]).forEach(function(r){(next.mt[r.class_id]||(next.mt[r.class_id]={}))[r.month]={delivered:r.delivered||0,att:r.attended||{},by:r.updated_by||'',at:r.updated_at||''};});
  ui.noPrograms=(res[4]===null);next.programs=(res[4]||[]).map(function(p){return {id:p.id,name:p.name,subjects:p.subjects||[],core:p.core!==false,sort_no:p.sort_no||0};});
  ui.noAssign=(res[3]===null);
  if(res[0].length)ui.canArchive=('archived_at' in res[0][0]);
  res[0].forEach(function(c){
    next.classes[c.id]={id:c.id,name:c.name,subject:c.subject||'',threshold:c.threshold,leaveAsPresent:!!c.leave_as_present,nextIdx:c.next_idx||0,students:[],assign:[],createdAt:Date.parse(c.created_at)||0,archived:!!c.archived_at};
  });
  (res[3]||[]).forEach(function(a){var c=next.classes[a.class_id];if(c)c.assign.push({id:a.id,email:a.teacher_email,from:a.from_day,to:a.to_day||null});});
  res[1].forEach(function(s){var c=next.classes[s.class_id];if(c)c.students.push({id:s.id,idx:s.idx,roll:s.roll,name:s.name||'',pp:s.prior_present||0,ph:s.prior_held||0});});
  Object.keys(next.classes).forEach(function(k){next.classes[k].students.sort(function(a,b){return a.idx-b.idx;});});
  res[2].forEach(function(d){
    var c=next.classes[d.class_id];if(!c)return;
    var m={};
    c.students.forEach(function(s){var ch=d.marks.charAt(s.idx);if(ch==='P'||ch==='A'||ch==='L')m[s.id]=ch;});
    if(Object.keys(m).length){(next.att[c.id]||(next.att[c.id]={}))[d.day]=m;}
    if(d.marked_by)(next.by[c.id]||(next.by[c.id]={}))[d.day]=d.marked_by;
  });
  S=next;
}
function startLoad(){
  ui.loading=true;ui.loadError='';render();
  loadAll().then(function(){ui.loading=false;render();},function(e){
    console.error(e);ui.loading=false;ui.loadError='Could not load your classes. Check your connection and try again.';render();
  });
}

/* ---------- sign in ---------- */
function friendlyAuthError(m){
  if(/database error|sign ?up|gcslahore|not allowed|hook|access_denied/i.test(m||''))return 'That Google account is not allowed. Sign in with your @'+DOMAIN+' account.';
  return m||'';
}
function handleSession(session){
  if(!session){
    if(ui.auth!=='out'){ui.auth='out';ui.userId=null;ui.email='';S={classes:{},att:{}};ui.view='home';ui.cid=null;ui.admin=null;ui.admC=null;render();}
    return;
  }
  var email=String(session.user.email||'').toLowerCase();
  if(email.slice(-('@'+DOMAIN).length)!=='@'+DOMAIN){
    ui.authError='Only @'+DOMAIN+' accounts can use this app. You signed in as '+email+'.';
    sb.auth.signOut();return;
  }
  if(ui.userId===session.user.id&&ui.auth==='in')return;
  ui.userId=session.user.id;ui.email=email;ui.auth='in';ui.authError='';
  ui.admin=null;
  setTimeout(startLoad,0);
  setTimeout(checkAdmin,0);
}
function signIn(){
  ui.authError='';
  sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname,queryParams:{hd:DOMAIN,prompt:'select_account'}}})
    .then(function(r){if(r&&r.error){ui.authError='Could not start Google sign-in. Try again.';render();}});
}
function signOut(){flushDays();chain.then(function(){return sb.auth.signOut();});}

/* ---------- students, classes ---------- */
function parseStudents(text,existing){
  var out=[],n=existing.length;
  text.split(/\r?\n/).map(function(l){return l.trim();}).filter(Boolean).forEach(function(line){
    var roll='',name='';
    if(line.indexOf('\t')>=0){
      var tIdx=line.indexOf('\t');
      var p1=line.slice(0,tIdx).trim(),p2=line.slice(tIdx+1).trim();
      if(!/\d/.test(p1)&&/\d/.test(p2)){roll=p2;name=p1;}
      else{roll=p1;name=p2;}
    }else if(line.indexOf('|')>=0){
      var barIdx=line.indexOf('|');
      var b1=line.slice(0,barIdx).trim(),b2=line.slice(barIdx+1).trim();
      if(!/\d/.test(b1)&&/\d/.test(b2)){roll=b2;name=b1;}
      else{roll=b1;name=b2;}
    }else if(/^(\S*\d\S*)\s*,\s*(.+)$/.test(line)){
      var m1=line.match(/^(\S*\d\S*)\s*,\s*(.+)$/);
      roll=m1[1];name=m1[2];
    }else if(/^([^,]+?)\s*,\s*(\S*\d\S*)$/.test(line)){
      var m2=line.match(/^([^,]+?)\s*,\s*(\S*\d\S*)$/);
      roll=m2[2];name=m2[1];
    }else{
      var m3=line.match(/^(\S*\d\S*)\s+(.+)$/);
      if(m3){roll=m3[1];name=m3[2];}else{name=line;}
    }
    n++;if(!roll)roll=String(n);
    out.push({id:newId(),roll:roll.slice(0,40),name:name.slice(0,200)});
  });
  return out;
}
function newClass(name,subject,studentsText,genRolls){
  var typed=parseStudents(studentsText||'',[]),have={};
  typed.forEach(function(s){have[s.roll]=1;});
  (genRolls||[]).forEach(function(r){if(!have[r]){have[r]=1;typed.push({id:newId(),roll:r,name:''});}});
  var c={id:newId(),name:name.slice(0,200),subject:(subject||'').slice(0,200),threshold:75,leaveAsPresent:false,nextIdx:0,students:typed,createdAt:Date.now()};
  c.students.forEach(function(s){s.idx=c.nextIdx++;});
  S.classes[c.id]=c;
  return c;
}
function setDay(cid,date,day){
  if(isFuture(date)){toast('Attendance cannot be marked for a future date.');return;}
  var gc=S.classes[cid];if(gc&&!canEdit(gc,date)){toast(lockReason(gc,date));return;}
  var prev=(S.att[cid]&&S.att[cid][date])||{};
  var a=S.att[cid]||(S.att[cid]={}),clean={};
  Object.keys(day).forEach(function(k){if(day[k])clean[k]=day[k];});
  if(Object.keys(clean).length)a[date]=clean;else delete a[date];
  if(gc&&gc.students){
    gc.students.forEach(function(st){
      var oldV=prev[st.id]||'';
      var newV=clean[st.id]||'';
      if(oldV!==newV)recordDayChange(cid,date,st.id,newV);
    });
  }
  persistDay(cid,date);
}

/* ---------- dictated and typed roll numbers ---------- */
var NUMW={zero:0,oh:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90,
  'صفر':0,'ایک':1,'دو':2,'تین':3,'چار':4,'پانچ':5,'چھ':6,'سات':7,'آٹھ':8,'نو':9,'دس':10,'گیارہ':11,'بارہ':12,'تیرہ':13,'چودہ':14,'پندرہ':15,'سولہ':16,'سترہ':17,'اٹھارہ':18,'انیس':19,'بیس':20,'تیس':30,'چالیس':40,'پچاس':50,'ساٹھ':60};
var FILLER=/^(and|also|roll|rolls|number|numbers|no|nos|present|absent|is|are|the|plus|اور|رول|نمبر)$/;
function isNumW(w){return Object.prototype.hasOwnProperty.call(NUMW,w);}
function nextTok(toks,k){while(k<toks.length&&(/^\s+$/.test(toks[k])||toks[k]==='-'))k++;return k;}
function normalizeSpoken(t){
  t=String(t).replace(/[٠-٩]/g,function(d){return d.charCodeAt(0)-0x0660;}).replace(/[۰-۹]/g,function(d){return d.charCodeAt(0)-0x06F0;}).toLowerCase();
  var toks=t.match(/[a-zؠ-يٱ-ۓ]+|\d+|\s+|[^a-z\d\sؠ-يٱ-ۓ]/g)||[],out=[],i=0;
  while(i<toks.length){
    var w=toks[i];
    if(isNumW(w)){
      var n=NUMW[w],j=i+1,k=nextTok(toks,j);
      if(n>=20&&n%10===0&&k<toks.length&&isNumW(toks[k])&&NUMW[toks[k]]>=1&&NUMW[toks[k]]<=9){n+=NUMW[toks[k]];j=k+1;}
      else if(n>=1&&n<=9&&toks[k]==='hundred'){
        n*=100;j=k+1;var k3=nextTok(toks,j);if(toks[k3]==='and')k3=nextTok(toks,k3+1);
        if(k3<toks.length&&isNumW(toks[k3])){
          var m=NUMW[toks[k3]];
          if(m>=20&&m%10===0){n+=m;j=k3+1;var k4=nextTok(toks,j);if(k4<toks.length&&isNumW(toks[k4])&&NUMW[toks[k4]]>=1&&NUMW[toks[k4]]<=9){n+=NUMW[toks[k4]];j=k4+1;}}
          else if(m>=1&&m<=19){n+=m;j=k3+1;}
        }
      }
      out.push(String(n));i=j;continue;
    }
    if(FILLER.test(w)){out.push(' ');i++;continue;}
    out.push(w);i++;
  }
  return out.join('').replace(/(\d+)\s*(?:-|–|—|to|through|thru|till|until|تا)\s*(\d+)/g,'$1-$2');
}
function norm(s){return String(s).toLowerCase().replace(/\s+/g,' ').trim();}
function parseQuick(c,text){
  var ids=new Set(),unmatched=[],st=c.students;
  function byRoll(t){
    var n=norm(t),ex=st.filter(function(s){return norm(s.roll)===n;});
    if(ex.length)return ex;
    if(/^\d+$/.test(n)){var v=parseInt(n,10);return st.filter(function(s){return /^\d+$/.test(s.roll)&&parseInt(s.roll,10)===v;});}
    return [];
  }
  function byRange(t){
    var m=t.match(/^(\d+)\s*(?:-|–|—|to)\s*(\d+)$/i);if(!m)return null;
    var a=+m[1],b=+m[2];if(a>b){var x=a;a=b;b=x;}
    return st.filter(function(s){return /^\d+$/.test(s.roll)&&+s.roll>=a&&+s.roll<=b;});
  }
  normalizeSpoken(text).split(/[\n,;،\t]+/).map(function(p){return p.trim();}).filter(Boolean).forEach(function(piece){
    var h=byRoll(piece);
    if(h.length){h.forEach(function(s){ids.add(s.id);});return;}
    var r=byRange(piece);
    if(r){if(r.length)r.forEach(function(s){ids.add(s.id);});else unmatched.push(piece);return;}
    if(/\s/.test(piece)){
      var subs=piece.split(/\s+/),ok=[],bad=false;
      subs.forEach(function(sub){var a=byRoll(sub);if(!a.length){var b=byRange(sub);a=b||[];}if(a.length)ok=ok.concat(a);else bad=true;});
      if(!bad&&ok.length){ok.forEach(function(s){ids.add(s.id);});return;}
    }
    unmatched.push(piece);
  });
  return {ids:ids,unmatched:unmatched};
}
function computeQuick(c,r){
  var day=Object.assign({},dayOf(c.id,ui.date));
  var listed=ui.qWho==='present'?'P':'A',other=ui.qWho==='present'?'A':'P';
  c.students.forEach(function(s){
    if(r.ids.has(s.id))day[s.id]=listed;
    else if(ui.qOthers&&day[s.id]!=='L')day[s.id]=other;
  });
  return day;
}
function quickPreviewHTML(c,r){
  if(!ui.quick.trim())return '<p class="hint">Type, paste or speak roll numbers only, like <span class="mono">1, 4, 7-12</span>. Separate them with commas, spaces or new lines. Spoken numbers such as “seven to twelve” are converted for you.</p>';
  var day=computeQuick(c,r),P=0,A=0,L=0;
  c.students.forEach(function(s){var v=day[s.id];if(v==='P')P++;else if(v==='A')A++;else if(v==='L')L++;});
  var matched=c.students.filter(function(s){return r.ids.has(s.id);});
  var h='<p><b>'+matched.length+'</b> matched · result: <span class="chip P">'+P+' present</span> <span class="chip A">'+A+' absent</span>'+(L?' <span class="chip L">'+L+' leave</span>':'')+'</p>';
  if(matched.length)h+='<div class="names">'+matched.map(function(s){return '<span dir="auto">'+esc(s.roll)+(s.name?' · '+esc(s.name):'')+'</span>';}).join('')+'</div>';
  if(r.unmatched.length)h+='<p class="warn">No student with roll number: '+r.unmatched.map(function(u){return '<span class="mono">'+esc(u)+'</span>';}).join(', ')+'</p>';
  return h;
}
function updateQuickPreview(){
  var el=document.getElementById('quickPreview'),btn=document.getElementById('applyQ');
  if(!el||!ui.cid||!cls())return;
  var r=parseQuick(cls(),ui.quick);
  el.innerHTML=quickPreviewHTML(cls(),r);
  if(btn)btn.disabled=r.ids.size===0;
}

/* ---------- reports ---------- */
function monthsOf(c){var a=S.att[c.id]||{},m={};Object.keys(a).forEach(function(d){m[d.slice(0,7)]=1;});return Object.keys(m).sort().reverse();}
function sessionDates(c,period){
  return sessionDates0(c,period);
}
function sessionDates0(c,period){
  var a=S.att[c.id]||{};
  return Object.keys(a).filter(function(d){return (period==='all'||d.indexOf(period)===0)&&c.students.some(function(s){return a[d][s.id];});}).sort();
}
var ALLTIME=true;
function hasPrior(c){return c.students.some(function(x){return x.ph>0;});}
function stats(c,dates,sid){
  var P=0,A=0,L=0,a=S.att[c.id]||{};
  dates.forEach(function(d){var v=a[d]&&a[d][sid];if(v==='P')P++;else if(v==='A')A++;else if(v==='L')L++;});
  if(ALLTIME){var st0=c.students.filter(function(x){return x.id===sid;})[0];if(st0&&st0.ph){P+=st0.pp;A+=Math.max(0,st0.ph-st0.pp);}}
  var held=P+A+L,num=P+(c.leaveAsPresent?L:0);
  return {P:P,A:A,L:L,held:held,pct:held?num/held*100:null};
}
function csvCell(v){v=String(v==null?'':v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
/* Monthly Excel for the registrar: one sheet per section, every subject's held / present / % per student.
   Teachers get only the registers they can see. */
function mxMonths(){var m={};if(!ui.noMonthly&&Object.keys(S.months||{}).length)Object.keys(S.months).forEach(function(x){m[x]=1;});else m[curMonth()]=1;openMonths().forEach(function(x){m[x]=1;});Object.keys(S.mt||{}).forEach(function(cid){Object.keys(S.mt[cid]).forEach(function(x){m[x]=1;});});return Object.keys(m).filter(monthVisible).sort().reverse();}
function lockBlock(){
  return '';
}
function toggleMonth(){}
function monthExportCard(){
  if(!classList().length)return '';
  var ms=mxMonths();if(!ui.mx||ms.indexOf(ui.mx)<0)ui.mx=ms[0];
  return '<section class="card"><h3>Monthly attendance</h3><p class="hint">Excel file, one sheet per section: each student&#39;s lectures delivered, attended and % in every subject.'+(isMgr()?'':' Only your registers are included.')+'</p>'+
  '<div class="row"><label class="lbl" style="flex:1;min-width:160px"><span class="sr">Month</span><select class="field" id="mxSel">'+ms.map(function(m){return '<option value="'+m+'"'+(ui.mx===m?' selected':'')+'>'+esc(fmtMonth(m))+'</option>';}).join('')+'</select></label><button class="btn primary" data-act="mxdo">Download Excel</button></div>'+lockBlock()+'</section>';
}
function mxSheetName(head,sec,used){
  var n=(head.replace(/^First Year · /,'1st ').replace(/^Second Year · /,'2nd ').replace(/ · /g,' ')+(sec?' '+sec.replace(/^Section /,''):'')).replace(/[\[\]:*?\/\\]/g,'').slice(0,31),b=n,i=2;
  while(used[n.toLowerCase()]){var suf=' ('+(i++)+')';n=b.slice(0,31-suf.length)+suf;}
  used[n.toLowerCase()]=1;return n;
}
function exportMonth(){
  var m=ui.mx||todayISO().slice(0,7),mName=fmtMonth(m),groups={},order=[];
  ALLTIME=false;
  classList().forEach(function(c){var p=splitName(c.name),k=p.head+'|'+p.sec;if(!groups[k]){groups[k]={head:p.head,sec:p.sec,regs:[]};order.push(k);}groups[k].regs.push(c);});
  if(!order.length){toast('No classes to export.');return;}
  order.sort(function(a,b){return a.localeCompare(b,undefined,{numeric:true});});
  var wb=XLSX.utils.book_new(),used={summary:1},sum=[['Attendance · '+mName],[],['Class','Section','Students','Subjects','Subjects not entered','Attendance %','Students below minimum']],sheets=[],anyMarked=false;
  order.forEach(function(k){
    var g=groups[k],regs=g.regs.slice().sort(function(a,b){return (a.createdAt||0)-(b.createdAt||0)||(a.subject||'').localeCompare(b.subject||'');});
    var thr=regs[0].threshold==null?75:regs[0].threshold,rolls=[],names={},seen={};
    regs.forEach(function(c){c.students.forEach(function(st){var rk=String(st.roll).trim();if(!seen[rk.toLowerCase()]){seen[rk.toLowerCase()]=1;rolls.push(rk);}if(st.name&&!names[rk.toLowerCase()])names[rk.toLowerCase()]=st.name;});});
    rolls.sort(function(a,b){return a.localeCompare(b,undefined,{numeric:true});});
    var ents=regs.map(function(c){return mtOf(c.id,m);}),title=g.head+(g.sec?' · '+g.sec:'')+' · '+mName;
    var r1=['Roll','Name'],r2=['',''],merges=[{s:{r:0,c:0},e:{r:0,c:5+regs.length*3}},{s:{r:1,c:0},e:{r:2,c:0}},{s:{r:1,c:1},e:{r:2,c:1}}];
    regs.forEach(function(c,i){r1.push(c.subject||'Register','','');r2.push('Delivered','Attended','%');merges.push({s:{r:1,c:2+i*3},e:{r:1,c:4+i*3}});});
    var tc=2+regs.length*3;r1.push('Total','','','Below '+thr+'%');r2.push('Delivered','Attended','%','');merges.push({s:{r:1,c:tc},e:{r:1,c:tc+2}},{s:{r:1,c:tc+3},e:{r:2,c:tc+3}});
    var rows=[[title],r1,r2],low=0,TH=0,TP=0;
    rolls.forEach(function(roll){
      var rk=roll.toLowerCase(),row=[roll,names[rk]||''],H=0,P=0;
      regs.forEach(function(c,i){
        var st=c.students.filter(function(x){return String(x.roll).trim().toLowerCase()===rk;})[0],e=ents[i],v=st&&e?e.att[st.id]:null;
        if(v==null){row.push('','','');return;}
        var d=e.delivered;H+=d;P+=v;
        row.push(d,v,d?Math.round(v/d*1000)/10:'');
      });
      var pc=H?Math.round(P/H*1000)/10:'';row.push(H,P,pc,pc!==''&&pc<thr?'Yes':'');if(pc!==''&&pc<thr)low++;TH+=H;TP+=P;
      rows.push(row);
    });
    var foot=['','Lectures delivered'];regs.forEach(function(c,i){foot.push(ents[i]?ents[i].delivered:'Not entered','','');if(ents[i])anyMarked=true;});rows.push([],foot);
    var ws=XLSX.utils.aoa_to_sheet(rows);ws['!merges']=merges;
    ws['!cols']=[{wch:10},{wch:24}].concat(r1.slice(2).map(function(){return {wch:8};}));
    sheets.push([mxSheetName(g.head,g.sec,used),ws]);
    sum.push([g.head,g.sec?g.sec.replace(/^Section /,''):'Whole class',rolls.length,regs.length,ents.filter(function(x){return !x;}).length,TH?Math.round(TP/TH*1000)/10:'',low]);
  });
  var ss=XLSX.utils.aoa_to_sheet(sum);ss['!cols']=[{wch:34},{wch:10},{wch:10},{wch:10},{wch:18},{wch:13},{wch:22}];
  XLSX.utils.book_append_sheet(wb,ss,'Summary');
  sheets.forEach(function(p){XLSX.utils.book_append_sheet(wb,p[1],p[0]);});
  XLSX.writeFile(wb,'Hazri-attendance-'+m+'.xlsx');
  toast(anyMarked?'Excel downloaded: '+order.length+' section'+(order.length===1?'':'s')+', '+mName+'.':'Excel downloaded, but nothing is entered for '+mName+' yet.');
}
function exportCsv(){
  var c=cls();if(!c)return;
  ALLTIME=ui.period==='all';
  var dates=sessionDates(c,ui.period);
  var rows=[['Roll','Name','Present','Absent','Attendance %'].concat(dates)];
  c.students.forEach(function(s){
    var t=stats(c,dates,s.id),a=S.att[c.id]||{};
    rows.push([s.roll,s.name,t.P,t.A,t.pct==null?'':Math.round(t.pct*10)/10].concat(dates.map(function(d){return (a[d]&&a[d][s.id])||'';})));
  });
  var csv='﻿'+rows.map(function(r){return r.map(csvCell).join(',');}).join('\r\n');
  var fname=(c.name.replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-')||'class')+'-attendance-'+(ui.period==='all'?'all':ui.period)+'.csv';
  var url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  var a=document.createElement('a');a.href=url;a.download=fname;document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(url);},3000);
  toast('CSV downloaded.');
}

/* ---------- roll numbers from a pattern ---------- */
function addSubject(quiet){
  var d=ui.draft,have={};d.subjects.forEach(function(s){have[s.toLowerCase()]=1;});
  d.subIn.split(',').map(function(s){return s.trim().slice(0,200);}).filter(Boolean).forEach(function(s){if(!have[s.toLowerCase()]){have[s.toLowerCase()]=1;d.subjects.push(s);}});
  d.subIn='';if(quiet)return;render();var el=document.getElementById('subIn');if(el)el.focus();
}
function genResult(existing){
  var g=ui.gen,ex={};(existing||[]).forEach(function(s){ex[s.roll]=1;});
  if(g.from.trim()===''&&g.to.trim()===''){return {list:[],msg:'Optional. Example: from 604, to 1200, step 4 gives 604, 608, 612 … 1200.'};}
  var a=parseInt(g.from,10),b=parseInt(g.to,10),st=parseInt(g.step.trim()===''?'1':g.step,10);
  if(isNaN(a)||isNaN(b)||isNaN(st)||st<1){return {list:[],error:true,msg:'Enter whole numbers for From and To, and a Step of 1 or more.'};}
  if(b<a){return {list:[],error:true,msg:'“To” must be the same as or larger than “From”.'};}
  if(Math.floor((b-a)/st)+1>1500){return {list:[],error:true,msg:'That makes more than 1,500 roll numbers. Use a smaller range.'};}
  var skip={};
  normalizeSpoken(g.skip||'').split(/[\s,;]+/).forEach(function(tok){
    var m=tok.match(/^(\d+)-(\d+)$/);
    if(m){var x=+m[1],y=Math.min(+m[2],x+5000);for(;x<=y;x++)skip[x]=1;}
    else if(/^\d+$/.test(tok))skip[+tok]=1;
  });
  var list=[],dup=0;
  for(var n=a;n<=b;n+=st){if(skip[n])continue;if(ex[String(n)]){dup++;continue;}list.push(String(n));}
  if(!list.length){return {list:[],error:dup===0,msg:dup?'These roll numbers are already in the class.':'Nothing is left after skipping.'};}
  return {list:list,msg:list.length+' roll numbers: '+list.slice(0,3).join(', ')+(list.length>3?' … '+list[list.length-1]:'')+'.'+(dup?' '+dup+' already in the class, left out.':'')};
}
function genBlock(existing){
  var g=ui.gen,r=genResult(existing);
  return '<div class="gen"><h3>Generate roll numbers</h3><p class="hint">For classes whose roll numbers follow a pattern. Students are added with roll numbers only. You can add names later.</p>'+
  '<div class="gen-grid"><label class="lbl">From<input class="field mono" id="genFrom" inputmode="numeric" value="'+esc(g.from)+'"></label><label class="lbl">To<input class="field mono" id="genTo" inputmode="numeric" value="'+esc(g.to)+'"></label><label class="lbl">Step<input class="field mono" id="genStep" inputmode="numeric" value="'+esc(g.step)+'"></label></div>'+
  '<label class="lbl">Skip these (optional)<input class="field mono" id="genSkip" value="'+esc(g.skip)+'" placeholder="e.g. 700, 744, 800-812"></label>'+
  '<p class="hint'+(r.error?' warn':'')+'" id="genInfo">'+esc(r.msg)+'</p></div>';
}

/* ---------- toast ---------- */
var toastTimer=null,toastUndo=null;
function toast(msg,undo){
  toastUndo=undo||null;
  toastEl.innerHTML='<span>'+esc(msg)+'</span>'+(undo?'<button data-act="toastundo">Undo</button>':'');
  toastEl.hidden=false;clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){toastEl.hidden=true;toastUndo=null;},undo?9000:4500);
}

/* ---------- views ---------- */
function topbar(title,sub,back){
  return '<header class="top">'+(back?'<button class="icon-btn" data-act="'+(back==='admin'?'adminhome':typeof back==='string'?back:'home')+'" aria-label="Back">←</button>':'')+
    '<div class="ttl"><h1 dir="auto">'+esc(title)+'</h1>'+(sub?'<p class="sub">'+esc(sub)+'</p>':'')+'</div>'+
    '<span class="save'+(ui.save==='error'?' err':'')+'" id="saveState" aria-live="polite">'+saveText()+'</span></header>';
}
function viewSignIn(){
  return '<main class="signin"><div><h1>Hazri Register</h1><p class="muted" style="margin-top:6px">Class attendance for teachers.</p></div>'+
    '<form class="card" id="loginForm" autocomplete="on"><label class="lbl">Username<input class="field" id="loginEmail" type="email" inputmode="email" autocapitalize="off" autocomplete="username" placeholder="name@'+esc(DOMAIN)+'" value="'+esc(ui.loginEmail||'')+'" required></label>'+
    '<label class="lbl">Password<input class="field" id="loginPass" type="password" autocomplete="current-password" value="'+esc(ui.loginPass||'')+'" required></label>'+
    '<button class="btn primary" type="submit"'+(ui.signingIn?' disabled':'')+'>'+(ui.signingIn?'Signing in…':'Sign in')+'</button></form>'+
    (GOOGLE_LOGIN?'<button class="btn" data-act="signin">Sign in with Google</button>':'')+
    (ui.authError?'<p class="hint warn" role="alert">'+esc(ui.authError)+'</p>':'')+'</main>';
}
/* ---------- menu ---------- */
var ICONS={
  home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  att:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8.5 15l2 2 4-4"/>',
  classes:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v16"/>',
  sections:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  teachers:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.7 2.5 3 5.2"/>',
  assign:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5 1.6 0 3 .5 4.1 1.4"/><path d="M19 14v6M16 17h6"/>',
  reports:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  admins:'<path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>'
};
function navItems(){
  var it=[{v:'home',label:'Dashboard'},{v:'att',label:'Attendance'},{v:'classes',label:isMgr()||ui.admin?'Classes':'My classes'}];
  if(isMgr())it.push({v:'sections',label:'Sections',icon:'sections'});
  if(ui.admin)it.push({v:'teachers',label:'Teachers'});
  if(isMgr())it.push({v:'assign',label:'Assign'});
  if(ui.admin)it.push({v:'admin',label:'Reports',icon:'reports'});
  if(ui.admin&&ui.admin.super)it.push({v:'manage',label:'Admins',icon:'admins'});
  return it;
}
function navSection(){
  var v=ui.view;
  if(v==='admin'||v==='adminclass')return 'admin';
  if(v==='attmonth'||v==='attentry')return 'att';
  if(v==='class'||v==='new'||v==='newsec')return ui.lastTop||'classes';
  if(v==='sections'||v==='sectiondetail')return 'sections';
  return v;
}
function viewNav(){
  var cur=navSection(),role=ui.admin?(ui.admin.super?'Super admin':ui.admin.manager?'Manager':'Admin'):'Teacher';
  return '<nav class="nav" aria-label="Main menu"><div class="brand">Hazri Register</div>'+navItems().map(function(n){
    return '<button data-act="nav" data-v="'+n.v+'"'+(cur===n.v?' aria-current="page"':'')+'><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICONS[n.icon||n.v]+'</svg><span>'+esc(n.label)+'</span></button>';
  }).join('')+'<div class="who"><b>'+esc(role)+'</b><br>'+esc(ui.email)+'<br><button class="linkbtn" data-act="signout">Sign out</button></div></nav>';
}

/* ---------- dashboard ---------- */
function statusChip(c,t){return mtChip(c,curMonth());}
function classCard(c,t){
  var k=dayCounts(c,t);
  return '<li><button class="class-card" data-act="open" data-cid="'+esc(c.id)+'"><span class="cc-top"><span><span class="cc-name" dir="auto">'+esc(c.name)+'</span><br><span class="cc-sub">'+(c.subject?esc(c.subject)+' · ':'')+k.N+' students</span></span>'+statusChip(c,t)+'</span><span class="bar"><i class="P" style="flex:'+k.P+'"></i><i class="A" style="flex:'+k.A+'"></i><i class="L" style="flex:'+k.L+'"></i><i class="U" style="flex:'+k.U+'"></i></span></button></li>';
}
function currentTeacher(c,t){var a=(c.assign||[]).filter(function(a){return a.from<=t&&(!a.to||t<=a.to);})[0];return a?a.email:'';}
function teacherLabel(em){var r=(ui.tp.list||[]).filter(function(x){return x.email===em;})[0];return r&&r.name?r.name:em.split('@')[0];}
function loadingBody(){
  if(ui.loading)return '<p class="muted">Opening your register…</p>';
  if(ui.loadError)return '<section class="empty"><p class="warn">'+esc(ui.loadError)+'</p><div class="row"><button class="btn primary" data-act="reload">Try again</button></div></section>';
  return '';
}
function viewHome(){
  var list=classList(),mine=myRegs(),h=topbar('Dashboard',fmtLong(todayISO()),false),wait=loadingBody();
  if(wait)return h+wait;
  var groups={},students=0;list.forEach(function(c){if(!groups[c.name]){groups[c.name]=1;students+=c.students.length;}});
  var om=openMonths(),cm=curMonth(),done=mine.filter(function(c){return mtStatus(c,cm).state==='done';}).length;
  h+='<div class="stack">';
  h+='<div class="tally tiles"><div><b>'+Object.keys(groups).length+'</b><small>Sections</small></div><div><b>'+list.length+'</b><small>Registers</small></div><div><b>'+students+'</b><small>Students</small></div><div><b>'+done+'<span class="of">/'+mine.length+'</span></b><small>'+esc(fmtMonthShort(cm))+' entered</small></div></div>';
  if(isMgr())h+='<div class="row"><button class="btn primary" data-act="nav" data-v="att">Attendance months</button><button class="btn" data-act="newclass">+ Add class</button><button class="btn" data-act="nav" data-v="admin">Reports</button></div>';
  if(!list.length){
    h+=isMgr()?'<section class="empty"><h2>Add your first class</h2><p class="muted">Choose the year, class and subjects, then add its sections. Add students and assign teachers from Classes.</p><div class="row"><button class="btn primary" data-act="newclass">Add a class</button></div></section>'
      :'<section class="empty"><h2>No classes assigned yet</h2><p class="muted">Your manager adds classes and assigns them to teachers. Once a class is assigned to you it appears here.</p></section>';
  }else if(ui.noMonthly){
    h+='<section class="empty"><h2>No month is open yet</h2><p class="muted">'+(isMgr()?'Monthly attendance is being switched on for the college. Please check again shortly.':'The registrar opens a month when its attendance is due.')+'</p></section>';
  }else if(!om.length){
    h+='<section class="empty"><h2>No month is open</h2><p class="muted">'+(isMgr()?'Open a month in Attendance so teachers can enter it.':'The registrar opens a month when its attendance is due.')+'</p>'+(isMgr()?'<div class="row"><button class="btn primary" data-act="nav" data-v="att">Open a month</button></div>':'')+'</section>';
  }else{
    h+='<section><h2 style="margin-bottom:10px">Open for entry</h2><ul class="classes">'+om.map(function(m){
      return '<li><button class="class-card" data-act="attmonth" data-m="'+m+'"><span class="cc-top"><span><span class="cc-name">'+esc(fmtMonth(m))+'</span><br><span class="cc-sub">'+(seesAllMonths()?'All registers':'Your subjects')+'</span></span></span>'+monthProgress(mine,m)+'</button></li>';
    }).join('')+'</ul></section>';
  }
  return h+'</div><p class="hint signed">Signed in as '+esc(ui.email)+' · <button class="linkbtn" data-act="signout">Sign out</button></p>';
}

/* ---------- classes, grouped by year · class → section → subjects ---------- */
function splitName(n){var p=n.split(' · '),i=p.length>=3&&/^Section /.test(p[p.length-1])?p.length-1:-1;return i<0?{head:n,sec:''}:{head:p.slice(0,i).join(' · '),sec:p[i]};}
function viewClasses(){
  var t=todayISO(),h=topbar(isMgr()||ui.admin?'Classes':'My classes','Grouped by class and section',false),wait=loadingBody();
  if(wait)return h+wait;
  var f=ui.cFilter||YEARS[0],list=classList().filter(function(c){return !f||c.name.indexOf(f)===0;});
  h+='<div class="stack">'+monthExportCard()+(isMgr()?'<div class="row"><button class="btn primary" data-act="newclass">+ Add class</button>'+(ui.noPrograms?'':'<button class="btn" data-act="programs">Class names</button>')+'</div>':'')+'<div class="seg" role="group" aria-label="Year">'+[['First Year','First Year'],['Second Year','Second Year']].map(function(o){return '<button data-act="cfilter" data-v="'+o[0]+'" aria-pressed="'+(f===o[0])+'">'+o[1]+'</button>';}).join('')+'</div>';
  if(list.length)h+='<div class="row" style="justify-content:flex-end;gap:6px;margin-bottom:-6px"><button class="btn small" data-act="togall" data-v="1">Expand all</button><button class="btn small" data-act="togall" data-v="0">Collapse all</button></div>';
  if(!list.length)return h+'<section class="empty"><p class="muted">'+(f?'No '+esc(f)+' classes yet.':'No classes yet.')+'</p></section>'+(isMgr()?deletedBlock():'')+'</div>';
  var heads={},order=[];
  list.forEach(function(c){var s=splitName(c.name);if(!heads[s.head]){heads[s.head]={};order.push(s.head);}(heads[s.head][s.sec]||(heads[s.head][s.sec]=[])).push(c);});
  order.sort();
  h+=order.map(function(hd){
    var secs=Object.keys(heads[hd]).sort(),mgr=isMgr(),E=ui.ce,dk='h|'+hd,nAll=regsOf(hd).length;
    var allRegs=[].concat.apply([],secs.map(function(s){return heads[hd][s];})),withT=allRegs.filter(function(c){return currentTeacher(c,t);}).length;
    var forceH=(ui.as&&ui.as.head===hd)||(ui.ns&&ui.ns.head===hd)||(E&&E.head===hd)||(ui.mg&&ui.mg.head===hd)||(ui.ta&&allRegs.some(function(c){return c.id===ui.ta.cid;}));
    var hOpen=forceH||isOpen('h|'+hd,true);
    var head=(E&&E.kind==='head'&&E.head===hd)?editHeadForm(E):
      '<div class="headrow"><button class="tog" data-act="tog" data-k="'+esc('h|'+hd)+'" aria-expanded="'+hOpen+'"><span class="chev" aria-hidden="true"></span><span><h2>'+esc(hd.indexOf(f+' · ')===0?hd.slice(f.length+3):hd)+'</h2>'+(hOpen?'':'<span class="hint">'+secs.filter(Boolean).length+' section'+(secs.filter(Boolean).length===1?'':'s')+' · '+allRegs.length+' registers · '+teachChip(withT,allRegs.length)+'</span>')+'</span></button>'+(mgr?'<span class="row" style="gap:6px"><button class="btn small primary icobtn" data-act="nsopen" data-h="'+esc(hd)+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 3 7.5l9 4.5 9-4.5z"/><path d="M3 12l9 4.5 3-1.5"/><path d="M3 16.5 12 21l3-1.5"/><path d="M19 13v6M16 16h6"/></svg>Add section</button><button class="btn small" data-act="ceh" data-h="'+esc(hd)+'">Edit</button><button class="btn small danger'+(ui.cdel===dk?' armed':'')+'" data-act="cdel" data-k="'+esc(dk)+'">'+(ui.cdel===dk?'Tap again to delete '+nAll+' register'+(nAll===1?'':'s'):'Delete')+'</button></span>':'')+'</div>';
    if(ui.ns&&ui.ns.head===hd)head+=addSectionForm(ui.ns);
    if(!hOpen)return '<section class="cgroup">'+head+'</section>';
    return '<section class="cgroup">'+head+'<div class="stack" style="gap:10px">'+secs.map(function(sn){
      var cs=heads[hd][sn],n=cs[0].students.length,sk='s|'+hd+'|'+sn,nSec=regsOf(hd,sn).length,wt=cs.filter(function(c){return currentTeacher(c,t);}).length;
      var sOpen=(ui.mg&&ui.mg.head===hd&&ui.mg.from===sn)||(ui.es&&ui.es.head===hd&&ui.es.sec===sn)||(ui.as&&ui.as.head===hd&&ui.as.sec===sn)||(ui.ta&&cs.some(function(c){return c.id===ui.ta.cid;}))||isOpen('s|'+hd+'|'+sn,secs.length===1);
      var top=(E&&E.kind==='sec'&&E.head===hd&&E.sec===sn)?
        '<div class="row" style="align-items:flex-end"><label class="lbl" style="flex:1;min-width:140px">Section name<input class="field" id="ceSec" value="'+esc(E.val)+'" placeholder="A" autocomplete="off"></label><button class="btn small primary" data-act="cesave">Save</button><button class="btn small" data-act="cecancel">Cancel</button></div>'+(E.msg?'<p class="hint warn" role="alert">'+esc(E.msg)+'</p>':''):
        '<div class="row" style="justify-content:space-between"><button class="tog" data-act="tog" data-k="'+esc('s|'+hd+'|'+sn)+'" aria-expanded="'+sOpen+'"><span class="chev" aria-hidden="true"></span><span><h3>'+esc(sn||'Registers')+'</h3><span class="hint">'+n+' student'+(n===1?'':'s')+' · '+cs.length+' subject'+(cs.length===1?'':'s')+' · '+teachChip(wt,cs.length)+'</span></span></button>'+
        (mgr?'<span class="row" style="gap:6px">'+(sOpen?'<button class="btn small addst" data-act="asopen" data-h="'+esc(hd)+'" data-s="'+esc(sn)+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M19 8v6M16 11h6"/></svg>Add students</button>'+(n?'<button class="btn small" data-act="esopen" data-h="'+esc(hd)+'" data-s="'+esc(sn)+'">Edit students</button>':''):'')+(sn?(secs.filter(Boolean).length>1?'<button class="btn small" data-act="mgopen" data-h="'+esc(hd)+'" data-s="'+esc(sn)+'">Merge</button>':'')+'<button class="btn small" data-act="ces" data-h="'+esc(hd)+'" data-s="'+esc(sn)+'">Edit</button><button class="btn small danger'+(ui.cdel===sk?' armed':'')+'" data-act="cdel" data-k="'+esc(sk)+'">'+(ui.cdel===sk?'Tap again to delete '+nSec+' register'+(nSec===1?'':'s'):'Delete')+'</button>':'')+'</span>':'')+'</div>';
      if(ui.mg&&ui.mg.head===hd&&ui.mg.from===sn)top+=mergeForm(ui.mg);
      if(ui.as&&ui.as.head===hd&&ui.as.sec===sn)top+=addStudentsForm(ui.as,[sn],true);
      if(ui.es&&ui.es.head===hd&&ui.es.sec===sn)top+=editStudentsForm(ui.es);
      if(!sOpen)return '<div class="card secbox closed">'+top+'</div>';
      return '<div class="card secbox">'+top+'<ul class="subrows">'+cs.map(function(c){
        var tch=currentTeacher(c,t);
        return '<li><div class="subrow"><button class="subopen" data-act="open" data-cid="'+esc(c.id)+'"><span><b>'+esc(c.subject||'Register')+'</b><br><span class="tline '+(tch?'t-yes':'t-no')+'">'+(tch?esc(teacherLabel(tch)):'No teacher assigned')+'</span></span>'+statusChip(c,t)+'</button>'+
          (mgr?'<button class="btn small assign" data-act="taopen" data-cid="'+esc(c.id)+'"'+(ui.ta&&ui.ta.cid===c.id?' aria-expanded="true"':'')+'>'+(tch?'Change teacher':'Assign teacher')+'</button>':'')+'</div>'+
          (ui.ta&&ui.ta.cid===c.id?assignForm(c,tch):'')+'</li>';
      }).join('')+'</ul></div>';
    }).join('')+'</div></section>';
  }).join('');
  return h+(isMgr()?deletedBlock():'')+'</div>';
}

function isOpen(k,def){var v=ui.open&&ui.open[k];return v==null?def:v;}
function teachChip(n,of){return '<span class="tcount '+(n===of?'t-yes':'t-no')+'">'+n+'/'+of+' with a teacher</span>';}
function regsOf(head,sec){return activeClasses().filter(function(c){var s=splitName(c.name);return s.head===head&&(sec==null||s.sec===sec);});}
function editHeadForm(E){
  return '<div class="card" style="margin-bottom:10px"><h3>Edit class</h3>'+
  '<div class="lbl">Year<div class="seg" role="group" aria-label="Year">'+YEARS.map(function(y){return '<button type="button" data-act="ceyear" data-v="'+y+'" aria-pressed="'+(E.year===y)+'">'+y+'</button>';}).join('')+'</div></div>'+
  '<label class="lbl">Class name<select class="field" id="ceProg">'+progNames().concat(['Other']).map(function(p){return '<option'+(E.prog===p?' selected':'')+'>'+esc(p)+'</option>';}).join('')+'</select></label>'+
  (E.prog==='Other'?'<label class="lbl">Other class name<input class="field" id="ceOther" value="'+esc(E.other)+'" autocomplete="off"></label>':'')+
  '<p class="hint">Renames all '+regsOf(E.head).length+' registers in this class. Students and attendance are kept.</p>'+
  (E.msg?'<p class="hint warn" role="alert">'+esc(E.msg)+'</p>':'')+
  '<div class="row"><button class="btn primary" data-act="cesave">Save</button><button class="btn" data-act="cecancel">Cancel</button></div></div>';
}
function startEditHead(hd){
  var p=hd.split(' · '),yr=YEARS.indexOf(p[0])>=0?p[0]:'',rest=yr?p.slice(1).join(' · '):hd;
  ui.ce={kind:'head',head:hd,year:yr,prog:progNames().indexOf(rest)>=0?rest:'Other',other:progNames().indexOf(rest)>=0?'':rest,msg:''};ui.cdel='';render();
}
function saveClassEdit(){
  var E=ui.ce;if(!E)return;
  if(E.kind==='head'){
    var nm=E.prog==='Other'?E.other.trim():E.prog;
    if(!E.year){E.msg='Choose First Year or Second Year.';return render();}
    if(!nm){E.msg='Enter the class name.';return render();}
    var nh=E.year+' · '+nm;
    if(nh!==E.head&&regsOf(nh).length){E.msg=nh+' already exists.';return render();}
    regsOf(E.head).forEach(function(c){var s=splitName(c.name);c.name=(nh+(s.sec?' · '+s.sec:'')).slice(0,200);dbUpdateClass(c);});
    toast('Renamed to '+nh+'.');
  }else{
    var v=E.val.trim().replace(/^section\s+/i,'');
    if(!v){E.msg='Enter the section name.';return render();}
    var ns='Section '+v;
    if(ns.toLowerCase()!==E.sec.toLowerCase()&&regsOf(E.head).some(function(c){return splitName(c.name).sec.toLowerCase()===ns.toLowerCase();})){E.msg=ns+' already exists in this class.';return render();}
    regsOf(E.head,E.sec).forEach(function(c){c.name=(E.head+' · '+ns).slice(0,200);dbUpdateClass(c);});
    toast(E.sec+' renamed to '+ns+'.');
  }
  ui.ce=null;render();
}
/* Registers with students are only hidden (archived), so students and attendance are never lost.
   Empty registers are removed for real. */
function removeRegs(regs){
  var keep=regs.filter(function(c){return c.students.length;});
  if(keep.length&&!ui.canArchive){toast('This has students, so it cannot be deleted yet. Please try again later.');return false;}
  var now=new Date().toISOString();
  regs.forEach(function(c){
    if(c.students.length){c.archived=true;run(async function(){chk(await sb.from('classes').update({archived_at:now}).eq('id',c.id));});}
    else{delete S.classes[c.id];delete S.att[c.id];dbDeleteClass(c.id);}
  });
  return true;
}
function restoreRegs(name){
  var regs=Object.keys(S.classes).map(function(k){return S.classes[k];}).filter(function(c){return c.archived&&c.name===name;});
  if(regsOf(splitName(name).head,splitName(name).sec).length){toast(name+' already exists. Rename that section first, then restore.');return;}
  regs.forEach(function(c){c.archived=false;run(async function(){chk(await sb.from('classes').update({archived_at:null}).eq('id',c.id));});});
  render();toast('Restored '+name+'.');
}
function deletedBlock(){
  var by={};Object.keys(S.classes).forEach(function(k){var c=S.classes[k];if(c.archived)(by[c.name]||(by[c.name]=[])).push(c);});
  var names=Object.keys(by).sort();if(!names.length)return '';
  return '<details class="card deleted"><summary><h3 style="display:inline">Deleted</h3> <span class="hint">'+names.length+' section'+(names.length===1?'':'s')+' · students and attendance kept</span></summary><ul class="list" style="margin-top:10px">'+names.map(function(n){
    var cs=by[n];return '<li class="srow-edit" style="grid-template-columns:minmax(0,1fr) auto"><span style="overflow-wrap:anywhere"><b>'+esc(n)+'</b><br><span class="hint">'+cs.length+' register'+(cs.length===1?'':'s')+' · '+cs[0].students.length+' students</span></span><button class="btn small" data-act="restore" data-n="'+esc(n)+'">Restore</button></li>';
  }).join('')+'</ul></details>';
}
/* Merge one section into another within the same class.
   For each subject the students move into the target register (same student ids, new positions)
   and their attendance days are rewritten there, so no history is lost. A source register is
   removed only after its students and attendance are safely in the target. */
function safeNext(c){var m=c.nextIdx||0;c.students.forEach(function(s){if(s.idx+1>m)m=s.idx+1;});c.nextIdx=m;return m;}
function mergePlan(head,from,to){
  var src=regsOf(head,from),dst=regsOf(head,to),by={};
  dst.forEach(function(c){by[c.subject.toLowerCase()]=c;});
  var pairs=[],moveOver=[],srcSubs={};
  src.forEach(function(c){srcSubs[c.subject.toLowerCase()]=1;if(by[c.subject.toLowerCase()])pairs.push([c,by[c.subject.toLowerCase()]]);else moveOver.push(c);});
  var fillIn=dst.filter(function(c){return !srcSubs[c.subject.toLowerCase()];});
  var srcStudents=src.length?src[0].students:[],dstRolls={};
  (dst[0]?dst[0].students:[]).forEach(function(s){dstRolls[s.roll]=1;});
  return {src:src,dst:dst,pairs:pairs,moveOver:moveOver,fillIn:fillIn,students:srcStudents.length,clash:srcStudents.filter(function(s){return dstRolls[s.roll];}).length};
}
function mergeForm(M){
  var others=regsOf(M.head).map(function(c){return splitName(c.name).sec;}).filter(function(s,i,a){return s&&s!==M.from&&a.indexOf(s)===i;}).sort();
  var h='<div class="card merge"><h3>Merge '+esc(M.from)+'</h3><label class="lbl">Into<select class="field" id="mgTo"><option value="">Choose a section…</option>'+others.map(function(s){return '<option'+(M.to===s?' selected':'')+'>'+esc(s)+'</option>';}).join('')+'</select></label>';
  if(M.to){
    var P=mergePlan(M.head,M.from,M.to);
    h+='<ul class="hint mergelist"><li>'+P.students+' student'+(P.students===1?'':'s')+' move from '+esc(M.from)+' into '+esc(M.to)+', with all their attendance.</li>'+
      (P.moveOver.length?'<li>'+esc(P.moveOver.map(function(c){return c.subject;}).join(', '))+' '+(P.moveOver.length===1?'is':'are')+' only in '+esc(M.from)+', so '+(P.moveOver.length===1?'it moves':'they move')+' across, and '+esc(M.to)+'’s students are added to '+(P.moveOver.length===1?'it':'them')+'.</li>':'')+
      (P.fillIn.length&&P.students?'<li>'+esc(P.fillIn.map(function(c){return c.subject;}).join(', '))+' '+(P.fillIn.length===1?'is':'are')+' only in '+esc(M.to)+'; the moved students are added there too.</li>':'')+
      (P.clash?'<li class="warn">'+P.clash+' roll number'+(P.clash===1?' is':'s are')+' used in both sections. Both students are kept; check them afterwards.</li>':'')+
      '<li>'+esc(M.from)+' is then removed. Teacher assignments for '+esc(M.to)+' stay as they are.</li></ul>';
  }
  return h+'<div class="row"><button class="btn primary" data-act="mgdo"'+(!M.to||M.busy?' disabled':'')+'>'+(M.busy?'Merging…':'Merge sections')+'</button><button class="btn" data-act="mgcancel"'+(M.busy?' disabled':'')+'>Cancel</button></div></div>';
}
function mergeSections(){
  var M=ui.mg;if(!M||!M.to||M.busy)return;
  var P=mergePlan(M.head,M.from,M.to),toName=M.head+' · '+M.to,snapshot=P.src.length?P.src[0].students.slice():[],dstSnap=P.dst.length?P.dst[0].students.slice():[];
  M.busy=true;render();
  run(async function(){
    try{
      for(var i=0;i<P.pairs.length;i++){
        var s=P.pairs[i][0],d=P.pairs[i][1];safeNext(d);
        var moved=s.students.map(function(st){return {id:st.id,idx:d.nextIdx++,roll:st.roll,name:st.name,pp:st.pp||0,ph:st.ph||0};});
        if(moved.length){
          var rows=moved.map(function(st){return {id:st.id,class_id:d.id,idx:st.idx,roll:st.roll,name:st.name||''};});
          for(var k=0;k<rows.length;k+=400)chk(await sb.from('students').upsert(rows.slice(k,k+400),{onConflict:'id'}));
          chk(await sb.from('classes').update({next_idx:d.nextIdx}).eq('id',d.id));
          d.students=d.students.concat(moved);s.students=[];
        }
        var days=S.att[s.id]||{};
        var dt=S.att[d.id]||(S.att[d.id]={});
        for(var date in days){dt[date]=Object.assign({},dt[date]||{},days[date]);await saveDay(d.id,date);}
        chk(await sb.from('classes').delete().eq('id',s.id));
        delete S.classes[s.id];delete S.att[s.id];
      }
      for(var j=0;j<P.moveOver.length;j++){var mc=P.moveOver[j];mc.name=toName.slice(0,200);chk(await sb.from('classes').update({name:mc.name}).eq('id',mc.id));
        if(dstSnap.length){safeNext(mc);var addT=dstSnap.map(function(st){return {id:newId(),roll:st.roll,name:st.name||'',idx:mc.nextIdx++};});await insertStudents(mc.id,addT);chk(await sb.from('classes').update({next_idx:mc.nextIdx}).eq('id',mc.id));mc.students=mc.students.concat(addT);}}
      for(var f=0;f<P.fillIn.length;f++){
        var fc=P.fillIn[f];if(!snapshot.length)continue;safeNext(fc);
        var add=snapshot.map(function(st){return {id:newId(),roll:st.roll,name:st.name||'',idx:fc.nextIdx++};});
        await insertStudents(fc.id,add);
        chk(await sb.from('classes').update({next_idx:fc.nextIdx}).eq('id',fc.id));
        fc.students=fc.students.concat(add);
      }
      ui.mg=null;render();toast('Merged '+M.from+' into '+M.to+'. '+P.students+' student'+(P.students===1?'':'s')+' moved with their attendance.');
    }catch(e){
      console.error(e);ui.mg=null;setSave('error');
      toast('The merge stopped part-way: '+(e.message||'could not save')+'. Nothing was deleted that had not been moved. Reloading…');
      startLoad();
    }
  });
}
/* Students are added once per section at the class level, and go into every subject register of that section. */
function asBase(){var A=ui.as;if(!A)return null;var r=regsOf(A.head,A.sec);return r.length?r[0]:null;}
function asCountText(){var b=asBase(),have={},seen={},n=0,dup=0;(b?b.students:[]).forEach(function(s){have[s.roll]=1;});
  if(ui.as.text.trim())parseStudents(ui.as.text,b?b.students:[]).forEach(function(s){if(seen[s.roll])return;seen[s.roll]=1;if(have[s.roll])dup++;else n++;});
  return n||dup?n+' to add.'+(dup?' '+dup+' already in this section.':''):'One per line: roll number, name. Pasting two columns from Excel or Sheets works too.';}
function addStudentsForm(A,secs,inSection){
  var named=secs.filter(Boolean),b=asBase();
  return '<div class="card merge" style="margin-bottom:10px"><h3>Add students to '+esc(inSection?(A.sec||A.head):A.head)+'</h3>'+
  (named.length&&!inSection?'<label class="lbl">Section<select class="field" id="asSec"><option value="">Choose a section…</option>'+named.map(function(s){return '<option'+(A.sec===s?' selected':'')+'>'+esc(s)+'</option>';}).join('')+'</select></label>':'')+
  (b?'<p class="hint">'+esc(A.sec||'This class')+' has '+b.students.length+' student'+(b.students.length===1?'':'s')+'. New students go into all '+regsOf(A.head,A.sec).length+' subject registers. Roll numbers already in the section are skipped.</p>'+
    '<label class="lbl"><span class="sr">New students</span><textarea id="asIn" placeholder="One per line: roll number, name&#10;31, Zainab Malik">'+esc(A.text)+'</textarea></label><p class="hint" id="asCount">'+asCountText()+'</p>'+genBlock(b.students):'')+
  '<div class="row"><button class="btn primary" data-act="asdo"'+(b?'':' disabled')+'>Add students</button><button class="btn" data-act="ascancel">Cancel</button></div></div>';
}
async function addStudentsToSection(){
  var A=ui.as,b=asBase();if(!b){toast('Choose a section first.');return;}
  var gr=genResult(b.students);if(gr.error){toast(gr.msg);return;}
  var typed=parseStudents(A.text,b.students),list=[],seen={};
  typed.forEach(function(s){if(!seen[s.roll]){seen[s.roll]=1;list.push({roll:s.roll,name:s.name});}});
  gr.list.forEach(function(r){if(!seen[r]){seen[r]=1;list.push({roll:r,name:''});}});
  if(!list.length){toast('Type, paste or generate at least one student.');return;}
  var secName=A.sec?(A.head+' · '+A.sec):A.head;
  var added=0,failed=[];
  for(var i=0;i<list.length;i++){
    var r=await sb.rpc('add_student',{p_section:secName,p_roll:list[i].roll,p_name:list[i].name||''});
    if(r.error)failed.push(list[i].roll+': '+(r.error.message||'failed'));
    else added++;
  }
  var where=A.sec||A.head;ui.as=null;resetGen();render();
  if(failed.length)toast('Added '+added+' student'+(added===1?'':'s')+' to '+where+'. Errors: '+failed.join('; '));
  else toast(added+' student'+(added===1?'':'s')+' added to '+where+'.');
  if(added>0)await loadAll();
}
/* Edit or remove students once per section: a change applies to that roll number in every subject register. */
function esStudents(E){var out=[],seen={};regsOf(E.head,E.sec).forEach(function(c){c.students.forEach(function(s){if(!seen[s.roll]){seen[s.roll]=1;out.push({roll:s.roll,name:s.name||''});}});});return out;}
function editStudentsForm(E){
  var list=esStudents(E),nr=regsOf(E.head,E.sec).length;
  return '<div class="card merge" style="margin-bottom:10px"><h3>Edit students in '+esc(E.sec||E.head)+'</h3>'+
  '<p class="hint">Changes and removals apply to all '+nr+' subject register'+(nr===1?'':'s')+'. Removing a student preserves attendance marks.</p>'+
  (list.length?'<ul class="list">'+list.map(function(s){var armed=E.armed===s.roll;
    return '<li class="srow-edit"><input class="r" data-field="esroll" data-roll="'+esc(s.roll)+'" value="'+esc(s.roll)+'" aria-label="Roll number"><input data-field="esname" data-roll="'+esc(s.roll)+'" dir="auto" value="'+esc(s.name)+'" placeholder="Name (optional)" aria-label="Name"><button class="btn small danger'+(armed?' armed':'')+'" data-act="esrm" data-roll="'+esc(s.roll)+'">'+(armed?'Remove?':'Remove')+'</button></li>';
  }).join('')+'</ul>':'<p class="muted">No students yet.</p>')+
  '<div class="row"><button class="btn primary" data-act="escancel">Done</button></div></div>';
}
function esEdit(roll,field,val){
  var E=ui.es;if(!E)return false;var regs=regsOf(E.head,E.sec);
  if(field==='esroll'){
    val=val.slice(0,40);if(!val||val===roll)return false;
    if(regs.some(function(c){return c.students.some(function(s){return s.roll===val;});})){toast('Roll number '+val+' is already in this section.');return true;}
  }else val=val.slice(0,200);
  regs.forEach(function(c){c.students.forEach(function(s){if(s.roll!==roll)return;if(field==='esroll')s.roll=val;else s.name=val;dbUpdateStudent(s);});});
  if(field==='esroll'){toast('Roll number changed in '+regs.length+' register'+(regs.length===1?'':'s')+'.');return true;}
  return false;
}
function esRemove(roll){
  var E=ui.es;if(!E)return;
  var secName=E.sec?(E.head+' · '+E.sec):E.head;
  sb.rpc('remove_student',{p_section:secName,p_roll:roll}).then(function(r){
    if(r.error){toast(r.error.message||'Could not remove student.');}
    else{
      E.armed='';toast('Roll number '+roll+' removed from section.');
      loadAll();
    }
  });
}
/* Assign a teacher to one subject register, straight from the Classes page.
   A listed teacher without a login gets one here (email + password) before being assigned. */
function assignForm(c,cur){
  var A=ui.ta,h='<div class="assignbox">';
  if(ui.noAssign||ui.tp.err==='setup')return h+'<p class="hint warn">Assigning teachers needs a one-time database setup.</p><div class="row"><button class="btn small" data-act="tacancel">Close</button></div></div>';
  var none=!(ui.tp.list||[]).length,pick=A.tid?tById(A.tid):null;
  h+=(none?'':teacherFreeBox('taQ'))+'<div class="row" style="align-items:flex-end"><label class="lbl" style="flex:2;min-width:180px">Teacher for '+esc(c.subject||'this register')+'<select class="field" id="taWho" data-combo="Type a teacher’s name or department"><option value="">'+(none?'No teachers yet':'Choose a teacher…')+'</option>'+teacherOptions(A.tid)+'</select></label>'+
    '<label class="lbl" style="flex:1;min-width:140px">From<input class="field mono" id="taFrom" type="date" value="'+esc(A.from||todayISO())+'"></label></div>'+
    (pick&&!pick.email?'<p class="hint">'+esc(pick.name)+' has no login yet. Enter their college email to create one.</p>'+loginFields('ta',A.lEmail,A.lPass):'')+
    (cur?'<p class="hint">'+esc(teacherLabel(cur))+' teaches this now. Additional teachers can be assigned concurrently.</p>':'')+
    (none?'<p class="hint">Add teachers on the <button class="linkbtn" data-act="nav" data-v="teachers">Teachers</button> page first.</p>':'')+
    (ui.asg.msg?'<p class="hint warn" role="alert">'+esc(ui.asg.msg)+'</p>':'')+
    '<div class="row"><button class="btn primary small" data-act="tado"'+(A.busy?' disabled':'')+'>'+(A.busy?'Assigning…':pick&&!pick.email?'Create login and assign':'Assign')+'</button><button class="btn small" data-act="tacancel">Cancel</button></div>';
  return h+'</div>';
}
async function doAssign(){
  var A=ui.ta,c=A&&S.classes[A.cid];if(!c||A.busy)return;
  var tch=A.tid?tById(A.tid):null;
  if(!tch){ui.asg.msg='Choose a teacher.';return render();}
  A.busy=true;ui.asg.msg='';render();
  if(!tch.email){
    try{var res=await setTeacherLogin(tch.id,A.lEmail,A.lPass==null?'123456':A.lPass);toast(res==='created'?'Login created for '+tch.name+'.':'Linked '+tch.name+' to their existing login.');}
    catch(e){A.busy=false;ui.asg.msg=e.message;return render();}
  }
  ui.asg.email=tch.email;ui.asg.from=A.from||todayISO();
  await addAssignment(c);A.busy=false;if(!ui.asg.msg)ui.ta=null;render();
}
/* ---------- quick assign: one teacher → year → several sections × several courses ---------- */
function qaState(){return ui.qa||(ui.qa={tid:'',year:YEARS[0],secs:{},subs:{},from:todayISO(),busy:false,msg:'',lEmail:'',lPass:'123456'});}
function qaSections(year){
  var seen={},out=[];
  activeClasses().forEach(function(c){var sp=splitName(c.name);if(sp.head.indexOf(year+' · ')!==0)return;var k=sp.head+'|'+sp.sec;if(!seen[k]){seen[k]=1;out.push({key:k,head:sp.head,sec:sp.sec});}});
  return out.sort(function(a,b){return (a.head+a.sec).localeCompare(b.head+b.sec,undefined,{numeric:true});});
}
function qaRegsIn(Q){return activeClasses().filter(function(c){var sp=splitName(c.name);return Q.secs[sp.head+'|'+sp.sec]&&sp.head.indexOf(Q.year+' · ')===0;});}
function qaSubjects(Q){var seen={},out=[];qaRegsIn(Q).forEach(function(c){var k=(c.subject||'').toLowerCase();if(!seen[k]){seen[k]=1;out.push(c.subject||'');}});return out.sort();}
function qaTargets(Q){return qaRegsIn(Q).filter(function(c){return Q.subs[(c.subject||'').toLowerCase()];}).sort(function(a,b){return (a.name+a.subject).localeCompare(b.name+b.subject,undefined,{numeric:true});});}
function regLabel(c){var sp=splitName(c.name);return sp.head.replace(/^(First|Second) Year · /,'')+(sp.sec?' · '+sp.sec:'')+' — '+(c.subject||'Register');}
function viewQuickAssign(){
  var Q=qaState(),P=ui.tp,h=topbar('Assign','One teacher to many sections and courses at once',false);
  if(!isMgr())return h+'<section class="empty"><p class="muted">Only managers can assign teachers.</p></section>';
  if(P.list===null)return h+'<p class="muted">Loading…</p>';
  if(ui.noAssign||P.err==='setup')return h+'<section class="empty"><p class="hint warn">Assigning teachers needs a one-time database setup.</p></section>';
  if(!(P.list||[]).length)return h+'<section class="empty"><h2>No teachers yet</h2><p class="muted">Add teachers on the Teachers page first.</p><div class="row"><button class="btn primary" data-act="nav" data-v="teachers">Teachers</button></div></section>';
  var pick=Q.tid?tById(Q.tid):null,secs=qaSections(Q.year),subs=qaSubjects(Q),tg=qaTargets(Q),t=todayISO();
  h+='<div class="stack"><section class="card"><h3>1. Teacher</h3>'+teacherFreeBox('qaQ')+
    '<label class="lbl">Teacher<select class="field" id="qaWho" data-combo="Type a teacher’s name or department"><option value="">Choose a teacher…</option>'+teacherOptions(Q.tid)+'</select></label>';
  if(pick&&!pick.email)h+='<p class="hint">'+esc(pick.name)+' has no login yet. Enter their college email to create one.</p>'+loginFields('qa',Q.lEmail,Q.lPass);
  if(pick&&pick.email){
    var now=activeClasses().filter(function(c){return currentTeacher(c,t)===pick.email;});
    h+='<p class="hint">'+(now.length?esc(tName(pick))+' teaches '+now.length+' register'+(now.length===1?'':'s')+' now: '+now.map(function(c){return esc(c.name.split(' · ')[0].replace(' Year',''))+' '+esc(regLabel(c));}).join(', ')+'.':esc(tName(pick))+' is not assigned to any register yet.')+'</p>';
  }
  h+='</section><section class="card"><h3>2. Year</h3><div class="seg" role="group" aria-label="Year">'+YEARS.map(function(y){return '<button type="button" data-act="qayear" data-v="'+y+'" aria-pressed="'+(Q.year===y)+'">'+y+'</button>';}).join('')+'</div></section>';
  h+='<section class="card"><h3>3. Sections</h3>';
  if(!secs.length)h+='<p class="muted">No '+esc(Q.year)+' classes yet.</p>';
  else{
    var byHead={};secs.forEach(function(x){(byHead[x.head]||(byHead[x.head]=[])).push(x);});
    h+='<div class="row"><button class="btn small" data-act="qasecall">Select all</button><button class="btn small" data-act="qasecnone">Clear</button></div>'+
      Object.keys(byHead).map(function(hd){return '<div class="lbl">'+esc(hd.replace(Q.year+' · ',''))+'<div class="checks">'+byHead[hd].map(function(x){
        return '<label class="chk"><input type="checkbox" data-qsec="'+esc(x.key)+'"'+(Q.secs[x.key]?' checked':'')+'><span>'+esc(x.sec||'Whole class')+'</span></label>';}).join('')+'</div></div>';}).join('');
  }
  h+='</section><section class="card"><h3>4. Courses</h3>';
  if(!subs.length)h+='<p class="muted">Choose sections first. Their courses appear here.</p>';
  else h+='<div class="row"><button class="btn small" data-act="qasuball">Select all</button><button class="btn small" data-act="qasubnone">Clear</button></div><div class="checks">'+subs.map(function(sb0){var k=sb0.toLowerCase();
      return '<label class="chk"><input type="checkbox" data-qsub="'+esc(k)+'"'+(Q.subs[k]?' checked':'')+'><span>'+esc(sb0||'Register')+'</span></label>';}).join('')+'</div>';
  h+='</section><section class="card"><h3>5. Check and assign</h3><label class="lbl" style="max-width:220px">From<input class="field mono" id="qaFrom" type="date" value="'+esc(Q.from||t)+'"></label>';
  if(tg.length){
    var em=pick&&pick.email;
    h+='<ul class="list">'+tg.map(function(c){var ct=currentTeacher(c,t);
      var note=em&&ct===em?'<span class="chip P">Already teaching</span>':ct?'<span class="hint">also taught by '+esc(teacherLabel(ct))+'</span>':'<span class="hint">no teacher now</span>';
      return '<li class="srow-edit" style="grid-template-columns:minmax(0,1fr) auto"><span>'+esc(regLabel(c))+'</span>'+note+'</li>';}).join('')+'</ul>'+
      '<p class="hint">Teachers are assigned to the selected registers from the start date.</p>';
  }else h+='<p class="muted">Choose sections and courses to see the registers.</p>';
  if(Q.msg)h+='<p class="hint warn" role="alert">'+esc(Q.msg)+'</p>';
  h+='<div class="row"><button class="btn primary" data-act="qado"'+(Q.busy||!tg.length||!pick?' disabled':'')+'>'+(Q.busy?'Assigning…':'Assign '+(pick?esc(tName(pick))+' to ':'')+tg.length+' register'+(tg.length===1?'':'s'))+'</button></div></section></div>';
  return h;
}
async function doQuickAssign(){
  var Q=qaState(),pick=Q.tid?tById(Q.tid):null,tg=qaTargets(Q),from=Q.from||todayISO();
  if(!pick){Q.msg='Choose a teacher.';return render();}
  if(!tg.length||Q.busy)return;
  Q.busy=true;Q.msg='';render();
  if(!pick.email){
    try{var res=await setTeacherLogin(pick.id,Q.lEmail,Q.lPass==null?'123456':Q.lPass);toast(res==='created'?'Login created for '+pick.name+'.':'Linked '+pick.name+' to their existing login.');}
    catch(e){Q.busy=false;Q.msg=e.message;return render();}
  }
  var ok=0,fail=[];
  for(var i=0;i<tg.length;i++){
    var c=tg[i],subs=c.subject?[c.subject]:null;
    var r=await sb.rpc('assign_teacher',{p_section:c.name,p_email:pick.email.toLowerCase().trim(),p_from:from,p_subjects:subs});
    if(!r.error){ok++;await refreshAssign(c);}
    else fail.push(regLabel(c)+': '+(r.error.message||'failed'));
  }
  Q.busy=false;
  if(!fail.length){Q.secs={};Q.subs={};}
  Q.msg=fail.length?'Not assigned — '+fail.join(' '):'';
  toast((ok?'Assigned '+tName(pick)+' to '+ok+' register'+(ok===1?'':'s')+'.':'Nothing new to assign.')+(fail.length?' '+fail.length+' could not be assigned.':''));
  render();
}
/* Add a section to an existing class: one register per subject the class already teaches. */
function classSubjects(head){var seen={},out=[];regsOf(head).sort(function(a,b){return (a.createdAt||0)-(b.createdAt||0);}).forEach(function(c){var k=(c.subject||'').toLowerCase();if(!seen[k]){seen[k]=1;out.push(c.subject||'');}});return out;}
function nextSectionName(head){
  var names=regsOf(head).map(function(c){return splitName(c.name).sec.replace(/^Section /,'');}).filter(function(s,i,a){return s&&a.indexOf(s)===i;});
  if(!names.length)return 'A';
  var m=names.map(function(n){return n.match(/^(.*?)(\d+)$/);});
  if(m.every(function(x){return x&&x[1]===m[0][1];}))return m[0][1]+(Math.max.apply(null,m.map(function(x){return +x[2];}))+1);
  if(names.every(function(n){return /^[A-Z]$/i.test(n);})){var mx=Math.max.apply(null,names.map(function(n){return n.toUpperCase().charCodeAt(0);}));if(mx<90)return String.fromCharCode(mx+1);}
  return '';
}
function addSectionForm(N){
  var subs=classSubjects(N.head);
  return '<div class="card merge" style="margin-bottom:10px"><h3>New section in '+esc(N.head)+'</h3>'+
    '<label class="lbl">Section name<input class="field" id="nsName" value="'+esc(N.name)+'" placeholder="E3" autocomplete="off"></label>'+
    '<div class="lbl">Subjects<div class="checks">'+subs.map(function(s,i){return '<label class="chk"><input type="checkbox" data-nsub="'+i+'"'+(N.skip[s.toLowerCase()]?'':' checked')+'><span>'+esc(s||'Register')+'</span></label>';}).join('')+'</div></div>'+
    '<p class="hint">Add the students afterwards with Add students on the new section.</p>'+
    (N.msg?'<p class="hint warn" role="alert">'+esc(N.msg)+'</p>':'')+
    '<div class="row"><button class="btn primary" data-act="nsdo">Create section</button><button class="btn" data-act="nscancel">Cancel</button></div></div>';
}
async function createSection(){
  var N=ui.ns;if(!N)return;
  var v=N.name.trim().replace(/^section\s+/i,'');
  if(!v){N.msg='Enter the section name.';return render();}
  var sec='Section '+v;
  if(regsOf(N.head).some(function(c){return splitName(c.name).sec.toLowerCase()===sec.toLowerCase();})){N.msg=sec+' already exists in '+N.head+'.';return render();}
  var subs=classSubjects(N.head).filter(function(s){return !N.skip[s.toLowerCase()];});
  if(!subs.length){N.msg='Choose at least one subject.';return render();}
  var nm=(N.head+' · '+sec).slice(0,200);
  try{
    var r=await sb.rpc('create_section',{p_name:nm,p_subjects:subs});
    if(r.error)throw r.error;
    ui.ns=null;ui.open=ui.open||{};ui.open['s|'+N.head+'|'+sec]=true;
    await loadAll();
    toast(sec+' added to '+N.head+' with '+subs.length+' subject register'+(subs.length===1?'':'s')+'.');
  }catch(e){
    console.error(e);
    N.msg=e.message||'Could not create section.';
  }
  render();
}
async function deleteGroup(key){
  if(ui.cdel!==key){ui.cdel=key;ui.ce=null;return render();}
  var p=key.split('|'),regs=p[0]==='h'?regsOf(p[1]):regsOf(p[1],p.slice(2).join('|'));
  ui.cdel='';
  var label=p[0]==='h'?p[1]:p.slice(2).join('|')+' of '+p[1];
  if(p[0]==='s'){
    var secName=(p[1]+' · '+p.slice(2).join('|')).slice(0,200);
    try{
      var r=await sb.rpc('archive_section',{p_name:secName});
      if(r.error)throw r.error;
      await loadAll();
      toast('Deleted '+label+'. Its students and attendance are kept in archive.');
    }catch(e){
      console.error(e);
      toast('Could not delete section: '+(e.message||''));
    }
    render();
    return;
  }
  if(removeRegs(regs))toast(regs.some(function(c){return c.students.length;})?'Deleted '+label+'. Its students and attendance are kept. Restore it from Deleted at the bottom of Classes.':'Deleted '+label+' ('+regs.length+' register'+(regs.length===1?'':'s')+').');
  render();
}

/* ---------- sections management (manager only) ---------- */
function allSections(){
  var seen={},out=[];
  activeClasses().forEach(function(c){
    var sp=splitName(c.name);
    if(!sp.sec)return;
    var k=sp.head+'|'+sp.sec;
    if(!seen[k]){
      seen[k]=true;
      var regs=regsOf(sp.head,sp.sec);
      var tchs=sectionTeachers(sp.head,sp.sec);
      var stCount=regs.length&&regs[0].students?regs[0].students.length:0;
      out.push({
        key:k,
        head:sp.head,
        sec:sp.sec,
        name:sp.sec.replace(/^Section /,''),
        regs:regs,
        studentsCount:stCount,
        teachers:tchs
      });
    }
  });
  return out.sort(function(a,b){
    return (a.head+' '+a.sec).localeCompare(b.head+' '+b.sec,undefined,{numeric:true});
  });
}
function sectionTeachers(head,sec){
  var regs=regsOf(head,sec),t=todayISO(),seen={},out=[];
  regs.forEach(function(c){
    (c.assign||[]).forEach(function(a){
      if(a.from<=t&&(!a.to||t<=a.to)){
        if(!seen[a.email]){
          seen[a.email]=true;
          out.push(a.email);
        }
      }
    });
  });
  return out;
}
async function createSectionInProgram(head,name){
  head=String(head||'').trim();
  var v=String(name||'').trim().replace(/^section\s+/i,'');
  if(!head)return 'Choose a class / program first.';
  if(!v)return 'Enter a section name.';
  var sec='Section '+v;
  var subs=classSubjects(head);
  if(!subs.length){
    var pName=head.split(' · ').slice(1).join(' · '),yr=head.split(' · ')[0];
    subs=defaultSubjects(pName,yr);
  }
  if(!subs.length)subs=['General'];
  var nm=(head+' · '+sec).slice(0,200);
  var r=await sb.rpc('create_section',{p_name:nm,p_subjects:subs});
  if(r.error)return r.error.message||'Could not create section.';
  await loadAll();
  return '';
}
async function renameSection(head,oldSec,newName){
  var v=String(newName||'').trim().replace(/^section\s+/i,'');
  if(!v)return 'Enter a section name.';
  var ns='Section '+v;
  if(ns.toLowerCase()===oldSec.toLowerCase())return '';
  var oldNm=(head+' · '+oldSec).slice(0,200);
  var newNm=(head+' · '+ns).slice(0,200);
  var r=await sb.rpc('rename_section',{p_old:oldNm,p_new:newNm});
  if(r.error)return r.error.message||'Could not rename section.';
  await loadAll();
  return '';
}
async function deleteSection(head,sec){
  var nm=(head+' · '+sec).slice(0,200);
  var r=await sb.rpc('archive_section',{p_name:nm});
  if(r.error)throw r.error;
  await loadAll();
  return true;
}
async function addStudentToSection(head,sec,roll,name){
  roll=String(roll||'').trim();
  name=String(name||'').trim();
  if(!roll)return 'Enter a roll number.';
  var nm=(head+' · '+sec).slice(0,200);
  var r=await sb.rpc('add_student',{p_section:nm,p_roll:roll,p_name:name});
  if(r.error)return r.error.message||'Could not add student.';
  await loadAll();
  return '';
}
async function bulkAddStudentsToSection(head,sec,text){
  var regs=regsOf(head,sec);
  if(!regs.length)return {count:0,skipped:0,error:'No registers in this section.'};
  var base=regs[0];
  var typed=parseStudents(text,base.students);
  if(!typed.length)return {count:0,skipped:0,error:'No students found to add.'};
  var seen={},list=[],have={};
  base.students.forEach(function(s){have[s.roll.toLowerCase()]=true;});
  var skipped=0;
  typed.forEach(function(s){
    var rk=s.roll.toLowerCase();
    if(seen[rk]||have[rk]){skipped++;return;}
    seen[rk]=true;
    list.push({roll:s.roll,name:s.name});
  });
  if(!list.length)return {count:0,skipped:skipped,error:skipped?'All entered roll numbers already exist in this section.':'No valid students to add.'};
  var nm=(head+' · '+sec).slice(0,200);
  var added=0,failed=[];
  for(var i=0;i<list.length;i++){
    var r=await sb.rpc('add_student',{p_section:nm,p_roll:list[i].roll,p_name:list[i].name||''});
    if(r.error)failed.push(list[i].roll+': '+(r.error.message||'failed'));
    else added++;
  }
  if(added>0)await loadAll();
  return {count:added,skipped:skipped,error:failed.join('; ')};
}
function secBulkPreviewText(base,text){
  if(!text||!text.trim())return 'Paste one student per line (e.g. "101, Ali Ahmed"). Existing roll numbers will be skipped.';
  var typed=parseStudents(text,base?base.students:[]);
  if(!typed.length)return 'No valid lines recognized yet.';
  var seen={},toAdd=0,dup=0,have={};
  (base?base.students:[]).forEach(function(s){have[s.roll.toLowerCase()]=true;});
  typed.forEach(function(s){
    var rk=s.roll.toLowerCase();
    if(seen[rk]||have[rk])dup++;
    else{seen[rk]=true;toAdd++;}
  });
  return toAdd+' student'+(toAdd===1?'':'s')+' will be added.'+(dup?' ('+dup+' duplicate/already present skipped)':'');
}
function editStudentInSection(head,sec,oldRoll,newRoll,newName){
  var regs=regsOf(head,sec);
  oldRoll=String(oldRoll).trim();
  newRoll=String(newRoll).trim();
  newName=String(newName||'').trim();
  if(!newRoll)return 'Roll number cannot be empty.';
  if(newRoll.toLowerCase()!==oldRoll.toLowerCase()){
    var clash=regs.some(function(c){
      return c.students.some(function(s){return s.roll.toLowerCase()===newRoll.toLowerCase();});
    });
    if(clash)return 'Roll number '+newRoll+' is already used in this section.';
  }
  regs.forEach(function(c){
    c.students.forEach(function(s){
      if(s.roll.toLowerCase()===oldRoll.toLowerCase()){
        s.roll=newRoll;
        s.name=newName;
        dbUpdateStudent(s);
      }
    });
  });
  return '';
}
// Note: Student removal preserves student idx positions for existing attendance marks, but removal drops the student from reports once attendance exists.
async function removeStudentFromSection(head,sec,roll){
  var nm=(head+' · '+sec).slice(0,200);
  var r=await sb.rpc('remove_student',{p_section:nm,p_roll:String(roll).trim()});
  if(r.error)throw r.error;
  await loadAll();
}
async function assignTeachersToSection(head,sec,emails,from,subjects){
  var nm=(head+' · '+sec).slice(0,200);
  var t=from||todayISO();
  var subs=(subjects&&subjects.length)?subjects:null;
  for(var i=0;i<emails.length;i++){
    var em=emails[i].toLowerCase().trim();
    var r=await sb.rpc('assign_teacher',{p_section:nm,p_email:em,p_from:t,p_subjects:subs});
    if(r.error)throw r.error;
  }
  await loadAll();
}
async function removeTeacherFromSection(head,sec,email,subjects){
  var nm=(head+' · '+sec).slice(0,200);
  var subs=(subjects&&subjects.length)?subjects:null;
  var r=await sb.rpc('unassign_teacher',{p_section:nm,p_email:email.toLowerCase().trim(),p_subjects:subs});
  if(r.error)throw r.error;
  await loadAll();
}
function viewSections(){
  var mgr=isMgr(),h=topbar('Sections',mgr?'Create, manage rosters and assign teachers':'Sections list',false),wait=loadingBody();
  if(wait)return h+wait;
  if(!mgr)return h+'<section class="empty"><p class="muted">Only managers can manage sections.</p></section>';
  var S_sec=ui.secM,all=allSections();
  var headsSeen={},progOptions=[];
  activeClasses().forEach(function(c){var sp=splitName(c.name);if(sp.head&&!headsSeen[sp.head]){headsSeen[sp.head]=true;progOptions.push(sp.head);}});
  progOptions.sort();

  var fYear=S_sec.filterYear||'First Year',fProg=S_sec.filterProg||'all';
  var list=all.filter(function(s){
    if(fYear!=='All'&&s.head.indexOf(fYear)!==0)return false;
    if(fProg!=='all'&&s.head!==fProg)return false;
    return true;
  });

  h+='<div class="stack">';
  h+='<div class="seg" role="group" aria-label="Year">'+['First Year','Second Year','All'].map(function(y){
    return '<button data-act="secfilteryear" data-v="'+y+'" aria-pressed="'+(fYear===y)+'">'+y+'</button>';
  }).join('')+'</div>';

  h+='<div class="row" style="justify-content:space-between;align-items:flex-end">'+
    '<label class="lbl" style="flex:1;min-width:200px">Class / Program'+
    '<select class="field" id="secProgFilter"><option value="all"'+(fProg==='all'?' selected':'')+'>All programs ('+progOptions.length+')</option>'+
    progOptions.filter(function(hd){return fYear==='All'||hd.indexOf(fYear)===0;}).map(function(hd){
      return '<option value="'+esc(hd)+'"'+(fProg===hd?' selected':'')+'>'+esc(hd)+'</option>';
    }).join('')+'</select></label>'+
    '<button class="btn primary icobtn" data-act="seccreateopen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>Create section</button>'+
    '</div>';

  if(S_sec.createOpen){
    var availHeads=progOptions.filter(function(hd){return fYear==='All'||hd.indexOf(fYear)===0;});
    if(!availHeads.length)availHeads=progOptions;
    if(!S_sec.createHead&&availHeads.length)S_sec.createHead=availHeads[0];
    h+='<section class="card"><h3>Create new section</h3>'+
      '<label class="lbl">Class / Program<select class="field" id="secCreateHead">'+
      availHeads.map(function(hd){return '<option value="'+esc(hd)+'"'+(S_sec.createHead===hd?' selected':'')+'>'+esc(hd)+'</option>';}).join('')+
      '</select></label>'+
      '<label class="lbl">Section name<input class="field" id="secCreateName" value="'+esc(S_sec.createName)+'" placeholder="e.g. M1, IP2, A, B" autocomplete="off"></label>'+
      '<p class="hint">Creates a new section with all subject registers of that program. You can add students and assign multiple teachers right away.</p>'+
      (S_sec.createMsg?'<p class="hint warn" role="alert">'+esc(S_sec.createMsg)+'</p>':'')+
      '<div class="row"><button class="btn primary" data-act="seccreate">Create section</button><button class="btn" data-act="seccreatecancel">Cancel</button></div>'+
      '</section>';
  }

  if(!list.length){
    h+='<section class="empty"><h2>No sections found</h2><p class="muted">'+(all.length?'No sections match the current filter. Try changing the Year or Program above.':'No sections created yet. Click "Create section" above.')+'</p></section>';
  }else{
    h+='<ul class="classes">'+list.map(function(s){
      var tchs=s.teachers;
      return '<li><button class="sec-card" data-act="secopen" data-k="'+esc(s.key)+'">'+
        '<div class="sec-header"><h2 style="margin:0">'+esc(s.sec)+'</h2><span class="chip '+(s.studentsCount?'P':'')+'">'+s.studentsCount+' student'+(s.studentsCount===1?'':'s')+'</span></div>'+
        '<div class="cc-sub">'+esc(s.head)+' · '+s.regs.length+' subject register'+(s.regs.length===1?'':'s')+'</div>'+
        '<div class="tchip-list" style="margin-top:4px">'+
        (tchs.length?tchs.map(function(em){return '<span class="chip blue"> '+esc(teacherLabel(em))+'</span>';}).join(''):'<span class="chip L">No teachers assigned</span>')+
        '</div>'+
        '</button></li>';
    }).join('')+'</ul>';
  }

  return h+'</div>';
}
function viewSectionDetail(){
  var mgr=isMgr();
  if(!mgr){ui.view='home';return viewHome();}
  var S_sec=ui.secM,k=S_sec.openSec;
  if(!k||k.indexOf('|')<0){ui.view='sections';return viewSections();}
  var parts=k.split('|'),head=parts[0],sec=parts[1];
  var regs=regsOf(head,sec);
  if(!regs.length){
    return topbar('Section not found','','sections')+'<div class="stack"><section class="empty"><p class="warn">This section has been deleted or archived.</p><div class="row"><button class="btn primary" data-act="nav" data-v="sections">Back to Sections</button></div></section></div>';
  }
  var base=regs[0],students=base.students||[],tchs=sectionTeachers(head,sec);
  var h=topbar(sec,head,'sections');
  h+='<div class="stack">';

  h+='<section class="card">'+
    '<div class="sec-header"><div><h3>'+esc(sec)+' Overview</h3><p class="hint">'+esc(head)+' · '+regs.length+' registers ('+esc(regs.map(function(r){return r.subject||'General';}).join(', '))+')</p></div>'+
    '<div class="row" style="gap:6px">'+
    '<button class="btn small" data-act="secrenameopen">Rename section</button>'+
    '<button class="btn small danger" data-act="secdelopen">Delete section</button>'+
    '</div></div>';

  if(S_sec.renameOpen){
    h+='<div class="card" style="margin-top:10px;background:var(--surface2)">'+
      '<h3>Rename '+esc(sec)+'</h3>'+
      '<label class="lbl">New section name<input class="field" id="secRenameVal" value="'+esc(S_sec.renameVal||sec.replace(/^Section /,''))+'" placeholder="e.g. M2" autocomplete="off"></label>'+
      (S_sec.renameMsg?'<p class="hint warn" role="alert">'+esc(S_sec.renameMsg)+'</p>':'')+
      '<div class="row"><button class="btn primary small" data-act="secrenamesave">Save</button><button class="btn small" data-act="secrenamecancel">Cancel</button></div>'+
      '</div>';
  }

  if(S_sec.delConfirm){
    h+='<div class="card warn" style="margin-top:10px;border-color:var(--af)">'+
      '<h3>Delete '+esc(sec)+'?</h3>'+
      '<p class="hint">Deleting this section archives its '+regs.length+' subject registers. All student rosters and attendance history are kept safe and can be restored if needed.</p>'+
      '<div class="row"><button class="btn danger small armed" data-act="secdeldo">Yes, delete section</button><button class="btn small" data-act="secdelcancel">Cancel</button></div>'+
      '</div>';
  }
  h+='</section>';

  h+='<section class="card">'+
    '<div class="sec-header"><div><h3>Assigned Teachers</h3><p class="hint">Multiple teachers can be assigned to this section. All assigned teachers can take attendance.</p></div>'+
    (!S_sec.tPickOpen?'<button class="btn small primary icobtn" data-act="sectpickopen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>Assign teachers</button>':'')+
    '</div>';

  if(S_sec.tPickOpen){
    var availTchs=(ui.tp.list||[]).filter(function(x){return x.email&&tchs.indexOf(x.email)<0;});
    h+='<div class="card" style="margin-top:10px;background:var(--surface2)">'+
      '<h3>Assign teachers to '+esc(sec)+'</h3>'+
      '<p class="hint">Select one or more teachers to assign to all '+regs.length+' subject registers of this section.</p>';
    if(!availTchs.length){
      h+='<p class="muted">All listed teachers are already assigned to this section, or no teachers with email logins exist.</p>';
    }else{
      h+='<div class="checks" style="max-height:220px;overflow-y:auto;padding:4px 0">'+
        availTchs.map(function(tc){
          var isSel=!!S_sec.selectedTids[tc.email];
          return '<label class="chk" style="width:100%"><input type="checkbox" data-act="sectchchk" data-em="'+esc(tc.email)+'"'+(isSel?' checked':'')+'><span><b>'+esc(tc.name||tc.email)+'</b> · <span class="hint">'+esc(tc.department||'General')+' ('+esc(tc.email)+')</span></span></label>';
        }).join('')+'</div>';
    }
    var subOptions=regs.map(function(c){return c.subject;}).filter(Boolean);
    h+='<div class="row" style="align-items:flex-end;margin-top:8px">'+
      '<label class="lbl" style="flex:1;min-width:180px">Subject<select class="field" id="secTSubs"><option value="">All subjects (default)</option>'+
      subOptions.map(function(sub){
        return '<option value="'+esc(sub)+'"'+(S_sec.subSel===sub?' selected':'')+'>'+esc(sub)+'</option>';
      }).join('')+'</select></label>'+
      '<label class="lbl" style="flex:1;min-width:140px">Teaches from<input class="field mono" id="secTFrom" type="date" value="'+esc(S_sec.tFrom||todayISO())+'"></label>'+
      '</div>';
    if(S_sec.tMsg)h+='<p class="hint warn" role="alert">'+esc(S_sec.tMsg)+'</p>';
    h+='<div class="row" style="margin-top:8px">'+
      '<button class="btn primary small" data-act="secassignsave"'+(!availTchs.length?' disabled':'')+'>Assign selected</button>'+
      '<button class="btn small" data-act="sectpickcancel">Cancel</button>'+
      '</div></div>';
  }

  if(!tchs.length){
    h+='<p class="muted">No teachers are currently assigned to this section.</p>';
  }else{
    h+='<ul class="list">'+tchs.map(function(em){
      var tName=teacherLabel(em);
      var tObj=(ui.tp.list||[]).filter(function(x){return x.email===em;})[0];
      var dept=tObj&&tObj.department?tObj.department:'Teacher';
      return '<li class="srow-edit" style="grid-template-columns:minmax(0,1fr) auto"><div><b>🧑‍🏫 '+esc(tName)+'</b><br><span class="hint">'+esc(dept)+' · '+esc(em)+'</span></div>'+
        '<button class="btn small danger" data-act="secunassign" data-em="'+esc(em)+'">Remove</button></li>';
    }).join('')+'</ul>';
  }
  h+='</section>';

  h+='<section class="card">'+
    '<div class="sec-header"><div><h3>Students ('+students.length+')</h3><p class="hint">Students enrolled in '+esc(sec)+'. Changes automatically apply across all subject registers.</p></div>'+
    '<div class="row" style="gap:6px">'+
    (!S_sec.stAddOpen?'<button class="btn small primary icobtn" data-act="secstaddopen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>Add student</button>':'')+
    (!S_sec.bulkOpen?'<button class="btn small" data-act="secbulkopen">Bulk add / Paste</button>':'')+
    '</div></div>';

  if(S_sec.stAddOpen){
    h+='<div class="card" style="margin-top:10px;background:var(--surface2)">'+
      '<h3>Add student to '+esc(sec)+'</h3>'+
      '<div class="row" style="align-items:flex-end">'+
      '<label class="lbl" style="flex:1;min-width:120px">Roll number<input class="field mono" id="secStRoll" value="'+esc(S_sec.stRoll)+'" placeholder="e.g. 101" autocomplete="off"></label>'+
      '<label class="lbl" style="flex:2;min-width:180px">Student name<input class="field" id="secStName" value="'+esc(S_sec.stName)+'" placeholder="e.g. Muhammad Ali" autocomplete="off"></label>'+
      '</div>'+
      (S_sec.stMsg?'<p class="hint warn" role="alert">'+esc(S_sec.stMsg)+'</p>':'')+
      '<div class="row" style="margin-top:8px"><button class="btn primary small" data-act="secstaddsave">Add student</button><button class="btn small" data-act="secstaddcancel">Cancel</button></div>'+
      '</div>';
  }

  if(S_sec.bulkOpen){
    h+='<div class="card" style="margin-top:10px;background:var(--surface2)">'+
      '<h3>Bulk add students</h3>'+
      '<p class="hint">Paste students one per line (e.g. "101, Muhammad Ali" or copy-pasted two columns from Excel/Google Sheets). Existing roll numbers are skipped.</p>'+
      '<textarea class="field mono" id="secBulkIn" rows="6" placeholder="101, Muhammad Ali&#10;102, Usman Tariq">'+esc(S_sec.bulkText)+'</textarea>'+
      '<p class="hint" id="secBulkPreview">'+esc(secBulkPreviewText(base,S_sec.bulkText))+'</p>'+
      (S_sec.stMsg?'<p class="hint warn" role="alert">'+esc(S_sec.stMsg)+'</p>':'')+
      '<div class="row" style="margin-top:8px"><button class="btn primary small" data-act="secbulksave">Save students</button><button class="btn small" data-act="secbulkcancel">Cancel</button></div>'+
      '</div>';
  }

  if(!students.length){
    h+='<p class="muted">No students in this section yet. Use "+ Add student" or "Bulk add / Paste" above.</p>';
  }else{
    h+='<ul class="list">'+students.map(function(st){
      var isEd=S_sec.editRoll===st.roll,armed=S_sec.armedRoll===st.roll;
      if(isEd){
        return '<li class="srow-edit" style="grid-template-columns:84px minmax(0,1fr) auto;gap:6px">'+
          '<input class="r field mono" id="secEditRollVal" value="'+esc(S_sec.editRollVal)+'" placeholder="Roll">'+
          '<input class="field" id="secEditNameVal" value="'+esc(S_sec.editNameVal)+'" placeholder="Name" dir="auto">'+
          '<span class="row" style="gap:4px"><button class="btn small primary" data-act="secsteditsave">Save</button><button class="btn small" data-act="secsteditcancel">Cancel</button></span>'+
          '</li>';
      }
      if(armed){
        return '<li class="srow-edit" style="grid-template-columns:1fr auto;gap:8px;background:var(--warn-bg,#fff3cd);padding:8px 12px;border-radius:6px;border:1px solid #ffeeba">'+
          '<div><b>Remove roll '+esc(st.roll)+' ('+esc(st.name||'unnamed')+')?</b><br><span class="hint" style="color:#856404">This student will be removed from every subject register of this section.</span></div>'+
          '<span class="row" style="gap:4px;align-self:center"><button class="btn small danger armed" data-act="secstrm" data-r="'+esc(st.roll)+'">Confirm remove</button>'+
          '<button class="btn small" data-act="secstrmcancel">Cancel</button></span>'+
          '</li>';
      }
      return '<li class="srow-edit"><span class="roll">'+esc(st.roll)+'</span><span class="sname" dir="auto">'+esc(st.name||'—')+'</span>'+
        '<span class="row" style="gap:4px"><button class="btn small" data-act="secstedit" data-r="'+esc(st.roll)+'">Edit</button>'+
        '<button class="btn small danger" data-act="secstrm" data-r="'+esc(st.roll)+'">Remove</button></span>'+
        '</li>';
    }).join('')+'</ul>';
  }
  h+='</section>';

  return h+'</div>';
}

/* ---------- teachers ---------- */
async function loadTeachers(){
  ui.tp.err='';
  try{var r=await sb.from('teachers').select('*').is('removed_at',null).order('department').order('sort_no',{nullsFirst:false}).order('name');
    if(r.error){ui.tp.list=[];ui.tp.err=/teachers|schema cache|PGRST205|42P01/.test((r.error.code||'')+' '+(r.error.message||''))?'setup':'load';}
    else{ui.tp.list=(r.data||[]).filter(function(x){return !x.removed_at;});ui.tp.gone=[];ui.tp.removed=[];}
  }catch(e){ui.tp.list=[];ui.tp.err='load';}
  render();
}
/* Extra words a register dropdown entry matches, so "1st"/"2nd" find the year. */
function regAlias(c){return /^First Year/.test(c.name)?'1st fy':/^Second Year/.test(c.name)?'2nd sy':'';}
function regPicks(regs,free){var t=todayISO();return regs.filter(function(c){return !free||!currentTeacher(c,t);});}
function tById(id){return (ui.tp.list||[]).filter(function(x){return x.id===id;})[0]||null;}
/* Put back a teacher removed this session, with the same id, email, designation and order. Their register assignments were kept, since those are stored by email. */
async function restoreTeacher(id){
  var g=(ui.tp.gone||[]).filter(function(r){return r.id===id;})[0],rm=ui.tp.removed||[],x=g||rm.filter(function(r){return r.id===id;})[0];if(!x)return;
  var r=g?await sb.from('teachers').update({removed_at:null}).eq('id',id):await sb.from('teachers').insert(x);
  if(r.error){console.error(r.error);toast('Could not restore '+x.name+'.');return;}
  if(!g)ui.tp.removed=rm.filter(function(r){return r.id!==id;});
  ui.tp.dopen=ui.tp.dopen||{};ui.tp.dopen[x.department||'Other']=true;
  toast('Restored '+x.name+' to '+(x.department||'the list')+'.');await loadTeachers();
}
/* Hide a teacher from the list (removed_at), keeping the row so they can be restored any time.
   Before the removed_at column exists, falls back to deleting, with Restore available until the page reloads. */
async function removeTeacher(id){
  var x=tById(id),r=await sb.from('teachers').update({removed_at:new Date().toISOString()}).eq('id',id),soft=true;
  if(r.error&&/removed_at|PGRST204|42703/.test((r.error.code||'')+' '+(r.error.message||''))){soft=false;r=await sb.from('teachers').delete().eq('id',id);}
  if(r.error){console.error(r.error);toast('Could not remove the teacher.');return;}
  if(!soft&&x)(ui.tp.removed||(ui.tp.removed=[])).unshift(Object.assign({},x));
  ui.tp.open='';
  toast('Removed '+(x?x.name:'the teacher')+(soft&&x?'. Restore them any time from '+(x.department||'Other')+' → Removed.':' from the list.'),x?function(){toastEl.hidden=true;restoreTeacher(id);}:null);
  await loadTeachers();
}
function depts(){var s={};(ui.tp.list||[]).forEach(function(x){if(x.department)s[x.department]=1;});if(!Object.keys(s).length)s['Computer Science']=1;return Object.keys(s).sort();}
function teacherRows(){
  var map={},t=todayISO(),out=[];
  (ui.tp.list||[]).forEach(function(x){
    var r={key:x.id,id:x.id,email:x.email||'',name:x.name||'',dept:x.department||'',des:x.designation||'',qual:x.qualification||'',regs:[]};
    out.push(r);if(r.email)map[r.email]=r;});
  activeClasses().forEach(function(c){(c.assign||[]).forEach(function(a){
    if(!(a.from<=t&&(!a.to||t<=a.to)))return;
    var r=map[a.email];
    if(!r){r=map[a.email]={key:'u:'+a.email,id:'',email:a.email,name:'',dept:'Not in the staff list',des:'',qual:'',regs:[],unlisted:true};out.push(r);}
    r.regs.push({c:c,a:a});});});
  return out;
}
function tName(r){return r.name||(r.email?r.email.split('@')[0]:'');}
function initialOf(n){return (n.replace(/^((mr|mrs|ms|mst|dr|rao|malik|syed|mian)\.?\s+)+/i,'').trim().charAt(0)||'?').toUpperCase();}
function tMatch(r,q){if(!q)return true;q=q.toLowerCase();return (r.name+' '+r.dept+' '+r.email+' '+r.des).toLowerCase().indexOf(q)>=0;}
/* Keyword match: every word typed must appear in the name, department, designation or email. */
function tKeys(x,q){var w=(q||'').toLowerCase().split(/\s+/).filter(Boolean),s=[x.name,x.department,x.designation,x.email].join(' ').toLowerCase();return w.every(function(k){return s.indexOf(k)>=0;});}
/* Emails of teachers who teach at least one active register today. */
function busyEmails(){var t=todayISO(),b={};activeClasses().forEach(function(c){(c.assign||[]).forEach(function(a){if(a.from<=t&&(!a.to||t<=a.to))b[a.email]=1;});});return b;}
function tFree(x,busy){return !x.email||!busy[x.email];}
function tPicks(q,byEmail){var busy=ui.tfree?busyEmails():null;return (ui.tp.list||[]).filter(function(x){return (!byEmail||x.email)&&tKeys(x,q)&&(!busy||tFree(x,busy));});}
/* "Only teachers not assigned" checkbox shown with a teacher dropdown. */
function teacherFreeBox(id,byEmail){
  var n=ui.tfree?tPicks('',byEmail).length:0;
  return '<label class="chk"><input type="checkbox" id="'+id+'Free"'+(ui.tfree?' checked':'')+'><span>Only teachers not assigned to any register</span></label>'+
    (ui.tfree?'<p class="hint'+(n?'':' warn')+'">'+(n?n+' teacher'+(n===1?'':'s')+' not assigned'+(n===1?' (selected)':'')+'.':'Every teacher is assigned to a register.')+'</p>':'');
}
/* Teacher dropdowns, grouped by department. byEmail: value is the email and only teachers with a login are listed.
   With "only not assigned" ticked, busy teachers are left out; the selected teacher always stays listed. */
function teacherOptions(sel,byEmail){
  var g={},busy=busyEmails();(ui.tp.list||[]).forEach(function(x){if(byEmail&&!x.email)return;if((byEmail?x.email:x.id)!==sel&&ui.tfree&&!tFree(x,busy))return;(g[x.department||'Other']||(g[x.department||'Other']=[])).push(x);});
  return Object.keys(g).sort().map(function(d){
    return '<optgroup label="'+esc(d)+'">'+g[d].map(function(x){var v=byEmail?x.email:x.id;
      return '<option value="'+esc(v)+'"'+(sel===v?' selected':'')+'>'+esc(x.name||x.email)+(x.designation?' — '+esc(x.designation):'')+(!byEmail&&!x.email?' (no login yet)':tFree(x,busy)?' (not assigned)':'')+'</option>';}).join('')+'</optgroup>';
  }).join('');
}
function teacherDatalists(){
  var des={},qual={};(ui.tp.list||[]).forEach(function(x){if(x.designation)des[x.designation]=1;if(x.qualification)qual[x.qualification]=1;});
  var o=function(m){return Object.keys(m).sort().map(function(v){return '<option value="'+esc(v)+'">';}).join('');};
  return '<datalist id="deptList">'+depts().map(function(d){return '<option value="'+esc(d)+'">';}).join('')+'</datalist><datalist id="desList">'+o(des)+'</datalist><datalist id="qualList">'+o(qual)+'</datalist>';
}
function loginFields(prefix,email,pass){
  return '<div class="row"><label class="lbl" style="flex:2;min-width:200px">College email<input class="field" id="'+prefix+'Email" type="email" inputmode="email" autocapitalize="off" value="'+esc(email||'')+'" placeholder="name@'+esc(DOMAIN)+'"></label>'+
    '<label class="lbl" style="flex:1;min-width:120px">Password<input class="field mono" id="'+prefix+'Pass" value="'+esc(pass==null?'123456':pass)+'" autocomplete="off"></label></div>';
}
/* Give a listed teacher an email; the database also creates their login (or links an existing one). */
async function setTeacherLogin(id,email,pass){
  var em=String(email||'').trim().toLowerCase(),sfx='@'+DOMAIN;
  if(em.slice(-sfx.length)!==sfx||em.length<sfx.length+2)throw new Error('Enter a full @'+DOMAIN+' email address.');
  if(String(pass||'').length<6)throw new Error('The password must be at least 6 characters.');
  var r=await sb.rpc('set_teacher_login',{p_id:id,p_email:em,p_password:pass});
  if(r.error)throw new Error(r.error.message||'Could not create the login.');
  var x=tById(id);if(x)x.email=em;
  return r.data;
}
function viewTeacherPage(){
  var P=ui.tp,h=topbar('Teachers','Staff list and who teaches which register',false),edit=isMgr();
  if(P.list===null)return h+'<p class="muted">Loading…</p>';
  if(P.err==='setup')return h+'<section class="empty"><h2>Teacher list not available yet</h2><p class="muted">The teacher list is being switched on for the college. Please check again shortly.</p><div class="row"><button class="btn" data-act="nav" data-v="teachers">Reload</button></div></section>';
  if(P.err)return h+'<section class="empty"><p class="warn">Could not load teachers.</p><div class="row"><button class="btn primary" data-act="nav" data-v="teachers">Try again</button></div></section>';
  var all=teacherRows(),regs=activeClasses().sort(function(a,b){return (a.name+a.subject).localeCompare(b.name+b.subject);});
  h+='<div class="stack">';
  if(edit&&!P.addOpen)h+='<div class="row"><button class="btn primary" data-act="tpaddopen">+ Add teacher</button></div>';
  if(edit&&P.addOpen)h+='<section class="card"><div class="row" style="justify-content:space-between"><h3>Add a teacher</h3><button class="btn small" data-act="tpaddclose">Close</button></div><div class="row"><label class="lbl" style="flex:1;min-width:180px">Name<input class="field" id="tpName" value="'+esc(P.name)+'" placeholder="Dr. Ahmad Ali" autocomplete="off"></label>'+
    '<label class="lbl" style="flex:1;min-width:160px">Department<input class="field" id="tpDept" value="'+esc(P.dept)+'" placeholder="Choose or type" list="deptList" autocomplete="off"></label></div>'+
    '<div class="row"><label class="lbl" style="flex:1;min-width:160px">Designation<input class="field" id="tpDes" value="'+esc(P.des||'')+'" placeholder="Lecturer" list="desList" autocomplete="off"></label>'+
    '<label class="lbl" style="flex:1;min-width:120px">Qualification<input class="field" id="tpQual" value="'+esc(P.qual||'')+'" placeholder="M.Phil" list="qualList" autocomplete="off"></label></div>'+teacherDatalists()+
    '<h3 style="margin-top:4px">Login <span class="hint" style="font-weight:400">(optional)</span></h3>'+
    '<div class="row"><label class="lbl" style="flex:2;min-width:200px">College email<input class="field" id="tpEmail" type="email" inputmode="email" autocapitalize="off" value="'+esc(P.email)+'" placeholder="Leave empty to add without a login"></label>'+
    '<label class="lbl" style="flex:1;min-width:120px">Password<input class="field mono" id="tpPass" value="'+esc(P.pass)+'" autocomplete="off"></label></div>'+
    '<p class="hint">Without an email the teacher is only added to the list. You can give them a login later, or when you assign them a register.</p>'+
    (P.msg?'<p class="hint warn" role="alert">'+esc(P.msg)+'</p>':'')+
    '<div class="row"><button class="btn primary" data-act="tpadd"'+(P.busy?' disabled':'')+'>'+(P.busy?'Adding…':'Add teacher')+'</button></div></section>';
  var nOn=all.filter(function(r){return r.regs.length;}).length,nNo=all.filter(function(r){return !r.email;}).length,show=P.show||'all',q=(P.q||'').trim();
  h+='<section><h2 style="margin-bottom:6px">All teachers <span class="muted mono" style="font-weight:400;font-size:15px">'+all.length+'</span></h2>'+
    '<p class="legend"><span class="chip P">'+nOn+' assigned</span> <span class="chip L">'+(all.length-nOn)+' not assigned</span> <span class="chip">'+nNo+' without login</span></p>'+
    '<div class="row" style="margin-bottom:10px"><input class="field" id="tpQ" type="search" style="flex:2;min-width:200px" value="'+esc(P.q||'')+'" placeholder="Search name, department or email" autocomplete="off">'+
    '<div class="seg nowrap" role="group" aria-label="Show" style="flex:1 1 320px">'+[['all','All'],['on','Assigned'],['off','Not assigned']].map(function(o){return '<button data-act="tpshow" data-v="'+o[0]+'" aria-pressed="'+(show===o[0])+'">'+o[1]+'</button>';}).join('')+'</div></div>';
  var rows=all.filter(function(r){return tMatch(r,q)&&(show==='all'||(show==='on')===(r.regs.length>0));});
  if(!rows.length){h+='<p class="muted">'+(all.length?'No teachers match.':'No teachers yet.')+'</p>';return h+'</section></div>';}
  var groups={};rows.forEach(function(r){(groups[r.dept||'Other']||(groups[r.dept||'Other']=[])).push(r);});
  var dOpen=P.dopen||{},forceAll=!!q||show!=='all';
  h+=Object.keys(groups).sort().map(function(d){
    var rs=groups[d],on=rs.filter(function(r){return r.regs.length;}).length,open=forceAll||dOpen[d]||rs.some(function(r){return r.key===P.open;});
    var s='<div class="card dgroup'+(open?'':' closed')+'"><button class="tog" data-act="tpdept" data-d="'+esc(d)+'" aria-expanded="'+open+'"><span class="chev" aria-hidden="true"></span><span><h3>'+esc(d)+'</h3><span class="hint">'+rs.length+' teacher'+(rs.length===1?'':'s')+' · '+teachChip(on,rs.length).replace('with a teacher','assigned')+'</span></span></button>';
    if(!open)return s+'</div>';
    return s+(rs.length?'<ul class="list tlist">'+rs.map(function(r){return teacherRow(r,edit,regs);}).join('')+'</ul>':'')+'</div>';
  }).join('');
  return h+'</section></div>';
}
function teacherRow(r,edit,regs){
  var P=ui.tp,open=P.open===r.key,on=r.regs.length>0;
  var s='<li class="'+(on?'t-on':'t-off')+'"><div class="trow"><span class="avatar" aria-hidden="true">'+esc(initialOf(tName(r)))+'</span><span style="flex:1;min-width:0"><b>'+esc(tName(r))+'</b>'+(r.qual?' <span class="hint">('+esc(r.qual)+')</span>':'')+(r.unlisted?' <span class="chip">Not in list</span>':'')+
    '<br><span class="hint" style="overflow-wrap:anywhere">'+(r.dept?esc(r.dept)+' · ':'')+(r.des?esc(r.des)+' · ':'')+(r.email?esc(r.email):'<span class="nologin">No login yet</span>')+'</span></span>'+
    (on?'<span class="chip P">Assigned · '+r.regs.length+' register'+(r.regs.length===1?'':'s')+'</span>':'<span class="chip L">Not assigned</span>')+
    '<button class="btn small" data-act="tpopen" data-k="'+esc(r.key)+'" aria-expanded="'+open+'">'+(open?'Close':edit?'Manage':'View')+'</button></div>';
  if(!open)return s+'</li>';
  s+='<div class="tdetail">'+(r.regs.length?'<ul class="subrows">'+r.regs.map(function(x){return '<li><button data-act="open" data-cid="'+esc(x.c.id)+'"><span><b>'+esc(x.c.subject||'Register')+'</b><br><span class="hint">'+esc(x.c.name)+' · since '+esc(fmtShortY(x.a.from))+'</span></span><span class="chip P">Current</span></button></li>';}).join('')+'</ul>':'<p class="muted">Not teaching any register right now.</p>');
  if(edit&&r.id){
    var E=P.edit&&P.edit.id===r.id?P.edit:null;
    if(!E)s+='<div class="row"><button class="btn small" data-act="teedit" data-id="'+esc(r.id)+'">Edit details</button></div>';
    else s+='<div class="assignbox"><h3>Edit details</h3><div class="row"><label class="lbl" style="flex:2;min-width:180px">Name<input class="field" id="teName" value="'+esc(E.name)+'"></label><label class="lbl" style="flex:1;min-width:160px">Department<input class="field" id="teDept" value="'+esc(E.dept)+'" list="deptList"></label></div>'+
      '<div class="row"><label class="lbl" style="flex:1;min-width:160px">Designation<input class="field" id="teDes" value="'+esc(E.des)+'" list="desList"></label><label class="lbl" style="flex:1;min-width:120px">Qualification<input class="field" id="teQual" value="'+esc(E.qual)+'" list="qualList"></label></div>'+teacherDatalists()+
      (P.emsg?'<p class="hint warn" role="alert">'+esc(P.emsg)+'</p>':'')+
      '<div class="row"><button class="btn primary small" data-act="tesave" data-id="'+esc(r.id)+'"'+(P.busy?' disabled':'')+'>Save</button><button class="btn small" data-act="tecancel">Cancel</button></div></div>';
  }
  if(edit&&!r.email&&r.id){
    s+='<div class="assignbox"><h3>Create a login</h3><p class="hint">'+esc(tName(r))+' needs a college email to sign in and to be assigned registers.</p>'+loginFields('tl',P.lEmail,P.lPass)+
      (P.lmsg?'<p class="hint warn" role="alert">'+esc(P.lmsg)+'</p>':'')+
      '<div class="row"><button class="btn primary small" data-act="tplogin" data-id="'+esc(r.id)+'"'+(P.busy?' disabled':'')+'>'+(P.busy?'Creating…':'Create login')+'</button></div></div>';
  }
  if(edit&&r.email){
    var allSecs=allSections();
    var curSecK=P.secK||(allSecs.length?allSecs[0].key:'');
    var curSecObj=allSecs.filter(function(s){return s.key===curSecK;})[0]||null;
    var curSubs=curSecObj?curSecObj.regs.map(function(reg){return reg.subject;}).filter(Boolean):[];
    s+='<div class="assignbox"><h3>Assign to section</h3>';
    s+='<div class="row" style="align-items:flex-end">'+
      '<label class="lbl" style="flex:2;min-width:200px">Section<select class="field" id="tpSecSel">'+
      allSecs.map(function(sec){
        return '<option value="'+esc(sec.key)+'"'+(curSecK===sec.key?' selected':'')+'>'+esc(sec.head+' · '+sec.sec)+'</option>';
      }).join('')+'</select></label>'+
      '<label class="lbl" style="flex:1;min-width:160px">Subject<select class="field" id="tpSubSel"><option value="">All subjects (default)</option>'+
      curSubs.map(function(sub){
        return '<option value="'+esc(sub)+'"'+(P.subSel===sub?' selected':'')+'>'+esc(sub)+'</option>';
      }).join('')+'</select></label>'+
      '<label class="lbl" style="flex:1;min-width:140px">From<input class="field mono" id="tpFrom" type="date" value="'+esc(P.from||todayISO())+'"></label>'+
      '<button class="btn primary" data-act="tpassign" data-em="'+esc(r.email)+'">Assign</button></div>'+
      (ui.asg.msg?'<p class="hint warn" role="alert">'+esc(ui.asg.msg)+'</p>':'')+
      '<p class="hint">Assigns '+esc(tName(r))+' to the selected section or subject. Skips registers where already assigned.</p></div>';
  }
  if(edit&&r.id)s+='<div class="row"><button class="btn small danger'+(P.armed===r.key?' armed':'')+'" data-act="tpremove" data-k="'+esc(r.key)+'">'+(P.armed===r.key?'Tap again to remove':'Remove from list')+'</button></div>';
  return s+'</div></li>';
}
/* ---------- class names (programmes) ---------- */
function progUses(name){var n=0,seen={};activeClasses().forEach(function(c){var h=splitName(c.name).head,p=h.split(' · ').slice(1).join(' · ');if(p===name&&!seen[h]){seen[h]=1;n++;}});return n;}
/* Older rows had "core" (English, Urdu, Islamiat added automatically); they are shown as ordinary subjects
   and saved that way the next time the class name is edited. */
function progSubs(p){var seen={},list=(p.core?['English','Urdu','Islamiat']:[]).concat(p.subjects||[]);return list.filter(function(x){var k=x.toLowerCase();if(seen[k])return false;seen[k]=1;return true;});}
function pgBlank(){return {mode:'add',id:'',name:'',subs:[],subIn:'',armed:''};}
function viewPrograms(){
  var P=ui.pg||(ui.pg=pgBlank()),h=topbar('Class names','Choose from these when adding a class','progback');
  if(!isMgr())return h+'<p class="muted">Only managers can change class names.</p>';
  if(ui.noPrograms)return h+'<section class="empty"><h2>Class names</h2><p class="muted">Editing class names is not available yet. Add class uses the standard list for now.</p></section>';
  var edit=P.mode==='edit';
  h+='<div class="stack"><section class="card" id="pgForm"><h3>'+(edit?'Edit '+esc(P.orig||P.name):'Add a class name')+'</h3>'+
    '<label class="lbl">Name<input class="field" id="pgName" value="'+esc(P.name)+'" placeholder="e.g. FSc Pre-Engineering" autocomplete="off"></label>'+
    '<div class="lbl">Subjects'+
      (P.subs.length?'<ul class="picks">'+P.subs.map(function(x,i){return '<li><span>'+esc(x)+'</span><button type="button" data-act="pgsubdel" data-i="'+i+'" aria-label="Remove '+esc(x)+'">×</button></li>';}).join('')+'</ul>':'<p class="hint">No subjects yet.</p>')+
      '<div class="row"><input class="field" id="pgSubIn" style="flex:1;min-width:180px" value="'+esc(P.subIn)+'" placeholder="Type subjects, comma separated: English, Urdu, Physics" autocomplete="off"><button type="button" class="btn" data-act="pgsubadd">Add</button></div></div>'+
    '<div class="row"><button class="btn primary" data-act="pgsave">'+(edit?'Save changes':'Add class name')+'</button>'+(edit||P.name||P.subs.length?'<button class="btn" data-act="pgcancel">Cancel</button>':'')+'</div></section>';
  var list=progList();
  h+='<section><h3 style="margin-bottom:8px">'+list.length+' class name'+(list.length===1?'':'s')+'</h3><ul class="classes">'+list.map(function(p){
    var u=progUses(p.name),armed=P.armed===p.id,cur=edit&&P.id===p.id,subs=progSubs(p);
    return '<li class="card"'+(cur?' style="outline:2px solid var(--accent, #2443B5)"':'')+'><div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px"><div style="flex:1;min-width:0"><h3 style="margin:0">'+esc(p.name)+'</h3>'+
      '<ul class="picks" style="margin:8px 0 4px">'+(subs.length?subs.map(function(x){return '<li style="padding:4px 12px">'+esc(x)+'</li>';}).join(''):'<li style="padding:4px 12px" class="muted">No subjects</li>')+'</ul>'+
      '<span class="hint">'+(u?'Used by '+u+' class'+(u===1?'':'es'):'Not used yet')+'</span></div>'+
      '<div class="row" style="gap:6px"><button class="btn small" data-act="pgedit" data-pid="'+esc(p.id)+'">Edit</button><button class="btn small danger'+(armed?' armed':'')+'" data-act="pgdel" data-pid="'+esc(p.id)+'">'+(armed?'Tap again':'Delete')+'</button></div></div></li>';
  }).join('')+'</ul></section></div>';
  return h;
}
function pgSubjects(v){var seen={};return String(v||'').split(',').map(function(x){return x.trim().slice(0,200);}).filter(function(x){var k=x.toLowerCase();if(!x||seen[k])return false;seen[k]=1;return true;});}
function pgNameTaken(n,exceptId){return progList().some(function(p){return p.id!==exceptId&&p.name.toLowerCase()===n.toLowerCase();});}
function pgAddSubs(){
  var P=ui.pg,have={};P.subs.forEach(function(x){have[x.toLowerCase()]=1;});
  var added=0;pgSubjects(P.subIn).forEach(function(x){if(!have[x.toLowerCase()]){have[x.toLowerCase()]=1;P.subs.push(x);added++;}});
  P.subIn='';render();var el=document.getElementById('pgSubIn');if(el)el.focus();
}
function pgEdit(id){
  var p=progList().filter(function(x){return x.id===id;})[0];if(!p)return;
  ui.pg={mode:'edit',id:p.id,orig:p.name,name:p.name,subs:progSubs(p),subIn:'',armed:''};render();
  var f=document.getElementById('pgForm');if(f)f.scrollIntoView({block:'start'});
}
function pgSave(){
  var P=ui.pg;if(P.subIn.trim())pgSubjects(P.subIn).forEach(function(x){if(!P.subs.some(function(y){return y.toLowerCase()===x.toLowerCase();}))P.subs.push(x);});P.subIn='';
  var n=P.name.trim().replace(/\s+/g,' ').slice(0,200);
  if(!n){toast('Enter the class name.');return;}
  if(n.indexOf(' · ')>=0){toast('A class name cannot contain " · ".');return;}
  if(pgNameTaken(n,P.mode==='edit'?P.id:null)){toast(n+' is already in the list.');return;}
  if(!P.subs.length){toast('Add at least one subject.');return;}
  var subs=P.subs.slice();
  if(P.mode==='edit'){
    var p=(S.programs||[]).filter(function(x){return x.id===P.id;})[0];if(!p)return;
    p.name=n;p.subjects=subs;p.core=false;
    run(async function(){chk(await sb.from('programs').update({name:n,subjects:subs,core:false}).eq('id',p.id));});
    toast(n+' saved.');
  }else{
    var np={id:newId(),name:n,subjects:subs,core:false,sort_no:progList().reduce(function(m,x){return Math.max(m,x.sort_no||0);},0)+1};
    S.programs=(S.programs||[]).concat([np]);
    run(async function(){chk(await sb.from('programs').insert({id:np.id,name:np.name,subjects:np.subjects,core:false,sort_no:np.sort_no}));});
    toast(n+' added.');
  }
  ui.pg=pgBlank();render();
}
function deleteProgram(id){
  var p=(S.programs||[]).filter(function(x){return x.id===id;})[0];if(!p)return;
  S.programs=S.programs.filter(function(x){return x.id!==id;});
  if(ui.pg.mode==='edit'&&ui.pg.id===id)ui.pg=pgBlank();else ui.pg.armed='';
  run(async function(){chk(await sb.from('programs').delete().eq('id',id));});
  render();toast(p.name+' deleted. Classes already created are not changed.');
}
function draftProgName(){return ui.draft.prog==='Other'?ui.draft.name.trim():ui.draft.prog;}
function viewNew(){
  var d=ui.draft;
  return topbar('New class','Step 1 of 2 · Class and subjects',true)+
  '<div class="card">'+
  '<div class="lbl">Year<div class="seg" role="group" aria-label="Year">'+YEARS.map(function(y){return '<button type="button" data-act="draftyear" data-v="'+y+'" aria-pressed="'+(d.year===y)+'">'+y+'</button>';}).join('')+'</div></div>'+
  '<label class="lbl">Class name<select class="field" id="draftProg"><option value="">Choose…</option>'+progNames().concat(['Other']).map(function(p){return '<option'+(d.prog===p?' selected':'')+'>'+esc(p)+'</option>';}).join('')+'</select></label>'+
  (d.prog==='Other'?'<label class="lbl">Other class name<input class="field" id="draftName" value="'+esc(d.name)+'" placeholder="e.g. FA Fine Arts" autocomplete="off"></label>':'')+
  '<div class="lbl">Subjects'+
    (d.subjects.length?'<ul class="picks">'+d.subjects.map(function(s,i){return '<li><span>'+esc(s)+'</span><button type="button" data-act="subdel" data-i="'+i+'" aria-label="Remove '+esc(s)+'">×</button></li>';}).join('')+'</ul>':'<p class="hint">'+(d.prog?'No subjects yet. Add one below.':'Choose the class name to see its usual subjects.')+'</p>')+
    '<div class="row"><input class="field" id="subIn" style="flex:1;min-width:160px" value="'+esc(d.subIn)+'" placeholder="Add a subject, e.g. Computer Science" autocomplete="off"><button type="button" class="btn" data-act="subadd">Add</button></div></div>'+
  '<div class="row"><button class="btn primary" data-act="newnext">Next: sections and students</button><button class="btn" data-act="home">Cancel</button></div></div>';
}
function viewNewSections(){
  var d=ui.draft,n=d.subjects.length,k=d.sections.length;
  return topbar(d.year+' · '+draftProgName(),'Step 2 of 2 · Sections','newback')+
  '<p class="hint" style="margin-bottom:12px">Subjects: '+esc(d.subjects.join(', '))+'</p>'+
  d.sections.map(function(s,i){
    return '<div class="card" style="margin-bottom:12px">'+
    '<div class="row"><label class="lbl" style="flex:1;min-width:140px">Section<input class="field" data-sec="'+i+'" data-f="name" value="'+esc(s.name)+'" placeholder="A" autocomplete="off"></label>'+
    (k>1?'<button type="button" class="btn small danger" data-act="secdel" data-i="'+i+'" style="align-self:flex-end">Remove</button>':'')+'</div>'+
    '</div>';
  }).join('')+
  '<div class="row" style="margin-bottom:16px"><button type="button" class="btn" data-act="secadd">+ Add section</button></div>'+
  '<p class="hint" style="margin-bottom:10px">Creates '+(n*k)+' register'+(n*k===1?'':'s')+': '+k+' section'+(k===1?'':'s')+' × '+n+' subject'+(n===1?'':'s')+'. Each can be assigned to its own teacher. Add students afterwards with <b>Add students</b> on each section in Classes.</p>'+
  '<div class="row"><button class="btn primary" data-act="createclass">Create class</button><button class="btn" data-act="newback">Back</button></div>';
}
function nextSection(){var used={};ui.draft.sections.forEach(function(s){used[s.name.trim().toUpperCase()]=1;});for(var i=0;i<26;i++){var l=String.fromCharCode(65+i);if(!used[l])return l;}return '';}
function defaultSubjects(prog,year){
  var p=progByName(prog),core=['English','Urdu',year==='Second Year'?'Pakistan Studies':'Islamiat'];
  var out=p&&!p.core?p.subjects.slice():(core).concat(p?p.subjects:[]),seen={};
  return out.filter(function(x){var k=x.toLowerCase();if(seen[k])return false;seen[k]=1;return true;});
}
function viewClass(){
  var c=cls();if(!c){ui.view='home';return viewHome();}
  var h=topbar(c.name,c.subject||(c.students.length+' students'),true);
  var tabs=isMgr()?['mark','report','students','teachers']:['mark','report'];
  h+='<nav class="seg" aria-label="Class sections" style="margin-bottom:16px">'+tabs.map(function(t){return '<button data-act="tab" data-tab="'+t+'" aria-pressed="'+(ui.tab===t)+'">'+{mark:'Daily',report:'Monthly',students:'Students',teachers:'Teachers'}[t]+'</button>';}).join('')+'</nav>';
  if(!isMgr()&&(ui.tab==='students'||ui.tab==='teachers'))ui.tab='mark';
  if(ui.tab==='mark')return h+viewMark(c);
  if(ui.tab==='report')return h+regMonthsView(c);
  if(ui.tab==='teachers')return h+viewTeachers(c);
  return h+viewStudents(c);
}
function viewMark(c){
  var m=dayOf(c.id,ui.date),k=dayCounts(c,ui.date),isToday=ui.date===todayISO(),ro=!canEdit(c,ui.date),mode=ro?'view':ui.mode;
  var h='<div class="stack">';
  h+='<div class="datebar"><button class="icon-btn" data-act="prevday" aria-label="Previous day">‹</button><input type="date" id="dateIn" value="'+esc(ui.date)+'" max="'+todayISO()+'"'+(!isMgr()&&teacherMinDate()?' min="'+teacherMinDate()+'"':'')+' aria-label="Date"><button class="icon-btn" data-act="nextday" aria-label="Next day"'+(isToday?' disabled':'')+'>›</button>'+(isToday?'':'<button class="btn small" data-act="today">Today</button>')+'</div>';
  h+='<p class="sub" style="margin-top:-8px">'+esc(fmtLong(ui.date))+'</p>';
  var by=dayBy(c.id,ui.date);if(by)h+='<p class="hint" style="margin-top:-4px">Last updated by '+esc(teacherLabel(by))+'</p>';
  if(!c.students.length){return h+'<section class="empty"><h2>No students yet</h2><p class="muted">Students for this section are added by the registrar from Classes. Once they are added, they appear here for marking.</p></section></div>';}
  h+='<div class="tally" style="grid-template-columns:repeat(3,1fr)"><div class="P"><b>'+k.P+'</b><small>Present</small></div><div class="A"><b>'+k.A+'</b><small>Absent</small></div><div><b>'+k.U+'</b><small>Unmarked</small></div></div>';
  if(ro)h+='<p class="hint warn" role="status">'+esc(isFuture(ui.date)?'Future dates cannot be marked.':lockReason(c,ui.date))+'</p>';
  if(!ro)h+='<div class="seg" role="group" aria-label="Marking method"><button data-act="mode" data-mode="tap" aria-pressed="'+(ui.mode==='tap')+'">Tap to mark</button><button data-act="mode" data-mode="paste" aria-pressed="'+(ui.mode==='paste')+'">Paste or speak</button></div>';
  if(mode==='paste'){
    var oppo=ui.qWho==='present'?'Absent':'Present';
    h+='<section class="card"><div><h3>Who is in your list?</h3><p class="hint">Give roll numbers only. Everyone else is updated for you.</p></div>'+
    '<div class="seg" role="group" aria-label="List contains"><button data-act="qwho" data-v="present" aria-pressed="'+(ui.qWho==='present')+'">Students present</button><button data-act="qwho" data-v="absent" aria-pressed="'+(ui.qWho==='absent')+'">Students absent</button></div>'+
    '<div class="row"><button class="btn small" data-act="dictate">Speak roll numbers</button><span class="hint" style="flex:1;min-width:200px">Opens your keyboard. Tap the microphone key on it and say the numbers, for example “one, four, seven to twelve”.</span></div>'+
    '<label class="lbl"><span class="sr">List</span><textarea id="quickIn" placeholder="1, 2, 4-9, 12&#10;15 16 21">'+esc(ui.quick)+'</textarea></label>'+
    '<label class="chk" for="qOthers" style="display:flex"><input type="checkbox" id="qOthers"'+(ui.qOthers?' checked':'')+'><span>Mark everyone not listed as <b>'+oppo+'</b>.</span></label>'+
    '<div class="preview" id="quickPreview"></div>'+
    '<div class="row"><button class="btn primary" id="applyQ" data-act="applyq" disabled>Apply to '+esc(fmtShort(ui.date))+'</button><button class="btn" data-act="clearquick">Clear list</button></div></section>';
  }else if(mode==='tap'){
    h+='<div class="row"><button class="btn small" data-act="allp">Mark all present</button><button class="btn small" data-act="clearday">Clear this day</button></div>';
  }
  h+='<ul class="list">'+c.students.map(function(s){
    var v=m[s.id];
    return '<li class="srow"><span class="roll">'+esc(s.roll)+'</span><span class="sname" dir="auto">'+esc(s.name)+'</span>'+
    (mode==='tap'?'<span class="stbtns" role="group" aria-label="Status for '+esc(s.name||s.roll)+'">'+['P','A'].map(function(x){return '<button class="st '+x+(v===x?' on':'')+'" data-act="mark" data-sid="'+esc(s.id)+'" data-v="'+x+'" aria-pressed="'+(v===x)+'" aria-label="'+NAMES[x]+'">'+x+'</button>';}).join('')+'</span>'
      :'<span class="chip '+(v||'')+'">'+(v?NAMES[v]:'—')+'</span>')+'</li>';
  }).join('')+'</ul></div>';
  return h;
}
function viewReport(c){
  var months=monthsOf(c);if(ui.period!=='all'&&months.indexOf(ui.period)===-1)ui.period='all';
  var dates=sessionDates(c,ui.period);ALLTIME=ui.period==='all';
  var h='<div class="stack">';
  h+='<div class="row"><label class="lbl" style="flex:1;min-width:160px"><span class="sr">Period</span><select class="field" id="periodSel"><option value="all"'+(ui.period==='all'?' selected':'')+'>All sessions</option>'+months.map(function(m){return '<option value="'+m+'"'+(ui.period===m?' selected':'')+'>'+esc(fmtMonth(m))+'</option>';}).join('')+'</select></label><button class="btn" data-act="exportcsv"'+(dates.length||(ALLTIME&&hasPrior(c))?'':' disabled')+'>Export CSV</button></div>';
  if((!dates.length&&!(ALLTIME&&hasPrior(c)))||!c.students.length){return h+'<section class="empty"><h2>Nothing to report yet</h2><p class="muted">Mark attendance for at least one day and the percentages appear here.</p></section></div>';}
  var rows=c.students.map(function(s){return {s:s,t:stats(c,dates,s.id)};});
  var withPct=rows.filter(function(r){return r.t.pct!=null;});
  var avg=withPct.length?withPct.reduce(function(a,r){return a+r.t.pct;},0)/withPct.length:null;
  var shortN=withPct.filter(function(r){return r.t.pct<c.threshold;}).length;
  h+='<div class="tally" style="grid-template-columns:repeat(3,1fr)"><div><b>'+(dates.length+(ALLTIME&&hasPrior(c)?'+':''))+'</b><small>Sessions'+(ALLTIME&&hasPrior(c)?' (+ imported)':'')+'</small></div><div><b>'+(avg==null?'–':Math.round(avg)+'%')+'</b><small>Class average</small></div><div class="A"><b>'+shortN+'</b><small>Below '+c.threshold+'%</small></div></div>';
  h+='<label class="chk"><input type="checkbox" id="shortOnly"'+(ui.shortOnly?' checked':'')+'><span>Show only students below '+c.threshold+'% (short attendance)</span></label>';
  var shown=rows.filter(function(r){return !ui.shortOnly||(r.t.pct!=null&&r.t.pct<c.threshold);});
  h+='<div class="tbl-wrap"><table><thead><tr><th>Student</th><th>P</th><th>A</th><th>Attendance</th></tr></thead><tbody>'+
  (shown.length?shown.map(function(r){
    var low=r.t.pct!=null&&r.t.pct<c.threshold;
    return '<tr><td class="nm" dir="auto"><span class="roll">'+esc(r.s.roll)+'</span> '+esc(r.s.name)+'</td><td class="mono">'+r.t.P+'</td><td class="mono">'+r.t.A+'</td><td><span class="pct"><b class="'+(low?'short':'')+'">'+(r.t.pct==null?'–':Math.round(r.t.pct)+'%')+'</b><span class="bar"><i style="flex:'+(r.t.pct||0)+';background:'+(low?'var(--af)':'var(--pf)')+'"></i><i style="flex:'+(100-(r.t.pct||0))+'"></i></span></span></td></tr>';
  }).join(''):'<tr><td colspan="5" class="muted">Nobody is below the limit.</td></tr>')+'</tbody></table></div>';
  var last=dates.slice(-20),a=S.att[c.id]||{};
  h+='<div><h3 style="margin-bottom:8px">Register</h3><div class="tbl-wrap"><table><thead><tr><th>Student</th>'+last.map(function(d){var dt=parseISO(d);return '<th title="'+esc(fmtShort(d))+'">'+dt.getDate()+'<br>'+dt.toLocaleDateString('en-GB',{weekday:'short'}).slice(0,2)+'</th>';}).join('')+'</tr></thead><tbody>'+
  c.students.map(function(s){return '<tr><td class="nm" dir="auto">'+esc(s.name||s.roll)+'</td>'+last.map(function(d){var v=a[d]&&a[d][s.id];return '<td>'+(v?'<span class="cell '+v+'">'+v+'</span>':'<span class="muted">·</span>')+'</td>';}).join('')+'</tr>';}).join('')+
  '</tbody></table></div><p class="hint" style="margin-top:6px">Last '+last.length+' session'+(last.length===1?'':'s')+'. Export the CSV for every date.</p></div></div>';
  return h;
}
/* ---------- import attendance totals from Excel / CSV ---------- */
function colIndex(head,words){
  for(var i=0;i<head.length;i++){var h=String(head[i]==null?'':head[i]).toLowerCase();for(var k=0;k<words.length;k++)if(h.indexOf(words[k])>-1)return i;}
  return -1;
}
function parseTotals(c,rows){
  if(!rows.length)return {error:'The file is empty.'};
  var head=rows[0],start=1;
  var ri=colIndex(head,['roll','reg','id']),pi=colIndex(head,['attend','present']),hi=colIndex(head,['held','total','out of','classes','lectures','sessions']);
  if(pi===hi)hi=-1;
  if(ri<0||pi<0||hi<0){ri=0;pi=1;hi=2;start=/^\s*\d/.test(String(head[0]==null?'':head[0]))?0:1;}
  var byRoll={};c.students.forEach(function(x){byRoll[String(x.roll).trim().toLowerCase()]=x;});
  var ok=[],unmatched=[],bad=[];
  for(var r=start;r<rows.length;r++){
    var row=rows[r];if(!row||row[ri]==null||String(row[ri]).trim()==='')continue;
    var roll=String(row[ri]).trim(),pn=Number(row[pi]),hn=Number(row[hi]);
    if(!isFinite(pn)||!isFinite(hn)||pn<0||hn<0||pn>hn||Math.round(pn)!==pn||Math.round(hn)!==hn||hn>5000){bad.push(roll);continue;}
    var st=byRoll[roll.toLowerCase()];
    if(!st){unmatched.push(roll);continue;}
    ok.push({id:st.id,roll:st.roll,pp:pn,ph:hn});
  }
  return {ok:ok,unmatched:unmatched,bad:bad};
}
function readTotalsFile(file){
  var c=cls();if(!c||!file)return;
  if(!window.XLSX){ui.imp={error:'The Excel reader did not load. Reload the page.'};render();return;}
  var fr=new FileReader();
  fr.onload=function(){
    try{
      var wb=XLSX.read(new Uint8Array(fr.result),{type:'array'});
      var rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''});
      var res=parseTotals(c,rows);res.file=file.name;ui.imp=res;
    }catch(e){console.error(e);ui.imp={error:'Could not read that file. Use an .xlsx, .xls or .csv file.'};}
    render();
  };
  fr.onerror=function(){ui.imp={error:'Could not read that file.'};render();};
  fr.readAsArrayBuffer(file);
}
async function applyTotals(c){
  var I=ui.imp;if(!I||!I.ok||!I.ok.length)return;
  var by={};c.students.forEach(function(x){by[x.id]=x;});
  var payload=I.ok.map(function(o){var x=by[o.id];return {id:x.id,class_id:c.id,idx:x.idx,roll:x.roll,name:x.name||'',prior_present:o.pp,prior_held:o.ph};});
  run(async function(){
    for(var i=0;i<payload.length;i+=400)chk(await sb.from('students').upsert(payload.slice(i,i+400),{onConflict:'id'}));
  });
  I.ok.forEach(function(o){var x=by[o.id];x.pp=o.pp;x.ph=o.ph;});
  toast('Imported totals for '+I.ok.length+' student'+(I.ok.length===1?'':'s')+'.');
  ui.imp=null;render();
}
function importCard(c){
  var I=ui.imp,h='<section class="card"><h3>Import attendance totals</h3><p class="hint">Upload an Excel or CSV file for '+esc(c.name)+' with three columns: roll number, classes attended, and total classes held. Use this for attendance recorded before this app. The totals are added to the daily marks in reports.</p>'+
  '<label class="lbl"><span class="sr">Excel or CSV file</span><input class="field" id="totalsFile" type="file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label>';
  if(I&&I.error)h+='<p class="hint warn" role="alert">'+esc(I.error)+'</p>';
  if(I&&I.ok){
    h+='<div class="preview"><p><b>'+esc(I.file||'File')+'</b>: '+I.ok.length+' student'+(I.ok.length===1?'':'s')+' matched.</p>'+
    (I.unmatched.length?'<p class="warn">Not in this class ('+I.unmatched.length+'): '+esc(I.unmatched.slice(0,15).join(', '))+(I.unmatched.length>15?'…':'')+'</p>':'')+
    (I.bad.length?'<p class="warn">Skipped, attended is more than held or not a whole number ('+I.bad.length+'): '+esc(I.bad.slice(0,15).join(', '))+(I.bad.length>15?'…':'')+'</p>':'')+'</div>'+
    '<div class="row"><button class="btn primary" data-act="applytotals"'+(I.ok.length?'':' disabled')+'>Apply to '+I.ok.length+' student'+(I.ok.length===1?'':'s')+'</button><button class="btn" data-act="canceltotals">Cancel</button></div>';
  }
  return h+'</section>';
}

function viewStudents(c){
  var h='<div class="stack">';
  h+=importCard(c);
  h+='<section><h3 style="margin-bottom:8px">'+c.students.length+' student'+(c.students.length===1?'':'s')+'</h3>'+(c.students.length?'<ul class="list">'+c.students.map(function(s){
    var armed=ui.confirm==='s'+s.id;
    return '<li class="srow-edit"><input class="r" data-field="roll" data-sid="'+esc(s.id)+'" value="'+esc(s.roll)+'" aria-label="Roll number"><input data-field="sname" data-sid="'+esc(s.id)+'" dir="auto" value="'+esc(s.name)+'" placeholder="Name (optional)" aria-label="Name"><button class="btn small danger'+(armed?' armed':'')+'" data-act="rmstudent" data-sid="'+esc(s.id)+'">'+(armed?'Remove from all registers?':'Remove')+'</button></li>';
  }).join('')+'</ul>':'<p class="muted">No students yet.</p>')+'</section>';
  h+='<section class="card"><h3>Class settings</h3>'+
  '<label class="lbl">Class name<input class="field" data-field="cname" value="'+esc(c.name)+'"></label>'+
  '<label class="lbl">Subject<input class="field" data-field="csubject" value="'+esc(c.subject||'')+'"></label>'+
  '<label class="lbl">Minimum attendance (%)<input class="field mono" type="number" inputmode="numeric" min="0" max="100" data-field="cthreshold" value="'+esc(c.threshold)+'"></label>'+
  '<div class="row"><button class="btn danger'+(ui.confirm==='class'?' armed':'')+'" data-act="delclass">'+(ui.confirm==='class'?(c.students.length?'Tap again: hide this register, keep students':'Tap again to delete this register'):'Delete class')+'</button></div></section>';
  return h+'</div>';
}

function fmtRange(a){return fmtShortY(a.from)+' → '+(a.to?fmtShortY(a.to):'present');}
function fmtShortY(d){return d<'2001-01-01'?'the start':parseISO(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});}
function viewTeachers(c){
  var A=ui.asg,list=(c.assign||[]).slice().sort(function(a,b){return a.from<b.from?1:-1;}),t=todayISO();
  var h='<div class="stack"><section class="card"><h3>Assign a teacher</h3>'+
  ((ui.tp.list||[]).length?teacherFreeBox('asgQ',true)+'<label class="lbl">Teacher<select class="field" id="asgEmail" data-combo="Type a teacher’s name or department"><option value="">Choose a teacher…</option>'+teacherOptions(A.email,true)+'</select></label><p class="hint">Only teachers with a login are listed. Give a teacher a login from Classes → Assign teacher, or from the Teachers page.</p>':'<label class="lbl">Teacher email<input class="field" id="asgEmail" type="email" inputmode="email" autocapitalize="off" placeholder="name@'+esc(DOMAIN)+'" value="'+esc(A.email)+'"></label>')+
  '<label class="lbl">Teaches from<input class="field mono" id="asgFrom" type="date" value="'+esc(A.from||t)+'"></label>'+
  '<p class="hint">Assigning adds the teacher to this register. Multi-teacher assignments are supported.</p>'+
  (A.msg?'<p class="hint warn" role="alert">'+esc(A.msg)+'</p>':'')+
  '<div class="row"><button class="btn primary" data-act="asgadd">Assign teacher</button></div></section>'+
  '<section><h3 style="margin-bottom:8px">Teaching history</h3>'+(list.length?'<ul class="list">'+list.map(function(a){
    var cur=a.from<=t&&(!a.to||t<=a.to);
    return '<li class="srow-edit" style="grid-template-columns:minmax(0,1fr) auto"><span style="overflow-wrap:anywhere">'+esc(a.email)+(cur?' <span class="chip P">Current</span>':'')+'<br><span class="hint">'+esc(fmtRange(a))+'</span></span>'+(!a.to?'<button class="btn small" data-act="asgend" data-aid="'+esc(a.id)+'">End today</button>':'')+'</li>';
  }).join('')+'</ul>':'<p class="muted">No teacher assigned yet.</p>')+'</section></div>';
  return h;
}
async function refreshAssign(c){
  var r=await sb.from('class_teachers').select('*').eq('class_id',c.id).order('from_day');
  if(r.error)throw r.error;
  c.assign=(r.data||[]).map(function(a){return {id:a.id,email:a.teacher_email,from:a.from_day,to:a.to_day||null};});
}
async function addAssignment(c){
  var A=ui.asg,em=String(A.email||'').trim().toLowerCase(),from=A.from||todayISO();
  var sfx='@'+DOMAIN;
  if(em.slice(-sfx.length)!==sfx||em.length<sfx.length+2){A.msg='Enter a full @'+DOMAIN+' email address.';return render();}
  var subs=c.subject?[c.subject]:null;
  try{
    var r=await sb.rpc('assign_teacher',{p_section:c.name,p_email:em,p_from:from,p_subjects:subs});
    if(r.error){A.msg=r.error.message||'Could not save assignment.';}
    else{A.email='';A.msg='';toast('Assigned '+teacherLabel(em)+' from '+fmtShort(from)+'.');await refreshAssign(c);}
  }catch(e){console.error(e);A.msg=(e&&e.message)||'Could not save assignment.';}
  render();
}
async function endAssignment(c,aid){
  try{
    var a=(c.assign||[]).filter(function(x){return x.id===aid;})[0];
    if(a){
      var subs=c.subject?[c.subject]:null;
      var r=await sb.rpc('unassign_teacher',{p_section:c.name,p_email:a.email,p_subjects:subs});
      if(r.error)throw r.error;
      await refreshAssign(c);toast('Assignment ended today.');
    }
  }catch(e){console.error(e);toast('Could not end the assignment: '+(e.message||''));}
  render();
}

/* ---------- admin (read-only reports across all teachers) ---------- */
async function checkAdmin(){
  try{
    var a=await sb.rpc('is_admin');if(a.error||!a.data){ui.admin=null;render();return;}
    var b=await sb.rpc('is_super');
    var m=await sb.rpc('is_manager');
    var sup=!!(b&&b.data);
    ui.admin={super:sup,manager:sup||!!(m&&!m.error&&m.data)};render();if(ui.tp.list===null)loadTeachers();
  }catch(e){ui.admin=null;}
}
function tOf(r){return r.teacher||'Unassigned';}
function admPct(r){var h=r.p+r.a+r.l;return h?(r.p+(r.leave_as_present?r.l:0))/h*100:null;}
function pctText(v){return v==null?'–':Math.round(v)+'%';}
async function loadOverview(){
  ui.adm.loading=true;ui.adm.err='';render();
  try{
    var r=chk(await sb.rpc('admin_overview'));
    var ct={};
    try{var at=chk(await sb.from('class_teachers').select('*').range(0,4999)),td=todayISO();
      (at.data||[]).forEach(function(a){if(a.from_day<=td&&(!a.to_day||td<=a.to_day))ct[a.class_id]=a.teacher_email;});}catch(e){}
    ui.adm.rows=(r.data||[]).map(function(x){x.teacher=ct[x.class_id]||'';return x;});
  }catch(e){console.error(e);ui.adm.err='Could not load the overview. Check your connection and try again.';}
  ui.adm.loading=false;render();
}
async function openAdminClass(cid){
  var row=(ui.adm.rows||[]).filter(function(x){return x.class_id===cid;})[0];if(!row)return;
  ui.adm.loading=true;render();
  try{
    var st=chk(await sb.from('students').select('*').eq('class_id',cid).order('idx').range(0,2999));
    var at=[],from=0;
    for(;;){var q=chk(await sb.from('attendance_days').select('*').eq('class_id',cid).order('day').range(from,from+999));at=at.concat(q.data||[]);if(!q.data||q.data.length<1000)break;from+=1000;}
    var c={id:cid,name:row.class_name,subject:row.subject||'',threshold:row.threshold,leaveAsPresent:!!row.leave_as_present,nextIdx:0,owner:tOf(row),
      students:(st.data||[]).map(function(x){return {id:x.id,idx:x.idx,roll:x.roll,name:x.name||'',pp:x.prior_present||0,ph:x.prior_held||0};})};
    var m={};
    at.forEach(function(d){var o={};c.students.forEach(function(x){var ch=d.marks.charAt(x.idx);if(ch==='P'||ch==='A'||ch==='L')o[x.id]=ch;});if(Object.keys(o).length)m[d.day]=o;});
    S.att[cid]=m;ui.admC=c;ui.view='adminclass';ui.period='all';ui.shortOnly=false;
  }catch(e){console.error(e);ui.adm.err='Could not open that class.';}
  ui.adm.loading=false;render();
}
function viewAdminClass(){
  var c=ui.admC;if(!c){ui.view='admin';return viewAdmin();}
  return topbar(c.name,(c.subject?c.subject+' · ':'')+c.owner,'admin')+viewReport(c);
}
function viewAdmin(){
  var A=ui.adm,h=topbar('Reports','Monthly attendance across every class',false),wait=loadingBody();
  if(wait)return h+wait;
  if(!ui.mx)ui.mx=curMonth();
  var rows=monthRows(ui.mx),teachers=[];
  rows.forEach(function(r){if(teachers.indexOf(tOf(r))<0)teachers.push(tOf(r));});
  teachers.sort();
  var yr=A.year||YEARS[0];
  var shown=rows.filter(function(r){return (!A.teacher||tOf(r)===A.teacher)&&r.class_name.indexOf(yr)===0;});
  var tot={p:0,a:0,l:0};shown.forEach(function(r){var lp=r.leave_as_present?r.l:0;tot.p+=r.p+lp;tot.a+=r.a;tot.l+=r.leave_as_present?0:r.l;});
  var held=tot.p+tot.a+tot.l,overall=held?tot.p/held*100:null;
  h+='<div class="stack">';
  h+=monthExportCard();
  h+='<div class="seg" role="group" aria-label="Year">'+YEARS.map(function(y){var n=rows.filter(function(r){return r.class_name.indexOf(y)===0;}).length;return '<button data-act="admyear" data-v="'+y+'" aria-pressed="'+(yr===y)+'">'+y+' <span class="muted">('+n+')</span></button>';}).join('')+'</div>';
  h+='<div class="tally" style="grid-template-columns:repeat(3,1fr)"><div><b>'+shown.length+'</b><small>Classes</small></div><div><b>'+new Set(shown.map(function(r){return tOf(r);})).size+'</b><small>Teachers</small></div><div><b>'+pctText(overall)+'</b><small>Overall</small></div></div>';
  h+='<div class="row"><div class="seg" role="group" aria-label="Group by" style="flex:1;min-width:200px"><button data-act="admgroup" data-v="section" aria-pressed="'+(A.group==='section')+'">By class</button><button data-act="admgroup" data-v="teacher" aria-pressed="'+(A.group==='teacher')+'">By teacher</button></div>'+
    '<label class="lbl" style="flex:1;min-width:200px"><span class="sr">Teacher</span><select class="field" id="admTeacher"><option value="">All teachers</option>'+teachers.map(function(t){return '<option value="'+esc(t)+'"'+(A.teacher===t?' selected':'')+'>'+esc(t)+'</option>';}).join('')+'</select></label></div>';
  if(shown.length)h+='<div class="card"><h3>'+esc(fmtMonth(ui.mx))+'</h3>'+admProgress(shown)+'</div>';
  if(shown.length)h+='<div class="row" style="justify-content:flex-end;gap:6px;margin-bottom:-6px"><button class="btn small" data-act="togall" data-v="1">Expand all</button><button class="btn small" data-act="togall" data-v="0">Collapse all</button></div>';
  if(!shown.length){h+='<section class="empty"><h2>No '+esc(yr)+' classes</h2><p class="muted">'+(rows.length?'Switch to the other year, or choose All teachers.':'Classes appear here once they are added.')+'</p></section>';}
  else if(A.group==='teacher'){
    var by={};shown.forEach(function(r){(by[tOf(r)]||(by[tOf(r)]=[])).push(r);});
    h+=Object.keys(by).sort().map(function(t){
      var rs=by[t],P=0,Ab=0;rs.forEach(function(r){P+=r.p+(r.leave_as_present?r.l:0);Ab+=r.a+(r.leave_as_present?0:r.l);});
      var pc=(P+Ab)?P/(P+Ab)*100:null;
      return admGroup('rt|'+t,t,rs.length+' register'+(rs.length===1?'':'s')+' · '+pctText(pc),rs.map(function(r){return admCard(r);}).join(''),rs);
    }).join('');
  }else{
    /* class → section → subject registers */
    var byC={},num=function(a,b){return a.localeCompare(b,undefined,{numeric:true});};
    shown.forEach(function(r){var sp=splitName(r.class_name),cg=byC[sp.head]||(byC[sp.head]={});(cg[sp.sec]||(cg[sp.sec]=[])).push(r);});
    h+=Object.keys(byC).sort(num).map(function(hd){
      var cg=byC[hd],secs=Object.keys(cg).sort(num),all=[].concat.apply([],secs.map(function(k){return cg[k];}));
      var inner=secs.map(function(sn){
        var rs=cg[sn].sort(function(a,b){return (a.subject||'').localeCompare(b.subject||'');});
        var cards=rs.map(function(r){return admCard(r,true,true);}).join('');
        if(!sn)return '<ul class="classes">'+cards+'</ul>';
        return admGroup('r|'+hd+'|'+sn,sn,rs.length+' subject'+(rs.length===1?'':'s')+' · '+pctText(admAvg(rs)),'<ul class="classes" style="margin-top:8px">'+cards+'</ul>',rs,true);
      }).join('');
      var nSec=secs.filter(Boolean).length;
      return admGroup('rc|'+hd,hd.indexOf(yr+' · ')===0?hd.slice(yr.length+3):hd,(nSec?nSec+' section'+(nSec===1?'':'s')+' · ':'')+all.length+' register'+(all.length===1?'':'s')+' · '+pctText(admAvg(all)),'<div class="stack" style="gap:10px;margin-top:10px">'+inner+'</div>',all);
    }).join('');
  }
  return h+'</div>';
}
/* Reports: a collapsible group (section or teacher), closed by default. */
function monthRows(m){
  var td=todayISO();
  return classList().map(function(c){
    var st=mtStatus(c,m);
    return {class_id:c.id,class_name:c.name,subject:c.subject||'',students:c.students.length,threshold:c.threshold==null?75:c.threshold,leave_as_present:false,
      p:st.P,a:st.H-st.P,l:0,done:st.state==='done',state:st.state,filled:st.filled,delivered:st.delivered||0,teacher:currentTeacher(c,td)};
  });
}
function admProgress(rs){
  var done=rs.filter(function(r){return r.done;}).length,all=rs.length;
  return '<span class="prog"><span class="'+(done===all?'t-yes':'t-no')+'">'+done+'/'+all+' entered</span><span class="bar"><i class="P" style="flex:'+done+'"></i><i class="U" style="flex:'+(all-done)+'"></i></span></span>';
}
function admAvg(rs){var P=0,H=0;rs.forEach(function(r){P+=r.p+(r.leave_as_present?r.l:0);H+=r.p+r.a+r.l;});return H?P/H*100:null;}
/* body is ready HTML when raw; otherwise a list of cards wrapped here. Nested (section) groups sit in a card. */
function admGroup(key,title,meta,body,rs,nested){
  var open=isOpen(key,false);meta+=admProgress(rs);
  var raw=body.indexOf('<ul')===0||body.indexOf('<div')===0;
  return '<section class="'+(nested?'card secbox':'cgroup')+'"><div class="headrow"'+(nested?' style="margin-bottom:0"':'')+'><button class="tog" data-act="tog" data-k="'+esc(key)+'" aria-expanded="'+open+'"><span class="chev" aria-hidden="true"></span><span>'+(nested?'<h3':'<h2')+' style="overflow-wrap:anywhere;margin:0">'+esc(title)+(nested?'</h3>':'</h2>')+'<span class="hint">'+meta+'</span></span></button></div>'+
    (open?(raw?body:'<ul class="classes" style="margin-top:8px">'+body+'</ul>'):'')+'</section>';
}
function admCard(r,showTeacher,subjectOnly){
  var pc=admPct(r),low=pc!=null&&pc<r.threshold;
  return '<li><button class="class-card" data-act="attopen" data-cid="'+esc(r.class_id)+'" data-m="'+esc(ui.mx)+'"><span class="cc-top"><span><span class="cc-name" dir="auto">'+esc(subjectOnly?(r.subject||'Register'):r.class_name+(r.subject?' · '+r.subject:''))+'</span><br><span class="cc-sub">'+(r.done?'<b class="done">✓ Entered</b> · '+r.delivered+' lectures · ':r.state==='part'?'Partly entered ('+r.filled+'/'+r.students+') · ':'Not entered · ')+(showTeacher?esc(tOf(r))+' · ':'')+r.students+' students'+'</span></span><span class="cc-status'+(low?' A':'')+'"><b class="'+(low?'short':'')+'">'+pctText(pc)+'</b></span></span><span class="bar"><i style="flex:'+(pc||0)+';background:'+(low?'var(--af)':'var(--pf)')+'"></i><i style="flex:'+(100-(pc||0))+'"></i></span></button></li>';
}
async function addTeacher(){
  var P=ui.tp,em=String(P.email||'').trim().toLowerCase(),sfx='@'+DOMAIN,nm=P.name.trim(),dept=P.dept.trim();
  if(!nm){P.msg='Enter the teacher’s name.';return render();}
  if(!dept){P.msg='Choose or type the department.';return render();}
  if(em&&(em.slice(-sfx.length)!==sfx||em.length<sfx.length+2)){P.msg='Enter a full @'+DOMAIN+' email address, or leave it empty.';return render();}
  if(em&&String(P.pass||'').length<6){P.msg='The password must be at least 6 characters.';return render();}
  var was=(ui.tp.gone||[]).filter(function(x){return em?x.email===em:(x.name||'').toLowerCase()===nm.toLowerCase()&&x.department===dept;})[0];
  if(was){P.name='';P.email='';P.des='';P.qual='';P.pass='123456';P.dupOk='';P.addOpen=false;P.msg='';return restoreTeacher(was.id);}
  var dup=(ui.tp.list||[]).filter(function(x){return (x.name||'').toLowerCase()===nm.toLowerCase()&&x.department===dept;})[0];
  if(dup&&P.dupOk!==nm){P.dupOk=nm;P.msg=nm+' is already in '+dept+'. Press Add teacher again to add another person with the same name.';return render();}
  P.msg='';P.busy=true;render();
  var extra={designation:(P.des||'').trim(),qualification:(P.qual||'').trim()},r,res='';
  if(em){
    r=await sb.rpc('add_teacher',{p_email:em,p_name:nm,p_department:dept,p_password:P.pass});
    if(!r.error){res=r.data;r=await sb.from('teachers').update(extra).eq('email',em);}
  }else{
    r=await sb.from('teachers').insert(Object.assign({name:nm,department:dept,added_by:ui.email},extra));
  }
  P.busy=false;
  if(r.error){console.error(r.error);P.msg=r.error.message||'Could not add the teacher.';return render();}
  toast(!em?'Added '+nm+' to '+dept+'. Give them a login when you assign a register.':res==='created'?'Added '+nm+'. They can sign in with '+em+'.':'Added '+nm+'. They already had a login, so their password was not changed.');
  P.name='';P.email='';P.des='';P.qual='';P.pass='123456';P.dupOk='';P.addOpen=false;
  P.dopen=P.dopen||{};P.dopen[dept]=true;
  await loadTeachers();
}
async function saveTeacherEdit(id){
  var P=ui.tp,E=P.edit,nm=(E.name||'').trim(),dept=(E.dept||'').trim();
  if(!nm||!dept){P.emsg='Name and department are required.';return render();}
  P.busy=true;render();
  var r=await sb.from('teachers').update({name:nm,department:dept,designation:(E.des||'').trim(),qualification:(E.qual||'').trim()}).eq('id',id);
  P.busy=false;
  if(r.error){P.emsg=r.error.message||'Could not save.';return render();}
  P.edit=null;P.emsg='';P.dopen=P.dopen||{};P.dopen[dept]=true;toast('Saved '+nm+(dept?' ('+dept+')':'')+'.');await loadTeachers();
}
async function loadAdmins(){
  try{var r=chk(await sb.from('admins').select('*').order('created_at'));ui.adm.list=r.data||[];}catch(e){ui.adm.msg='Could not load admins.';}
  render();
}
function viewManage(){
  var A=ui.adm,h=topbar('Admins','Who can manage classes and view reports',false);
  h+='<div class="stack"><section class="card"><h3>Add an admin</h3><label class="lbl">Role<select class="field" id="admRole"><option value="manager"'+(A.newRole!=='admin'?' selected':'')+'>Manager: adds classes, assigns teachers, edits any attendance</option><option value="admin"'+(A.newRole==='admin'?' selected':'')+'>Admin: views all reports only</option></select></label><label class="lbl">College email<input class="field" id="admEmail" type="email" inputmode="email" autocapitalize="off" placeholder="name@'+esc(DOMAIN)+'" value="'+esc(A.newEmail)+'"></label>'+(A.msg?'<p class="hint warn" role="alert">'+esc(A.msg)+'</p>':'')+'<div class="row"><button class="btn primary" data-act="admadd">Add admin</button></div></section>';
  h+='<section><h3 style="margin-bottom:8px">Current admins</h3>'+(A.list?'<ul class="list">'+A.list.map(function(a){
    return '<li class="srow-edit" style="grid-template-columns:minmax(0,1fr) auto"><span style="overflow-wrap:anywhere">'+esc(a.email)+(a.role==='super'?' <span class="chip">Super admin</span>':' <span class="chip">'+(a.role==='manager'?'Manager':'Admin')+'</span>')+'</span>'+(a.role==='super'?'':'<button class="btn small danger" data-act="admremove" data-email="'+esc(a.email)+'">Remove</button>')+'</li>';
  }).join('')+'</ul>':'<p class="muted">Loading…</p>')+'</section></div>';
  return h;
}

function body(){
  if(ui.auth==='loading')return '<main class="signin"><p class="muted">Opening…</p></main>';
  if(ui.auth==='out')return viewSignIn();
  return viewNav()+'<main class="main">'+viewMain()+'</main>';
}
function viewMain(){
  if(ui.view==='att')return viewAtt();
  if(ui.view==='attmonth')return viewAttMonth();
  if(ui.view==='attentry')return viewAttEntry();
  if(ui.view==='programs')return viewPrograms();
  if(ui.view==='admin')return viewAdmin();
  if(ui.view==='adminclass')return viewAdminClass();
  if(ui.view==='manage')return viewManage();
  if(ui.view==='new')return viewNew();
  if(ui.view==='newsec')return viewNewSections();
  if(ui.view==='class')return viewClass();
  if(ui.view==='classes')return viewClasses();
  if(ui.view==='sections')return viewSections();
  if(ui.view==='sectiondetail')return viewSectionDetail();
  if(ui.view==='teachers')return viewTeacherPage();
  if(ui.view==='assign')return viewQuickAssign();
  return viewHome();
}
/* Date fields show and accept dd-mm-yyyy whatever the browser's locale. The native date input stays (hidden) for its
   calendar and keeps holding the ISO value, so existing handlers keep reading t.value as yyyy-mm-dd. */
function dmy(iso){var p=String(iso||'').split('-');return p.length===3?p[2]+'-'+p[1]+'-'+p[0]:'';}
function parseDmy(v){
  var m=String(v||'').trim().match(/^(\d{1,2})[-\/. ](\d{1,2})[-\/. ](\d{4})$/);if(!m)return null;
  var d=+m[1],mo=+m[2],y=+m[3],dt=new Date(y,mo-1,d);
  if(dt.getFullYear()!==y||dt.getMonth()!==mo-1||dt.getDate()!==d)return null;
  return y+'-'+('0'+mo).slice(-2)+'-'+('0'+d).slice(-2);
}
function enhanceDates(root){
  root.querySelectorAll('input[type=date]').forEach(function(n){
    var w=document.createElement('span'),tx=document.createElement('input'),b=document.createElement('button');
    w.className='dmy';n.parentNode.insertBefore(w,n);
    tx.type='text';tx.className=n.className;if(n.id)tx.id=n.id+'Dmy';tx.inputMode='numeric';tx.autocomplete='off';tx.placeholder='dd-mm-yyyy';tx.value=dmy(n.value);
    tx.setAttribute('aria-label',(n.getAttribute('aria-label')||'Date')+', dd-mm-yyyy');
    b.type='button';b.className='dmy-pick';b.setAttribute('aria-label','Open calendar');
    b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
    n.tabIndex=-1;n.setAttribute('aria-hidden','true');
    w.appendChild(tx);w.appendChild(n);w.appendChild(b);
    b.addEventListener('click',function(){try{n.showPicker();}catch(e){n.focus();}});
    n.addEventListener('change',function(){tx.value=dmy(n.value);});
    tx.addEventListener('change',function(e){
      e.stopPropagation();
      var iso=parseDmy(tx.value);
      if(!iso||(n.min&&iso<n.min)||(n.max&&iso>n.max)){toast(iso?'That date is outside the allowed range.':'Enter the date as dd-mm-yyyy, e.g. '+dmy(todayISO())+'.');tx.value=dmy(n.value);return;}
      tx.value=dmy(iso);if(iso===n.value)return;
      n.value=iso;n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));
    });
    tx.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();tx.blur();}});
  });
}
/* select[data-combo] becomes a type-to-filter dropdown: typing keeps the options where every word typed starts a word
   of the option text, its group (department) or its data-k aliases. Picking sets the hidden select and fires its change event, so handlers are unchanged. */
function enhanceCombos(root){
  root.querySelectorAll('select[data-combo]').forEach(function(sel){
    var w=document.createElement('span'),inp=document.createElement('input'),ul=document.createElement('ul'),act=-1,shown=[];
    var items=[].slice.call(sel.options).filter(function(o){return o.value;}).map(function(o){
      var g=o.parentNode.tagName==='OPTGROUP'?o.parentNode.label:'';return {v:o.value,t:o.text,g:g,k:' '+(o.text+' '+g+' '+(o.getAttribute('data-k')||'')).toLowerCase().replace(/[^a-z0-9]+/g,' ')};});
    var curText=function(){var o=sel.options[sel.selectedIndex];return o&&o.value?o.text:'';};
    w.className='combo';sel.parentNode.insertBefore(w,sel);
    inp.type='text';inp.className=sel.className;inp.id=sel.id+'Cb';inp.autocomplete='off';inp.spellcheck=false;
    inp.placeholder=items.length?sel.getAttribute('data-combo'):(sel.options[0]?sel.options[0].text:'');inp.value=curText();inp.disabled=!items.length;
    inp.setAttribute('role','combobox');inp.setAttribute('aria-autocomplete','list');inp.setAttribute('aria-expanded','false');inp.setAttribute('aria-controls',sel.id+'Lb');
    ul.className='combo-list';ul.id=sel.id+'Lb';ul.setAttribute('role','listbox');ul.hidden=true;
    sel.hidden=true;sel.tabIndex=-1;
    w.appendChild(inp);w.appendChild(ul);w.appendChild(sel);
    function close(){ul.hidden=true;inp.setAttribute('aria-expanded','false');inp.removeAttribute('aria-activedescendant');}
    function mark(i){act=i;[].forEach.call(ul.querySelectorAll('.combo-opt'),function(li){var on=+li.getAttribute('data-i')===i;li.setAttribute('aria-selected',on?'true':'false');if(on){li.scrollIntoView({block:'nearest'});inp.setAttribute('aria-activedescendant',li.id);}});}
    function draw(q){
      var ws=String(q||'').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),g=null,h='';
      shown=items.filter(function(it){return ws.every(function(k){return it.k.indexOf(' '+k)>=0;});});
      shown.forEach(function(it,i){if(it.g&&it.g!==g){g=it.g;h+='<li class="combo-grp" role="presentation">'+esc(g)+'</li>';}
        h+='<li class="combo-opt" role="option" id="'+sel.id+'Op'+i+'" data-i="'+i+'" aria-selected="false">'+esc(it.t)+'</li>';});
      ul.innerHTML=h||'<li class="combo-none">No match. Try fewer words.</li>';ul.hidden=false;inp.setAttribute('aria-expanded','true');
      var cur=shown.map(function(it){return it.v;}).indexOf(sel.value);mark(ws.length?0:cur);
    }
    function pick(i){var it=shown[i];if(!it)return;close();inp.value=it.t;if(sel.value===it.v)return;sel.value=it.v;sel.dispatchEvent(new Event('change',{bubbles:true}));}
    inp.addEventListener('focus',function(){inp.select();draw('');});
    inp.addEventListener('click',function(){if(ul.hidden)draw('');});
    inp.addEventListener('input',function(e){e.stopPropagation();draw(inp.value);});
    inp.addEventListener('change',function(e){e.stopPropagation();});
    inp.addEventListener('keydown',function(e){
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(ul.hidden)draw(inp.value);var n=shown.length;if(n)mark(((act<0?(e.key==='ArrowDown'?-1:0):act)+(e.key==='ArrowDown'?1:-1)+n)%n);}
      else if(e.key==='Enter'){e.preventDefault();e.stopPropagation();if(!ul.hidden&&act>=0)pick(act);}
      else if(e.key==='Escape'){if(!ul.hidden){e.preventDefault();e.stopPropagation();close();inp.value=curText();}}
    });
    inp.addEventListener('blur',function(){setTimeout(function(){if(document.activeElement!==inp){close();inp.value=curText();}},120);});
    ul.addEventListener('mousedown',function(e){e.preventDefault();});
    ul.addEventListener('click',function(e){var li=e.target.closest('.combo-opt');if(li)pick(+li.getAttribute('data-i'));});
  });
}
function render(){
  var ae=document.activeElement,fid=ae&&ae.id?ae.id:null,ss=null,se=null;
  try{if(fid&&ae.selectionStart!=null){ss=ae.selectionStart;se=ae.selectionEnd;}}catch(e){}
  var key=ui.auth+'|'+ui.view+'|'+ui.cid+'|'+ui.tab,sy=window.scrollY;
  app.innerHTML=body();enhanceDates(app);enhanceCombos(app);
  if(key===ui.lastKey)window.scrollTo(0,sy);else window.scrollTo(0,0);
  ui.lastKey=key;
  if(fid){var el=document.getElementById(fid);if(el){try{el.focus({preventScroll:true});if(ss!=null)el.setSelectionRange(ss,se);}catch(e){}}}
  if(ui.auth==='in'&&ui.view==='class'&&ui.tab==='mark'&&ui.mode==='paste')updateQuickPreview();
}

/* ---------- events ---------- */
function snapshotDay(c){return JSON.stringify(dayOf(c.id,ui.date));}
function restoreUndo(cid,date,prev){return function(){setDay(cid,date,JSON.parse(prev));toastEl.hidden=true;render();};}
function resetGen(){ui.gen={from:'',to:'',step:'1',skip:''};}
document.addEventListener('click',async function(e){
  var t=e.target.closest('[data-act]');if(!t)return;
  var act=t.getAttribute('data-act'),c=ui.cid?cls():null;
  switch(act){
    case 'signin':signIn();break;
    case 'applytotals':if(c&&isMgr())applyTotals(c);break;
    case 'canceltotals':ui.imp=null;render();break;
    case 'asgadd':if(c)addAssignment(c);break;
    case 'asgend':if(c)endAssignment(c,t.getAttribute('data-aid'));break;
    case 'adminopen':ui.view='admin';ui.cid=null;render();if(!ui.adm.rows)loadOverview();break;
    case 'adminhome':ui.view='admin';ui.admC=null;render();break;
    case 'admload':loadOverview();break;
    case 'admyear':ui.adm.year=t.getAttribute('data-v');render();break;
    case 'admgroup':ui.adm.group=t.getAttribute('data-v');render();break;
    case 'admopen':openAdminClass(t.getAttribute('data-cid'));break;
    case 'admmanage':ui.view='manage';ui.adm.msg='';render();loadAdmins();break;
    case 'admadd':{
      var em=String(ui.adm.newEmail||'').trim().toLowerCase();
      if(em.slice(-('@'+DOMAIN).length)!=='@'+DOMAIN||em.length<('@'+DOMAIN).length+2){ui.adm.msg='Enter a full @'+DOMAIN+' email address.';render();break;}
      sb.from('admins').insert({email:em,role:ui.adm.newRole==='admin'?'admin':'manager',added_by:ui.email}).then(function(r){
        if(r.error){ui.adm.msg=/duplicate/i.test(r.error.message)?'That person is already an admin.':'Could not add the admin.';render();}
        else{ui.adm.newEmail='';ui.adm.msg='';loadAdmins();}
      });break;}
    case 'admremove':{
      var rem=t.getAttribute('data-email');
      sb.from('admins').delete().eq('email',rem).then(function(r){if(r.error){ui.adm.msg='Could not remove the admin.';render();}else{ui.adm.msg='';loadAdmins();}});break;}
    case 'signout':signOut();break;
    case 'reload':startLoad();break;
    case 'home':ui.view=ui.lastTop||'home';ui.confirm=null;render();break;
    case 'nav':{var nv=t.getAttribute('data-v');ui.confirm=null;ui.ce=null;ui.cdel='';ui.as=null;ui.ns=null;ui.ta=null;if(ui.mg&&!ui.mg.busy)ui.mg=null;ui.cid=null;ui.admC=null;
      if(nv==='home'||nv==='classes'||nv==='teachers')ui.lastTop=nv;
      ui.view=nv;window.scrollTo(0,0);render();

      if(nv==='manage'){ui.adm.msg='';loadAdmins();}
      if(nv==='teachers'){ui.tp.list=null;ui.asg.msg='';loadTeachers();}
      break;}
    case 'tog':{var tk=t.getAttribute('data-k'),cur=t.getAttribute('aria-expanded')==='true';(ui.open||(ui.open={}))[tk]=!cur;render();break;}
    case 'togall':{var tv=t.getAttribute('data-v')==='1';ui.open=ui.open||{};document.querySelectorAll('[data-act=tog]').forEach(function(b){ui.open[b.getAttribute('data-k')]=tv;});
      activeClasses().forEach(function(cc){var sp=splitName(cc.name);ui.open['h|'+sp.head]=tv;ui.open['s|'+sp.head+'|'+sp.sec]=tv;});
      if(ui.view==='admin')(ui.adm.rows||[]).forEach(function(r){var sp=splitName(r.class_name);ui.open['rc|'+sp.head]=tv;ui.open['r|'+sp.head+'|'+sp.sec]=tv;ui.open['rt|'+tOf(r)]=tv;});render();break;}
    case 'cfilter':ui.cFilter=t.getAttribute('data-v');render();break;
    case 'ceh':if(isMgr())startEditHead(t.getAttribute('data-h'));break;
    case 'ces':if(isMgr()){ui.ce={kind:'sec',head:t.getAttribute('data-h'),sec:t.getAttribute('data-s'),val:t.getAttribute('data-s').replace(/^Section /,''),msg:''};ui.cdel='';render();var cs=document.getElementById('ceSec');if(cs){cs.focus();cs.select();}}break;
    case 'ceyear':if(ui.ce){ui.ce.year=t.getAttribute('data-v');render();}break;
    case 'cesave':saveClassEdit();break;
    case 'cecancel':ui.ce=null;render();break;
    case 'mgopen':if(isMgr()&&!(ui.mg&&ui.mg.busy)){ui.mg={head:t.getAttribute('data-h'),from:t.getAttribute('data-s'),to:'',busy:false};ui.ce=null;ui.cdel='';render();}break;
    case 'mgcancel':if(ui.mg&&!ui.mg.busy){ui.mg=null;render();}break;
    case 'mgdo':mergeSections();break;
    case 'asopen':{if(!isMgr())break;var ah=t.getAttribute('data-h'),as0=t.getAttribute('data-s');var named=regsOf(ah).map(function(c){return splitName(c.name).sec;}).filter(function(s,i,a){return s&&a.indexOf(s)===i;});
      ui.as={head:ah,sec:as0!=null?as0:(named.length===1?named[0]:(named.length?'':'')),text:''};resetGen();ui.ce=null;ui.cdel='';ui.mg=null;ui.ns=null;ui.es=null;
      if(ui.view!=='classes'){ui.view='classes';ui.lastTop='classes';ui.cid=null;var ay=ah.split(' · ')[0];if(YEARS.indexOf(ay)>=0)ui.cFilter=ay;}render();
      var hdEl=document.querySelector('[data-act=asdo]');if(hdEl)hdEl.closest('.card').scrollIntoView({block:'start'});break;}
    case 'ascancel':ui.as=null;resetGen();render();break;
    case 'asdo':addStudentsToSection();break;
    case 'esopen':if(!isMgr())break;ui.es={head:t.getAttribute('data-h'),sec:t.getAttribute('data-s')||'',armed:''};ui.as=null;ui.ce=null;ui.cdel='';ui.mg=null;ui.ns=null;render();break;
    case 'escancel':ui.es=null;render();break;
    case 'esrm':{if(!isMgr()||!ui.es)break;var er=t.getAttribute('data-roll');if(ui.es.armed===er)esRemove(er);else ui.es.armed=er;render();break;}
    case 'taopen':{var tcid=t.getAttribute('data-cid');if(ui.ta&&ui.ta.cid===tcid){ui.ta=null;}else{ui.ta={cid:tcid,tid:'',from:todayISO(),busy:false,lEmail:'',lPass:'123456'};ui.asg.msg='';ui.ce=null;ui.cdel='';ui.mg=null;ui.as=null;}render();break;}
    case 'tacancel':ui.ta=null;ui.asg.msg='';render();break;
    case 'tado':doAssign();break;
    case 'qado':doQuickAssign();break;
    case 'qayear':{var qy=qaState();if(qy.year!==t.getAttribute('data-v')){qy.year=t.getAttribute('data-v');qy.secs={};qy.subs={};qy.msg='';}render();break;}
    case 'qasecall':{var qs=qaState();qaSections(qs.year).forEach(function(x){qs.secs[x.key]=1;});render();break;}
    case 'qasecnone':{var qn=qaState();qn.secs={};qn.subs={};render();break;}
    case 'qasuball':{var qb=qaState();qaSubjects(qb).forEach(function(x){qb.subs[x.toLowerCase()]=1;});render();break;}
    case 'qasubnone':qaState().subs={};render();break;
    case 'nsopen':{if(!isMgr())break;var nh=t.getAttribute('data-h');ui.ns={head:nh,name:nextSectionName(nh),text:'',skip:{},msg:''};ui.as=null;ui.ce=null;ui.cdel='';ui.mg=null;ui.ta=null;render();var ni=document.getElementById('nsName');if(ni){ni.focus();ni.select();}break;}
    case 'nscancel':ui.ns=null;render();break;
    case 'nsdo':createSection();break;
    case 'restore':if(isMgr())restoreRegs(t.getAttribute('data-n'));break;
    case 'cdel':if(isMgr())deleteGroup(t.getAttribute('data-k'));break;
    case 'tpopen':{var te=t.getAttribute('data-k');ui.tp.open=ui.tp.open===te?'':te;ui.tp.edit=null;ui.tp.cid='';ui.tp.armed='';ui.tp.lmsg='';ui.tp.lEmail='';ui.tp.lPass='123456';ui.asg.msg='';render();break;}
    case 'tpdept':{var dd=t.getAttribute('data-d');ui.tp.dopen=ui.tp.dopen||{};ui.tp.dopen[dd]=t.getAttribute('aria-expanded')!=='true';render();break;}
    case 'tpshow':ui.tp.show=t.getAttribute('data-v');render();break;
    case 'tplogin':{var lid=t.getAttribute('data-id');ui.tp.busy=true;ui.tp.lmsg='';render();
      setTeacherLogin(lid,ui.tp.lEmail,ui.tp.lPass==null?'123456':ui.tp.lPass).then(function(res){ui.tp.busy=false;var x=tById(lid);toast(res==='created'?'Login created for '+(x?x.name:'teacher')+'.':'Linked to their existing login.');render();},function(e){ui.tp.busy=false;ui.tp.lmsg=e.message;render();});break;}
    case 'tpadd':addTeacher();break;
    case 'teedit':{var ex=tById(t.getAttribute('data-id'));if(ex){ui.tp.edit={id:ex.id,name:ex.name||'',dept:ex.department||'',des:ex.designation||'',qual:ex.qualification||''};ui.tp.emsg='';render();}break;}
    case 'tesave':saveTeacherEdit(t.getAttribute('data-id'));break;
    case 'tecancel':ui.tp.edit=null;ui.tp.emsg='';render();break;
    case 'tpaddopen':ui.tp.addOpen=true;ui.tp.msg='';render();var tn=document.getElementById('tpName');if(tn)tn.focus();break;
    case 'tpaddclose':ui.tp.addOpen=false;ui.tp.msg='';render();break;
    case 'tpassign':{
      var tx=tById(ui.tp.open);
      var em=(tx&&tx.email)||t.getAttribute('data-em')||'';
      if(!em){ui.asg.msg='This teacher needs a login first.';render();break;}
      var allSecs=allSections();
      var curSecK=ui.tp.secK||(allSecs.length?allSecs[0].key:'');
      if(!curSecK){ui.asg.msg='Choose a section first.';render();break;}
      var parts=curSecK.split('|');
      var secName=(parts[0]+' · '+parts[1]).slice(0,200);
      var fromD=ui.tp.from||todayISO();
      var sub=ui.tp.subSel?[ui.tp.subSel]:null;
      ui.asg.msg='';
      try{
        var r=await sb.rpc('assign_teacher',{p_section:secName,p_email:em.toLowerCase().trim(),p_from:fromD,p_subjects:sub});
        if(r.error)throw r.error;
        toast('Assigned '+teacherLabel(em)+' to '+parts[1]+(ui.tp.subSel?' ('+ui.tp.subSel+')':'')+'.');
        await loadAll();
      }catch(e){
        console.error(e);
        ui.asg.msg=e.message||'Could not assign teacher.';
      }
      render();break;}
    case 'tpremove':{var tr=t.getAttribute('data-k');
      if(ui.tp.armed!==tr){ui.tp.armed=tr;render();break;}
      ui.tp.armed='';removeTeacher(tr);break;}
    case 'tprestore':restoreTeacher(t.getAttribute('data-k'));break;
    case 'open':ui.view='class';ui.cid=t.getAttribute('data-cid');ui.tab='report';ui.mode='tap';ui.date=todayISO();ui.quick='';ui.confirm=null;render();break;
    case 'tab':ui.tab=t.getAttribute('data-tab');ui.confirm=null;render();break;
    case 'mode':ui.mode=t.getAttribute('data-mode');render();break;
    case 'prevday':{var pd=addDays(ui.date,-1);if(closedFor(pd)){toast(closedNote(pd));break;}ui.date=pd;render();break;}
    case 'nextday':if(!isFuture(addDays(ui.date,1))){ui.date=addDays(ui.date,1);render();}break;
    case 'today':ui.date=todayISO();render();break;
    case 'mark':{
      var sid=t.getAttribute('data-sid'),v=t.getAttribute('data-v'),day=Object.assign({},dayOf(c.id,ui.date));
      if(day[sid]===v)delete day[sid];else day[sid]=v;
      setDay(c.id,ui.date,day);render();break;}
    case 'allp':{
      var prev=snapshotDay(c),day2={};c.students.forEach(function(s){day2[s.id]='P';});
      setDay(c.id,ui.date,day2);render();toast('All '+c.students.length+' marked present.',restoreUndo(c.id,ui.date,prev));break;}
    case 'clearday':{
      var prev2=snapshotDay(c);setDay(c.id,ui.date,{});render();toast('Day cleared.',restoreUndo(c.id,ui.date,prev2));break;}
    case 'qwho':ui.qWho=t.getAttribute('data-v');render();break;
    case 'clearquick':ui.quick='';render();break;
    case 'dictate':{var qi=document.getElementById('quickIn');if(qi)qi.focus();break;}
    case 'applyq':{
      var r=parseQuick(c,ui.quick);if(!r.ids.size)break;
      var prev3=snapshotDay(c),nd=computeQuick(c,r),P=0,A=0;
      c.students.forEach(function(s){if(nd[s.id]==='P')P++;else if(nd[s.id]==='A')A++;});
      setDay(c.id,ui.date,nd);ui.quick='';ui.mode='tap';render();
      toast(P+' present, '+A+' absent for '+fmtShort(ui.date)+'.',restoreUndo(c.id,ui.date,prev3));break;}
    case 'toastundo':if(toastUndo){var f=toastUndo;toastUndo=null;f();}break;
    case 'attmonth':ui.am=t.getAttribute('data-m');ui.view='attmonth';ui.cid=null;window.scrollTo(0,0);render();break;
    case 'attmtog':toggleMonthOpen(t.getAttribute('data-m'));break;
    case 'amadd':addMonth();break;
    case 'amdel':{if(!isMgr())break;var dm=t.getAttribute('data-m');ui.amf=ui.amf||{m:'',open:true,del:''};if(ui.amf.del===dm)deleteMonth(dm);else{ui.amf.del=dm;render();}break;}
    case 'attback':ui.view='att';render();break;
    case 'attopen':startEntry(t.getAttribute('data-cid'),t.getAttribute('data-m')||ui.am||curMonth());break;
    case 'aeback':{var AE=ui.ae;if(AE&&AE.dirty&&!AE.warned){AE.warned=true;toast('You have unsaved changes. Tap Back again to discard them.');break;}ui.ae=null;ui.view=ui.am?'attmonth':'att';render();break;}
    case 'aesave':saveEntry();break;
    case 'aefill':{var AF=ui.ae,cf=AF&&S.classes[AF.cid];var df=parseInt(AF&&AF.del,10);if(!cf)break;if(!(df>0)){toast('Enter the lectures delivered first.');break;}cf.students.forEach(function(st){AF.att[st.id]=String(df);});AF.dirty=true;AF.warned=false;render();break;}
    case 'programs':if(!isMgr())break;ui.pg=null;ui.view='programs';window.scrollTo(0,0);render();break;
    case 'progback':ui.view='classes';ui.lastTop='classes';render();break;
    case 'pgsave':if(isMgr())pgSave();break;
    case 'pgsubadd':pgAddSubs();break;
    case 'pgsubdel':ui.pg.subs.splice(+t.getAttribute('data-i'),1);render();break;
    case 'pgedit':if(isMgr())pgEdit(t.getAttribute('data-pid'));break;
    case 'pgcancel':ui.pg=pgBlank();render();break;
    case 'pgdel':{if(!isMgr())break;var pid=t.getAttribute('data-pid');if(ui.pg.armed===pid)deleteProgram(pid);else{ui.pg.armed=pid;render();}break;}
    case 'newclass':if(!isMgr()){toast('Only managers can add classes.');break;}ui.draft=blankDraft();ui.view='new';render();break;
    case 'draftyear':{var dy=ui.draft,ny=t.getAttribute('data-v'),swap={'Islamiat':'Pakistan Studies','Pakistan Studies':'Islamiat'};
      if(dy.year&&dy.year!==ny)dy.subjects=dy.subjects.map(function(s){return swap[s]||s;});
      dy.year=ny;if(dy.prog&&!dy.subjects.length)dy.subjects=defaultSubjects(dy.prog,ny);render();break;}
    case 'subadd':addSubject();break;
    case 'subdel':ui.draft.subjects.splice(+t.getAttribute('data-i'),1);render();break;
    case 'newnext':{var dn=ui.draft;
      if(!dn.year){toast('Choose First Year or Second Year first.');break;}
      if(!dn.prog){toast('Choose the class name first.');var el=document.getElementById('draftProg');if(el)el.focus();break;}
      if(!draftProgName()){toast('Type the class name first.');var el1=document.getElementById('draftName');if(el1)el1.focus();break;}
      var dHead=(dn.year+' · '+draftProgName()).toLowerCase();
      if(activeClasses().some(function(c){return splitName(c.name).head.toLowerCase()===dHead;})){toast(dn.year+' · '+draftProgName()+' already exists. Open it in Classes and use Add section instead.');break;}
      if(dn.subIn.trim())addSubject(true);
      if(!dn.subjects.length){toast('Add at least one subject.');var el2=document.getElementById('subIn');if(el2)el2.focus();break;}
      ui.view='newsec';window.scrollTo(0,0);render();break;}
    case 'newback':ui.view='new';render();break;
    case 'secadd':ui.draft.sections.push({name:nextSection(),students:''});render();break;
    case 'secdel':ui.draft.sections.splice(+t.getAttribute('data-i'),1);render();break;
    case 'createclass':{
      var dc=ui.draft,seen={},bad='';
      dc.sections.forEach(function(s){s.name=s.name.trim().replace(/^section\s+/i,'');var nm=s.name.toUpperCase();if(!nm)bad='Give every section a name.';else if(seen[nm])bad='Two sections are both called '+s.name.trim()+'.';seen[nm]=1;});
      if(bad){toast(bad);break;}
      var base=dc.year+' · '+draftProgName(),made=0;
      for(var i=0;i<dc.sections.length;i++){
        var s=dc.sections[i];
        var nm=(base+' · Section '+s.name.trim()).slice(0,200);
        try{
          var r=await sb.rpc('create_section',{p_name:nm,p_subjects:dc.subjects});
          if(r.error)throw r.error;
          made+=dc.subjects.length;
        }catch(e){
          console.error(e);
          toast(e.message||'Could not create section '+s.name);
        }
      }
      await loadAll();
      ui.open=ui.open||{};ui.open['h|'+base]=true;
      ui.draft=null;ui.view='classes';ui.lastTop='classes';ui.cid=null;ui.cFilter=dc.year;window.scrollTo(0,0);render();
      toast(made+' register'+(made===1?'':'s')+' created for '+base+'. Now use Add students on each section.');break;}
    case 'sample':{if(!isMgr())break;
      var sample=['1, Ayesha Khan','2, Muhammad Hamza','3, Fatima Noor','4, Ali Raza','5, Hira Iqbal','6, Usman Tariq','7, Zainab Malik','8, Bilal Ahmed','9, Maryam Saeed','10, Hassan Javed'].join('\n');
      var sc=newClass('Example class (delete me)','Databases',sample);dbCreateClass(sc);
      ui.cid=sc.id;ui.view='class';ui.tab='mark';ui.mode='tap';ui.date=todayISO();render();break;}
    case 'addstudents':{
      var gr2=genResult(c.students);if(gr2.error){toast(gr2.msg);break;}
      var add=parseStudents(ui.addText,c.students),have={};
      c.students.concat(add).forEach(function(s){have[s.roll]=1;});
      gr2.list.forEach(function(r2){if(!have[r2]){have[r2]=1;add.push({roll:r2,name:''});}});
      if(!add.length){toast('Type, paste or generate at least one student.');break;}
      var added=0,fail=[];
      for(var i=0;i<add.length;i++){
        var r=await sb.rpc('add_student',{p_section:c.name,p_roll:add[i].roll,p_name:add[i].name||''});
        if(r.error)fail.push(add[i].roll+': '+(r.error.message||'failed'));
        else added++;
      }
      ui.addText='';resetGen();
      if(added>0)await loadAll();
      if(fail.length)toast('Added '+added+' student'+(added===1?'':'s')+'. Failed: '+fail.join('; '));
      else toast(added+' student'+(added===1?'':'s')+' added.');
      render();break;}
    case 'rmstudent':{
      var key='s'+t.getAttribute('data-sid');
      if(ui.confirm===key){
        var rid=t.getAttribute('data-sid');
        var stObj=c.students.filter(function(s){return s.id===rid;})[0];
        if(stObj){
          try{
            var r=await sb.rpc('remove_student',{p_section:c.name,p_roll:stObj.roll});
            if(r.error)throw r.error;
            toast('Student '+stObj.roll+' removed from section.');
            await loadAll();
          }catch(e){
            console.error(e);
            toast('Could not remove student: '+(e.message||''));
          }
        }
        ui.confirm=null;
      }
      else ui.confirm=key;
      render();break;}
    case 'delclass':
      if(ui.confirm==='class'){var hadSt=c.students.length;ui.confirm=null;if(removeRegs([c])){ui.view=ui.lastTop||'home';ui.cid=null;render();toast(hadSt?'Register deleted. Its students and attendance are kept under Deleted in Classes.':'Register deleted.');}else render();}
      else{ui.confirm='class';render();}
      break;
    case 'exportcsv':exportCsv();break;
    case 'mxdo':exportMonth();break;
    case 'mxlock':toggleMonth();break;
    case 'secfilteryear':ui.secM.filterYear=t.getAttribute('data-v');render();break;
    case 'secopen':{
      ui.secM.openSec=t.getAttribute('data-k');
      ui.secM.renameOpen=false;ui.secM.delConfirm=false;ui.secM.stAddOpen=false;
      ui.secM.bulkOpen=false;ui.secM.tPickOpen=false;ui.secM.editRoll=null;ui.secM.armedRoll=null;
      ui.view='sectiondetail';window.scrollTo(0,0);render();break;}
    case 'seccreateopen':ui.secM.createOpen=!ui.secM.createOpen;ui.secM.createMsg='';render();break;
    case 'seccreatecancel':ui.secM.createOpen=false;ui.secM.createMsg='';render();break;
    case 'seccreate':{
      var cErr=await createSectionInProgram(ui.secM.createHead,ui.secM.createName);
      if(cErr){ui.secM.createMsg=cErr;render();}
      else{
        var scV=ui.secM.createName.trim().replace(/^section\s+/i,'');
        toast('Section '+scV+' created.');
        ui.secM.createOpen=false;ui.secM.createName='';ui.secM.createMsg='';
        ui.secM.openSec=ui.secM.createHead+'|Section '+scV;
        ui.view='sectiondetail';render();
      }
      break;}
    case 'secrenameopen':ui.secM.renameOpen=true;ui.secM.renameVal='';ui.secM.renameMsg='';render();break;
    case 'secrenamecancel':ui.secM.renameOpen=false;ui.secM.renameMsg='';render();break;
    case 'secrenamesave':{
      var pRn=ui.secM.openSec.split('|'),hdRn=pRn[0],scRn=pRn[1];
      var rnErr=await renameSection(hdRn,scRn,ui.secM.renameVal);
      if(rnErr){ui.secM.renameMsg=rnErr;render();}
      else{
        var newV='Section '+ui.secM.renameVal.trim().replace(/^section\s+/i,'');
        toast(scRn+' renamed to '+newV+'.');
        ui.secM.openSec=hdRn+'|'+newV;
        ui.secM.renameOpen=false;ui.secM.renameMsg='';render();
      }
      break;}
    case 'secdelopen':ui.secM.delConfirm=true;render();break;
    case 'secdelcancel':ui.secM.delConfirm=false;render();break;
    case 'secdeldo':{
      var pDl=ui.secM.openSec.split('|'),hdDl=pDl[0],scDl=pDl[1];
      try{
        await deleteSection(hdDl,scDl);
        toast(scDl+' deleted. Students and attendance are safely kept in archive.');
        ui.secM.delConfirm=false;ui.secM.openSec='';ui.view='sections';
      }catch(e){
        console.error(e);
        toast('Could not delete section: '+(e.message||''));
      }
      render();break;}
    case 'secstaddopen':ui.secM.stAddOpen=true;ui.secM.bulkOpen=false;ui.secM.stMsg='';render();break;
    case 'secstaddcancel':ui.secM.stAddOpen=false;ui.secM.stMsg='';render();break;
    case 'secstaddsave':{
      var pSt=ui.secM.openSec.split('|'),hdSt=pSt[0],scSt=pSt[1];
      var stAddErr=await addStudentToSection(hdSt,scSt,ui.secM.stRoll,ui.secM.stName);
      if(stAddErr){ui.secM.stMsg=stAddErr;render();}
      else{
        toast('Student '+ui.secM.stRoll+' added.');
        ui.secM.stRoll='';ui.secM.stName='';ui.secM.stMsg='';ui.secM.stAddOpen=false;render();
      }
      break;}
    case 'secbulkopen':ui.secM.bulkOpen=true;ui.secM.stAddOpen=false;ui.secM.stMsg='';render();break;
    case 'secbulkcancel':ui.secM.bulkOpen=false;ui.secM.stMsg='';render();break;
    case 'secbulksave':{
      var pBk=ui.secM.openSec.split('|'),hdBk=pBk[0],scBk=pBk[1];
      var bRes=await bulkAddStudentsToSection(hdBk,scBk,ui.secM.bulkText);
      if(bRes.error){
        ui.secM.stMsg=(bRes.count?'Added '+bRes.count+' students. ':'')+bRes.error;
        if(bRes.count)toast('Added '+bRes.count+' students with errors: '+bRes.error);
        render();
      }else{
        toast(bRes.count+' student'+(bRes.count===1?'':'s')+' added.'+(bRes.skipped?' ('+bRes.skipped+' duplicates skipped)':''));
        ui.secM.bulkText='';ui.secM.bulkOpen=false;ui.secM.stMsg='';render();
      }
      break;}
    case 'secstedit':{
      var stR=t.getAttribute('data-r');
      var pEd=ui.secM.openSec.split('|'),hdEd=pEd[0],scEd=pEd[1];
      var regsEd=regsOf(hdEd,scEd),baseEd=regsEd[0];
      var stEd=(baseEd.students||[]).filter(function(s){return s.roll===stR;})[0];
      if(stEd){ui.secM.editRoll=stR;ui.secM.editRollVal=stEd.roll;ui.secM.editNameVal=stEd.name||'';}
      render();break;}
    case 'secsteditcancel':ui.secM.editRoll=null;render();break;
    case 'secsteditsave':{
      var pSv=ui.secM.openSec.split('|'),hdSv=pSv[0],scSv=pSv[1];
      var edErr=editStudentInSection(hdSv,scSv,ui.secM.editRoll,ui.secM.editRollVal,ui.secM.editNameVal);
      if(edErr){toast(edErr);}
      else{toast('Student updated.');ui.secM.editRoll=null;render();}
      break;}
    case 'secstrmcancel':ui.secM.armedRoll=null;render();break;
    case 'secstrm':{
      var rRm=t.getAttribute('data-r');
      if(ui.secM.armedRoll===rRm){
        var pRm=ui.secM.openSec.split('|'),hdRm=pRm[0],scRm=pRm[1];
        try{
          await removeStudentFromSection(hdRm,scRm,rRm);
          toast('Student '+rRm+' removed.');
        }catch(e){
          console.error(e);
          toast('Could not remove student: '+(e.message||''));
        }
        ui.secM.armedRoll=null;
      }else{ui.secM.armedRoll=rRm;}
      render();break;}
    case 'sectpickopen':ui.secM.tPickOpen=true;ui.secM.selectedTids={};ui.secM.subSel='';ui.secM.tMsg='';render();break;
    case 'sectpickcancel':ui.secM.tPickOpen=false;ui.secM.selectedTids={};ui.secM.subSel='';ui.secM.tMsg='';render();break;
    case 'sectchchk':{
      var chkEm=t.getAttribute('data-em');
      if(t.checked)ui.secM.selectedTids[chkEm]=true;
      else delete ui.secM.selectedTids[chkEm];
      break;}
    case 'secassignsave':{
      var emails=Object.keys(ui.secM.selectedTids).filter(function(em){return ui.secM.selectedTids[em];});
      if(!emails.length){ui.secM.tMsg='Select at least one teacher.';render();break;}
      var pAsg=ui.secM.openSec.split('|'),hdAsg=pAsg[0],scAsg=pAsg[1];
      var subSel=ui.secM.subSel?[ui.secM.subSel]:null;
      try{
        await assignTeachersToSection(hdAsg,scAsg,emails,ui.secM.tFrom,subSel);
        toast('Assigned '+emails.length+' teacher'+(emails.length===1?'':'s')+' to '+scAsg+(ui.secM.subSel?' ('+ui.secM.subSel+')':'')+'.');
        ui.secM.tPickOpen=false;ui.secM.selectedTids={};ui.secM.subSel='';ui.secM.tMsg='';
      }catch(e){
        console.error(e);
        ui.secM.tMsg=e.message||'Could not assign teacher.';
      }
      render();break;}
    case 'secunassign':{
      var unEm=t.getAttribute('data-em');
      var pUn=ui.secM.openSec.split('|'),hdUn=pUn[0],scUn=pUn[1];
      try{
        await removeTeacherFromSection(hdUn,scUn,unEm);
        toast('Removed '+teacherLabel(unEm)+' from '+scUn+'.');
      }catch(e){
        console.error(e);
        toast('Could not remove teacher: '+(e.message||''));
      }
      render();break;}
  }
});
document.addEventListener('keydown',function(e){
  if(e.key==='Enter'&&e.target&&e.target.id==='subIn'&&ui.draft){e.preventDefault();addSubject();}
  if(e.key==='Enter'&&e.target&&e.target.id==='pgSubIn'&&ui.pg){e.preventDefault();pgAddSubs();}
  if(e.key==='Enter'&&e.target&&e.target.id==='pgName'&&ui.pg){e.preventDefault();pgSave();}
  if(e.key==='Enter'&&e.target&&(e.target.id==='ceSec'||e.target.id==='ceOther')&&ui.ce){e.preventDefault();saveClassEdit();}
  if(e.key==='Escape'&&ui.ce){ui.ce=null;render();}
});
document.addEventListener('input',function(e){
  var t=e.target,si=t.getAttribute&&t.getAttribute('data-sec');
  if(si!=null&&ui.draft){var sx=ui.draft.sections[+si];if(!sx)return;sx[t.getAttribute('data-f')]=t.value;return;}
  if(ui.ae&&t.getAttribute&&t.getAttribute('data-ae')!=null){ui.ae.att[t.getAttribute('data-ae')]=t.value;ui.ae.dirty=true;ui.ae.warned=false;aeRefresh();return;}
  if(ui.ae&&t.id==='aeDel'){ui.ae.del=t.value;ui.ae.dirty=true;ui.ae.warned=false;aeRefresh();return;}
  switch(t.id){
    case 'loginEmail':ui.loginEmail=t.value;break;
    case 'loginPass':ui.loginPass=t.value;break;
    case 'quickIn':ui.quick=t.value;updateQuickPreview();break;
    case 'asgEmail':ui.asg.email=t.value;break;
    case 'asgFrom':ui.asg.from=t.value;break;
    case 'admEmail':ui.adm.newEmail=t.value;break;
    case 'draftName':ui.draft.name=t.value;break;
    case 'subIn':ui.draft.subIn=t.value;break;
    case 'ceSec':if(ui.ce)ui.ce.val=t.value;break;
    case 'nsName':if(ui.ns){ui.ns.name=t.value;if(ui.ns.msg){ui.ns.msg='';var na=document.querySelector('.merge [role=alert]');if(na)na.remove();}}break;
    case 'nsIn':if(ui.ns){ui.ns.text=t.value;var nc=document.getElementById('nsCount');if(nc){var k=t.value.trim()?parseStudents(t.value,[]).length:0;nc.textContent=k?k+' student'+(k===1?'':'s')+' found.':'Pasting two columns from Excel or Sheets works too.';}}break;
    case 'pgName':if(ui.pg)ui.pg.name=t.value;break;
    case 'pgSubIn':if(ui.pg)ui.pg.subIn=t.value;break;
    case 'asIn':if(ui.as){ui.as.text=t.value;var ac=document.getElementById('asCount');if(ac)ac.textContent=asCountText();}break;
    case 'ceOther':if(ui.ce)ui.ce.other=t.value;break;
    case 'tpName':ui.tp.name=t.value;break;
    case 'tpDes':ui.tp.des=t.value;break;
    case 'tpQual':ui.tp.qual=t.value;break;
    case 'teName':if(ui.tp.edit)ui.tp.edit.name=t.value;break;
    case 'teDept':if(ui.tp.edit)ui.tp.edit.dept=t.value;break;
    case 'teDes':if(ui.tp.edit)ui.tp.edit.des=t.value;break;
    case 'teQual':if(ui.tp.edit)ui.tp.edit.qual=t.value;break;
    case 'tpQ':ui.tp.q=t.value;render();break;
    case 'tlEmail':ui.tp.lEmail=t.value;if(ui.tp.lmsg){ui.tp.lmsg='';var al2=document.querySelector('.tdetail [role=alert]');if(al2)al2.remove();}break;
    case 'tlPass':ui.tp.lPass=t.value;break;
    case 'taEmail':if(ui.ta){ui.ta.lEmail=t.value;if(ui.asg.msg){ui.asg.msg='';var al=document.querySelector('.assignbox [role=alert]');if(al)al.remove();}}break;
    case 'taPass':if(ui.ta)ui.ta.lPass=t.value;break;
    case 'qaEmail':qaState().lEmail=t.value;break;
    case 'qaPass':qaState().lPass=t.value;break;
    case 'tpDept':ui.tp.dept=t.value;break;
    case 'tpEmail':ui.tp.email=t.value;break;
    case 'tpPass':ui.tp.pass=t.value;break;
    case 'genFrom':case 'genTo':case 'genStep':case 'genSkip':{
      ui.gen[{genFrom:'from',genTo:'to',genStep:'step',genSkip:'skip'}[t.id]]=t.value;
      var gc=(ui.view==='class'&&ui.cid)?cls():(ui.as?asBase():null),gi=document.getElementById('genInfo'),gres=genResult(gc?gc.students:[]);
      if(gi){gi.textContent=gres.msg;gi.className='hint'+(gres.error?' warn':'');}
      break;}
    case 'addIn':{ui.addText=t.value;var c=cls(),el2=document.getElementById('addCount');if(c&&el2)el2.textContent=t.value.trim()?parseStudents(t.value,c.students).length+' to add.':'Pasting two columns from Excel or Sheets works too.';}break;
    case 'secCreateName':ui.secM.createName=t.value;break;
    case 'secRenameVal':ui.secM.renameVal=t.value;break;
    case 'secStRoll':ui.secM.stRoll=t.value;break;
    case 'secStName':ui.secM.stName=t.value;break;
    case 'secBulkIn':{
      ui.secM.bulkText=t.value;
      var elPr=document.getElementById('secBulkPreview');
      if(elPr&&ui.secM.openSec){
        var pB2=ui.secM.openSec.split('|'),rB2=regsOf(pB2[0],pB2[1]);
        elPr.textContent=secBulkPreviewText(rB2.length?rB2[0]:null,t.value);
      }
      break;}
    case 'secEditRollVal':ui.secM.editRollVal=t.value;break;
    case 'secEditNameVal':ui.secM.editNameVal=t.value;break;
  }
});
document.addEventListener('change',function(e){
  var t=e.target,c=ui.cid?cls():null,f=t.getAttribute&&t.getAttribute('data-field');
  if(t.id==='secProgFilter'){ui.secM.filterProg=t.value;render();return;}
  if(t.id==='secCreateHead'){ui.secM.createHead=t.value;return;}
  if(t.id==='secTSubs'){ui.secM.subSel=t.value;return;}
  if(t.id==='secTFrom'){ui.secM.tFrom=t.value;return;}
  if(t.id==='tpSecSel'){ui.tp.secK=t.value;ui.tp.subSel='';render();return;}
  if(t.id==='tpSubSel'){ui.tp.subSel=t.value;return;}
  if(t.id==='dateIn'){var nd0=t.value||todayISO();if(isFuture(nd0)){nd0=todayISO();toast('Future dates cannot be marked.');}else if(closedFor(nd0)){toast(closedNote(nd0));nd0=closedFor(ui.date)?todayISO():ui.date;}ui.date=nd0;render();return;}
  if(t.id==='totalsFile'){if(isMgr()&&t.files&&t.files[0])readTotalsFile(t.files[0]);return;}
  if(t.id==='draftProg'){ui.draft.prog=t.value;ui.draft.subjects=t.value&&t.value!=='Other'?defaultSubjects(t.value,ui.draft.year):[];render();if(t.value==='Other'){var on=document.getElementById('draftName');if(on)on.focus();}return;}
  if(t.id==='taWho'&&ui.ta){ui.ta.tid=t.value;ui.asg.msg='';render();return;}
  if(t.id==='asgEmail'&&t.tagName==='SELECT'){ui.asg.email=t.value;return;}
  if(t.id==='taQFree'||t.id==='asgQFree'||t.id==='qaQFree'){ui.tfree=t.checked;var fp=tPicks('',t.id==='asgQFree');if(fp.length===1){if(t.id==='taQFree'&&ui.ta)ui.ta.tid=fp[0].id;else if(t.id==='qaQFree')qaState().tid=fp[0].id;else ui.asg.email=fp[0].email;}render();return;}
  if(t.id==='qaWho'){var qw=qaState();qw.tid=t.value;qw.msg='';render();return;}
  if(t.id==='qaFrom'){qaState().from=t.value;render();return;}
  if(t.getAttribute&&t.getAttribute('data-qsec')!=null){var qc=qaState();if(t.checked)qc.secs[t.getAttribute('data-qsec')]=1;else delete qc.secs[t.getAttribute('data-qsec')];render();return;}
  if(t.getAttribute&&t.getAttribute('data-qsub')!=null){var qd=qaState();if(t.checked)qd.subs[t.getAttribute('data-qsub')]=1;else delete qd.subs[t.getAttribute('data-qsub')];render();return;}
  if(t.id==='taFrom'&&ui.ta){ui.ta.from=t.value;return;}
  if(t.getAttribute&&t.getAttribute('data-nsub')!=null&&ui.ns){var sl=classSubjects(ui.ns.head)[+t.getAttribute('data-nsub')];if(sl!=null){ui.ns.skip[sl.toLowerCase()]=!t.checked;}return;}
  if((f==='esroll'||f==='esname')&&ui.es&&isMgr()){var v0=t.value.trim();if(f==='esroll'&&!v0){t.value=t.getAttribute('data-roll');return;}if(esEdit(t.getAttribute('data-roll'),f,v0))render();return;}
  if(t.id==='asSec'&&ui.as){ui.as.sec=t.value;resetGen();render();return;}
  if(t.id==='mgTo'&&ui.mg){ui.mg.to=t.value;render();return;}
  if(t.id==='ceProg'&&ui.ce){ui.ce.prog=t.value;render();return;}
  if(t.id==='tpReg'){ui.tp.cid=t.value;return;}
  if(t.id==='tpRegFree'){ui.tp.rfree=t.checked;var rf=regPicks(activeClasses(),t.checked);if(rf.length===1)ui.tp.cid=rf[0].id;render();return;}
  if(t.id==='tpFrom'){ui.tp.from=t.value;return;}
  if(t.id==='admRole'){ui.adm.newRole=t.value;return;}
  if(t.id==='admTeacher'){ui.adm.teacher=t.value;render();return;}
  if(t.id==='amNew'&&ui.amf){ui.amf.m=t.value;return;}
  if(t.id==='amOpen'&&ui.amf){ui.amf.open=t.checked;return;}
  if(t.id==='mxSel'){ui.mx=t.value;render();return;}
  if(t.id==='periodSel'){ui.period=t.value;render();return;}
  if(t.id==='shortOnly'){ui.shortOnly=t.checked;render();return;}
  if(t.id==='qOthers'){ui.qOthers=t.checked;updateQuickPreview();return;}
  if(!f||!c)return;
  if(f==='roll'||f==='sname'){
    var s=c.students.filter(function(x){return x.id===t.getAttribute('data-sid');})[0];if(!s)return;
    var val=t.value.trim();
    if(f==='roll'&&!val){t.value=s.roll;return;}
    if(f==='roll')s.roll=val.slice(0,40);else s.name=val.slice(0,200);
    dbUpdateStudent(s);return;
  }
  if(f==='cname'){var n=t.value.trim();if(!n){t.value=c.name;return;}c.name=n.slice(0,200);dbUpdateClass(c);render();return;}
  if(f==='csubject'){c.subject=t.value.trim().slice(0,200);dbUpdateClass(c);return;}
  if(f==='cthreshold'){var v=Math.max(0,Math.min(100,parseInt(t.value,10)));if(isNaN(v)){t.value=c.threshold;return;}c.threshold=v;dbUpdateClass(c);return;}
  if(f==='cleave'){c.leaveAsPresent=t.checked;dbUpdateClass(c);return;}
});
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')flushDays();});
window.addEventListener('pagehide',flushDays);

/* ---------- start ---------- */
(function boot(){
  var qp=new URLSearchParams(location.search+'&'+location.hash.replace(/^#/,''));
  var err=qp.get('error_description');
  if(err)ui.authError=friendlyAuthError(err.replace(/\+/g,' '));
  render();
  sb.auth.onAuthStateChange(function(ev,session){handleSession(session);});
  sb.auth.getSession().then(function(r){handleSession(r&&r.data?r.data.session:null);},function(){handleSession(null);});
})();

document.addEventListener('submit',function(e){
  if(!e.target||e.target.id!=='loginForm')return;
  e.preventDefault();
  var em=String(ui.loginEmail||'').trim().toLowerCase(),pw=ui.loginPass||'';
  if(!em||!pw){ui.authError='Enter your username and password.';render();return;}
  ui.signingIn=true;ui.authError='';render();
  sb.auth.signInWithPassword({email:em,password:pw}).then(function(r){
    ui.signingIn=false;
    if(r.error){ui.authError='Wrong username or password.';ui.loginPass='';render();}
    else{ui.loginPass='';}
  },function(){ui.signingIn=false;ui.authError='Could not reach the server. Check your connection.';render();});
});
})();
