"use strict";

/* ===================== MOTION (optional, graceful fallback) ===================== */
let animate = null, spring = null;
try{
  const motion = await import('motion');
  animate = motion.animate; spring = motion.spring;
}catch(e){ /* CDN unreachable — CSS transitions still cover every interaction */ }

/* ===================== UTIL ===================== */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,8);
let currency = localStorage.getItem('ledger.currency') || '₹';
const fmt = n => currency + Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(()=>t.classList.remove('show'), 2200);
}
function load(key, def){ try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }catch(e){ return def; } }
function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

/* ===================== STATE ===================== */
let txns = load('ledger.txns', []);
let vaultBlobs = load('ledger.vault', []);
let vaultSalt = localStorage.getItem('ledger.vaultSalt');
let sessionKey = null;
let selected = new Set();
let editingId = null;

/* ===================== NAV ===================== */
const sections = {
  fin:{title:'Money', sub:'income & expense ledger'},
  vlt:{title:'Vault', sub:'encrypted logins'}
};
function goTo(sec){
  $$('.track').forEach(t=>t.classList.toggle('active', t.dataset.section===sec));
  $$('.panel').forEach(p=>p.classList.toggle('active', p.id==='panel-'+sec));
  $('#secTitle').textContent = sections[sec].title;
  $('#secSub').textContent = sections[sec].sub;
  $('#primaryAdd').textContent = sec==='fin' ? '+ Add transaction' : '+ Add login';
  $('#primaryAdd').style.display = (sec==='vlt' && !sessionKey) ? 'none' : 'inline-flex';
  $('#lockVaultBtn').style.display = (sec==='vlt' && sessionKey) ? 'inline-flex' : 'none';
  window.location.hash = sec;
  currentSection = sec;
  if(sec==='fin') renderFinance();
}
let currentSection = 'fin';
$$('.track').forEach(t => t.addEventListener('click', ()=>goTo(t.dataset.section)));
goTo((location.hash||'#fin').slice(1) in sections ? (location.hash||'#fin').slice(1) : 'fin');

function tickClock(){ $('#clock').textContent = new Date().toTimeString().slice(0,8); }
setInterval(tickClock, 1000); tickClock();

/* ===================== MODALS (Motion spring if available, CSS fallback) ===================== */
function openModal(id){
  const ov = $(id), modal = ov.querySelector('.modal');
  ov.classList.add('show');
  if(animate){
    animate(modal, {opacity:[0,1], scale:[.94,1], y:[10,0]}, {duration:.28, easing: spring ? spring({stiffness:300,damping:24}) : [.2,.7,.2,1]});
  }
}
function closeModal(id){ $(id).classList.remove('show'); }
$$('.overlay').forEach(ov=>{
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.classList.remove('show'); });
  ov.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click', ()=>ov.classList.remove('show')));
});

$('#primaryAdd').addEventListener('click', ()=>{
  if(currentSection==='fin'){ openAddTxn(); }
  if(currentSection==='vlt'){ if(sessionKey) openModal('#ovVault'); }
});

/* ===================== FINANCE / MONEY ===================== */
let txnType = 'expense';
$$('.segbtn[data-txntype]').forEach(b=>b.addEventListener('click', ()=>{
  txnType = b.dataset.txntype;
  $$('.segbtn[data-txntype]').forEach(x=>x.classList.toggle('on', x===b));
}));

function openAddTxn(){
  editingId = null;
  $('#txnModalTitle').textContent = 'Add transaction';
  $('#txnDesc').value=''; $('#txnAmt').value=''; $('#txnCat').value='Client work'; $('#txnPay').value='Bank transfer';
  $('#txnDate').value = new Date().toISOString().slice(0,10);
  txnType = 'expense'; $$('.segbtn[data-txntype]').forEach(x=>x.classList.toggle('on', x.dataset.txntype==='expense'));
  openModal('#ovTxn');
}
function openEditTxn(t){
  editingId = t.id;
  $('#txnModalTitle').textContent = 'Edit transaction';
  $('#txnDesc').value = t.desc; $('#txnAmt').value = Math.abs(t.amount);
  $('#txnDate').value = t.date; $('#txnCat').value = t.cat; $('#txnPay').value = t.pay || 'Bank transfer';
  txnType = t.amount<0 ? 'expense':'income';
  $$('.segbtn[data-txntype]').forEach(x=>x.classList.toggle('on', x.dataset.txntype===txnType));
  openModal('#ovTxn');
}

