'use strict';

function groupHref42(mode,id,qid){
 return '#/quiz/'+mode+'/'+id+(qid?'/'+qid:'');
}
function reviewHref42(id,stage,back){
 return '#/lesson/'+id+'/review/'+stage+'/'+back.slice('#/quiz/'.length);
}
function review42(){
 const m=location.hash.match(/^#\/lesson\/(l\d{2})\/review\/([0-3])\/([a-z0-9/-]+)$/);
 return m?{id:m[1],stage:Number(m[2]),back:'#/quiz/'+m[3]}:null;
}
function reviewLinks42(q,z){
 const l=lesson(q.lesson),back=z.positionKey?groupHref42(z.mode,z.lessonId,q.id):'#/quiz/question/'+q.id;
 const peers=C.lessons.filter(x=>x.chapter===l.chapter&&x.id!==l.id);
 return `<nav class="quiz-review" aria-label="回看课程"><span>做题时也可以回看</span>${['概念讲解','代码示例','执行过程','课后题列表'].map((name,i)=>`<a href="${reviewHref42(l.id,i,back)}">${name}</a>`).join('')}${peers.length?`<details><summary>本章其他课</summary><div>${peers.map(x=>`<a href="${reviewHref42(x.id,0,back)}">${esc(x.title)}</a>`).join('')}</div></details>`:''}</nav>`;
}
function questionType42(q){
 if(q.type==='choice')return ['成立','正确'].includes(q.options[0])&&q.options.length===2?'判断题':'单选题';
 return {program:'编程题',output:'读代码',fill:'补全代码'}[q.type]||'知识练习';
}
function hintHTML42(q,count){
 return count?`<ol class="hint-box">${q.hints.slice(0,count).map(h=>`<li>${rich(h)}</li>`).join('')}</ol>`:'';
}
function hintLabel42(count){
 return ['看提示 1 · 从哪开始','看提示 2 · 再想一步','两条提示已展开'][Math.min(2,count)];
}
function showHint42(q,b){
 if(!q)return;
 const key='draft:'+q.id,count=Math.min(2,(rec(key).hints420||0)+1);
 patch(key,{hints420:count});
 $('#question-hints').innerHTML=hintHTML42(q,count);
 b.textContent=hintLabel42(count);
 b.disabled=count===2;
}
function quizMap42(z){
 if(!z.positionKey)return `<div class="quiz-progress"><span style="transform:scaleX(${(z.index+1)/z.ids.length})"></span></div>`;
 const passes=new Set(z.ids.filter(passedCurrent43)),done=passes.size;
 return `<div class="quiz-progress" aria-hidden="true"><span style="transform:scaleX(${done/z.ids.length})"></span></div><nav class="quiz-map" aria-label="本组题目"><span>已通过 <strong>${done} / ${z.ids.length}</strong></span><div>${z.ids.map((id,i)=>`<button type="button" data-question42="${i}" class="${passes.has(id)?'is-passed':''}" ${i===z.index?'aria-current="step"':''} aria-label="第 ${i+1} 题，${passes.has(id)?'已通过':'待通过'}">${i+1}${passes.has(id)?'<small aria-hidden="true">✓</small>':''}</button>`).join('')}</div></nav>`;
}
function quizActions42(z,q){
 const prev=`<button class="text-button" data-action="quiz-prev" ${z.index===0?'disabled':''}>‹ 上一题</button>`;
 const last=z.index===z.ids.length-1;
 if(!z.positionKey)return prev+`<button class="button secondary" data-action="quiz-next">${last?'查看本组结果':'下一题 ›'}</button>`;
 if(!passedCurrent43(q.id))return prev+'<span class="small-text muted">通过本题后，这里会出现下一步。上方题号可直接选择。</span>';
 const unfinished=z.ids.findIndex(id=>!passedCurrent43(id));
 if(!last)return prev+'<button class="button" data-action="quiz-next">下一题 ›</button>';
 if(z.mode==='homework'&&unfinished>=0)return prev+`<button class="button" data-question42="${unfinished}">继续未完成题 ›</button>`;
 return prev+'<button class="button" data-action="quiz-next">查看本组结果 ›</button>';
}
function homeworkEnd42(z){
 if(z.index!==z.ids.length-1)return '';
 const l=lesson(z.lessonId);
 return homeworkPassed(l)===z.ids.length?nextHomework(l):'';
}
function refreshQuizActions42(){
 const z=currentQuiz,bar=$('#quiz-actions'),map=$('.quiz-map');
 if(bar)bar.innerHTML=quizActions42(z,currentQuestion());
 const finish=$('#quiz-homework-finish');
 if(finish)finish.innerHTML=homeworkEnd42(z);
 if(map){
  const progress=$('.quiz-progress');
  progress.insertAdjacentHTML('beforebegin',quizMap42(z));
  progress.remove();
  map.remove();
 }
}
function openQuestion42(index){
 const z=currentQuiz;
 if(!z||!Number.isInteger(index)||index<0||index>=z.ids.length||index===z.index&&!z.completed)return;
 flushTimers();
 z.index=index;
 z.completed=false;
 z.scroll=0;
 saveQuizPosition();
 codeMap.clear();
 $('#main').innerHTML=renderQuiz();
 window.scrollTo(0,0);
 const heading=$('.quiz-heading h1');
 if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true})}
 void loadSolution41(currentQuestion().id);
}
function groupSummary42(z){
 const l=lesson(z.lessonId),done=z.ids.filter(passed41).length,unfinished=z.ids.findIndex(id=>!passedCurrent43(id));
 return `<section class="quiz group-summary"><div class="quiz-top"><a href="#/practice">‹ 练习中心</a><span>${esc(z.title)}</span></div><header class="page-heading"><span class="overline">本组进度</span><h1>${done===z.ids.length?'这组题都通过了':'这次练到这里'}</h1><p>已通过 ${done} / ${z.ids.length} 题${z.mode==='daily'?'。日常题可以按需选练。':'。已通过的题可以随时回看。'}</p></header>${questionRows(z.ids,z.mode,l.id)}<div class="button-row">${unfinished>=0?`<button class="button" data-question42="${unfinished}">继续未完成题 ›</button>`:''}${button('#/lesson/'+l.id,'回到本课','secondary','')}${button('#/practice','返回练习中心','secondary','')}</div>${z.mode==='homework'?nextHomework(l):''}</section>`;
}

