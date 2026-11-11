'use strict';

const editorIndent='    ';
const exitEditorWithTab=new WeakSet();

function replaceEditorText(editor,start,end,replacement,selectionStart,selectionEnd=selectionStart){
 const before=editor.value;
 const expected=before.slice(0,start)+replacement+before.slice(end);
 if(expected===before)return;
 const direction=editor.selectionDirection;
 editor.setSelectionRange(start,end);
 // A native text edit participates in the textarea's Undo history.
 if(replacement)document.execCommand('insertText',false,replacement);
 else document.execCommand('delete',false);
 if(editor.value!==expected){
  editor.value=expected;
  editor.dispatchEvent(new Event('input',{bubbles:true}));
 }
 editor.setSelectionRange(selectionStart,selectionEnd,direction);
}

function enterInCode(editor){
 const {value,selectionStart:start,selectionEnd:end}=editor;
 const before=value.slice(0,start);
 const line=before.slice(before.lastIndexOf('\n')+1);
 const indentation=line.match(/^[ \t]*/)[0];
 // Ignore braces inside comments, literals and continued preprocessor lines.
 const ignored=/^[ \t]*#(?:\\\n|\\[^\n]|[^\n\\])*|\/\/(?:\\\n|\\[^\n]|[^\n\\])*|\/\*[\s\S]*?(?:\*\/|(?![\s\S]))|"(?:\\[\s\S]|[^"\\\n])*(?:"|(?=\n|$))|'(?:\\[\s\S]|[^'\\\n])*(?:'|(?=\n|$))/gm;
 const code=before.replace(ignored,token=>{
  const mask=token.replace(/[^\n]/g,' ');
  return token.startsWith('"')||token.startsWith("'")?'x'+mask.slice(1):mask;
 });
 const context=code.slice(code.lastIndexOf('\n')+1).trimEnd();
 const opensBlock=context.endsWith('{');
 const opensCase=/^[ \t]*(?:case\s+.+|default)\s*:$/.test(context);
 const nextIndent=indentation+(opensBlock||opensCase?editorIndent:'');
 const nextLine='\n'+nextIndent;
 const closing=value.slice(end).match(/^[ \t]*(?=})/);
 if(opensBlock&&closing){
  replaceEditorText(editor,start,end+closing[0].length,nextLine+'\n'+indentation,start+nextLine.length);
 }else{
  replaceEditorText(editor,start,end,nextLine,start+nextLine.length);
 }
}

function tabInCode(editor,outdent){
 const {value,selectionStart:start,selectionEnd:end}=editor;
 if(start===end&&!outdent){
  replaceEditorText(editor,start,end,editorIndent,start+editorIndent.length);
  return;
 }
 const lineStart=value.slice(0,start).lastIndexOf('\n')+1;
 const endAtNextLine=end>start&&value[end-1]==='\n';
 const nextBreak=value.indexOf('\n',endAtNextLine?end-1:end);
 const lineEnd=nextBreak<0?value.length:nextBreak;
 const originalLines=value.slice(lineStart,lineEnd).split('\n');
 const editedLines=originalLines.map(line=>outdent?line.replace(/^(?:\t| {1,4})/,''):editorIndent+line);
 const replacement=editedLines.join('\n');
 const firstDelta=editedLines[0].length-originalLines[0].length;
 const lastLineStart=lineStart+replacement.lastIndexOf('\n')+1;
 const delta=replacement.length-(lineEnd-lineStart);
 const newStart=start===lineStart?lineStart:Math.max(lineStart,start+firstDelta);
 const newEnd=start===end?newStart:endAtNextLine?end+delta:Math.max(lastLineStart,end+delta);
 replaceEditorText(editor,lineStart,lineEnd,replacement,newStart,newEnd);
}

document.addEventListener('keydown',event=>{
 const editor=event.target;
 if(!editor.matches?.('#quiz-answer.program')||event.isComposing||event.keyCode===229)return;
 if(event.key==='Escape'){
  exitEditorWithTab.add(editor);
  return;
 }
 const exit=exitEditorWithTab.delete(editor);
 if(event.ctrlKey||event.metaKey||event.altKey||event.defaultPrevented)return;
 if(event.key==='Enter'){
  event.preventDefault();
  enterInCode(editor);
 }else if(event.key==='Tab'&&!exit){
  event.preventDefault();
  tabInCode(editor,event.shiftKey);
 }
});

document.addEventListener('click',async event=>{
 const control=event.target.closest('[data-format-code]');
 if(!control||control.disabled)return;
 const editor=$('#quiz-answer.program');
 if(!editor||!editor.value.trim())return toast('先写几行代码，再点整理。');
 const before=editor.value;
 const caret=new TextEncoder().encode(before.slice(0,editor.selectionEnd)).length;
 control.disabled=true;
 control.textContent='正在整理…';
 try{
  const {result}=await post('format-code',{code:before,cursor:caret});
  if(!editor.isConnected||updatePaused)return;
  if(editor.value!==before){
   toast('代码刚刚有改动，再点一次即可整理。');
   return;
  }
  const oldTop=editor.scrollTop,oldLeft=editor.scrollLeft;
  const previousFocus=document.activeElement;
  const bytes=new TextEncoder().encode(result.code);
  const nextCaret=new TextDecoder().decode(bytes.subarray(0,result.cursor)).length;
  editor.focus({preventScroll:true});
  replaceEditorText(editor,0,before.length,result.code,nextCaret);
  editor.scrollTop=oldTop;
  editor.scrollLeft=oldLeft;
  if(previousFocus&&previousFocus!==control&&previousFocus!==editor&&previousFocus!==document.body)previousFocus.focus({preventScroll:true});
  toast(before===result.code?'代码排版已经整齐。':'代码已整理，可以撤销。');
 }catch(error){
  if(editor.isConnected)toast(error.message);
 }finally{
  control.disabled=false;
  control.textContent='整理代码';
 }
});