$('#saveTxn').addEventListener('click', ()=>{
  const desc = $('#txnDesc').value.trim();
  const amt = parseFloat($('#txnAmt').value);
  const date = $('#txnDate').value || new Date().toISOString().slice(0,10);
  const cat = $('#txnCat').value;
  const pay = $('#txnPay').value;
  if(!desc || !amt || amt<=0){ toast('Add a description and amount'); return; }
  const signed = txnType==='expense' ? -Math.abs(amt) : Math.abs(amt);
  if(editingId){
    const t = txns.find(x=>x.id===editingId);
    if(t){ t.desc=desc; t.amount=signed; t.date=date; t.cat=cat; t.pay=pay; }
    toast('Transaction updated');
  } else {
    txns.unshift({id:uid(), desc, amount:signed, date, cat, pay});
    toast('Transaction saved');
  }
  save('ledger.txns', txns);
  closeModal('#ovTxn'); editingId = null; renderFinance();
});

function updateSelectBar(){
  const bar = $('#selectBar');
  bar.classList.toggle('show', selected.size>0);
  $('#selectCount').textContent = selected.size;
  $('#selectAllChk').checked = txns.length>0 && selected.size===txns.length;
}

$('#selectAllChk').addEventListener('change', (e)=>{
  selected = e.target.checked ? new Set(txns.map(t=>t.id)) : new Set();
  renderFinance();
});
$('#clearSelect').addEventListener('click', ()=>{ selected.clear(); renderFinance(); });
$('#bulkDeleteBtn').addEventListener('click', ()=>{
  if(!selected.size) return;
  const n = selected.size;
  txns = txns.filter(t=>!selected.has(t.id));
  selected.clear();
  save('ledger.txns', txns); renderFinance();
  toast(n + (n===1?' transaction':' transactions') + ' deleted');
});

function renderFinance(){
  const body = $('#finBody');
  if(!txns.length){
    body.innerHTML = `<tr><td colspan="7"><div class="empty"><b>No transactions yet</b>Add your first income or expense to start the ledger.</div></td></tr>`;
  } else {
    body.innerHTML = txns.map(t=>`
      <tr data-id="${t.id}" class="${selected.has(t.id)?'selected':''}">
        <td class="chk"><input type="checkbox" class="rowchk" data-sel="${t.id}" ${selected.has(t.id)?'checked':''}></td>
        <td style="font-family:var(--mono);color:var(--muted);">${t.date}</td>
        <td>${escapeHtml(t.desc)}</td>
        <td><span class="tag">${escapeHtml(t.cat)}</span></td>
        <td><span class="tag pay">${escapeHtml(t.pay||'—')}</span></td>
        <td style="text-align:right" class="amt ${t.amount<0?'neg':'pos'}">${t.amount<0?'−':'+'}${fmt(Math.abs(t.amount))}</td>
        <td style="text-align:right; white-space:nowrap;">
          <button class="rowbtn edit" data-edit="${t.id}" title="Edit">✎</button>
          <button class="rowbtn del" data-del="${t.id}" title="Delete">✕</button>
        </td>
      </tr>`).join('');

    body.querySelectorAll('tr[data-id]').forEach(row=>{
      row.addEventListener('click', (e)=>{
        if(e.target.closest('[data-sel],[data-edit],[data-del]')) return;
        const t = txns.find(x=>x.id===row.dataset.id);
        if(t) openEditTxn(t);
      });
    });
    body.querySelectorAll('[data-sel]').forEach(c=>c.addEventListener('click', e=>{
      e.stopPropagation();
      const id = c.dataset.sel;
      if(c.checked) selected.add(id); else selected.delete(id);
      renderFinance();
    }));
    body.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click', e=>{
      e.stopPropagation();
      const t = txns.find(x=>x.id===b.dataset.edit);
      if(t) openEditTxn(t);
    }));
    body.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click', e=>{
      e.stopPropagation();
      txns = txns.filter(t=>t.id!==b.dataset.del);
      selected.delete(b.dataset.del);
      save('ledger.txns', txns); renderFinance();
    }));
  }
  updateSelectBar();

  const balance = txns.reduce((s,t)=>s+t.amount,0);
  const cutoff = Date.now() - 30*86400000;
  const income30 = txns.filter(t=>t.amount>0 && new Date(t.date).getTime()>=cutoff).reduce((s,t)=>s+t.amount,0);
  const expense30 = txns.filter(t=>t.amount<0 && new Date(t.date).getTime()>=cutoff).reduce((s,t)=>s+Math.abs(t.amount),0);
  $('#statBalance').textContent = fmt(balance);
  $('#statBalance').className = 'v ' + (balance>=0?'pos':'neg');
  $('#statIncome').textContent = fmt(income30);
  $('#statExpense').textContent = fmt(expense30);
  $('#statCount').textContent = txns.length;
  drawChart();

  if(animate){
    animate('.cards .card', {opacity:[0,1], y:[14,0]}, {duration:.4, delay: (el,i)=>i*0.06, easing:[.2,.7,.2,1]});
  }
}

