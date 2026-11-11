'use strict';
// Completion is derived from real saved evidence. Self-assessment remains separate.
const solutions41=new Map();
let revision41=0,focusRequest41=0;
function mergeRecord41(key,base,fields){
 const value={...base,...fields};
 if(key==='profile')for(const name of ['chapterResume41','trackResume41'])if(fields[name])value[name]={...(base[name]||{}),...fields[name]};
 return value;
}
const originalPatch41=patch;
patch=function(key,fields){
 if(META.recovery)return;revision41++;
 S.records[key]={value:mergeRecord41(key,rec(key),fields),updated:nowLocal()};
 queue('record',{key,patch:fields});
};
const originalLater41=later;
later=function(key,fields,delay){revision41++;return originalLater41(key,fields,delay)};
flush=async function(){
 if(busy||META.recovery)return;busy=true;
 while(Q.length){
  const a=Q[0];
  try{
   // An offline legacy self-assessment is kept as a draft, never silently discarded or trusted as a judge result.
   if(a.kind==='attempt'&&qidMap[a.data.qid]?.type==='program'){
    const prior=a.data,key='draft:'+prior.qid;
    a.kind='record';a.data={key,patch:{answer:prior.answer,legacy_unverified_submission41:prior}};
    S.records[key]={value:mergeRecord41(key,rec(key),a.data.patch),updated:nowLocal()};persistQueue();
    toast('旧版待核对的编程提交已保留为草稿；运行检查后即可计入新通过记录。');
   }
   if(a.kind==='attempt'&&qidMap[a.data.qid]&&(a.data.revision||'legacy')!==(qidMap[a.data.qid].revision||'legacy')){
    const prior=a.data,key='draft:'+prior.qid;
    a.kind='record';a.data={key,patch:{['legacy_submission430_'+prior.event_id]:prior}};
    S.records[key]={value:mergeRecord41(key,rec(key),a.data.patch),updated:nowLocal()};persistQueue();
   }
   const response=await post(a.kind,a.data);
   if(a.kind==='record'){
    let value=response.result.value;
    for(const pending of Q)if(pending.id!==a.id&&pending.kind==='record'&&pending.data.key===a.data.key)value=mergeRecord41(a.data.key,value,pending.data.patch);
    if(timers.has(a.data.key))value=mergeRecord41(a.data.key,value,timers.get(a.data.key).fields);
    S.records[a.data.key]={value,updated:response.saved_at};
   }
   if(a.kind==='attempt'&&!S.attempts.some(x=>x.event_id===response.result.event_id))S.attempts.push(response.result);
   Q=Q.filter(x=>x.id!==a.id);revision41++;lastSave=response.saved_at;META.warning=response.warning;META.secondary_warning=response.secondary_warning;errorState=false;persistQueue();updateSave();
  }catch(e){errorState=true;updateSave();break}
 }
 busy=false;updateCounts();
};
const passes41=()=>new Set(S.attempts.filter(a=>a.correct===1||a.self_pass===1).map(a=>a.qid));
const passed41=id=>passes41().has(id);
function lessonProgress41(l){
 const ids=passes41(),required=l.homework_ids||[],legacy=l.questions||[];
 const homework=required.filter(id=>ids.has(id)).length;
 const legacyDone=legacy.length>0&&legacy.every(q=>ids.has(q.id));
 return {homework,complete:required.length>0&&homework===required.length||legacyDone||rec('lesson:'+l.id).status==='mastered',legacyDone,self:rec('lesson:'+l.id).status==='mastered'};
}
masteredCount=()=>coreLessons().filter(l=>lessonProgress41(l).complete).length;
trackDone=id=>trackLessons(id).filter(l=>lessonProgress41(l).complete).length;
homeworkPassed=l=>lessonProgress41(l).homework;
lessonResult=l=>l.questions.filter(q=>passed41(q.id)).length;
updateCounts=function(){
 if(!C)return;const n=masteredCount();$('#side-progress-bar').style.transform='scaleX('+(n/32)+')';$('#side-count').textContent=`已完成 ${n} / 32 课 · 随时接着学`;
 for(const el of document.querySelectorAll('[data-completed-core]'))el.textContent=n;
};

