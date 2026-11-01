(() => {
 'use strict';
 let previewUrl=null;
 const release=()=>{if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}};
 function validate(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPG, PNG or WebP picture.');if(file.size>5*1024*1024)throw new Error('Choose a picture smaller than 5 MB.');}
 function fields(user){return `<section class="profile-photo-editor" aria-label="Your profile picture"><div id="profile-picture-preview">${window.ClubAvatar.render(user,true)}</div><div><label class="field">Profile picture<input type="file" name="profile_photo" id="profile-photo-file" accept="image/jpeg,image/png,image/webp"></label><p>JPG, PNG or WebP · up to 5 MB. Without a photo, your personal club avatar appears everywhere.</p>${user.avatar_path?'<label class="checkbox"><input type="checkbox" name="remove_avatar" id="profile-photo-remove"> Use my club avatar instead</label>':''}</div></section>`;}
 function bind(user){
  const input=document.getElementById('profile-photo-file'),remove=document.getElementById('profile-photo-remove'),target=document.getElementById('profile-picture-preview');
  const reset=()=>{release();target.innerHTML=window.ClubAvatar.render({...user,use_default_avatar:true},true);};
  input.onchange=()=>{release();const file=input.files[0],error=document.getElementById('form-error');error.textContent='';if(!file){target.innerHTML=window.ClubAvatar.render(user,true);return;}try{validate(file);if(remove)remove.checked=false;previewUrl=URL.createObjectURL(file);target.innerHTML=`<span class="initials club-avatar large"><img alt="Your selected profile picture" src="${previewUrl}"></span>`;}catch(e){input.value='';target.innerHTML=window.ClubAvatar.render(user,true);error.textContent=e.message;}};
  if(remove)remove.onchange=()=>{if(remove.checked){input.value='';reset();}else target.innerHTML=window.ClubAvatar.render(user,true);};
  document.getElementById('club-dialog').addEventListener('close',release,{once:true});
 }
 async function upload(form,user){
  const file=form.get('profile_photo');
  if(file&&file.size){validate(file);const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type],token=crypto.randomUUID().replaceAll('-',''),body=new FormData();body.set('path',user.id+'/avatar-'+token+'.'+extension);body.set('avatar',file);const saved=await window.api.request('/api/avatars.php',{method:'POST',body});return {avatar_path:saved.path};}
  return form.has('remove_avatar')?{avatar_path:null}:{};
 }
 window.ClubPhoto={fields,bind,upload};
})();