function drawChart(){
  const canvas = $('#chart');
  const dpr = window.devicePixelRatio||1;
  const w = canvas.clientWidth, h = 120;
  canvas.width = w*dpr; canvas.height = h*dpr;
  const ctx = canvas.getContext('2d'); ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,w,h);
  const days = [];
  for(let i=13;i>=0;i--){
    const d = new Date(); d.setDate(d.getDate()-i);
    const key = d.toISOString().slice(0,10);
    const net = txns.filter(t=>t.date===key).reduce((s,t)=>s+t.amount,0);
    days.push({key, net});
  }
  const max = Math.max(1, ...days.map(d=>Math.abs(d.net)));
  const bw = w/days.length;
  days.forEach((d,i)=>{
    const bh = Math.abs(d.net)/max * (h*0.7);
    const x = i*bw + bw*0.25;
    const y = d.net>=0 ? h/2 - bh : h/2;
    ctx.fillStyle = d.net>=0 ? 'rgba(95,217,138,.75)' : 'rgba(255,107,107,.75)';
    ctx.fillRect(x, y, bw*0.5, Math.max(1,bh));
  });
  ctx.strokeStyle = 'rgba(124,133,146,.25)';
  ctx.beginPath(); ctx.moveTo(0,h/2); ctx.lineTo(w,h/2); ctx.stroke();
}

/* ===================== CRYPTO (vault) ===================== */
const enc = new TextEncoder(), dec = new TextDecoder();
function b64(buf){ return btoa(String.fromCharCode(...new Uint8Array(buf))); }
function unb64(str){ return Uint8Array.from(atob(str), c=>c.charCodeAt(0)).buffer; }
async function deriveKey(password, saltB64){
  const salt = unb64(saltB64);
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {name:'PBKDF2', salt, iterations:250000, hash:'SHA-256'},
    keyMaterial, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']
  );
}
async function encryptStr(key, plaintext){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, enc.encode(plaintext));
  return {iv:b64(iv), ct:b64(ct)};
}
async function decryptStr(key, ivB64, ctB64){
  const pt = await crypto.subtle.decrypt({name:'AES-GCM', iv:unb64(ivB64)}, key, unb64(ctB64));
  return dec.decode(pt);
}

