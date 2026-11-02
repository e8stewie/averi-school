import React,{useCallback,useEffect,useState} from 'react';
import PracticeTests from './PracticeTests.jsx';

const ACCEPT=['image/png','image/jpeg','image/webp','application/pdf'];
const MAX_BYTES=10*1024*1024;
export default function StudyHub({db,member,session}){
 const [classes,setClasses]=useState([]),[folders,setFolders]=useState([]),[materials,setMaterials]=useState([]);
 const [selected,setSelected]=useState(''),[folder,setFolder]=useState(''),[newClass,setNewClass]=useState(''),[newFolder,setNewFolder]=useState('');
 const [title,setTitle]=useState(''),[body,setBody]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [guideIds,setGuideIds]=useState([]),[guide,setGuide]=useState(''),[generating,setGenerating]=useState(false),[guides,setGuides]=useState([]),[activeGuide,setActiveGuide]=useState(''),[guideExpanded,setGuideExpanded]=useState(false);
 const canEdit=['admin','parent','student'].includes(member.role),family=member.family_id,uid=session.user.id;
 const refresh=useCallback(async()=>{
  const [a,b,c]=await Promise.all(['study_classes','study_folders','study_materials'].map(t=>db.from(t).select('*').eq('family_id',family).order('created_at',{ascending:false})));
  const failure=[a,b,c].find(x=>x.error);if(failure){setError(failure.error.message);return}
  setClasses(a.data||[]);setFolders(b.data||[]);setMaterials(c.data||[]);
 },[db,family]);
 useEffect(()=>{refresh()},[refresh]);
 const refreshGuides=useCallback(async()=>{if(!selected){setGuides([]);return}const {data,error}=await db.from('study_guides').select('*').eq('family_id',family).eq('class_id',selected).order('created_at',{ascending:false});if(error)setError(error.message);else setGuides(data||[])},[db,family,selected]);
 useEffect(()=>{refreshGuides()},[refreshGuides]);
 const fail=e=>{setError(e.message||String(e));setMessage('')};
 async function addClass(e){e.preventDefault();if(!newClass.trim())return;const {error}=await db.from('study_classes').insert({name:newClass.trim(),family_id:family,student_id:uid});if(error)return fail(error);setNewClass('');await refresh()}
 async function addFolder(e){e.preventDefault();if(!selected||!newFolder.trim())return;const {error}=await db.from('study_folders').insert({name:newFolder.trim(),class_id:selected,family_id:family});if(error)return fail(error);setNewFolder('');await refresh()}
 async function saveNote(e){e.preventDefault();if(!selected||!title.trim()||!body.trim())return;const {error}=await db.from('study_materials').insert({class_id:selected,folder_id:folder||null,family_id:family,student_id:uid,title:title.trim(),kind:'note',body});if(error)return fail(error);setTitle('');setBody('');setMessage('Note saved');await refresh()}
 async function uploadFiles(files){
  if(!canEdit||!selected||busy)return;
  setError('');setMessage('');setBusy(true);
  try{
   for(const file of Array.from(files)){
    if(!ACCEPT.includes(file.type)||file.size>MAX_BYTES){throw new Error('Only PNG, JPG, WebP and PDF files up to 10 MB are allowed.')}
    const extension=({ 'image/png':'png','image/jpeg':'jpg','image/webp':'webp','application/pdf':'pdf'})[file.type];
    const path=family+'/'+uid+'/'+crypto.randomUUID()+'.'+extension;
    const {error:uploadError}=await db.storage.from('study-materials').upload(path,file,{contentType:file.type,upsert:false});if(uploadError)throw uploadError;
    const {error:recordError}=await db.from('study_materials').insert({class_id:selected,folder_id:folder||null,family_id:family,student_id:uid,title:file.name.slice(0,200),kind:'file',storage_path:path,mime_type:file.type});
    if(recordError){await db.storage.from('study-materials').remove([path]);throw recordError}
   }
   setMessage('Files uploaded');await refresh();
  }catch(e){fail(e)}finally{setBusy(false)}
 }
 async function viewFile(item){const {data,error}=await db.storage.from('study-materials').createSignedUrl(item.storage_path,60);if(error)return fail(error);window.open(data.signedUrl,'_blank','noopener,noreferrer')}
 async function removeMaterial(item){if(!window.confirm('Delete this material?'))return;if(item.storage_path){const {error:storageError}=await db.storage.from('study-materials').remove([item.storage_path]);if(storageError)return fail(storageError)}const {error}=await db.from('study_materials').delete().eq('id',item.id);if(error)return fail(error);await refresh()}
 async function optimizeImage(file,filename){
  const bitmap=await createImageBitmap(file);try{
   let scale=Math.min(1,2000/Math.max(bitmap.width,bitmap.height));
   for(let attempt=0;attempt<5;attempt++){
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image processing unavailable');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.82));if(blob&&blob.size<=3*1024*1024){return new File([blob],(filename||'study-photo').replace(/\\.[^.]+$/,'.jpg'),{type:'image/jpeg'})}scale*=0.75;
   }throw new Error('Could not optimize the image; try a smaller photo');
  }finally{bitmap.close()}
 }
 async function generateGuide(){if(!guideIds.length)return;setGenerating(true);setError('');setMessage('');setGuide('');try{const optimizedImages={};for(const id of guideIds){const material=materials.find(m=>m.id===id);if(!material||material.kind!=='file'||!material.mime_type?.startsWith('image/'))continue;const {data:original,error:downloadError}=await db.storage.from('study-materials').download(material.storage_path);if(downloadError)throw downloadError;if(original.size<=4*1024*1024)continue;const optimized=await optimizeImage(original,material.title);const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(optimized)});optimizedImages[id]=base64;}const {data,error}=await db.functions.invoke('generate-study-guide',{body:{classId:selected,materialIds:guideIds,optimizedImages}});if(error){let detail='';try{const response=error.context;if(response&&typeof response.json==='function'){const payload=await response.json();detail=payload?.error||''}}catch(_ignored){}throw new Error(detail||error.message)}if(data?.error)throw new Error(data.error);const generated=data.guide||'';if(!generated)throw new Error('Empty guide');const sourceNames=(data.sources||[]).map(s=>s.title).join(', ');const {data:saved,error:saveError}=await db.from('study_guides').insert({family_id:family,class_id:selected,created_by:uid,title:('Study guide: '+(sourceNames||'Selected notes')).slice(0,200),body:generated,source_material_ids:guideIds}).select('id').single();if(saveError)throw new Error('Guide generated but could not be saved: '+saveError.message);setGuide(generated);setActiveGuide(saved.id);setGuideExpanded(true);setMessage('Study guide generated and saved');await refreshGuides();}catch(e){fail(e)}finally{setGenerating(false)}}
 function printGuide(){if(!guide)return;const popup=window.open('','_blank');if(!popup){fail(new Error('Allow pop-ups to print the study guide.'));return}popup.document.title='Averi School — Study Guide';const style=popup.document.createElement('style');style.textContent='body{font:12pt/1.5 system-ui,Arial,sans-serif;max-width:800px;margin:36px auto;padding:0 18px;color:#111}h1{font-size:20pt}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}@media print{body{margin:0;max-width:none;padding:0}}';popup.document.head.appendChild(style);const heading=popup.document.createElement('h1');heading.textContent=guides.find(g=>g.id===activeGuide)?.title||'Study Guide';const body=popup.document.createElement('pre');body.textContent=guide;popup.document.body.append(heading,body);popup.focus();popup.print()}
 const visible=materials.filter(m=>m.class_id===selected&&(!folder||m.folder_id===folder));
 return <section className="study-hub">
  <article><h2>📚 Study Hub</h2><p className="muted">Organize notes, screenshots and worksheets by class. AI guides and quizzes are coming next.</p>
  {error&&<p className="warning" role="alert">{error}</p>}{message&&<p className="success" role="status">{message}</p>}
  <div className="study-class-list">{classes.map(c=><button key={c.id} className={'subtle '+(selected===c.id?'study-selected':'')} onClick={()=>{setSelected(c.id);setFolder('');setGuideIds([]);setGuide('');setActiveGuide('');setGuideExpanded(false)}}>{c.name}</button>)}</div>
  {canEdit&&<form onSubmit={addClass} className="study-inline"><input aria-label="New class name" placeholder="New class (e.g. Biology)" maxLength="100" value={newClass} onChange={e=>setNewClass(e.target.value)}/><button className="primary">Add class</button></form>}
  {!selected&&<p className="empty">Choose a class to view materials.</p>}
  </article>
  {selected&&<article><h2>✨ AI Study Guide (preview)</h2><p className="muted">Select up to 20 materials (notes, screenshots or PDFs) from this class or folder. AI processing supports up to 3 files, 4 MB each and 8 MB total. Larger files can still be stored, but must be reduced before AI processing. AI-generated content may contain mistakes; check against the originals.</p><div>{visible.map(m=><label className="check" key={m.id}><input type="checkbox" checked={guideIds.includes(m.id)} onChange={e=>setGuideIds(ids=>e.target.checked?[...ids,m.id].slice(0,20):ids.filter(id=>id!==m.id))}/>{m.kind==='file'?'📎 ':'📝 '}{m.title}</label>)}</div><button className="primary" disabled={generating||!guideIds.length} onClick={generateGuide}>{generating?'Generating…':'Generate study guide'}</button>{guides.length>0&&<div><h3>Saved study guides</h3>{guides.map(g=><div className="item" key={g.id}><button className="subtle" onClick={()=>{setGuide(g.body);setActiveGuide(g.id);setGuideExpanded(true)}}>{g.title} · {new Date(g.created_at).toLocaleString()}</button>{canEdit&&<button className="subtle" onClick={async()=>{const next=window.prompt('Rename study guide',g.title);if(next===null)return;const name=next.trim();if(!name||name.length>200){fail(new Error('Guide title must be 1–200 characters'));return}if(name===g.title)return;const {error}=await db.from('study_guides').update({title:name}).eq('id',g.id);if(error)return fail(error);setMessage('Study guide renamed');await refreshGuides()}}>Rename</button>}{canEdit&&<button className="subtle" onClick={async()=>{if(!window.confirm('Delete this saved guide?'))return;const {error}=await db.from('study_guides').delete().eq('id',g.id);if(error)return fail(error);if(activeGuide===g.id){setGuide('');setActiveGuide('')}await refreshGuides()}}>Delete guide</button>}</div>)}</div>}{guide&&<div className="item"><button className="subtle" aria-expanded={guideExpanded} onClick={()=>setGuideExpanded(v=>!v)}>{guideExpanded?'▾ Hide study guide':'▸ Show study guide'}</button>{guideExpanded&&<div><h3>Your study guide</h3><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{guide}</p></div>}<div className="row"><button className="subtle" onClick={()=>navigator.clipboard.writeText(guide)}>Copy guide</button><button className="subtle" onClick={printGuide}>Print guide</button></div></div>}</article>}
  {selected&&<PracticeTests db={db} member={member} session={session} classId={selected} guides={guides}/>}
  {selected&&<div className="grid">
   <article><h2>Folders</h2><button className={'subtle '+(!folder?'study-selected':'')} onClick={()=>{setFolder('');setGuideIds([]);setGuide('')}}>All materials</button>
    {folders.filter(f=>f.class_id===selected).map(f=><button key={f.id} className={'subtle '+(folder===f.id?'study-selected':'')} onClick={()=>{setFolder(f.id);setGuideIds([]);setGuide('')}}>📁 {f.name}</button>)}
    {canEdit&&<form onSubmit={addFolder} className="study-inline"><input aria-label="New folder name" placeholder="New unit or chapter" maxLength="100" value={newFolder} onChange={e=>setNewFolder(e.target.value)}/><button className="primary">Add folder</button></form>}
    <h3>Saved materials</h3>{visible.map(m=><div className="item" key={m.id}><b>{m.kind==='note'?'📝':'📎'} {m.title}</b>{m.kind==='note'?<p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{m.body}</p>:<button className="subtle" onClick={()=>viewFile(m)}>Open file</button>}{canEdit&&<button className="subtle" onClick={()=>removeMaterial(m)}>Delete</button>}</div>)}
    {!visible.length&&<p className="empty">No materials in this selection yet.</p>}
   </article>
   <article><h2>Add study materials</h2>{canEdit?<><form onSubmit={saveNote}><label className="field">Note title<input required maxLength="200" value={title} onChange={e=>setTitle(e.target.value)}/></label><label className="field">Notes<textarea required rows="6" value={body} onChange={e=>setBody(e.target.value)}/></label><button className="primary">Save note</button></form>
    <div className="study-drop" tabIndex="0" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();uploadFiles(e.dataTransfer.files)}} onPaste={e=>{const files=Array.from(e.clipboardData.files);if(files.length){e.preventDefault();uploadFiles(files)}}}>
     <strong>Drop files or paste a screenshot here</strong><p className="muted">Click this area and press Command+V (Mac) or Ctrl+V (Windows).</p><label className="subtle study-upload">Choose files<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" multiple hidden disabled={busy} onChange={e=>{uploadFiles(e.target.files);e.target.value=''}}/></label><p className="muted">PNG, JPG, WebP or PDF · 10 MB maximum each</p>{busy&&<p>Uploading…</p>}
    </div></>:<p className="muted">You do not have permission to edit study materials.</p>}</article>
  </div>}
 </section>
}