const practiceOpen42=new Set();
let practiceMode42='daily',practiceScroll42=0,practiceProgress42='all';
function capturePractice42(){
 if(routeName!=='practice')return;
 for(const el of document.querySelectorAll('[data-practice-panel]')){
  if(el.open)practiceOpen42.add(el.dataset.practicePanel);
  else practiceOpen42.delete(el.dataset.practicePanel);
 }
 practiceScroll42=window.scrollY;
}
function restorePractice42(){
 if(routeName==='practice')window.scrollTo(0,practiceScroll42);
}
function renderDaily(){
 const homework=practiceMode42==='homework',passes=passes41();
 const lessons=C.lessons.filter(l=>l.track===dailyTrack);
 const groups=lessons.map(l=>{
  const ids=homework?l.homework_ids:l.daily_ids;
  const matching=ids.filter(id=>(homework||dailyCategory==='全部'||qidMap[id].category===dailyCategory)&&(practiceProgress42==='all'||!passes.has(id)));
  return {l,ids,matching,done:ids.filter(id=>passes.has(id)).length};
 }).filter(g=>g.matching.length);
 const trackTabs=[['core','课内主线'],['security','网安 C'],['work','工程 C']];
 return `<section class="daily-practice practice-center"><header class="page-heading"><h1>练习中心</h1><p>做完课后必做题，再按知识点选几道日常题巩固。</p></header>
 <div class="practice-controls">
 <div class="segmented" role="group" aria-label="练习类型">${[['daily','日常选练'],['homework','课后必做']].map(([id,label])=>`<button data-practice-mode="${id}" aria-pressed="${practiceMode42===id}">${label}</button>`).join('')}</div>
 <div class="segmented" role="group" aria-label="课程分类">${trackTabs.map(([id,label])=>`<button data-v4-track="${id}" aria-pressed="${dailyTrack===id}">${label}</button>`).join('')}</div>
 </div><div class="daily-filter"><div>${homework?'':`<label>题目分类 <select id="daily-category">${['全部','概念辨析','边界排错','规则迁移','综合编程'].map(x=>`<option ${dailyCategory===x?'selected':''}>${x}</option>`).join('')}</select></label>`}<label>题目状态 <select id="practice-progress"><option value="all">全部</option><option value="todo" ${practiceProgress42==='todo'?'selected':''}>待通过</option></select></label></div><span>${homework?'每课 5 道 · 通过后可点下一课':'每课 8 道 · 可按分类自由选题'}</span></div>
 ${groups.length?groups.map(({l,ids,matching,done})=>{
  const key=practiceMode42+'-'+l.id,first=matching.find(id=>!passes.has(id))||matching[0];
  return `<details class="daily-lesson" data-practice-panel="${key}" ${practiceOpen42.has(key)?'open':''}><summary><span class="practice-topic"><strong>${esc(l.practice_title||l.title)}</strong><small>${esc(l.title)}</small></span><span class="practice-count">${done} / ${ids.length} 已通过${matching.length<ids.length?' · 显示 '+matching.length+' 题':''}<span aria-hidden="true">＋</span></span></summary><div class="practice-group-tools">${button(groupHref42(practiceMode42,l.id,first),done===ids.length?'回看本课练习':done?'继续未完成题':'开始练习','secondary small','')}</div>${questionRows(matching,practiceMode42,l.id,ids)}</details>`;
 }).join(''):'<p class="notice">这个筛选条件下没有题目。可以切换题目状态或分类。</p>'}
 <details class="legacy-practice" data-practice-panel="legacy" ${practiceOpen42.has('legacy')?'open':''}><summary>综合复习、入门诊断与错题 ＋</summary>${renderPracticeLegacy()}</details><details class="extra practice-sources"><summary>教材对照与课外题源 <span>＋</span></summary>${C.practice_sources.map(r=>`<a href="${r.url}" target="_blank" rel="noreferrer">${esc(r.title)} ↗</a>`).join('')}</details></section>`;
}
function redrawPractice42(focusSelector){
 capturePractice42();
 $('#main').innerHTML=renderDaily();
 $(focusSelector)?.focus({preventScroll:true});
 restorePractice42();
}
document.addEventListener('click',e=>{
 const step=e.target.closest('[data-question42]');
 if(step){openQuestion42(Number(step.dataset.question42));return}
 const tab=e.target.closest('[data-practice-mode],[data-v4-track]');
 if(!tab)return;
 if(tab.dataset.practiceMode)practiceMode42=tab.dataset.practiceMode;
 if(tab.dataset.v4Track)dailyTrack=tab.dataset.v4Track;
 const attr=tab.hasAttribute('data-v4-track')?'data-v4-track':'data-practice-mode';
 redrawPractice42('['+attr+'="'+tab.getAttribute(attr)+'"]');
});
document.addEventListener('change',e=>{
 if(e.target.id==='daily-category')dailyCategory=e.target.value;
 else if(e.target.id==='practice-progress')practiceProgress42=e.target.value;
 else return;
 redrawPractice42('#'+e.target.id);
});