/* ===================== VAULT FILES (encrypted, stored in IndexedDB) ===================== */
const VFDB_NAME = 'ledgerVault', VFDB_STORE = 'files';
function vfOpenDB(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(VFDB_NAME, 1);
    req.onupgradeneeded = ()=>{ req.result.createObjectStore(VFDB_STORE, {keyPath:'id'}); };
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });
}
async function vfPut(record){
  const db = await vfOpenDB();
  return new Promise((res,rej)=>{
    const tx = db.transaction(VFDB_STORE,'readwrite');
    tx.objectStore(VFDB_STORE).put(record);
    tx.oncomplete = ()=>res(); tx.onerror = ()=>rej(tx.error);
  });
}
async function vfGetAll(){
  const db = await vfOpenDB();
  return new Promise((res,rej)=>{
    const tx = db.transaction(VFDB_STORE,'readonly');
    const req = tx.objectStore(VFDB_STORE).getAll();
    req.onsuccess = ()=>res(req.result || []); req.onerror = ()=>rej(req.error);
  });
}
async function vfDelete(id){
  const db = await vfOpenDB();
  return new Promise((res,rej)=>{
    const tx = db.transaction(VFDB_STORE,'readwrite');
    tx.objectStore(VFDB_STORE).delete(id);
    tx.oncomplete = ()=>res(); tx.onerror = ()=>rej(tx.error);
  });
}
function fileIcon(type, name){
  if(/pdf$/i.test(type) || /\.pdf$/i.test(name||'')) return '📄';
  if(/^image\//.test(type)) return '🖼';
  if(/sheet|excel|csv/i.test(type)) return '📊';
  return '📁';
}
function fmtBytes(n){
  if(n < 1024) return n + ' B';
  if(n < 1024*1024) return (n/1024).toFixed(1) + ' KB';
  return (n/(1024*1024)).toFixed(1) + ' MB';
}

$('#addFileBtn').addEventListener('click', ()=>{
  if(!sessionKey) return;
  $('#vfLabel').value=''; $('#vfFile').value='';
  openModal('#ovVaultFile');
});

$('#saveVaultFile').addEventListener('click', async ()=>{
  const label = $('#vfLabel').value.trim();
  const file = $('#vfFile').files[0];
  if(!file){ toast('Choose a file'); return; }
  if(file.size > 20*1024*1024){ toast('File too large — 20MB max'); return; }
  try{
    const buf = await file.arrayBuffer();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM', iv}, sessionKey, buf);
    await vfPut({id:uid(), label: label || file.name, name:file.name, type:file.type, size:file.size, iv, ciphertext, createdAt:Date.now()});
    closeModal('#ovVaultFile'); renderVaultFiles(); toast('File encrypted & saved');
  }catch(e){ toast('Could not encrypt that file'); }
});

async function renderVaultFiles(){
  const list = $('#vaultFileList');
  const files = await vfGetAll();
  if(!files.length){
    list.innerHTML = `<div class="empty"><b>No files saved</b>Add a resume, bank statement, or ID scan — encrypted before it touches disk.</div>`;
    return;
  }
  files.sort((a,b)=>b.createdAt-a.createdAt);
  list.innerHTML = files.map(f=>`
    <div class="file-row" data-id="${f.id}">
      <div class="fm"><span class="ficon">${fileIcon(f.type,f.name)}</span>
        <div class="fv"><b>${escapeHtml(f.label)}</b><span>${escapeHtml(f.name)} · ${fmtBytes(f.size)}</span></div>
      </div>
      <div class="vault-actions">
        <button data-dl="${f.id}">Download</button>
        <button data-delf="${f.id}">✕</button>
      </div>
    </div>`).join('');
  list.querySelectorAll('[data-dl]').forEach(b=>b.addEventListener('click', async ()=>{
    const f = files.find(x=>x.id===b.dataset.dl);
    try{
      const pt = await crypto.subtle.decrypt({name:'AES-GCM', iv:f.iv}, sessionKey, f.ciphertext);
      const blob = new Blob([pt], {type:f.type || 'application/octet-stream'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = f.name; a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
    }catch(e){ toast('Could not decrypt that file'); }
  }));
  list.querySelectorAll('[data-delf]').forEach(b=>b.addEventListener('click', async ()=>{
    await vfDelete(b.dataset.delf); renderVaultFiles();
  }));
}

function updateVaultLockUI(){
  const hasVault = !!vaultSalt;
  $('#vaultLockTitle').textContent = hasVault ? 'Vault locked' : 'Create your vault';
  $('#vaultLockDesc').textContent = hasVault
    ? "Enter your master password to decrypt saved logins. This password never leaves your device."
    : "Set a master password to start saving encrypted logins on this device.";
  $('#unlockBtn').textContent = hasVault ? 'Unlock' : 'Create vault';
}
updateVaultLockUI();

$('#unlockBtn').addEventListener('click', async ()=>{
  const pw = $('#masterPwInput').value;
  if(!pw){ toast('Enter a password'); return; }
  if(!vaultSalt){
    const salt = crypto.getRandomValues(new Uint8Array(16));
    vaultSalt = b64(salt);
    localStorage.setItem('ledger.vaultSalt', vaultSalt);
    sessionKey = await deriveKey(pw, vaultSalt);
    const verify = await encryptStr(sessionKey, 'ledger-vault-ok');
    localStorage.setItem('ledger.vaultVerify', JSON.stringify(verify));
    unlockVaultUI();
    toast('Vault created');
    return;
  }
  try{
    const key = await deriveKey(pw, vaultSalt);
    const verify = JSON.parse(localStorage.getItem('ledger.vaultVerify'));
    const check = await decryptStr(key, verify.iv, verify.ct);
    if(check !== 'ledger-vault-ok') throw new Error('bad');
    sessionKey = key;
    unlockVaultUI();
  }catch(e){
    toast('Wrong master password');
  }
});

function unlockVaultUI(){
  $('#vaultLocked').style.display = 'none';
  $('#vaultUnlocked').style.display = 'block';
  $('#masterPwInput').value = '';
  $('#primaryAdd').style.display = 'inline-flex';
  $('#lockVaultBtn').style.display = 'inline-flex';
  renderVault();
  renderVaultFiles();
}

$('#lockVaultBtn').addEventListener('click', ()=>{
  sessionKey = null;
  $('#vaultUnlocked').style.display = 'none';
  $('#vaultLocked').style.display = 'flex';
  $('#vaultList').innerHTML = '';
  $('#vaultFileList').innerHTML = '';
  $('#lockVaultBtn').style.display = 'none';
  if(currentSection==='vlt') $('#primaryAdd').style.display = 'none';
  toast('Vault locked');
});

$('#saveVault').addEventListener('click', async ()=>{
  const site = $('#vSite').value.trim(), user = $('#vUser').value.trim(), pass = $('#vPass').value, notes = $('#vNotes').value.trim();
  if(!site || !pass){ toast('Site and password required'); return; }
  const {iv, ct} = await encryptStr(sessionKey, pass);
  vaultBlobs.unshift({id:uid(), site, user, notes, iv, ct});
  save('ledger.vault', vaultBlobs);
  $('#vSite').value=''; $('#vUser').value=''; $('#vPass').value=''; $('#vNotes').value='';
  closeModal('#ovVault'); renderVault(); toast('Login saved, encrypted');
});

function renderVault(){
  const list = $('#vaultList');
  if(!vaultBlobs.length){
    list.innerHTML = `<div class="empty"><b>No logins saved</b>Add your first encrypted login above.</div>`;
    return;
  }
  list.innerHTML = vaultBlobs.map(v=>`
    <div class="vault-row" data-id="${v.id}">
      <div class="vm"><b>${escapeHtml(v.site)}</b><span>${escapeHtml(v.user||'—')}</span></div>
      <div class="vault-actions">
        <button data-reveal="${v.id}">Show</button>
        <button data-copy="${v.id}">Copy</button>
        <button data-delv="${v.id}">✕</button>
      </div>
    </div>`).join('');
  list.querySelectorAll('[data-reveal]').forEach(b=>b.addEventListener('click', async ()=>{
    const v = vaultBlobs.find(x=>x.id===b.dataset.reveal);
    const pw = await decryptStr(sessionKey, v.iv, v.ct);
    const row = list.querySelector(`[data-id="${v.id}"] .vm`);
    if(row.dataset.shown==='1'){
      row.innerHTML = `<b>${escapeHtml(v.site)}</b><span>${escapeHtml(v.user||'—')}</span>`;
      row.dataset.shown='0'; b.textContent='Show';
    } else {
      row.innerHTML = `<b>${escapeHtml(v.site)}</b><span>${escapeHtml(v.user||'—')} · ${escapeHtml(pw)}</span>`;
      row.dataset.shown='1'; b.textContent='Hide';
    }
  }));
  list.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click', async ()=>{
    const v = vaultBlobs.find(x=>x.id===b.dataset.copy);
    const pw = await decryptStr(sessionKey, v.iv, v.ct);
    await navigator.clipboard.writeText(pw);
    toast('Password copied');
  }));
  list.querySelectorAll('[data-delv]').forEach(b=>b.addEventListener('click', ()=>{
    vaultBlobs = vaultBlobs.filter(x=>x.id!==b.dataset.delv);
    save('ledger.vault', vaultBlobs); renderVault();
  }));
}

