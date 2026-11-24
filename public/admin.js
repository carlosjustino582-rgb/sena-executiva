'use strict';let csrf='',identity=null,articles=[];const $=s=>document.querySelector(s);const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(url,method='GET',data){const isFormData=data instanceof FormData;const r=await fetch(url,{method,headers:{...(isFormData?{}:{'Content-Type':'application/json'}),'X-CSRF-Token':csrf},body:data===undefined?undefined:(isFormData?data:JSON.stringify(data))});const x=await r.json();if(!r.ok)throw Error(x.error||'Erro na operação');return x}
const navItems=[['dashboard','Resumo'],['articles','Artigos'],['ads','Publicidade'],['sponsored','Patrocinado'],['partners','Parceiros'],['slides','Carrossel'],['categories','Categorias'],['contacts','Contactos'],['subscribers','Newsletter'],['settings','Configurações'],['users','Utilizadores']];
function show(id){document.querySelectorAll('.section').forEach(x=>x.classList.toggle('active',x.id===id));document.querySelectorAll('[data-nav]').forEach(x=>x.classList.toggle('active',x.dataset.nav===id));load(id).catch(e=>alert(e.message))}
function init(){for(const box of ['#nav','#navMobile'])$(box).innerHTML=navItems.filter(x=>x[0]!=='users'||identity.role==='admin').map(([id,name])=>`<button data-nav="${id}">${name}</button>`).join('');document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>show(b.dataset.nav));$('#userBadge').textContent=identity.name+' · '+identity.role;$('#login').classList.add('hide');$('#app').classList.remove('hide');show('dashboard')}
async function load(id){if(id==='ads')return loadAds();if(id==='partners')return loadPartners();if(id==='sponsored')return loadSpons();if(id==='categories')return loadCats();if(id==='slides')return loadSlides();if(id==='articles')await fillCats();if(id==='dashboard'){const d=await api('/api/admin/dashboard');const n=k=>(d.articles.find(x=>x.status===k)||{}).n||0;$('#stats').innerHTML=[['Artigos publicados',n('published')],['Rascunhos',n('draft')],['Contactos recebidos',d.contacts.reduce((a,c)=>a+c.n,0)],['Subscritores',d.subscribers]].map(([k,v])=>`<div class="metric"><span>${k}</span><strong>${v}</strong></div>`).join('');$('#audit').innerHTML=d.recent.length?`<table>${d.recent.map(x=>`<tr><td>${esc(x.created_at)}</td><td>${esc(x.action)}</td><td>${esc(x.entity)}</td></tr>`).join('')}</table>`:'<p class="muted">Ainda não existem operações registadas.</p>'}
if(id==='articles'){articles=await api('/api/admin/articles');$('#articleRows').innerHTML=articles.map(a=>`<tr><td><strong>${esc(a.title)}</strong><div class="muted">/${esc(a.slug)}</div></td><td>${esc(a.category)}</td><td><span class="pill ${a.status}">${esc(a.status)}</span></td><td>${esc(a.updated_at)}</td><td><div class="actions"><button class="btn secondary small" data-edit="${a.id}">Editar</button><button class="btn warn small" data-delete="${a.id}">Eliminar</button></div></td></tr>`).join('');document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>edit(Number(b.dataset.edit)));document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>removeArticle(Number(b.dataset.delete)))}
if(id==='contacts'){const rows=await api('/api/admin/contacts');$('#contactRows').innerHTML=`<table><tr><th>Data</th><th>Remetente</th><th>Assunto / Mensagem</th><th>Estado</th></tr>${rows.map(r=>`<tr><td>${esc(r.created_at)}</td><td>${esc(r.name)}<br>${esc(r.email)}</td><td><strong>${esc(r.subject)}</strong><p>${esc(r.message)}</p><textarea id="note${r.id}" placeholder="Observações internas">${esc(r.notes)}</textarea></td><td><select id="state${r.id}">${['new','in_progress','resolved'].map(x=>`<option value="${x}" ${x===r.status?'selected':''}>${x}</option>`).join('')}</select><button class="btn small" data-contact="${r.id}">Guardar</button></td></tr>`).join('')}</table>`;document.querySelectorAll('[data-contact]').forEach(b=>b.onclick=async()=>{try{await api('/api/admin/contacts/'+b.dataset.contact,'PATCH',{status:$('#state'+b.dataset.contact).value,notes:$('#note'+b.dataset.contact).value});alert('Contacto actualizado.')}catch(e){alert(e.message)}})}
if(id==='subscribers'){const rows=await api('/api/admin/subscribers');$('#subRows').innerHTML=`<table><tr><th>E-mail</th><th>Estado</th><th>Data</th></tr>${rows.map(r=>`<tr><td>${esc(r.email)}</td><td>${esc(r.status)}</td><td>${esc(r.created_at)}</td></tr>`).join('')}</table>`}
if(id==='settings'){const s=await api('/api/admin/settings');const names={company:'Nome da publicação',email:'E-mail',phone:'Telefone',location:'Localização',about:'Descrição institucional'};$('#settingFields').innerHTML=Object.entries(names).map(([k,label])=>`<div class="${k==='about'?'full':''}"><label>${label}</label>${k==='about'?`<textarea name="${k}">${esc(s[k])}</textarea>`:`<input name="${k}" value="${esc(s[k])}">`}</div>`).join('')}
if(id==='users'){const rows=await api('/api/admin/users');$('#userRows').innerHTML=`<table><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Activo</th><th>Acção</th></tr>${rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.email)}</td><td><select id="role${r.id}"><option ${r.role==='admin'?'selected':''}>admin</option><option ${r.role==='editor'?'selected':''}>editor</option></select></td><td><input type="checkbox" id="active${r.id}" style="width:auto" ${r.active?'checked':''}></td><td><button class="btn small" data-user="${r.id}">Actualizar</button></td></tr>`).join('')}</table>`;document.querySelectorAll('[data-user]').forEach(b=>b.onclick=async()=>{try{await api('/api/admin/users/'+b.dataset.user,'PATCH',{role:$('#role'+b.dataset.user).value,active:$('#active'+b.dataset.user).checked});show('users')}catch(e){alert(e.message)}})}
}
function edit(id){const a=articles.find(x=>x.id===id);$('#editor').classList.remove('hide');const f=$('#articleForm');f.dataset.id=id||'';f.reset();$('#editorTitle').textContent=a?'Editar artigo':'Novo artigo';if(a){for(const k of ['title','excerpt','category','status'])f.elements[k].value=a[k];f.elements.body.value=JSON.parse(a.body_json).map(b=>b.v).join('\n\n');f.elements.featured.checked=!!a.featured;f.elements.trending.checked=!!a.trending}$('#editor').scrollIntoView({behavior:'smooth'})}
async function removeArticle(id){if(!confirm('Eliminar definitivamente este artigo? Esta operação não pode ser anulada.'))return;try{await api('/api/admin/articles/'+id,'DELETE');await load('articles')}catch(e){alert(e.message)}}
$('#newArticle').onclick=()=>edit(null);$('#cancelEditor').onclick=()=>$('#editor').classList.add('hide');
$('#articleForm').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;const formData=new FormData(f);formData.set('featured',String(f.elements.featured.checked));formData.set('trending',String(f.elements.trending.checked));try{await api('/api/admin/articles'+(f.dataset.id?'/'+f.dataset.id:''),f.dataset.id?'PUT':'POST',formData);$('#editor').classList.add('hide');await load('articles')}catch(e){$('#articleMsg').textContent=e.message}};
$('#settingsForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/admin/settings','PUT',Object.fromEntries(new FormData(e.currentTarget)));$('#settingMsg').textContent='Configurações guardadas.'}catch(e){$('#settingMsg').textContent=e.message}};
$('#userForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/admin/users','POST',Object.fromEntries(new FormData(e.currentTarget)));e.currentTarget.reset();$('#userMsg').textContent='Utilizador criado.';await load('users')}catch(e){$('#userMsg').textContent=e.message}};
$('#toggleForgot').onclick=()=>{$('#forgotBox').style.display = $('#forgotBox').style.display === 'none' ? 'block' : 'none'; if($('#forgotBox').style.display === 'block') $('#forgotEmail').focus();};
$('#forgotSubmit').onclick=async()=>{const email=$('#forgotEmail').value.trim(); const msg=$('#forgotMessage'); msg.textContent=''; if(!email){msg.textContent='Introduza o seu e-mail.'; msg.style.color='#a73535'; return;} try{const x=await api('/api/auth/forgot-password','POST',{email}); msg.style.color='#0d7f4f'; msg.textContent=x.message || 'Se o e-mail existir, foi enviado um link de recuperação.'; $('#forgotEmail').value='';}catch(e){msg.style.color='#a73535'; msg.textContent=e.message;}};
$('#loginForm').onsubmit=async e=>{e.preventDefault();try{const x=await api('/api/auth/login','POST',Object.fromEntries(new FormData(e.currentTarget)));csrf=x.csrf;identity=x.user;init()}catch(e){$('#loginError').textContent=e.message}};
$('#logout').onclick=async()=>{try{await api('/api/auth/logout','POST');location.href='/admin'}catch(e){alert(e.message)}};
api('/api/auth/me').then(x=>{csrf=x.csrf;identity=x.user;init()}).catch(()=>{});

/* ===== Publicidade ===== */
let ads=[],adSlots={};
async function loadAds(){
  [adSlots,ads]=await Promise.all([api('/api/admin/ad-slots'),api('/api/admin/ads')]);
  $('#adSlot').innerHTML=Object.entries(adSlots).map(([k,v])=>`<option value="${k}">${esc(v.label)} (${v.w}×${v.h})</option>`).join('');
  const live={};ads.filter(a=>a.active).forEach(a=>live[a.slot]=a.id);
  $('#adRows').innerHTML=ads.length?`<table><thead><tr><th>Pré-visualização</th><th>Anúncio</th><th>Posição</th><th>Estado</th><th>Acções</th></tr></thead><tbody>${ads.map(a=>{const s=adSlots[a.slot]||{label:a.slot,w:'?',h:'?'};
    const st=!a.active?'<span class="pill draft">inactivo</span>':live[a.slot]===a.id?'<span class="pill published">no ar</span>':'<span class="pill archived">substituído</span>';
    return `<tr><td><img src="${esc(a.image_url)}" alt="" style="max-width:150px;max-height:70px;border:1px solid var(--line)"></td><td><strong>${esc(a.name)}</strong><div class="muted">${esc(a.href||'sem link')}</div></td><td>${esc(s.label)}<div class="muted">${s.w}×${s.h}</div></td><td>${st}</td><td><div class="actions"><button class="btn secondary small" data-ad-edit="${a.id}">Editar</button><button class="btn secondary small" data-ad-toggle="${a.id}">${a.active?'Desactivar':'Activar'}</button><button class="btn warn small" data-ad-del="${a.id}">Eliminar</button></div></td></tr>`}).join('')}</tbody></table>`:'<p class="muted" style="padding:16px">Ainda não há anúncios. Clique em «Novo anúncio».</p>';
  document.querySelectorAll('[data-ad-edit]').forEach(b=>b.onclick=()=>editAd(Number(b.dataset.adEdit)));
  document.querySelectorAll('[data-ad-del]').forEach(b=>b.onclick=()=>removeAd(Number(b.dataset.adDel)));
  document.querySelectorAll('[data-ad-toggle]').forEach(b=>b.onclick=()=>toggleAd(Number(b.dataset.adToggle)));
}
function adHint(){const s=adSlots[$('#adSlot').value];if(!s)return;$('#adSizeHint').textContent='Tamanho recomendado: '+s.w+' × '+s.h+' px.';$('#adMobileBox').classList.toggle('hide',!s.mobile)}
function editAd(id){
  const a=ads.find(x=>x.id===id);const f=$('#adForm');f.reset();f.dataset.id=id||'';
  $('#adEditor').classList.remove('hide');$('#adEditorTitle').textContent=a?'Editar anúncio':'Novo anúncio';$('#adMsg').textContent='';
  $('#adImage').required=!a;$('#adActive').checked=a?!!a.active:true;
  if(a){for(const k of ['name','slot','href','alt'])f.elements[k].value=a[k]||''}
  $('#adCurrent').textContent=a?'Imagem actual mantida se não escolher outra.':'';
  $('#adRemoveMobile').classList.toggle('hide',!(a&&a.image_mobile_url));
  adHint();$('#adEditor').scrollIntoView({behavior:'smooth'});
}
async function removeAd(id){if(!confirm('Eliminar definitivamente este anúncio? Esta operação não pode ser anulada.'))return;try{await api('/api/admin/ads/'+id,'DELETE');await loadAds()}catch(e){alert(e.message)}}
async function toggleAd(id){const a=ads.find(x=>x.id===id);const fd=new FormData();for(const k of ['name','slot','href','alt'])fd.set(k,a[k]||'');fd.set('active',String(!a.active));try{await api('/api/admin/ads/'+id,'PUT',fd);await loadAds()}catch(e){alert(e.message)}}
$('#newAd').onclick=()=>editAd(null);
$('#cancelAd').onclick=()=>$('#adEditor').classList.add('hide');
$('#adSlot').onchange=adHint;
$('#adForm').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;const fd=new FormData(f);fd.set('active',String($('#adActive').checked));if($('#adRemoveMobileCb').checked)fd.set('remove_mobile','true');
  try{await api('/api/admin/ads'+(f.dataset.id?'/'+f.dataset.id:''),f.dataset.id?'PUT':'POST',fd);$('#adEditor').classList.add('hide');await loadAds()}catch(err){$('#adMsg').textContent=err.message}};

/* ===== Categorias ===== */
let cats=[];
async function fillCats(){
  const [cs,as]=await Promise.all([api('/api/admin/categories'),api('/api/admin/articles')]);
  const names=cs.map(c=>c.name);
  as.forEach(a=>{if(!names.includes(a.category))names.push(a.category)});
  const sel=document.querySelector('#articleForm [name=category]');
  if(sel)sel.innerHTML=names.map(n=>'<option>'+esc(n)+'</option>').join('');
}
async function loadCats(){
  cats=await api('/api/admin/categories');
  $('#catRows').innerHTML='<table><thead><tr><th>Categoria</th><th>Onde aparece</th><th>Artigos</th><th>Acções</th></tr></thead><tbody>'+cats.map(c=>'<tr><td><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:'+esc(c.color)+';margin-right:8px"></span><strong>'+esc(c.name)+'</strong></td><td>'+(c.is_top?'Menu principal e lateral':'Só menu lateral')+'</td><td>'+c.articles+'</td><td><div class="actions"><button class="btn secondary small" data-cat-edit="'+c.id+'">Editar</button>'+(c.is_top?'':'<button class="btn warn small" data-cat-del="'+c.id+'">Eliminar</button>')+'</div></td></tr>').join('')+'</tbody></table>';
  document.querySelectorAll('[data-cat-edit]').forEach(b=>b.onclick=()=>editCat(Number(b.dataset.catEdit)));
  document.querySelectorAll('[data-cat-del]').forEach(b=>b.onclick=()=>removeCat(Number(b.dataset.catDel)));
}
function editCat(id){const c=cats.find(x=>x.id===id);const f=$('#catForm');f.dataset.id=id||'';$('#catName').value=c?c.name:'';$('#catName').readOnly=!!(c&&c.is_top);$('#catColor').value=c?c.color.toLowerCase():'#1b2f6e';$('#catFormTitle').textContent=c?'Editar categoria':'Nova categoria';$('#cancelCat').classList.toggle('hide',!c);$('#catMsg').textContent='';f.scrollIntoView({behavior:'smooth'})}
async function removeCat(id){if(!confirm('Eliminar esta categoria?'))return;try{await api('/api/admin/categories/'+id,'DELETE');await loadCats()}catch(e){alert(e.message)}}
$('#cancelCat').onclick=()=>{editCat(null)};
$('#catForm').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;try{await api('/api/admin/categories'+(f.dataset.id?'/'+f.dataset.id:''),f.dataset.id?'PUT':'POST',Object.fromEntries(new FormData(f)));editCat(null);$('#catMsg').textContent='Guardado.';await loadCats()}catch(err){$('#catMsg').textContent=err.message}};

/* ===== Carrossel ===== */
let slides=[];
async function loadSlides(){
  slides=await api('/api/admin/slides');
  $('#slideRows').innerHTML=slides.length?'<table><thead><tr><th>Imagem</th><th>Legenda</th><th>Ordem</th><th>Estado</th><th>Acções</th></tr></thead><tbody>'+slides.map((x,i)=>'<tr><td><img src="'+esc(x.image_url)+'" alt="" style="width:160px;height:60px;object-fit:cover;border:1px solid var(--line)"></td><td><strong>'+esc(x.caption||'(sem legenda)')+'</strong><div class="muted">'+esc(x.href||'sem link')+'</div></td><td><div class="actions"><button class="btn secondary small" data-sl-up="'+x.id+'"'+(i===0?' disabled':'')+'>↑</button><button class="btn secondary small" data-sl-down="'+x.id+'"'+(i===slides.length-1?' disabled':'')+'>↓</button></div></td><td>'+(x.active?'<span class="pill published">visível</span>':'<span class="pill draft">oculto</span>')+'</td><td><div class="actions"><button class="btn secondary small" data-sl-edit="'+x.id+'">Editar</button><button class="btn secondary small" data-sl-toggle="'+x.id+'">'+(x.active?'Ocultar':'Mostrar')+'</button><button class="btn warn small" data-sl-del="'+x.id+'">Eliminar</button></div></td></tr>').join('')+'</tbody></table>':'<p class="muted" style="padding:16px">Ainda não há imagens. Enquanto estiver vazio, o carrossel não aparece no website.</p>';
  document.querySelectorAll('[data-sl-edit]').forEach(b=>b.onclick=()=>editSlide(Number(b.dataset.slEdit)));
  document.querySelectorAll('[data-sl-del]').forEach(b=>b.onclick=()=>removeSlide(Number(b.dataset.slDel)));
  document.querySelectorAll('[data-sl-toggle]').forEach(b=>b.onclick=()=>toggleSlide(Number(b.dataset.slToggle)));
  document.querySelectorAll('[data-sl-up]').forEach(b=>b.onclick=()=>moveSlide(Number(b.dataset.slUp),'up'));
  document.querySelectorAll('[data-sl-down]').forEach(b=>b.onclick=()=>moveSlide(Number(b.dataset.slDown),'down'));
}
function editSlide(id){const x=slides.find(s=>s.id===id);const f=$('#slideForm');f.reset();f.dataset.id=id||'';$('#slideEditor').classList.remove('hide');$('#slideEditorTitle').textContent=x?'Editar imagem':'Nova imagem';$('#slideImage').required=!x;$('#slideActive').checked=x?!!x.active:true;if(x){f.elements.caption.value=x.caption||'';f.elements.href.value=x.href||''}$('#slideCurrent').textContent=x?'A imagem actual é mantida se não escolher outra.':'';$('#slideMsg').textContent='';$('#slideEditor').scrollIntoView({behavior:'smooth'})}
async function removeSlide(id){if(!confirm('Eliminar esta imagem do carrossel?'))return;try{await api('/api/admin/slides/'+id,'DELETE');await loadSlides()}catch(e){alert(e.message)}}
async function moveSlide(id,dir){try{await api('/api/admin/slides/'+id+'/move','POST',{dir});await loadSlides()}catch(e){alert(e.message)}}
async function toggleSlide(id){const x=slides.find(s=>s.id===id);const fd=new FormData();fd.set('caption',x.caption||'');fd.set('href',x.href||'');fd.set('active',String(!x.active));try{await api('/api/admin/slides/'+id,'PUT',fd);await loadSlides()}catch(e){alert(e.message)}}
$('#newSlide').onclick=()=>editSlide(null);
$('#cancelSlide').onclick=()=>$('#slideEditor').classList.add('hide');
$('#slideForm').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;const fd=new FormData(f);fd.set('active',String($('#slideActive').checked));try{await api('/api/admin/slides'+(f.dataset.id?'/'+f.dataset.id:''),f.dataset.id?'PUT':'POST',fd);$('#slideEditor').classList.add('hide');await loadSlides()}catch(err){$('#slideMsg').textContent=err.message}};

/* ===== Conteúdo patrocinado ===== */
let spons=[];
async function loadSpons(){
  spons=await api('/api/admin/sponsored');
  const live=(spons.find(x=>x.active)||{}).id;
  $('#sponsRows').innerHTML=spons.length?'<table><thead><tr><th>Imagem</th><th>Patrocínio</th><th>Estado</th><th>Acções</th></tr></thead><tbody>'+spons.map(x=>'<tr><td>'+(x.image_url?'<img src="'+esc(x.image_url)+'" alt="" style="width:110px;height:64px;object-fit:cover;border:1px solid var(--line)">':'<span class="muted">sem imagem</span>')+'</td><td><strong>'+esc(x.title)+'</strong><div class="muted">'+esc(x.brand||'sem marca')+' · '+esc(x.href)+'</div></td><td>'+(!x.active?'<span class="pill draft">inactivo</span>':x.id===live?'<span class="pill published">no ar</span>':'<span class="pill archived">substituído</span>')+'</td><td><div class="actions"><button class="btn secondary small" data-sp-edit="'+x.id+'">Editar</button><button class="btn secondary small" data-sp-toggle="'+x.id+'">'+(x.active?'Desactivar':'Activar')+'</button><button class="btn warn small" data-sp-del="'+x.id+'">Eliminar</button></div></td></tr>').join('')+'</tbody></table>':'<p class="muted" style="padding:16px">Ainda não há conteúdo patrocinado. Enquanto estiver vazio, aparece o convite «A sua marca ao lado dos melhores insights».</p>';
  document.querySelectorAll('[data-sp-edit]').forEach(b=>b.onclick=()=>editSpons(Number(b.dataset.spEdit)));
  document.querySelectorAll('[data-sp-del]').forEach(b=>b.onclick=()=>removeSpons(Number(b.dataset.spDel)));
  document.querySelectorAll('[data-sp-toggle]').forEach(b=>b.onclick=()=>toggleSpons(Number(b.dataset.spToggle)));
}
function editSpons(id){const x=spons.find(s=>s.id===id);const f=$('#sponsForm');f.reset();f.dataset.id=id||'';$('#sponsEditor').classList.remove('hide');$('#sponsEditorTitle').textContent=x?'Editar patrocínio':'Novo patrocínio';$('#sponsActive').checked=x?!!x.active:true;$('#sponsRemove').checked=false;if(x){for(const k of ['brand','cta','title','text','href'])f.elements[k].value=x[k]||''}$('#sponsCurrent').textContent=x&&x.image_url?'Imagem actual mantida se não escolher outra.':'';$('#sponsRemoveBox').classList.toggle('hide',!(x&&x.image_url));$('#sponsMsg').textContent='';$('#sponsEditor').scrollIntoView({behavior:'smooth'})}
async function removeSpons(id){if(!confirm('Eliminar este conteúdo patrocinado? Esta operação não pode ser anulada.'))return;try{await api('/api/admin/sponsored/'+id,'DELETE');await loadSpons()}catch(e){alert(e.message)}}
async function toggleSpons(id){const x=spons.find(s=>s.id===id);const fd=new FormData();for(const k of ['brand','cta','title','text','href'])fd.set(k,x[k]||'');fd.set('active',String(!x.active));try{await api('/api/admin/sponsored/'+id,'PUT',fd);await loadSpons()}catch(e){alert(e.message)}}
$('#newSpons').onclick=()=>editSpons(null);
$('#cancelSpons').onclick=()=>$('#sponsEditor').classList.add('hide');
$('#sponsForm').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;const fd=new FormData(f);fd.set('active',String($('#sponsActive').checked));if($('#sponsRemove').checked)fd.set('remove_image','true');try{await api('/api/admin/sponsored'+(f.dataset.id?'/'+f.dataset.id:''),f.dataset.id?'PUT':'POST',fd);$('#sponsEditor').classList.add('hide');await loadSpons()}catch(err){$('#sponsMsg').textContent=err.message}};

/* ===== Parceiros ===== */
let partners=[];
async function loadPartners(){
  partners=await api('/api/admin/partners');
  $('#partnerRows').innerHTML=partners.length?'<table><thead><tr><th>Logótipo</th><th>Parceiro</th><th>Ordem</th><th>Estado</th><th>Acções</th></tr></thead><tbody>'+partners.map((x,i)=>'<tr><td><img src="'+esc(x.image_url)+'" alt="" style="max-width:120px;max-height:50px;object-fit:contain"></td><td><strong>'+esc(x.name)+'</strong><div class="muted">'+esc(x.href||'sem link')+'</div></td><td><div class="actions"><button class="btn secondary small" data-pt-up="'+x.id+'"'+(i===0?' disabled':'')+'>↑</button><button class="btn secondary small" data-pt-down="'+x.id+'"'+(i===partners.length-1?' disabled':'')+'>↓</button></div></td><td>'+(x.active?'<span class="pill published">visível</span>':'<span class="pill draft">oculto</span>')+'</td><td><div class="actions"><button class="btn secondary small" data-pt-edit="'+x.id+'">Editar</button><button class="btn secondary small" data-pt-toggle="'+x.id+'">'+(x.active?'Ocultar':'Mostrar')+'</button><button class="btn warn small" data-pt-del="'+x.id+'">Eliminar</button></div></td></tr>').join('')+'</tbody></table>':'<p class="muted" style="padding:16px">Ainda não há parceiros. Enquanto estiver vazio, o rodapé mostra espaços «Parceiro».</p>';
  document.querySelectorAll('[data-pt-edit]').forEach(b=>b.onclick=()=>editPartner(Number(b.dataset.ptEdit)));
  document.querySelectorAll('[data-pt-del]').forEach(b=>b.onclick=()=>removePartner(Number(b.dataset.ptDel)));
  document.querySelectorAll('[data-pt-toggle]').forEach(b=>b.onclick=()=>togglePartner(Number(b.dataset.ptToggle)));
  document.querySelectorAll('[data-pt-up]').forEach(b=>b.onclick=()=>movePartner(Number(b.dataset.ptUp),'up'));
  document.querySelectorAll('[data-pt-down]').forEach(b=>b.onclick=()=>movePartner(Number(b.dataset.ptDown),'down'));
}
function editPartner(id){const x=partners.find(p=>p.id===id);const f=$('#partnerForm');f.reset();f.dataset.id=id||'';$('#partnerEditor').classList.remove('hide');$('#partnerEditorTitle').textContent=x?'Editar parceiro':'Novo parceiro';$('#partnerImage').required=!x;$('#partnerActive').checked=x?!!x.active:true;if(x){f.elements.name.value=x.name;f.elements.href.value=x.href||''}$('#partnerCurrent').textContent=x?'O logótipo actual é mantido se não escolher outro.':'';$('#partnerMsg').textContent='';$('#partnerEditor').scrollIntoView({behavior:'smooth'})}
async function removePartner(id){if(!confirm('Eliminar este parceiro?'))return;try{await api('/api/admin/partners/'+id,'DELETE');await loadPartners()}catch(e){alert(e.message)}}
async function movePartner(id,dir){try{await api('/api/admin/partners/'+id+'/move','POST',{dir});await loadPartners()}catch(e){alert(e.message)}}
async function togglePartner(id){const x=partners.find(p=>p.id===id);const fd=new FormData();fd.set('name',x.name);fd.set('href',x.href||'');fd.set('active',String(!x.active));try{await api('/api/admin/partners/'+id,'PUT',fd);await loadPartners()}catch(e){alert(e.message)}}
$('#newPartner').onclick=()=>editPartner(null);
$('#cancelPartner').onclick=()=>$('#partnerEditor').classList.add('hide');
$('#partnerForm').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;const fd=new FormData(f);fd.set('active',String($('#partnerActive').checked));try{await api('/api/admin/partners'+(f.dataset.id?'/'+f.dataset.id:''),f.dataset.id?'PUT':'POST',fd);$('#partnerEditor').classList.add('hide');await loadPartners()}catch(err){$('#partnerMsg').textContent=err.message}};