let activeUsage42=null;
function knowledgeHTML(l){return knowledgeHTML43(l)}
function closeUsage42(restore=false){
 if(!activeUsage42)return;
 const {trigger,panel}=activeUsage42;
 panel.hidden=true;
 trigger.setAttribute('aria-expanded','false');
 activeUsage42=null;
 if(restore&&trigger.isConnected)trigger.focus({preventScroll:true});
}
function placeUsage42(){
 if(!activeUsage42)return;
 const {panel,trigger}=activeUsage42;
 if(!trigger.isConnected){closeUsage42();return}
 if(matchMedia('(max-width: 780px)').matches)return;
 const rect=trigger.getBoundingClientRect(),width=panel.offsetWidth,height=panel.offsetHeight;
 if(rect.bottom<0||rect.top>innerHeight){closeUsage42();return}
 const toRight=rect.right+12+width<=innerWidth-16;
 panel.style.left=Math.max(16,toRight?rect.right+12:rect.left-width-12)+'px';
 panel.style.top=Math.max(16,Math.min(rect.top-8,innerHeight-height-16))+'px';
}
document.addEventListener('click',e=>{
 const trigger=e.target.closest('[data-usage42]');
 if(trigger){
  const wasOpen=activeUsage42?.trigger===trigger;
  closeUsage42();
  if(!wasOpen){
   const panel=document.getElementById(trigger.dataset.usage42);
   activeUsage42={trigger,panel};
   panel.hidden=false;
   trigger.setAttribute('aria-expanded','true');
   placeUsage42();
   panel.querySelector('button').focus({preventScroll:true});
   if(matchMedia('(max-width: 780px)').matches)panel.scrollIntoView({block:'nearest'});
  }
 }else if(e.target.closest('[data-close-usage42]'))closeUsage42(true);
 else if(activeUsage42&&!activeUsage42.panel.contains(e.target))closeUsage42();
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&activeUsage42){e.preventDefault();closeUsage42(true)}
});
window.addEventListener('resize',placeUsage42);
window.addEventListener('scroll',placeUsage42,{passive:true});
window.addEventListener('hashchange',()=>closeUsage42());