/* ===================== EXPORT / IMPORT / SETTINGS ===================== */
$('#exportBtn').addEventListener('click', ()=>{
  const data = {txns, vaultBlobs, vaultSalt, vaultVerify: localStorage.getItem('ledger.vaultVerify'), currency};
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'ledger-backup-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  toast('Backup downloaded');
});
$('#importBtn').addEventListener('click', ()=>{
  const inp = document.createElement('input'); inp.type='file'; inp.accept='application/json';
  inp.onchange = async ()=>{
    const file = inp.files[0]; if(!file) return;
    const text = await file.text();
    try{
      const data = JSON.parse(text);
      txns = data.txns||[]; vaultBlobs = data.vaultBlobs||[];
      if(data.vaultSalt){ vaultSalt = data.vaultSalt; localStorage.setItem('ledger.vaultSalt', vaultSalt); }
      if(data.vaultVerify) localStorage.setItem('ledger.vaultVerify', data.vaultVerify);
      if(data.currency){ currency = data.currency; localStorage.setItem('ledger.currency', currency); }
      save('ledger.txns', txns); save('ledger.vault', vaultBlobs);
      sessionKey = null; selected.clear(); updateVaultLockUI();
      goTo(currentSection); toast('Backup restored');
    }catch(e){ toast('Invalid backup file'); }
  };
  inp.click();
});
$('#settingsBtn').addEventListener('click', ()=>{
  const c = prompt('Currency symbol', currency);
  if(c){ currency = c; localStorage.setItem('ledger.currency', c); renderFinance(); }
});

