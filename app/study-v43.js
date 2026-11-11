'use strict';
// Current-edition practice is distinct from earned lesson completion.
function attemptVersion43(a,q){return q.revision?String(a.answer).startsWith(q.revision+':'):!/^v\d+:/.test(String(a.answer))}
function passedCurrent43(id){const q=qidMap[id];return !!q&&S.attempts.some(a=>a.qid===id&&(a.correct===1||a.self_pass===1)&&attemptVersion43(a,q))}
function solutionKey43(q){return q.id+'@'+(q.revision||'legacy')}
function draftField43(q){return q.draft_field||(q.revision?'choice420':'answer')}
function draftAnswer43(q,d){return d[draftField43(q)]}
function sourceCaption43(q){return q.code_language==='powershell'?'PowerShell · 命令阅读':q.code_language==='makefile'?'Makefile · 构建规则':q.type==='fill'?'C · 填空片段':'C · 阅读示例'}
function sourceName43(q){return q.code_language==='powershell'?q.id+'.ps1':q.code_language==='makefile'?'Makefile':q.id+'.c'}
function restoreTrace43(l,r){
 if(!l.trace43)return Math.min(Number(r.traceStep)||0,l.steps.length-1);
 const id=r.tracePosition43?.step;
 if(id){const index=l.trace43.findIndex(s=>s.id===id);if(index>=0)return index}
 if(r.traceStep==null)return 0;
 const mapped=l.trace_legacy_map43?.[Math.min(Number(r.traceStep)||0,(l.trace_legacy_map43?.length||1)-1)];
 return Math.max(0,l.trace43.findIndex(s=>s.id===mapped));
}
function saveTrace43(l){const index=tracePositions[l.id]||0;patch('lesson:'+l.id,{traceStep:index,tracePosition43:{revision:l.trace_revision,step:l.trace43?.[index]?.id}})}
function knowledgeHTML43(l){
 if(!l.new_terms?.length)return '';
 return `<section class="new-knowledge"><header><span class="overline">先把新写法认清楚</span><h2>认识这几个知识点</h2><p>点开「基本用法」，看清每个位置填什么，再对照带注释的小例子。</p></header>${l.new_terms.map((t,i)=>{
  const id='usage-'+l.id+'-'+i,u=t.usage;
  return `<article class="syntax-card"><div class="syntax-meta"><code>${esc(t.term)}</code><small>${esc(t.location)}</small></div><p>${rich(t.meaning)}</p>${u?`<button class="syntax-trigger" type="button" data-usage42="${id}" aria-expanded="false" aria-controls="${id}">基本用法 <span aria-hidden="true">›</span></button><aside class="syntax-panel" id="${id}" aria-labelledby="${id}-title" hidden><header><h3 id="${id}-title">${esc(t.term)}</h3><button class="syntax-close" type="button" data-close-usage42 aria-label="关闭基本用法">×</button></header><p class="usage-purpose">${rich(u.purpose||t.meaning)}</p><p class="syntax-label">先认格式</p><pre><code>${esc(u.format)}</code></pre><p class="small-text muted">格式里的占位名称要换成自己的变量、值或语句。</p><ol class="usage-parts">${u.parts.map(x=>`<li>${rich(x)}</li>`).join('')}</ol><p class="syntax-label">对照中文注释读一遍</p><p class="small-text muted">${esc(u.example_context||'下面是本知识点的独立片段。')}</p><pre class="annotated-example"><code>${esc(u.example)}</code></pre>${u.outcome?`<p class="usage-result"><strong>这段会怎样</strong>${esc(u.outcome)}</p>`:''}${u.walk?.length?`<details class="usage-walk"><summary>逐句再讲一遍 <span>＋</span></summary>${u.walk.map(x=>`<article><code>${esc(x.code)}</code><p>${rich(x.explain)}</p></article>`).join('')}</details>`:''}<p class="syntax-tip"><strong>容易弄错的地方</strong> ${rich(u.caution)}</p></aside>`:''}</article>`;
 }).join('')}${l.review_terms43?.length?`<p class="small-text muted">这里还会用到${l.review_terms43.map(t=>`<a href="${review42()?reviewHref42(t.lesson,0,review42().back):'#/lesson/'+t.lesson}">${esc(t.term)}的前置介绍</a>`).join('、')}。</p>`:''}</section>`;
}
function detailedCode43(l){
 return (l.safety_note43?`<aside class="notice"><strong>保护程序，先看这一点</strong><p>${rich(l.safety_note43)}</p></aside>`:'')+(l.line_guide43?.length?`<details class="line-guide43"><summary>逐句读代码 · 每条语句在做什么 <span>＋</span></summary><p>可以先看主例，再挑没看懂的语句对照。不需要一次记住所有写法。</p>${l.line_guide43.map(x=>`<article><code>${esc(x.code)}</code><p>${rich(x.explain)}</p></article>`).join('')}</details>`:'');
}
function safetyHTML43(l){
 return l.safety_examples?.length?`<section class="safety-lessons43"><h2>让程序出错时也有处理办法</h2>${l.safety_examples.map(s=>`<details><summary>${esc(s.title)} <span>＋</span></summary><p>${rich(s.reason)}</p>${codeBlock(s.code,l.id+'-checked.c','C · 检查失败与完整处理')}${s.steps?.length?`<ol>${s.steps.map(x=>`<li>${rich(x)}</li>`).join('')}</ol>`:''}</details>`).join('')}</section>`:'';
}
function readingLinks43(l){
 const items=l.coverage43||[],seen=new Set(),links=[];
 for(const item of items){for(const id of [item.reading,...(item.practice||[])]){if(id&&qidMap[id]?.code&&!seen.has(id)){seen.add(id);links.push(id)}}}
 if(l.reading_question43&&!seen.has(l.reading_question43))links.unshift(l.reading_question43);
 return `<section class="reading-checks43"><h2>换一段代码，检查是否读懂</h2><p>这里的题与上面的主例分开。可以先选知识点读代码，再去练习页作答；阅读不会替你提交答案。</p>${links.map(id=>{const q=qidMap[id];return `<details><summary>${esc(q.display_title||q.prompt)} <span>＋</span></summary>${q.code?codeBlock(q.code,q.id+'-reading.c','C · 独立阅读练习'):''}<p>${rich(q.task||q.prompt)}</p>${button('#/quiz/question/'+id,'打开这道题','secondary small','')}</details>`}).join('')}</section>`;
}
function traceState43(s){
 const names=Array.from(new Set([...Object.keys(s.before),...Object.keys(s.after)]));
 return `<div class="trace-state43 table-wrap"><table><thead><tr><th>变量所属调用</th><th>名字</th><th>执行前</th><th>执行后</th></tr></thead><tbody>${names.map(frame=>{const before=s.before[frame]||{},after=s.after[frame]||{};return Array.from(new Set([...Object.keys(before),...Object.keys(after)])).map(name=>`<tr class="${before[name]!==after[name]?'state-changed43':''}"><th scope="row">${esc(frame)}</th><td><code>${esc(name)}</code></td><td>${esc(before[name]??'尚未进入或声明')}</td><td>${esc(after[name]??'已离开此作用域')}</td></tr>`).join('')}).join('')||'<tr><td colspan="4">这一步尚未建立可读取的局部变量。</td></tr>'}</tbody></table></div>`;
}
traceHTML=function(l){
 const n=Math.min(tracePositions[l.id]||0,l.steps.length-1),s=l.trace43?.[n];
 if(!s)return '<p>这段示例暂无细步骤。</p>';
 return `<div class="trace-top"><span>固定输入 · 逐句推演</span><strong>${n+1} / ${l.trace43.length}</strong></div><div class="trace-code"><span>${esc(s.title)}</span><pre><code>${highlight(s.code)}</code></pre></div><div class="trace-body trace-detail43" aria-live="polite"><p class="trace-decision43">${s.condition===true?'条件为真，进入对应路径':s.condition===false?'条件为假，跳过对应路径':'执行这条语句'}</p><p>${esc(s.explain)}</p>${traceState43(s)}<div class="trace-output43"><strong>到这一步，屏幕上已有</strong><pre>${esc(s.output||'（还没有输出）')}</pre></div></div><div class="trace-actions"><span class="small-text muted">先看变化，再点下一步</span><div class="button-row"><button data-action="trace-prev" data-id="${l.id}" ${n===0?'disabled':''}>← 上一步</button><button data-action="trace-next" data-id="${l.id}" ${n===l.trace43.length-1?'disabled':''}>下一步 →</button></div></div><details class="full-trace43"><summary>展开完整执行表 <span>＋</span></summary><div class="table-wrap"><table><thead><tr><th>步骤</th><th>正在执行</th><th>变量变化</th><th>逻辑走向</th><th>已有输出</th></tr></thead><tbody>${l.trace43.map((r,i)=>`<tr><td>${i+1}</td><td><code>${esc(r.code)}</code></td><td>${r.changes.map(esc).join('<br>')||'已列变量不变'}</td><td>${esc(r.explain)}</td><td><pre>${esc(r.output||'（无）')}</pre></td></tr>`).join('')}</tbody></table></div></details>`;
};
function historyHTML43(q){
 if(!q.previous_revisions?.length)return '';
 return `<div class="edition-note43"><p>${passed41(q.id)&&!passedCurrent43(q.id)?'旧版已通过，课程完成资格仍保留。这一版可以单独补练。':esc(q.content_note||'题目已更新，旧作答仍保留。')}</p><details data-history43="${q.id}"><summary>旧版题目与历史作答 <span>＋</span></summary><div class="history-content43">展开后读取旧版题目。</div></details></div>`;
}
document.addEventListener('toggle',async e=>{
 const el=e.target;if(!el.matches?.('[data-history43]')||!el.open||el.dataset.loaded)return;
 const id=el.dataset.history43,container=el.querySelector('.history-content43');container.textContent='正在读取旧版…';
 try{
  const r=await post('question-history',{qid:id});
  if(!el.isConnected)return;
  container.innerHTML=r.result.versions.map(v=>{
   const q=v.question,attempts=S.attempts.filter(a=>a.qid===id&&(v.revision==='legacy'?!/^v\d+:/.test(String(a.answer)):String(a.answer).startsWith(v.revision+':'))),draft=rec('draft:'+id),oldDraft=draft[v.revision==='v420'?'choice420':'answer'],pending=Object.entries(draft).filter(([key,value])=>key.startsWith('legacy_submission430_')&&(value.revision||'legacy')===v.revision);
   return `<article><h3>旧版 ${esc(v.revision==='legacy'?'原题':v.revision)}</h3><p>${rich(q.task||q.prompt)}</p>${q.code?codeBlock(q.code,id+'-previous.c','C · 旧版题目代码'):''}${q.options?`<ol type="A">${q.options.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>`:''}<p class="small-text">此版本保留 ${attempts.length} 次历史作答${v.unlocked?'，曾经通过。':'。'}</p>${oldDraft!=null?`<details><summary>保留的旧版草稿</summary><pre class="historical-answer43">${esc(q.type==='choice'?(('ABCD'[Number(oldDraft)]||'')+'. '+(q.options[Number(oldDraft)]||oldDraft)):oldDraft)}</pre></details>`:''}${pending.map(([,a])=>`<details><summary>升级前待提交内容 · 已保留，未按新版判分</summary><pre class="historical-answer43">${esc(q.type==='choice'?(('ABCD'[Number(a.answer)]||'')+'. '+(q.options[Number(a.answer)]||a.answer)):a.answer)}</pre></details>`).join('')}${attempts.slice(-5).map(a=>{const answer=String(a.answer).replace(/^v\d+:/,'');return `<details><summary>${fmtTime(a.saved_at)} · ${a.correct===1||a.self_pass===1?'已通过':'待复习'}</summary><pre class="historical-answer43">${esc(q.type==='choice'?('ABCD'[Number(answer)]||'')+'. '+(q.options[Number(answer)]||answer):answer)}</pre></details>`}).join('')}${v.unlocked?`<details><summary>回看已通过旧题的答案</summary>${q.type==='program'?codeBlock(v.solution.reference||'',id+'-old-reference.c','C · 旧题参考答案'):`<pre>${esc(q.type==='choice'?('ABCD'[Number(v.solution.answer)]+'. '+q.options[Number(v.solution.answer)]):v.solution.answer)}</pre>`}</details>`:'<p class="small-text muted">旧版未通过，保留题目与提交记录，完整解答仍不公开。</p>'}</article>`;
  }).join('');el.dataset.loaded='1';
 }catch(error){container.textContent='旧版暂时没读出，请收起后再展开重试。'}
},true);
