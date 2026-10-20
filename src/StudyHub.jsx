import React,{useCallback,useEffect,useState} from 'react';

const ACCEPT=['image/png','image/jpeg','image/webp','application/pdf'];
const MAX_BYTES=10*1024*1024;
export default function StudyHub({db,member,session}){
 const [classes,setClasses]=useState([]),[folders,setFolders]=useState([]),[materials,setMaterials]=useState([]);
 const [selected,setSelected]=useState(''),[folder,setFolder]=useState(''),[newClass,setNewClass]=useState(''),[newFolder,setNewFolder]=useState('');
 const [title,setTitle]=useState(''),[body,setBody]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const canEdit=['admin','parent','student'].includes(member.role),family=member.family_id,uid=session.user.id;
 const refresh=useCallback(async()=>{
  const [a,b,c]=await Promise.all(['study_classes','study_folders','study_materials'].map(t=>db.from(t).select('*').eq('family_id',family).order('created_at',{ascending:false})));
  const failure=[a,b,c].find(x=>x.error);if(failure){setError(failure.error.message);return}
  setClasses(a.data||[]);setFolders(b.data||[]);setMaterials(c.data||[]);
 },[db,family]);
 useEffect(()=>{refresh()},[refresh]);
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
 const visible=materials.filter(m=>m.class_id===selected&&(!folder||m.folder_id===folder));
 return <section className="study-hub">
  <article><h2>📚 Study Hub</h2><p className="muted">Organize notes, screenshots and worksheets by class. AI guides and quizzes are coming next.</p>
  {error&&<p className="warning" role="alert">{error}</p>}{message&&<p className="success" role="status">{message}</p>}
  <div className="study-class-list">{classes.map(c=><button key={c.id} className={'subtle '+(selected===c.id?'study-selected':'')} onClick={()=>{setSelected(c.id);setFolder('')}}>{c.name}</button>)}</div>
  {canEdit&&<form onSubmit={addClass} className="study-inline"><input aria-label="New class name" placeholder="New class (e.g. Biology)" maxLength="100" value={newClass} onChange={e=>setNewClass(e.target.value)}/><button className="primary">Add class</button></form>}
  {!selected&&<p className="empty">Choose a class to view materials.</p>}
  </article>
  {selected&&<div className="grid">
   <article><h2>Folders</h2><button className={'subtle '+(!folder?'study-selected':'')} onClick={()=>setFolder('')}>All materials</button>
    {folders.filter(f=>f.class_id===selected).map(f=><button key={f.id} className={'subtle '+(folder===f.id?'study-selected':'')} onClick={()=>setFolder(f.id)}>📁 {f.name}</button>)}
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