/* ===================== HELPERS ===================== */
function escapeHtml(s){
  return String(s??'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
window.addEventListener('resize', ()=>{ if(currentSection==='fin') drawChart(); });

/* ===================== PWA: installable on mac / windows / android ===================== */
try{
  const manifest = {
    name:"Ledger — Accounts", short_name:"Ledger", start_url:".", display:"standalone",
    background_color:"#0A0C0F", theme_color:"#0A0C0F",
    icons:[{src:makeIcon(192), sizes:"192x192", type:"image/png"},{src:makeIcon(512), sizes:"512x512", type:"image/png"}]
  };
  const manifestBlob = new Blob([JSON.stringify(manifest)], {type:'application/manifest+json'});
  const link = document.createElement('link');
  link.rel = 'manifest'; link.href = URL.createObjectURL(manifestBlob);
  document.head.appendChild(link);

  if('serviceWorker' in navigator){
    const swCode = `
      self.addEventListener('install', e=>self.skipWaiting());
      self.addEventListener('activate', e=>self.clients.claim());
      self.addEventListener('fetch', e=>{});
    `;
    const swBlob = new Blob([swCode], {type:'application/javascript'});
    navigator.serviceWorker.register(URL.createObjectURL(swBlob)).catch(()=>{});
  }
}catch(e){}

function makeIcon(size){
  const c = document.createElement('canvas'); c.width=size; c.height=size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0A0C0F'; ctx.fillRect(0,0,size,size);
  ctx.strokeStyle = '#5FD98A'; ctx.lineWidth = size*0.06;
  ctx.beginPath(); ctx.moveTo(size*0.22,size*0.5); ctx.lineTo(size*0.42,size*0.7); ctx.lineTo(size*0.78,size*0.3); ctx.stroke();
  return c.toDataURL('image/png');
}

/* ===================== INIT ===================== */
renderFinance();