// A separate bookmark for each chapter and each route. Existing lesson fields survive.
function inferredResume41(ls){
 const saved=new Set(ls.map(l=>l.chapter)).size===1?rec('profile').chapterResume41?.[String(ls[0]?.chapter)]:null;
 if(saved&&ls.some(l=>l.id===saved.lesson)&&validResume41(saved))return saved;
 let best=null;
 for(const l of ls){
  const r=rec('lesson:'+l.id),at=Date.parse(r.lastStudyAt41||S.records['lesson:'+l.id]?.updated||'')||0;
  if(at&&(!best||at>best.at))best={lesson:l.id,href:'#/lesson/'+l.id,at};
  for(const a of S.attempts.filter(a=>a.qid&&qidMap[a.qid]?.lesson===l.id)){
   const t=Date.parse(a.saved_at)||0;
   if(t&&(!best||t>best.at))best={lesson:l.id,href:'#/quiz/question/'+a.qid,at:t};
  }
 }
 return best||{lesson:ls[0].id,href:'#/lesson/'+ls[0].id};
}
function validResume41(x){
 if(!x||typeof x.href!=='string')return false;
 if(x.href==='#/lesson/'+x.lesson)return !!lesson(x.lesson);
 const m=x.href.match(/^#\/quiz\/(homework|daily|lesson|question)\/([a-z0-9]+)$/);
 return !!m&&(m[1]==='question'?qidMap[m[2]]?.lesson===x.lesson:m[2]===x.lesson&&!!lesson(x.lesson));
}
function chapterHref41(ch){return '#/resume/'+ch}
function trackHref41(id){const ls=id==='core'?coreLessons():trackLessons(id);const saved=rec('profile').trackResume41?.[id];return saved&&validResume41(saved)?saved.href:inferredResume41(ls).href}
function globalHref41(){const r=rec('profile').lastStudy41;return r&&validResume41(r)?r.href:'#/lesson/'+(lesson(rec('profile').currentLesson)?.id||'l01')}
function rememberStudy41(l,href,extra={}){
 if(!l||META.recovery||updatePaused)return;
 const stamp=nowLocal(),position={lesson:l.id,href,stamp,...extra},p=rec('profile');
 if(!validResume41(position))return;
 patch('profile',{currentLesson:l.id,lastStudy41:position,chapterResume41:{[String(l.chapter)]:position},trackResume41:{[l.track||'core']:position}});
}
const oldQuizSetup41=quizSetup;
quizSetup=function(parts){
 if(parts[0]==='question'){
  const q=qidMap[parts[1]];
  if(q&&['homework','daily'].includes(q.kind))parts=[q.kind,q.lesson,q.id];
 }
 const z=oldQuizSetup41(parts);if(!z)return z;
 if(['homework','daily'].includes(parts[0])){
  const l=lesson(parts[1]),key='quiz_'+parts[0]+'41',r=rec('lesson:'+l.id)[key];
  z.saveKey='lesson:'+l.id;z.lessonId=l.id;z.positionKey=key;
  if(r){z.index=Math.max(0,Math.min(Number(r.index)||0,z.ids.length-1));z.completed=!!r.completed;z.scroll=Number(r.scroll)||0}
  else {
   // Old versions did not keep these indexes. Recover the latest submitted question.
   const recent=S.attempts.filter(a=>z.ids.includes(a.qid)).at(-1);
   z.index=recent?z.ids.indexOf(recent.qid):0;z.completed=false;z.scroll=0;
  }
  const explicit=z.ids.indexOf(parts[2]);
  if(explicit>=0){z.index=explicit;z.completed=false;z.scroll=0;z.explicit=true}
  else if(z.completed&&z.mode==='homework'&&z.ids.some(id=>!passed41(id))){z.index=z.ids.findIndex(id=>!passed41(id));z.completed=false;z.scroll=0}
 }
 return z;
};
saveQuizPosition=function(){
 const z=currentQuiz,q=currentQuestion();if(!z||!q)return;
 if(z.positionKey)patch(z.saveKey,{[z.positionKey]:{index:z.index,completed:!!z.completed,scroll:z.scroll||0},lastStudyAt41:nowLocal()});
 else if(z.saveKey)patch(z.saveKey,z.mode.startsWith('lesson-')?{questionIndex:z.index,quizCompleted:z.completed}:{index:z.index,completed:z.completed});
 const l=lesson(q.lesson),href=z.positionKey?groupHref42(z.mode,z.lessonId):location.hash;
 rememberStudy41(l,href,{question:q.id,index:z.index,completed:!!z.completed});
};

function problemHeading41(q){
 return `<h1>${esc(q.display_title||q.prompt)}</h1>${q.background?`<p class="problem-background">${esc(q.background)}</p>`:''}`;
}
function problemStatement41(q){
 if(!q.task)return '';
 const sample=q.judge_tests?.[0];
 const parts=q.task.split(/第一部分：|第二部分：/);
 const task=parts.length===3?`<p>按顺序完成下面两项任务。</p><div class="problem-parts"><article><h3>第一部分</h3><p>${rich(parts[1])}</p></article><article><h3>第二部分</h3><p>${rich(parts[2])}</p></article></div>`:`<p>${rich(q.task)}</p>`;
 return `<section class="problem-statement"><h2>${q.type==='program'?'任务要求':q.type==='choice'&&q.options?.length===4?'请选择一项':'题目要求'}</h2>${task}${q.type==='program'?`<div class="problem-format"><div><h3>输入格式</h3><p>${esc(q.input_format)}</p></div><div><h3>输出格式</h3><p>${esc(q.output_format)}</p></div></div>${sample?`<div class="problem-sample"><div><h3>样例输入</h3><pre>${esc(sample.input||'（无标准输入）')}</pre>${Object.entries(sample.files||{}).map(([name,value])=>`<strong>${esc(name)}</strong><pre>${esc(value||'（空文件）')}</pre>`).join('')}</div><div><h3>样例输出</h3><pre>${esc(sample.output||'（空输出）')}</pre></div></div>`:''}`:''}</section>`;
}
function solutionPanel41(q){
 const data=solutions41.get(solutionKey43(q)),unlocked=passedCurrent43(q.id);
 if(!unlocked)return `<section class="solution-locked" id="solution-panel-${q.id}">${icon('bookmark')}<div><strong>答对后，解锁本题答案。</strong><p>现在可以查看提示、编译诊断和公开测试结果；完整解法会在首次通过后保留，方便复习。</p></div></section>`;
 if(!data)return `<section class="answer-detail" id="solution-panel-${q.id}"><button class="text-button" data-solution41="${q.id}">读取已解锁的参考答案 ›</button></section>`;
 const steps=data.solution_steps||[];
 return `<section id="solution-panel-${q.id}"><details class="answer-detail unlocked-answer" open><summary>已解锁 · 参考答案与分步解释 <span>＋</span></summary><p class="small-text muted">首次通过后永久保留。回看答案不会减少已完成进度。</p>${q.type==='program'?codeBlock(data.reference||'',q.id+'-reference.c','C · 使用本课与先修知识的一种写法'):`<div class="output">${q.type==='choice'?esc('ABCD'[Number(data.answer)]+'. '+q.options[Number(data.answer)]):esc(data.answer)}</div>`}${steps.length?`<div class="solution-steps">${steps.map((x,i)=>`<article><span>${String(i+1).padStart(2,'0')}</span><div><h3>${esc(x.title)}</h3>${x.code?`<code>${esc(x.code)}</code>`:''}<p>${rich(x.body)}</p></div></article>`).join('')}</div>`:`<p>${esc(data.explanation||'')}</p>`}${data.tests?.length?`<ul class="test-list">${data.tests.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}</details></section>`;
}
async function loadSolution41(id){
 const q=qidMap[id],key=solutionKey43(q);
 if(!passedCurrent43(id)||solutions41.has(key))return;
 try{
  const result=await post('solution',{qid:id,revision:q.revision||'legacy'});
  if(result.result.unlocked){solutions41.set(key,result.result.solution);const el=$('#solution-panel-'+id);if(el&&currentQuestion()?.id===id)el.outerHTML=solutionPanel41(qidMap[id])}
 }catch(e){toast('答案暂时没有读出，可以点击重试。')}
}
feedbackHTML=function(a,q){
 const ok=a.correct===1||a.self_pass===1;
 return `<div class="feedback ${ok?'':'wrong'}"><strong>${ok?(q.type==='program'?'本题测试已通过。':'这次答对了。'):'还没有答对，可以按线索再试一次。'}</strong><p>${esc(ok?'参考答案已解锁，回看不会减少完成进度。':'下面可以逐条展开本题提示，检查后再提交。')}</p>${ok&&a.praise?`<p class="earned-praise">${esc(a.praise)}</p>`:''}<div class="small-text">${a.assisted?'本次使用了学习提示。':'本次提交未使用本页提示。'} · ${fmtTime(a.saved_at)}</div></div>`;
};
submitQuestion=async function(btn){
 if(META.recovery||judgeBusy)return;
 const q=currentQuestion(),answer=currentAnswer();if(!q||!answer.trim())return toast(q?.type==='program'?'先写下完整C程序，再运行检查。':'先写下你的判断，再检查。');
 const wasPassed=passedCurrent43(q.id),quiz=currentQuiz;judgeBusy=true;btn.disabled=true;const label=btn.textContent;btn.textContent=q.type==='program'?'正在编译与检查…':'正在检查…';
 try{
  if(!await waitSaved())throw Error('请先保存当前草稿。');
  let a,result;
  if(q.type==='program'){
   const response=await post('judge',{qid:q.id,answer,event_id:crypto.randomUUID(),mode:quiz.mode,assisted:!!rec('draft:'+q.id).hints420,revision:q.revision||'legacy'});
   a=response.result.attempt;result=response.result.judgement;if(!S.attempts.some(x=>x.event_id===a.event_id))S.attempts.push(a);lastSave=response.saved_at;
  }else{
   const pending=Q.find(x=>x.kind==='attempt'&&x.data.qid===q.id&&x.data.mode===quiz.mode)||queue('attempt',{qid:q.id,answer,event_id:crypto.randomUUID(),mode:quiz.mode,assisted:!!rec('draft:'+q.id).hints420,revision:q.revision});
   if(!await waitSaved())throw Error('提交已放入待保存队列，请保持页面并重试。');
   a=S.attempts.find(x=>x.event_id===pending.data.event_id);
  }
  if(!a)return;revision41++;
  if(routeName==='quiz'&&currentQuiz&&!currentQuiz.completed){
   refreshQuizActions42();
   if(currentQuiz.mode===quiz.mode&&currentQuestion()?.id===q.id&&$('#feedback')){
    $('#feedback').innerHTML=(result?judgementHTML(result):'')+feedbackHTML(a,q);
    await loadSolution41(q.id);
   }
  }
  updateSave();updateCounts();
  if(!wasPassed&&(a.correct===1||a.self_pass===1)&&a.praise)toast(a.praise);
 }catch(e){toast(e.message);if(routeName==='quiz'&&currentQuiz===quiz&&currentQuestion()?.id===q.id&&$('#feedback'))$('#feedback').textContent=e.message}
 finally{judgeBusy=false;if(btn.isConnected){btn.disabled=false;btn.textContent=label}}
};

// Keep card styling and independent links, but give its primary surface one resume destination.
const oldChapterCard41=chapterCard;
chapterCard=function(ch){
 const ls=C.lessons.filter(l=>l.chapter===ch.id),n=ls.filter(l=>lessonProgress41(l).complete).length;
 let html=oldChapterCard41(ch);
 html=html.replace(/<div class="chapter-card-progress">[\s\S]*?<\/div>/,`<div class="chapter-card-progress"><span>${n?n+' / '+ls.length+' 课已完成':'从这一章，开始理解。'}</span><a href="${chapterHref41(ch.id)}">${inferredResume41(ls).at||rec('profile').chapterResume41?.[ch.id]?'接着学':'开始学习'} ›</a></div>`);
 return html.replace(/<span class="lesson-status ([^"]*)">([^<]*)<\/span><span>([^<]*)<\/span>/g,(full,cls,mark,title)=>{const l=ls.find(x=>esc(x.title)===title);return l?`<span class="lesson-status ${lessonProgress41(l).complete?'mastered':cls}">${lessonProgress41(l).complete?'✓':mark}</span><span>${title}</span>`:full});
};
const oldGlass41=renderGlassHome;
renderGlassHome=function(){return oldGlass41().replace(/<a class="hero-cta" href="[^"]*"/,`<a class="hero-cta" href="${globalHref41()}"`).replace('已掌握 · 自评','已完成 · 自动记录')};
const oldHomeBase41=renderHomeBase;
renderHomeBase=function(){return oldHomeBase41().replace('已掌握为你的自评，学习不设固定时长。',`已完成课时自动统计；自评已掌握 ${coreLessons().filter(l=>lessonProgress41(l).self).length} 课。`).replace(/<strong>(\d+)<small> \/ 32 课<\/small><\/strong>/g,'<strong><span data-completed-core>$1</span><small> / 32 课</small></strong>')};
const oldRecords41=renderRecords;
renderRecords=function(){return oldRecords41().replace('课内已掌握','课内已完成').replace('由你判断掌握程度 · 拓展另计',`完成自动统计 · 自评掌握 ${coreLessons().filter(l=>lessonProgress41(l).self).length} 课`).replaceAll('<small>已掌握</small>','<small>已完成</small>')};
const oldExtensions41=renderExtensions;
renderExtensions=function(id){return oldExtensions41(id).replaceAll('<span>已掌握 <b>','<span>已完成 <b>').replace(/<a class="button" href="#\/lesson\/(l\d{2})">接着这条路线学/g,(full,lid)=>`<a class="button" href="${trackHref41(lesson(lid).track)}">接着这条路线学`)};
const oldSuggestion41=suggestion;
suggestion=function(){const x=oldSuggestion41();if(x.tag!=='课内复习'){const r=rec('profile').lastStudy41,l=r&&lesson(r.lesson);if(l&&validResume41(r))return {...x,title:l.title,text:lessonContext(l)+' · 回到上次停下的位置。',href:r.href,cta:'接着学'}}return x};
const oldRoute41=renderRoute;
renderRoute=async function(){
 captureQuizScroll41();
 capturePractice42();
 const parts=location.hash.replace(/^#\/?/,'').split('/');
 if(parts[0]==='resume'){
  const ls=C.lessons.filter(l=>l.chapter===Number(parts[1]));
  location.replace(ls.length?inferredResume41(ls).href:'#/courses');return;
 }
 await oldRoute41();
 if(parts[0]==='practice')requestAnimationFrame(restorePractice42);
 if(parts[0]==='lesson'&&lesson(parts[1])&&!review42())rememberStudy41(lesson(parts[1]),location.hash,{stage:currentFlow(lesson(parts[1]))});
 if(parts[0]==='quiz'&&currentQuestion()){
  if(currentQuiz.explicit){history.replaceState(null,'',groupHref42(currentQuiz.mode,currentQuiz.lessonId));currentQuiz.explicit=false}
  saveQuizPosition();void loadSolution41(currentQuestion().id);
  const y=currentQuiz.scroll||0;requestAnimationFrame(()=>window.scrollTo(0,y));
 }
};
questionRows=function(ids,mode,lid,ordered=ids){return `<div class="practice-question-list">${ids.map((id,i)=>{const q=qidMap[id];return `<a href="${mode?groupHref42(mode,lid,id):'#/quiz/question/'+id}"><span class="question-number">${String(ordered.indexOf(id)+1).padStart(2,'0')}</span><span><strong>${esc(q.display_title||q.prompt.split('。')[0])}</strong><small>${esc(q.category||'综合复习')} · ${questionType42(q)}</small></span><span class="question-difficulty level-${q.difficulty==='简单'?1:q.difficulty==='中等'?2:3}">${esc(q.difficulty||'复习')}</span><span>${passedCurrent43(id)?'✓':passed41(id)?'旧版已过':'›'}</span></a>`}).join('')}</div>`};
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-solution41]');if(b)void loadSolution41(b.dataset.solution41);
 const flow=e.target.closest('[data-ui="flow"]');if(flow&&!review42()){const l=lesson(flow.dataset.id);rememberStudy41(l,'#/lesson/'+l.id,{stage:Number(flow.dataset.stage)})}
 const next=e.target.closest('[data-action="quiz-next"],[data-action="quiz-prev"],[data-action="quiz-restart"]');if(next&&currentQuestion())void loadSolution41(currentQuestion().id);
});
let quizScroll41;
function captureQuizScroll41(){
 clearTimeout(quizScroll41);const z=currentQuiz;
 if(routeName==='quiz'&&z?.positionKey&&!META.recovery&&!updatePaused){z.scroll=window.scrollY||0;patch(z.saveKey,{[z.positionKey]:{index:z.index,completed:!!z.completed,scroll:z.scroll}})}
}
window.addEventListener('beforeunload',captureQuizScroll41);
window.addEventListener('scroll',()=>{
 if(routeName!=='quiz'||!currentQuiz?.positionKey||updatePaused)return;
 const z=currentQuiz,y=window.scrollY;clearTimeout(quizScroll41);quizScroll41=setTimeout(()=>{if(currentQuiz!==z)return;z.scroll=y;later(z.saveKey,{[z.positionKey]:{index:z.index,completed:!!z.completed,scroll:y}})},450);
},{passive:true});
window.addEventListener('focus',async()=>{
 if(!C||Q.length||timers.size||judgeBusy||busy)return;
 const revision=revision41,request=++focusRequest41;
 try{const b=await fetch('/api/bootstrap').then(r=>r.json());if(Q.length||timers.size||judgeBusy||busy||revision!==revision41||request!==focusRequest41)return;S=b.state;META=b.meta;TOKEN=b.token;updateCounts();
  if(['home','courses','extensions','records'].includes(routeName))await renderRoute();
  else if(routeName==='quiz'&&currentQuestion())void loadSolution41(currentQuestion().id);
 }catch(e){/* Preserve the current view and durable queue during reconnection. */}
});
void init();
