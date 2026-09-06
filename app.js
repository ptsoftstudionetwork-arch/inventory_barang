/* =========================================================
   app.js — Logika aplikasi Inventory PT. Softstudio Network
   Semua data disimpan di localStorage browser.
   ========================================================= */
'use strict';

/* ---------- util dasar ---------- */
const $  = (s,el=document)=>el.querySelector(s);
const $$ = (s,el=document)=>[...el.querySelectorAll(s)];
const esc = s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = ()=>Math.random().toString(36).slice(2,10);
const fmtNum = n=>Number(n||0).toLocaleString('id-ID');
const fmtRp  = n=>'Rp '+fmtNum(Math.round(n||0));
const fmtShort = n=>n>=1e9?(n/1e9).toFixed(1).replace('.',',')+' M':n>=1e6?(n/1e6).toFixed(1).replace('.',',')+' jt':n>=1e3?Math.round(n/1e3)+' rb':fmtNum(n);
function todayISO(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function todayComp(){return todayISO().replace(/-/g,'');}
const fmtDate = iso=>new Date(iso+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
const fmtDT = ts=>new Date(ts).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
const LOG_LABEL={in:'MASUK',out:'KELUAR',adj:'ADJUST'};
function statusOf(i){return i.qty===0?'HABIS':i.qty<=i.min?'MENIPIS':'AMAN';}
function stampStatus(i){const s=statusOf(i);const c=s==='HABIS'?'bad':s==='MENIPIS'?'warn':'ok';return `<span class="stamp ${c}">${s}</span>`;}

/* ---------- penyimpanan ---------- */
const store={
  get(k,fb){try{const v=localStorage.getItem('ssn_'+k);return v?JSON.parse(v):fb;}catch(e){return fb;}},
  set(k,v){localStorage.setItem('ssn_'+k,JSON.stringify(v));}
};
function persist(key,val){
  try{ store.set(key,val); }
  catch(e){ toast('Penyimpanan browser penuh — data terakhir mungkin tidak tersimpan.','err'); }
}

/* ---------- state global ---------- */
let items, outT, fixT, photos, techs, stocklog, settings, seq;
let current='dashboard';
let invState={q:'',cat:'Semua',sort:'nama'};
let outState={q:'',status:'Semua'};
let fixState={status:'Semua'};
let albState={cat:'Semua'};
let logState={type:'Semua'};
let lbIndex=0, lbList=[];

function loadState(){
  items=store.get('inventory',null);
  if(!items){ items=SEED_INVENTORY.map(i=>({id:uid(),...i})); store.set('inventory',items); }
  outT=store.get('out',[]); fixT=store.get('fix',[]); photos=store.get('photos',[]);
  techs=store.get('techs',[]);
  stocklog=store.get('stocklog',null);
  if(!stocklog){
    stocklog=[{t:Date.now(),type:'in',name:'Data awal inventaris',
      qty:items.reduce((s,i)=>s+i.qty,0),note:'Muat awal '+items.length+' SKU'}];
    store.set('stocklog',stocklog);
  }
  settings=Object.assign({},DEFAULT_SETTINGS,store.get('settings',{}));
  store.set('settings',settings);
  seq=store.get('seq',null)||{out:0,fix:0}; store.set('seq',seq);
}
function catList(){
  return [...new Set([...items.map(i=>i.cat),...EXTRA_CATS])].sort();
}
function genSku(cat){
  const P={'Kabel':'KBL','Closure & FOT':'CLS','Router / ONT':'ONT','Patchcord':'PCH',
    'Splitter':'SPL','Adaptor':'ADP','Konektor':'KON','Consumable':'CSM'};
  const p=P[cat]||'BRG';
  let n=items.filter(i=>i.sku.startsWith(p+'-')).length+1, sku;
  do{ sku=p+'-'+String(n).padStart(3,'0'); n++; }while(items.some(i=>i.sku===sku));
  return sku;
}
function nextNo(type){
  seq[type]++; store.set('seq',seq);
  return (type==='out'?'OUT-':'FIX-')+new Date().getFullYear()+'-'+String(seq[type]).padStart(4,'0');
}
function pushLog(type,name,qty,note){
  stocklog.unshift({t:Date.now(),type,name,qty,note});
  if(stocklog.length>600) stocklog.length=600;
  persist('stocklog',stocklog);
}
function upsertTech(name){
  name=name.trim(); if(!name) return;
  if(!techs.some(t=>t.name.toLowerCase()===name.toLowerCase())){
    techs.push({id:uid(),name,phone:''}); persist('techs',techs);
  }
}

/* ---------- toast & modal ---------- */
function toast(msg,type='ok'){
  const el=document.createElement('div'); el.className='toast '+type;
  el.innerHTML=`<i data-lucide="${type==='ok'?'check-circle-2':type==='err'?'alert-triangle':'info'}"></i><span>${msg}</span>`;
  $('#toast-root').appendChild(el);
  if(window.lucide) lucide.createIcons();
  setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),260);},3300);
}
function openModal(html,lg){
  $('#modal-root').innerHTML=`<div class="mback" id="mback"><div class="mbox ${lg?'lg':''}">${html}</div></div>`;
  $('#mback').addEventListener('mousedown',e=>{if(e.target.id==='mback')closeModal();});
  $$('#modal-root [data-close]').forEach(b=>b.addEventListener('click',closeModal));
  if(window.lucide) lucide.createIcons();
}
function closeModal(){ $('#modal-root').innerHTML=''; }
function askConfirm(title,msg,onYes,yesLabel='Hapus',danger=true){
  openModal(`<div class="mhead"><h3>${esc(title)}</h3></div>
    <div class="mbody"><p class="confirm-msg">${msg}</p></div>
    <div class="mfoot"><button class="btn" data-close>Batal</button>
    <button class="btn ${danger?'danger':'primary'}" id="cf-yes">${esc(yesLabel)}</button></div>`);
  $('#cf-yes').addEventListener('click',()=>{closeModal();onYes();});
}
function icons(){ if(window.lucide) lucide.createIcons(); }
function refresh(){ updateNavBadges(); PAGES[current].render($('#content')); icons(); window.scrollTo(0,0); }

/* ---------- router ---------- */
const PAGES={
  dashboard:{title:'Dashboard',render:renderDashboard},
  inventory:{title:'Inventaris',render:renderInventory},
  out:{title:'Ticket Pengeluaran Barang',render:renderOut},
  fix:{title:'Ticket Perbaikan',render:renderFix},
  album:{title:'Album Foto',render:renderAlbum},
  techs:{title:'Data Teknisi',render:renderTechs},
  log:{title:'Riwayat Stok',render:renderLog},
  settings:{title:'Pengaturan',render:renderSettings}
};
function go(page){
  current=page;
  $$('#side-nav .nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  $('#page-title').textContent=PAGES[page].title;
  refresh();
}
function updateNavBadges(){
  const o=outT.filter(t=>t.status==='active'&&t.date===todayISO()).length;
  const f=fixT.filter(t=>t.status==='Baru').length;
  const set=(el,n)=>{if(!el)return;el.hidden=!n;el.textContent=n;};
  set($('#nav-out-badge'),o); set($('#nav-fix-badge'),f);
}

/* ---------- login & brand ---------- */
function applyBrand(){
  const has=!!settings.logo;
  const l=$('#login-logo'); if(l){l.src=has?settings.logo:'';l.hidden=!has;$('#login-logo-hint').hidden=has;}
  $('#login-company-name').textContent=settings.company;
  const sl=$('#side-logo'); sl.src=has?settings.logo:''; sl.hidden=!has;
  $('#side-logo-mono').hidden=has;
  $('#side-company').textContent=settings.company;
  document.title=settings.company+' — Inventory';
}
function readLogoFile(file,cb){
  const img=new Image(),url=URL.createObjectURL(file);
  img.onload=()=>{
    const max=220,sc=Math.min(1,max/Math.max(img.width,img.height));
    const c=document.createElement('canvas');
    c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);
    URL.revokeObjectURL(url);cb(c.toDataURL('image/png'));
  };
  img.onerror=()=>cb(null);
  img.src=url;
}
function bindLogoPick(inputEl,after){
  inputEl.addEventListener('change',e=>{
    const f=e.target.files[0]; if(!f)return;
    readLogoFile(f,data=>{
      if(data){settings.logo=data;persist('settings',settings);applyBrand();toast('Logo perusahaan tersimpan.');}
      else toast('Gagal membaca file logo.','err');
      if(after)after();
    });
    e.target.value='';
  });
}
function enterApp(){
  $('#view-login').hidden=true; $('#app').hidden=false;
  $('#top-date').textContent=new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const sess=store.get('logged',{});
  $('#top-user').textContent='@'+(sess.user||settings.user);
  $('#side-user').textContent='@'+(sess.user||settings.user);
  applyBrand(); go('dashboard');
}

/* ===================== DASHBOARD ===================== */
function countUp(el,target,fmt){
  const t0=performance.now(),dur=850;
  (function step(t){
    const p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3);
    el.textContent=fmt(Math.round(target*e));
    if(p<1)requestAnimationFrame(step);
  })(t0);
}
function mountBarChart(el,data){
  if(!el)return;
  const max=Math.max(1,...data.map(d=>d.value));
  el.innerHTML=data.map(d=>`
    <div class="hrow">
      <div class="hlabel" title="${esc(d.label)}">${esc(d.label)}</div>
      <div class="htrack"><div class="hfill" data-w="${(d.value/max*100).toFixed(1)}"></div></div>
      <div class="hval">${d.text}</div>
    </div>`).join('');
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    $$('.hfill',el).forEach(f=>f.style.width=f.dataset.w+'%');
  }));
}
function mountDonut(el,data){
  if(!el)return;
  const total=data.reduce((s,d)=>s+d.value,0)||1;
  const PAL=['#E8590C','#2E6B4F','#1D1B16','#8C5A2B','#A3902E','#5B6E80','#7A4E2D'];
  let acc=0,segs='';
  data.forEach((d,i)=>{
    const len=(d.value/total*100);
    segs+=`<circle cx="18" cy="18" r="15.9" fill="none" stroke="${PAL[i%PAL.length]}" stroke-width="5.4"
      stroke-dasharray="${len.toFixed(2)} ${(100-len).toFixed(2)}" stroke-dashoffset="${((100-acc)%100).toFixed(2)}"/>`;
    acc+=len;
  });
  el.innerHTML=`<div class="donut-wrap">
    <svg viewBox="0 0 36 36"><g transform="rotate(-90 18 18)">${segs}</g></svg>
    <div class="donut-center"><span class="dc1">TOTAL</span><span class="dc2">${fmtShort(total)}</span></div>
  </div>
  <div class="legend">${data.map((d,i)=>`
    <div class="lg-row"><span class="lg-sw" style="background:${PAL[i%PAL.length]}"></span>
    <span class="lg-name" title="${esc(d.label)}">${esc(d.label)}</span>
    <span class="lg-val">${fmtShort(d.value)}</span>
    <span class="lg-pct">${(d.value/total*100).toFixed(1).replace('.',',')}%</span></div>`).join('')}
  </div>`;
}
function mountArea(el,series,xlabels){
  if(!el)return;
  const W=620,H=195,P=12,BASE=H-16,TOP=26;
  const max=Math.max(1,...series.map(s=>s.value));
  const step=(W-2*P)/(series.length-1);
  const pts=series.map((s,i)=>[P+i*step,BASE-(s.value/max)*(BASE-TOP)]);
  const lineD=pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
  const flat=series.every(s=>s.value===0);
  el.innerHTML=`<div class="area-wrap">
    <div class="area-plot">
      <span class="area-ymax">${fmtNum(max)}</span><span class="area-zero">0</span>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <line x1="${P}" x2="${W-P}" y1="${BASE}" y2="${BASE}" class="axis" vector-effect="non-scaling-stroke"/>
        <line x1="${P}" x2="${W-P}" y1="${(BASE-TOP)*0.5+TOP}" y2="${(BASE-TOP)*0.5+TOP}" class="grid" vector-effect="non-scaling-stroke"/>
        <polygon points="${P},${BASE} ${lineD} ${W-P},${BASE}" class="area"/>
        <polyline points="${lineD}" class="aline" vector-effect="non-scaling-stroke"/>
        <line id="area-gline" y1="${TOP}" y2="${BASE}" class="gline" style="display:none" vector-effect="non-scaling-stroke"/>
      </svg>
      <div class="adot" id="area-dot"></div>
      <div class="ctip" id="area-tip"></div>
      ${flat?'<div class="area-note">BELUM ADA PENGELUARAN TERCATAT</div>':''}
    </div>
    <div class="area-labels">${xlabels.map(l=>`<span>${l}</span>`).join('')}</div>
  </div>`;
  const svg=$('#area-svg',el)||$('svg',el),dot=$('#area-dot',el),gl=$('#area-gline',el),
        tip=$('#area-tip',el),plot=$('.area-plot',el);
  if(!svg)return;
  svg.addEventListener('pointermove',e=>{
    const r=svg.getBoundingClientRect();
    const x=(e.clientX-r.left)/r.width*W;
    let idx=Math.round((x-P)/step); idx=Math.max(0,Math.min(series.length-1,idx));
    const [cx,cy]=pts[idx];
    gl.setAttribute('x1',cx);gl.setAttribute('x2',cx);gl.style.display='block';
    dot.style.display='block';
    dot.style.left=(cx/W*100)+'%'; dot.style.top=(cy/H*100)+'%';
    tip.style.display='block';
    tip.style.left=(cx/W*100)+'%'; tip.style.top=(cy/H*100)+'%';
    tip.textContent=`${series[idx].label} · ${fmtNum(series[idx].value)} unit`;
  });
  svg.addEventListener('pointerleave',()=>{dot.style.display='none';gl.style.display='none';tip.style.display='none';});
  void plot;
}

function renderDashboard(el){
  const totalSKU=items.length;
  const totalUnit=items.reduce((s,i)=>s+i.qty,0);
  const totalValue=items.reduce((s,i)=>s+i.qty*i.price,0);
  const crit=items.filter(i=>i.qty<=i.min).sort((a,b)=>a.qty-b.qty);
  const cats={}; items.forEach(i=>cats[i.cat]=(cats[i.cat]||0)+i.qty);
  const bars=Object.entries(cats).map(([label,value])=>({label,value,text:fmtNum(value)+' unit'})).sort((a,b)=>b.value-a.value);
  const valCat={}; items.forEach(i=>valCat[i.cat]=(valCat[i.cat]||0)+i.qty*i.price);
  const donut=Object.entries(valCat).map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value);
  const days=[];for(let k=29;k>=0;k--){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-k);days.push(d);}
  const series=days.map(d=>{
    const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const v=outT.reduce((s,t)=>(t.status==='active'&&t.date===key)?s+t.items.reduce((a,i)=>a+i.qty,0):s,0);
    return {value:v,label:d.getDate()+' '+d.toLocaleDateString('id-ID',{month:'short'})};
  });
  const out30=series.reduce((s,d)=>s+d.value,0);
  const xlabels=[0,6,12,18,24,29].map(ix=>days[ix].getDate()+'/'+(days[ix].getMonth()+1));

  el.innerHTML=`
  <div class="kpi-row">
    <div class="kpi"><span class="k-label">Total SKU Barang</span><span class="k-val mono" data-cu="${totalSKU}">0</span><span class="k-sub">${Object.keys(cats).length} kategori terdaftar</span></div>
    <div class="kpi"><span class="k-label">Total Unit Stok</span><span class="k-val mono" data-cu="${totalUnit}">0</span><span class="k-sub">gabungan seluruh barang</span></div>
    <div class="kpi dark"><span class="k-label">Nilai Inventaris</span><span class="k-val mono" data-cu="${totalValue}" data-fmt="rp">0</span><span class="k-sub">harga satuan × stok</span></div>
    <div class="kpi ${crit.length?'alert':''}"><span class="k-label">Perlu Restock</span><span class="k-val mono" data-cu="${crit.length}">0</span><span class="k-sub">stok habis / di bawah minimum</span></div>
  </div>
  <div class="dash-grid">
    <section class="card span2"><div class="card-head"><h3 class="card-title">Stok per Kategori</h3><span class="mono dim" style="font-size:11px">UNIT</span></div>
      <div class="card-body"><div id="c-bars"></div></div></section>
    <section class="card"><div class="card-head"><h3 class="card-title">Nilai Stok</h3></div>
      <div class="card-body"><div id="c-donut"></div></div></section>
    <section class="card span2"><div class="card-head"><h3 class="card-title">Pengeluaran Barang — 30 Hari</h3><span class="mono dim" style="font-size:11px">${fmtNum(out30)} UNIT KELUAR</span></div>
      <div class="card-body"><div id="c-area"></div></div></section>
    <section class="card"><div class="card-head"><h3 class="card-title">Perlu Restock</h3><button class="btn sm ghost" id="go-inv">Inventaris</button></div>
      <div class="card-body">${crit.slice(0,8).map(i=>`
        <div class="crit-row"><div class="crit-name">${esc(i.name)}<br><span class="mono dim" style="font-size:11px">stok ${fmtNum(i.qty)} / min ${fmtNum(i.min)} ${esc(i.unit)}</span></div>${stampStatus(i)}</div>`).join('')
        ||'<div class="empty-mini">Semua stok dalam batas aman.</div>'}</div></section>
    <section class="card"><div class="card-head"><h3 class="card-title">Aktivitas Terakhir</h3></div>
      <div class="card-body">${stocklog.slice(0,8).map(l=>`
        <div class="act-row"><span class="tag t-${l.type}">${LOG_LABEL[l.type]||l.type}</span>
        <span class="act-txt"><b>${esc(l.name)}</b> · ${l.qty>0?'+':''}${fmtNum(l.qty)}${l.note?' — '+esc(l.note):''}</span>
        <span class="mono dim act-time">${fmtDT(l.t)}</span></div>`).join('')
        ||'<div class="empty-mini">Belum ada aktivitas.</div>'}</div></section>
  </div>`;
  requestAnimationFrame(()=>{
    $$('.k-val',el).forEach(v=>countUp(v,+v.dataset.cu,v.dataset.fmt==='rp'?fmtRp:fmtNum));
    mountBarChart($('#c-bars'),bars);
    mountDonut($('#c-donut'),donut);
    mountArea($('#c-area'),series,xlabels);
  });
  $('#go-inv').onclick=()=>go('inventory');
}

/* ===================== INVENTARIS ===================== */
function renderInventory(el){
  let list=items.slice();
  if(invState.cat!=='Semua')list=list.filter(i=>i.cat===invState.cat);
  if(invState.q){const q=invState.q.toLowerCase();
    list=list.filter(i=>i.name.toLowerCase().includes(q)||i.sku.toLowerCase().includes(q));}
  if(invState.sort==='stok')list.sort((a,b)=>a.qty-b.qty||a.name.localeCompare(b.name));
  else if(invState.sort==='nilai')list.sort((a,b)=>b.qty*b.price-a.qty*a.price);
  else list.sort((a,b)=>a.name.localeCompare(b.name));
  const tVal=list.reduce((s,i)=>s+i.qty*i.price,0);

  el.innerHTML=`
  <div class="toolbar">
    <div class="searchbox"><i data-lucide="search"></i><input id="inv-q" placeholder="Cari nama / SKU…" value="${esc(invState.q)}"></div>
    <select id="inv-cat">${['Semua',...catList()].map(c=>`<option ${c===invState.cat?'selected':''}>${esc(c)}</option>`).join('')}</select>
    <select id="inv-sort">
      ${[['nama','Urut: Nama A–Z'],['stok','Urut: Stok Terendah'],['nilai','Urut: Nilai Tertinggi']].map(o=>
        `<option value="${o[0]}" ${o[0]===invState.sort?'selected':''}>${o[1]}</option>`).join('')}
    </select>
    <div class="spacer"></div>
    <button class="btn" id="inv-import"><i data-lucide="upload"></i>Import Massal</button>
    <button class="btn" id="inv-export"><i data-lucide="file-spreadsheet"></i>Export Excel</button>
    <button class="btn primary" id="inv-add"><i data-lucide="plus"></i>Tambah Barang</button>
  </div>
  <div class="card">
    <div class="card-head"><h3 class="card-title">Daftar Barang — ${list.length} SKU</h3>
      <span class="mono dim" style="font-size:11px">NILAI: ${fmtRp(tVal)}</span></div>
    <div class="card-body table-wrap">
      ${list.length?`<table class="tbl"><thead><tr>
        <th>SKU</th><th>Nama Barang</th><th>Kategori</th><th class="num">Stok</th><th>Sat.</th>
        <th class="num">Harga Satuan</th><th class="num">Nilai Stok</th><th>Status</th><th>Aksi</th>
      </tr></thead><tbody id="inv-tbody">
      ${list.map(i=>`<tr>
        <td class="mono dim">${esc(i.sku)}</td>
        <td class="b">${esc(i.name)}</td>
        <td>${esc(i.cat)}</td>
        <td class="num mono ${i.qty===0?'qty-zero':''}">${fmtNum(i.qty)}</td>
        <td>${esc(i.unit)}</td>
        <td class="num mono">${fmtRp(i.price)}</td>
        <td class="num mono">${fmtRp(i.qty*i.price)}</td>
        <td>${stampStatus(i)}</td>
        <td class="acts">
          <button class="btn icon" data-act="edit" data-id="${i.id}" title="Edit barang"><i data-lucide="pencil"></i></button>
          <button class="btn icon" data-act="restock" data-id="${i.id}" title="Tambah stok (barang masuk)"><i data-lucide="package-plus"></i></button>
          <button class="btn icon" data-act="del" data-id="${i.id}" title="Hapus barang"><i data-lucide="trash-2"></i></button>
        </td></tr>`).join('')}
      </tbody></table>`
      :`<div class="empty"><i data-lucide="boxes"></i><p>Tidak ada barang yang cocok dengan pencarian / filter.</p></div>`}
    </div>
  </div>`;

  $('#inv-q').addEventListener('input',e=>{
    invState.q=e.target.value;
    renderInventory(el);
    const n=$('#inv-q'); n.focus(); try{n.setSelectionRange(n.value.length,n.value.length);}catch(err){}
  });
  $('#inv-cat').addEventListener('change',e=>{invState.cat=e.target.value;renderInventory(el);});
  $('#inv-sort').addEventListener('change',e=>{invState.sort=e.target.value;renderInventory(el);});
  $('#inv-add').onclick=()=>openItemModal(null);
  $('#inv-import').onclick=openImportModal;
  $('#inv-export').onclick=()=>exportInventoryExcel();
  $('#inv-tbody')&&$('#inv-tbody').addEventListener('click',e=>{
    const b=e.target.closest('[data-act]'); if(!b)return;
    const it=items.find(x=>x.id===b.dataset.id); if(!it)return;
    if(b.dataset.act==='edit')openItemModal(it);
    else if(b.dataset.act==='restock')openRestockModal(it);
    else if(b.dataset.act==='del')askConfirm('Hapus Barang',
      `Hapus <b>${esc(it.name)}</b> (${esc(it.sku)}) dari inventaris? Riwayat stok tetap tersimpan.`,
      ()=>{ pushLog('adj',it.name,-it.qty,'Penghapusan item dari inventaris');
        items=items.filter(x=>x.id!==it.id); persist('inventory',items); refresh(); toast('Barang dihapus.'); });
  });
}

function openItemModal(it){
  const edit=!!it;
  openModal(`
  <div class="mhead"><h3>${edit?'Edit Barang':'Tambah Barang'}</h3><span class="mono">${edit?esc(it.sku):'SKU OTOMATIS'}</span></div>
  <div class="mbody">
    <label>Nama Barang<input id="if-name" value="${esc(it?.name||'')}" placeholder="mis. Router ZTE F660" required></label>
    <div class="form-grid">
      <label>Kategori<input id="if-cat" list="dl-cat" value="${esc(it?.cat||'')}" placeholder="mis. Router / ONT"></label>
      <label>SKU<input id="if-sku" class="mono" value="${esc(it?.sku||'')}" placeholder="kosong = otomatis"></label>
      <label>Satuan<input id="if-unit" value="${esc(it?.unit||'pcs')}" placeholder="pcs / mtr / roll"></label>
      <label>Stok${edit?' (perubahan dicatat)':''}<input id="if-qty" type="number" min="0" value="${it?it.qty:0}"></label>
      <label>Stok Minimum<input id="if-min" type="number" min="0" value="${it?it.min:0}"></label>
      <label>Harga Satuan (Rp)<input id="if-price" type="number" min="0" value="${it?it.price:0}"></label>
    </div>
    <datalist id="dl-cat">${catList().map(c=>`<option value="${esc(c)}">`).join('')}</datalist>
  </div>
  <div class="mfoot"><button class="btn" data-close>Batal</button>
  <button class="btn primary" id="if-save">${edit?'Simpan Perubahan':'Tambah ke Inventaris'}</button></div>`);
  $('#if-save').onclick=()=>{
    const name=$('#if-name').value.trim(),cat=$('#if-cat').value.trim()||'Lainnya';
    const unit=$('#if-unit').value.trim()||'pcs';
    const qty=Math.max(0,parseInt($('#if-qty').value,10)||0);
    const min=Math.max(0,parseInt($('#if-min').value,10)||0);
    const price=Math.max(0,parseInt($('#if-price').value,10)||0);
    if(!name){toast('Nama barang wajib diisi.','err');return;}
    if(edit){
      if(qty!==it.qty)pushLog('adj',name,qty-it.qty,'Penyesuaian stok manual');
      Object.assign(it,{name,cat,unit,qty,min,price,
        sku:$('#if-sku').value.trim()||it.sku});
      persist('inventory',items); closeModal(); refresh(); toast('Perubahan barang disimpan.');
    }else{
      items.push({id:uid(),sku:$('#if-sku').value.trim()||genSku(cat),name,cat,unit,qty,min,price});
      if(qty>0)pushLog('in',name,qty,'Barang baru ditambahkan');
      persist('inventory',items); closeModal(); refresh(); toast(name+' masuk ke inventaris.');
    }
  };
}
function openRestockModal(it){
  openModal(`
  <div class="mhead"><h3>Tambah Stok</h3><span class="mono">${esc(it.sku)}</span></div>
  <div class="mbody">
    <p class="hint">Barang: <b>${esc(it.name)}</b> — stok saat ini <b class="mono">${fmtNum(it.qty)} ${esc(it.unit)}</b></p>
    <div class="form-grid">
      <label>Qty Masuk<input id="rs-qty" type="number" min="1" value="1"></label>
      <label>Keterangan<input id="rs-note" placeholder="mis. beli dari distributor"></label>
    </div>
  </div>
  <div class="mfoot"><button class="btn" data-close>Batal</button>
  <button class="btn primary" id="rs-save">Catat Barang Masuk</button></div>`);
  $('#rs-save').onclick=()=>{
    const q=Math.max(1,parseInt($('#rs-qty').value,10)||0);
    it.qty+=q;
    pushLog('in',it.name,q,$('#rs-note').value.trim()||'Restock manual');
    persist('inventory',items); closeModal(); refresh();
    toast(`+${fmtNum(q)} ${esc(it.unit)} ${esc(it.name)} masuk gudang.`);
  };
}
function openImportModal(){
  openModal(`
  <div class="mhead"><h3>Import Massal Barang</h3><span class="mono">CSV / TEKS</span></div>
  <div class="mbody">
    <p class="hint">Format per baris (pemisah <code>;</code> atau Tab):<br>
    <code>Nama Barang ; Kategori ; Satuan ; Qty ; Harga</code><br>
    Kategori &amp; SKU lama tidak terpengaruh — hanya menambah barang baru.</p>
    <div class="file-row">
      <input type="file" id="im-file" accept=".csv,.txt">
      <button class="btn sm ghost" id="im-tpl"><i data-lucide="download"></i>Unduh Template CSV</button>
    </div>
    <textarea id="im-text" rows="9" class="mono" placeholder="Router ZTE F609; Router / ONT; pcs; 10; 350000&#10;Kabel DC 1 Core; Kabel; mtr; 500; 1500"></textarea>
  </div>
  <div class="mfoot"><button class="btn" data-close>Batal</button>
  <button class="btn primary" id="im-go"><i data-lucide="upload"></i>Proses Import</button></div>`,true);
  $('#im-file').addEventListener('change',e=>{
    const f=e.target.files[0]; if(!f)return;
    const r=new FileReader(); r.onload=()=>{$('#im-text').value=r.result;}; r.readAsText(f);
  });
  $('#im-tpl').onclick=()=>{
    _dl(new Blob(['Nama Barang;Kategori;Satuan;Qty;Harga\r\nRouter ZTE F609;Router / ONT;pcs;10;350000\r\nKabel DC 1 Core;Kabel;mtr;500;1500'],{type:'text/csv'}),'template-import-barang.csv');
  };
  $('#im-go').onclick=()=>{
    const text=$('#im-text').value; if(!text.trim()){toast('Data masih kosong.','warn');return;}
    let ok=0,fail=0,qTot=0;
    text.split(/\r?\n/).forEach(ln=>{
      if(!ln.trim())return;
      const p=ln.split(/[;\t]/).map(s=>s.trim());
      if(p.length<5||!p[0]){fail++;return;}
      const qty=parseInt(String(p[3]).replace(/[^\d]/g,''),10);
      const price=parseInt(String(p[4]).replace(/[^\d]/g,''),10);
      if(isNaN(qty)||qty<0||isNaN(price)||price<0){fail++;return;}
      const cat=p[1]||'Lainnya';
      items.push({id:uid(),sku:genSku(cat),name:p[0],cat,unit:p[2]||'pcs',qty,min:0,price});
      ok++; qTot+=qty;
    });
    persist('inventory',items);
    if(ok)pushLog('in','Import massal',qTot,ok+' barang baru');
    closeModal(); refresh();
    toast(ok?`${ok} barang ditambahkan${fail?`, ${fail} baris gagal dibaca.`:'.'}`:'Semua baris gagal dibaca — cek formatnya.',ok?'ok':'err');
  };
}

/* ===================== TICKET KELUAR ===================== */
function renderOut(el){
  let list=outT.slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  if(outState.status!=='Semua')list=list.filter(t=>(outState.status==='Aktif'?t.status==='active':t.status==='void'));
  if(outState.q){const q=outState.q.toLowerCase();
    list=list.filter(t=>t.no.toLowerCase().includes(q)||t.tech.toLowerCase().includes(q)||(t.purpose||'').toLowerCase().includes(q));}

  el.innerHTML=`
  <div class="toolbar">
    <div class="searchbox"><i data-lucide="search"></i><input id="out-q" placeholder="Cari no ticket / teknisi…" value="${esc(outState.q)}"></div>
    <div class="chip-row" id="out-chips">
      ${['Semua','Aktif','Dibatalkan'].map(s=>`<button class="chip ${outState.status===s?'active':''}" data-v="${s}">${s}</button>`).join('')}
    </div>
    <div class="spacer"></div>
    <button class="btn" id="out-export"><i data-lucide="file-spreadsheet"></i>Export Excel</button>
    <button class="btn primary" id="out-add"><i data-lucide="plus"></i>Buat Ticket Keluar</button>
  </div>
  <div class="card">
    <div class="card-head"><h3 class="card-title">Riwayat Ticket — ${list.length} ticket</h3></div>
    <div class="card-body table-wrap">
      ${list.length?`<table class="tbl"><thead><tr>
        <th>No Ticket</th><th>Tanggal</th><th>Teknisi</th><th>Barang Diambil</th>
        <th class="num">Nilai</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="out-tbody">
        ${list.map(t=>{
          const tq=t.items.reduce((s,i)=>s+i.qty,0);
          const sum=t.items.length===1?esc(t.items[0].name):esc(t.items[0].name)+` +${t.items.length-1} lainnya`;
          return `<tr>
            <td class="mono b">${esc(t.no)}</td>
            <td>${fmtDate(t.date)}</td>
            <td class="b">${esc(t.tech)}</td>
            <td>${sum} <span class="mono dim" style="font-size:11px">· ${fmtNum(tq)} unit</span></td>
            <td class="num mono">${fmtRp(t.totalValue)}</td>
            <td>${t.status==='active'?'<span class="stamp ok">AKTIF</span>':'<span class="stamp bad">BATAL</span>'}</td>
            <td class="acts">
              <button class="btn icon" data-act="view" data-id="${t.id}" title="Detail"><i data-lucide="eye"></i></button>
              <button class="btn icon" data-act="print" data-id="${t.id}" title="Cetak struk"><i data-lucide="printer"></i></button>
              ${t.status==='active'?`<button class="btn icon" data-act="void" data-id="${t.id}" title="Batalkan & kembalikan stok"><i data-lucide="x"></i></button>`:''}
            </td></tr>`;}).join('')}
      </tbody></table>`
      :`<div class="empty"><i data-lucide="clipboard-list"></i><p>Belum ada ticket pengeluaran barang.<br>Tekan <b>Buat Ticket Keluar</b> untuk mencatat barang yang diambil teknisi.</p></div>`}
    </div>
  </div>`;

  $('#out-q').addEventListener('input',e=>{
    outState.q=e.target.value; renderOut(el);
    const n=$('#out-q'); n.focus(); try{n.setSelectionRange(n.value.length,n.value.length);}catch(err){}
  });
  $('#out-chips').addEventListener('click',e=>{
    const c=e.target.closest('.chip'); if(!c)return;
    outState.status=c.dataset.v; renderOut(el);
  });
  $('#out-add').onclick=openOutModal;
  $('#out-export').onclick=()=>exportOutExcel();
  $('#out-tbody')&&$('#out-tbody').addEventListener('click',e=>{
    const b=e.target.closest('[data-act]'); if(!b)return;
    const t=outT.find(x=>x.id===b.dataset.id); if(!t)return;
    if(b.dataset.act==='view')openOutDetail(t);
    else if(b.dataset.act==='print')printOutTicket(t);
    else if(b.dataset.act==='void')askConfirm('Batalkan Ticket',
      `Stok barang pada ticket <b>${esc(t.no)}</b> akan dikembalikan ke gudang.`,
      ()=>{ t.status='void';
        t.items.forEach(i=>{
          const it=items.find(x=>x.id===i.id)||items.find(x=>x.sku===i.sku);
          if(it)it.qty+=i.qty;
          pushLog('in',i.name,i.qty,'Pembatalan '+t.no);
        });
        persist('out',outT); persist('inventory',items); refresh();
        toast(t.no+' dibatalkan — stok dikembalikan.'); },
      'Ya, Batalkan');
  });
}

function openOutModal(){
  const no=nextNo('out');
  const opts=items.filter(i=>i.qty>0).map(i=>`<option value="${i.id}" data-unit="${esc(i.unit)}">${esc(i.name)} — stok ${fmtNum(i.qty)} ${esc(i.unit)}</option>`).join('');
  openModal(`
  <div class="mhead"><h3>Buat Ticket Keluar</h3><span class="mono">${no}</span></div>
  <div class="mbody">
    <div class="form-grid">
      <label>Tanggal<input type="date" id="ot-date" value="${todayISO()}"></label>
      <label>Nama Teknisi<input list="dl-tech" id="ot-tech" placeholder="— diisi petugas —" autocomplete="off"></label>
    </div>
    <datalist id="dl-tech">${techs.map(t=>`<option value="${esc(t.name)}">`).join('')}</datalist>
    <label>Keperluan / Tujuan<input id="ot-purpose" placeholder="mis. Instalasi baru — Pelanggan ..."></label>
    <div class="mlabel">Barang Diambil</div>
    <div id="ot-lines"></div>
    <button class="btn sm ghost" id="ot-addline" type="button"><i data-lucide="plus"></i>Tambah Baris Barang</button>
    <label>Catatan<input id="ot-note" placeholder="opsional"></label>
  </div>
  <div class="mfoot"><button class="btn" data-close>Batal</button>
  <button class="btn primary" id="ot-save">Simpan &amp; Keluarkan Barang</button></div>`);
  const addLine=()=>{
    const row=document.createElement('div'); row.className='oline';
    row.innerHTML=`
      <select class="oline-item">${opts||'<option value="">— stok kosong —</option>'}</select>
      <input type="number" class="oline-qty" min="1" value="1" title="Qty">
      <span class="oline-unit mono"></span>
      <button class="btn icon" type="button" title="Hapus baris"><i data-lucide="x"></i></button>`;
    const sel=$('.oline-item',row),unit=$('.oline-unit',row);
    const sync=()=>{const o=sel.selectedOptions[0];unit.textContent=o&&o.dataset.unit?o.dataset.unit:'';};
    sel.addEventListener('change',sync); sync();
    $('button',row).onclick=()=>row.remove();
    $('#ot-lines').appendChild(row); icons();
  };
  addLine();
  $('#ot-addline').onclick=addLine;
  $('#ot-save').onclick=()=>{
    const tech=$('#ot-tech').value.trim();
    if(!tech){toast('Nama teknisi wajib diisi.','err');return;}
    const agg={};
    $$('#ot-lines .oline').forEach(r=>{
      const id=$('.oline-item',r).value, q=Math.max(0,parseInt($('.oline-qty',r).value,10)||0);
      if(id&&q>0)agg[id]=(agg[id]||0)+q;
    });
    const ids=Object.keys(agg);
    if(!ids.length){toast('Tambahkan minimal 1 barang dengan qty di atas 0.','err');return;}
    for(const id of ids){
      const it=items.find(x=>x.id===id);
      if(!it||agg[id]>it.qty){toast(`Stok ${it?esc(it.name):'barang'} tidak cukup.`,'err');return;}
    }
    const tItems=ids.map(id=>{const it=items.find(x=>x.id===id);
      return {id,name:it.name,sku:it.sku,unit:it.unit,qty:agg[id],price:it.price};});
    const ticket={id:uid(),no,date:$('#ot-date').value||todayISO(),tech,
      purpose:$('#ot-purpose').value.trim(),note:$('#ot-note').value.trim(),
      items:tItems,totalValue:tItems.reduce((s,i)=>s+i.qty*i.price,0),
      status:'active',createdAt:Date.now()};
    tItems.forEach(i=>{
      items.find(x=>x.id===i.id).qty-=i.qty;
      pushLog('out',i.name,i.qty,no+' · '+tech);
    });
    outT.push(ticket);
    upsertTech(tech);
    persist('out',outT); persist('inventory',items); persist('techs',techs);
    closeModal(); refresh();
    toast(`Ticket ${no} tersimpan — ${fmtNum(tItems.reduce((s,i)=>s+i.qty,0))} unit keluar gudang.`);
    setTimeout(()=>openOutDetail(ticket),350);
  };
}
function openOutDetail(t){
  openModal(`
  <div class="mhead"><h3>Detail Ticket</h3><span class="mono">${esc(t.no)}</span></div>
  <div class="mbody">
    <div class="form-grid">
      <div><span class="dim" style="font-size:11px">TANGGAL</span><br><b>${fmtDate(t.date)}</b></div>
      <div><span class="dim" style="font-size:11px">TEKNISI</span><br><b>${esc(t.tech)}</b></div>
      <div><span class="dim" style="font-size:11px">STATUS</span><br>${t.status==='active'?'<span class="stamp ok">AKTIF</span>':'<span class="stamp bad">BATAL</span>'}</div>
    </div>
    <p class="hint">Keperluan: ${esc(t.purpose||'—')}${t.note?'<br>Catatan: '+esc(t.note):''}</p>
    <div class="table-wrap"><table class="tbl" style="min-width:380px">
      <thead><tr><th>Barang</th><th class="num">Qty</th><th>Sat.</th><th class="num">Nilai</th></tr></thead>
      <tbody>${t.items.map(i=>`<tr><td>${esc(i.name)}</td><td class="num mono">${fmtNum(i.qty)}</td><td>${esc(i.unit)}</td><td class="num mono">${fmtRp(i.qty*i.price)}</td></tr>`).join('')}
      <tr><td class="b">TOTAL</td><td class="num mono b">${fmtNum(t.items.reduce((s,i)=>s+i.qty,0))}</td><td></td><td class="num mono b">${fmtRp(t.totalValue)}</td></tr>
      </tbody></table></div>
  </div>
  <div class="mfoot">
    ${t.status==='active'?`<button class="btn danger" id="od-void">Batalkan Ticket</button>`:''}
    <button class="btn dark" id="od-print"><i data-lucide="printer"></i>Cetak Struk</button>
    <button class="btn" data-close>Tutup</button>
  </div>`);
  $('#od-print').onclick=()=>printOutTicket(t);
  const v=$('#od-void'); if(v)v.onclick=()=>{closeModal();$$('.mback');askConfirm('Batalkan Ticket',
    `Stok barang pada ticket <b>${esc(t.no)}</b> akan dikembalikan ke gudang.`,
    ()=>{t.status='void';t.items.forEach(i=>{const it=items.find(x=>x.id===i.id)||items.find(x=>x.sku===i.sku);
      if(it)it.qty+=i.qty;pushLog('in',i.name,i.qty,'Pembatalan '+t.no);});
      persist('out',outT);persist('inventory',items);refresh();toast(t.no+' dibatalkan — stok dikembalikan.');},'Ya, Batalkan');};
}
function printOutTicket(t){
  const logo=settings.logo?`<img src="${settings.logo}">`:'';
  $('#print-area').innerHTML=`
  <div class="slip">
    <div class="slip-head">${logo}<div><b>${esc(settings.company)}</b><br><span>Gudang &amp; Inventory</span></div></div>
    <div class="slip-title">TICKET PENGELUARAN BARANG</div>
    <table class="slip-meta">
      <tr><td>No. Ticket</td><td class="b">${esc(t.no)}</td><td>Tanggal</td><td>${fmtDate(t.date)}</td></tr>
      <tr><td>Teknisi</td><td class="b">${esc(t.tech)}</td><td>Status</td><td>${t.status==='void'?'DIBATALKAN':'AKTIF'}</td></tr>
      <tr><td>Keperluan</td><td colspan="3">${esc(t.purpose||'-')}</td></tr>
    </table>
    <table class="data"><thead><tr><th>Barang</th><th class="r">Qty</th><th>Sat.</th><th class="r">Nilai</th></tr></thead>
    <tbody>
      ${t.items.map(i=>`<tr><td>${esc(i.name)}</td><td class="r">${fmtNum(i.qty)}</td><td>${esc(i.unit)}</td><td class="r">${fmtRp(i.qty*i.price)}</td></tr>`).join('')}
      <tr><td><b>TOTAL</b></td><td class="r"><b>${fmtNum(t.items.reduce((s,i)=>s+i.qty,0))}</b></td><td></td><td class="r"><b>${fmtRp(t.totalValue)}</b></td></tr>
    </tbody></table>
    ${t.note?`<p class="slip-note">Catatan: ${esc(t.note)}</p>`:''}
    <div class="slip-sign"><div>Petugas Gudang</div><div>Teknisi Pengambil</div></div>
    <p class="slip-foot">dicetak ${new Date().toLocaleString('id-ID')}</p>
  </div>`;
  window.print();
}

/* ===================== TICKET PERBAIKAN ===================== */
function renderFix(el){
  let list=fixT.slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  if(fixState.status!=='Semua')list=list.filter(f=>f.status===fixState.status);
  const stCls={'Baru':'warn','Proses':'neutral','Selesai':'ok'};

  el.innerHTML=`
  <div class="toolbar">
    <div class="chip-row" id="fix-chips">
      ${['Semua','Baru','Proses','Selesai'].map(s=>`<button class="chip ${fixState.status===s?'active':''}" data-v="${s}">${s}</button>`).join('')}
    </div>
    <div class="spacer"></div>
    <button class="btn" id="fix-export"><i data-lucide="file-spreadsheet"></i>Export Excel</button>
    <button class="btn primary" id="fix-add"><i data-lucide="plus"></i>Buat Ticket Perbaikan</button>
  </div>
  ${list.length?`<div class="job-list">
    ${list.map(f=>`
    <div class="job">
      <div class="job-pri pri-${esc(f.prio)}"></div>
      <div class="job-body">
        <div class="job-top">
          <span class="mono">${esc(f.no)}</span>
          <span class="mono dim" style="font-size:11px">${fmtDate(f.date)}</span>
          <span class="stamp ${stCls[f.status]||'neutral'}">${esc(f.status).toUpperCase()}</span>
        </div>
        <div class="job-name">${esc(f.customer)}</div>
        <div class="job-sub">${esc(f.device)} — ${esc(f.desc.length>95?f.desc.slice(0,95)+'…':f.desc)}</div>
        <div class="job-meta">Teknisi: ${f.tech?esc(f.tech):'— BELUM DITUGASKAN —'} · Prioritas: ${esc(f.prio)}</div>
      </div>
      <div class="job-acts">
        ${f.status!=='Selesai'?`<button class="btn sm ${f.status==='Baru'?'primary':''}" data-act="next" data-id="${f.id}">${f.status==='Baru'?'Kerjakan':'Selesaikan'}</button>`:''}
        <button class="btn icon" data-act="print" data-id="${f.id}" title="Cetak work order"><i data-lucide="printer"></i></button>
        <button class="btn icon" data-act="del" data-id="${f.id}" title="Hapus"><i data-lucide="trash-2"></i></button>
      </div>
    </div>`).join('')}
  </div>`
  :`<div class="card"><div class="empty"><i data-lucide="wrench"></i>
     <p>Belum ada ticket perbaikan pada filter ini.<br>Tekan <b>Buat Ticket Perbaikan</b> untuk mencatat kerusakan perangkat pelanggan.</p></div></div>`}`;

  $('#fix-chips').addEventListener('click',e=>{
    const c=e.target.closest('.chip'); if(!c)return;
    fixState.status=c.dataset.v; renderFix(el);
  });
  $('#fix-add').onclick=openFixModal;
  $('#fix-export').onclick=()=>exportFixExcel();
  el.addEventListener('click',e=>{
    const b=e.target.closest('[data-act]'); if(!b)return;
    const f=fixT.find(x=>x.id===b.dataset.id); if(!f)return;
    if(b.dataset.act==='next'){
      f.status=f.status==='Baru'?'Proses':'Selesai';
      if(f.tech)upsertTech(f.tech);
      persist('fix',fixT); refresh(); toast(f.no+' → '+f.status.toUpperCase()+'.');
    }else if(b.dataset.act==='print')printFixTicket(f);
    else if(b.dataset.act==='del')askConfirm('Hapus Ticket',
      `Hapus ticket perbaikan <b>${esc(f.no)}</b> (${esc(f.customer)})?`,
      ()=>{fixT=fixT.filter(x=>x.id!==f.id);persist('fix',fixT);refresh();toast('Ticket perbaikan dihapus.');});
  });
}
function openFixModal(f){
  const edit=!!f;
  const no=edit?f.no:nextNo('fix');
  const dlDev=items.filter(i=>/router|ont/i.test(i.cat)).map(i=>`<option value="${esc(i.name)}">`).join('');
  openModal(`
  <div class="mhead"><h3>${edit?'Edit':'Buat'} Ticket Perbaikan</h3><span class="mono">${no}</span></div>
  <div class="mbody">
    <div class="form-grid">
      <label>Pelanggan / Lokasi<input id="ff-cust" value="${esc(f?.customer||'')}" placeholder="mis. Pelanggan — Jl. Melati No. 12" required></label>
      <label>Tanggal<input type="date" id="ff-date" value="${f?f.date:todayISO()}"></label>
    </div>
    <label>Perangkat<input id="ff-dev" list="dl-dev" value="${esc(f?.device||'')}" placeholder="mis. Router ZTE F660 / ONU"></label>
    <datalist id="dl-dev">${dlDev}</datalist>
    <label>Kerusakan / Keluhan<textarea id="ff-desc" rows="3" placeholder="deskripsi kerusakan…">${esc(f?.desc||'')}</textarea></label>
    <div class="form-grid">
      <label>Teknisi<input list="dl-tech2" id="ff-tech" value="${esc(f?.tech||'')}" placeholder="— diisi petugas —"></label>
      <label>Prioritas<select id="ff-prio">
        ${['Rendah','Sedang','Tinggi'].map(p=>`<option ${f&&f.prio===p?'selected':''}>${p}</option>`).join('')}
      </select></label>
    </div>
    <datalist id="dl-tech2">${techs.map(t=>`<option value="${esc(t.name)}">`).join('')}</datalist>
  </div>
  <div class="mfoot"><button class="btn" data-close>Batal</button>
  <button class="btn primary" id="ff-save">${edit?'Simpan':'Simpan Ticket'}</button></div>`);
  $('#ff-save').onclick=()=>{
    const cust=$('#ff-cust').value.trim(),dev=$('#ff-dev').value.trim()||'-',
          desc=$('#ff-desc').value.trim(),tech=$('#ff-tech').value.trim(),
          prio=$('#ff-prio').value,date=$('#ff-date').value||todayISO();
    if(!cust){toast('Pelanggan / lokasi wajib diisi.','err');return;}
    if(!desc){toast('Deskripsi kerusakan wajib diisi.','err');return;}
    if(edit){
      Object.assign(f,{customer:cust,device:dev,desc,tech,prio,date});
      if(tech)upsertTech(tech);
      persist('fix',fixT); closeModal(); refresh(); toast(f.no+' diperbarui.');
    }else{
      fixT.push({id:uid(),no,date,customer:cust,device:dev,desc,tech,prio,status:'Baru',createdAt:Date.now()});
      if(tech)upsertTech(tech);
      persist('fix',fixT); persist('techs',techs); closeModal(); refresh();
      toast('Ticket perbaikan '+no+' dibuat.');
    }
  };
}
function printFixTicket(f){
  const logo=settings.logo?`<img src="${settings.logo}">`:'';
  $('#print-area').innerHTML=`
  <div class="slip">
    <div class="slip-head">${logo}<div><b>${esc(settings.company)}</b><br><span>Teknis &amp; Perbaikan</span></div></div>
    <div class="slip-title">TICKET PERBAIKAN / WORK ORDER</div>
    <table class="slip-meta">
      <tr><td>No. Ticket</td><td class="b">${esc(f.no)}</td><td>Tanggal</td><td>${fmtDate(f.date)}</td></tr>
      <tr><td>Pelanggan</td><td class="b">${esc(f.customer)}</td><td>Status</td><td>${esc(f.status).toUpperCase()}</td></tr>
      <tr><td>Perangkat</td><td colspan="3">${esc(f.device)}</td></tr>
      <tr><td>Teknisi</td><td colspan="3">${f.tech?esc(f.tech):'—'}</td></tr>
      <tr><td>Prioritas</td><td colspan="3">${esc(f.prio)}</td></tr>
    </table>
    <table class="data"><thead><tr><th>Uraian Kerusakan</th></tr></thead>
    <tbody><tr><td>${esc(f.desc)}</td></tr></tbody></table>
    <div class="slip-sign"><div>Petugas Gudang</div><div>Teknisi</div></div>
    <p class="slip-foot">dicetak ${new Date().toLocaleString('id-ID')}</p>
  </div>`;
  window.print();
}

/* ===================== ALBUM FOTO ===================== */
function renderAlbum(el){
  const cats=['Semua',...new Set(photos.map(p=>p.cat))];
  let list=albState.cat==='Semua'?photos:photos.filter(p=>p.cat===albState.cat);
  lbList=list;

  el.innerHTML=`
  <div class="toolbar">
    <div class="chip-row" id="alb-chips">${cats.map(c=>`<button class="chip ${albState.cat===c?'active':''}" data-v="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <div class="spacer"></div>
    <button class="btn primary" id="alb-add"><i data-lucide="image-plus"></i>Upload Foto</button>
  </div>
  <div class="card"><div class="card-body">
    <div class="dropzone" id="alb-drop">
      <i data-lucide="image-plus"></i>
      <b>Tarik &amp; letakkan foto di sini</b>
      <span>atau klik untuk memilih file (bisa banyak sekaligus, otomatis dikompres)</span>
    </div>
    <input type="file" id="alb-file" accept="image/*" multiple hidden>
  </div></div>
  <p class="hint" style="margin-top:-8px">Foto tersimpan di browser (localStorage). Gunakan <b>Backup JSON</b> di menu Pengaturan untuk cadangan.</p>
  ${list.length?`<div class="photo-grid">
    ${list.map(p=>`
    <figure class="photo" data-id="${p.id}">
      <img src="${p.src}" alt="${esc(p.caption)}" loading="lazy">
      <figcaption class="cap"><span>${esc(p.caption||p.cat)}</span><span>${fmtDate(p.date)}</span></figcaption>
      <button class="del" data-del="${p.id}" title="Hapus foto"><i data-lucide="trash-2"></i></button>
    </figure>`).join('')}
  </div>`
  :`<div class="card"><div class="empty"><i data-lucide="images"></i><p>Album masih kosong.<br>Upload foto pekerjaan, perangkat, atau dokumentasi gudang.</p></div></div>`}`;

  const fileInput=$('#alb-file'),drop=$('#alb-drop');
  drop.onclick=()=>fileInput.click();
  fileInput.addEventListener('change',e=>{handlePhotoFiles(e.target.files);e.target.value='';});
  drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('over');});
  drop.addEventListener('dragleave',()=>drop.classList.remove('over'));
  drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('over');handlePhotoFiles(e.dataTransfer.files);});
  $('#alb-add').onclick=()=>fileInput.click();
  $('#alb-chips').addEventListener('click',e=>{
    const c=e.target.closest('.chip'); if(!c)return;
    albState.cat=c.dataset.v; renderAlbum(el);
  });
  el.addEventListener('click',e=>{
    const del=e.target.closest('[data-del]');
    if(del){
      e.stopPropagation();
      const p=photos.find(x=>x.id===del.dataset.del);
      askConfirm('Hapus Foto',`Hapus foto <b>${esc(p.caption||'tanpa keterangan')}</b> dari album?`,
        ()=>{photos=photos.filter(x=>x.id!==p.id);persist('photos',photos);refresh();toast('Foto dihapus.');});
      return;
    }
    const ph=e.target.closest('.photo');
    if(ph)openLightbox(list.findIndex(x=>x.id===ph.dataset.id));
  });
}
function handlePhotoFiles(files){
  const fs=[...files].filter(f=>f.type.startsWith('image/'));
  if(!fs.length){toast('Tidak ada file gambar yang terbaca.','err');return;}
  const jobs=fs.slice(0,30).map(f=>new Promise(res=>{
    const img=new Image(),url=URL.createObjectURL(f);
    img.onload=()=>{
      const max=1000,sc=Math.min(1,max/Math.max(img.width,img.height));
      const c=document.createElement('canvas');
      c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      URL.revokeObjectURL(url);res(c.toDataURL('image/jpeg',0.82));
    };
    img.onerror=()=>res(null);
    img.src=url;
  }));
  Promise.all(jobs).then(srcs=>{
    const ok=srcs.filter(Boolean);
    if(!ok.length){toast('Gagal memproses gambar.','err');return;}
    openPhotoConfirm(ok);
  });
}
function openPhotoConfirm(srcs){
  const catOpts=['Pekerjaan','Perangkat','Dokumentasi','Lainnya'];
  openModal(`
  <div class="mhead"><h3>Konfirmasi Upload</h3><span class="mono">${srcs.length} FOTO</span></div>
  <div class="mbody">
    <p class="hint">Beri keterangan singkat lalu simpan ke album.</p>
    <div class="pm-grid">
      ${srcs.map((s,ix)=>`<div class="pm-item">
        <img src="${s}">
        <input placeholder="Keterangan…" data-cap="${ix}">
        <select data-cat="${ix}">${catOpts.map(c=>`<option ${c==='Pekerjaan'?'selected':''}>${c}</option>`).join('')}</select>
      </div>`).join('')}
    </div>
  </div>
  <div class="mfoot"><button class="btn" data-close>Batal</button>
  <button class="btn primary" id="pm-save"><i data-lucide="upload"></i>Simpan ke Album</button></div>`,true);
  $('#pm-save').onclick=()=>{
    srcs.forEach((s,ix)=>{
      const cap=$(`[data-cap="${ix}"]`).value.trim();
      const cat=$(`[data-cat="${ix}"]`).value;
      photos.unshift({id:uid(),src:s,caption:cap,cat,date:todayISO(),ts:Date.now()});
    });
    persist('photos',photos); closeModal(); refresh();
    toast(srcs.length+' foto tersimpan di album.');
  };
}
function initLightbox(){
  const lb=$('#lightbox');
  lb.innerHTML=`
    <button class="lb-btn" id="lb-close"><i data-lucide="x"></i></button>
    <img id="lb-img" alt="">
    <div class="lb-cap"><span id="lb-count"></span><span id="lb-text"></span></div>
    <div class="lb-nav">
      <button class="lb-btn" id="lb-prev"><i data-lucide="chevron-left"></i></button>
      <button class="lb-btn" id="lb-next"><i data-lucide="chevron-right"></i></button>
      <button class="lb-btn" id="lb-del"><i data-lucide="trash-2"></i></button>
    </div>`;
  icons();
  $('#lb-close').onclick=()=>lb.hidden=true;
  $('#lb-prev').onclick=()=>{if(lbList.length){lbIndex=(lbIndex-1+lbList.length)%lbList.length;updateLightbox();}};
  $('#lb-next').onclick=()=>{if(lbList.length){lbIndex=(lbIndex+1)%lbList.length;updateLightbox();}};
  $('#lb-del').onclick=()=>{
    const p=lbList[lbIndex]; if(!p)return;
    askConfirm('Hapus Foto',`Hapus foto <b>${esc(p.caption||'tanpa keterangan')}</b>?`,
      ()=>{photos=photos.filter(x=>x.id!==p.id);persist('photos',photos);
        lbList=lbList.filter(x=>x.id!==p.id);
        if(!lbList.length){lb.hidden=true;}else{lbIndex=Math.min(lbIndex,lbList.length-1);updateLightbox();}
        refresh();});
  };
  document.addEventListener('keydown',e=>{
    if(lb.hidden)return;
    if(e.key==='Escape')lb.hidden=true;
    if(e.key==='ArrowLeft')$('#lb-prev').click();
    if(e.key==='ArrowRight')$('#lb-next').click();
  });
}
function openLightbox(i){ if(i<0)return; lbIndex=i; $('#lightbox').hidden=false; updateLightbox(); }
function updateLightbox(){
  const p=lbList[lbIndex]; if(!p)return;
  $('#lb-img').src=p.src;
  $('#lb-count').textContent=(lbIndex+1)+' / '+lbList.length;
  $('#lb-text').textContent=(p.caption?p.caption+' · ':'')+p.cat+' · '+fmtDate(p.date);
}

/* ===================== TEKNISI ===================== */
function renderTechs(el){
  const count=t=>t?(outT.filter(x=>x.tech===t.name&&x.status==='active').length):0;
  const fcount=t=>t?(fixT.filter(x=>x.tech===t.name).length):0;
  el.innerHTML=`
  <div class="toolbar">
    <span class="hint">${techs.length} teknisi terdaftar — daftar ini juga terisi otomatis setiap nama teknisi baru ditulis pada ticket.</span>
    <div class="spacer"></div>
    <button class="btn primary" id="tc-add"><i data-lucide="plus"></i>Tambah Teknisi</button>
  </div>
  ${techs.length?`<div class="tech-grid">
    ${techs.map(t=>`<div class="tcard">
      <div style="display:flex;gap:12px;align-items:center">
        <div class="tavatar">${esc(t.name.trim().slice(0,2).toUpperCase())}</div>
        <div><div class="tname">${esc(t.name)}</div>
        <div class="mono dim" style="font-size:11px">${t.phone?esc(t.phone):'—'}</div></div>
      </div>
      <div class="tstats">TICKET BARANG: ${count(t)} · PERBAIKAN: ${fcount(t)}</div>
      <div style="display:flex;justify-content:flex-end">
        <button class="btn sm icon" data-del="${t.id}" title="Hapus teknisi"><i data-lucide="trash-2"></i></button>
      </div>
    </div>`).join('')}
  </div>`
  :`<div class="card"><div class="empty"><i data-lucide="users"></i>
    <p>Belum ada teknisi terdaftar (sengaja dikosongkan agar Anda isi sendiri).<br>
    Tambahkan di sini, atau cukup tulis nama teknisi saat membuat ticket — nama akan tersimpan otomatis.</p></div></div>`}`;
  $('#tc-add').onclick=()=>{
    openModal(`
    <div class="mhead"><h3>Tambah Teknisi</h3></div>
    <div class="mbody">
      <label>Nama Teknisi<input id="tt-name" placeholder="nama lengkap" required></label>
      <label>No. HP (opsional)<input id="tt-phone" class="mono" placeholder="08xx"></label>
    </div>
    <div class="mfoot"><button class="btn" data-close>Batal</button>
    <button class="btn primary" id="tt-save">Simpan</button></div>`);
    $('#tt-save').onclick=()=>{
      const name=$('#tt-name').value.trim();
      if(!name){toast('Nama wajib diisi.','err');return;}
      if(techs.some(t=>t.name.toLowerCase()===name.toLowerCase())){toast('Nama teknisi sudah ada.','err');return;}
      techs.push({id:uid(),name,phone:$('#tt-phone').value.trim()});
      persist('techs',techs); closeModal(); refresh(); toast(name+' ditambahkan.');
    };
  };
  el.addEventListener('click',e=>{
    const b=e.target.closest('[data-del]'); if(!b)return;
    const t=techs.find(x=>x.id===b.dataset.del);
    askConfirm('Hapus Teknisi',`Hapus <b>${esc(t.name)}</b> dari daftar? Ticket lama tidak berubah.`,
      ()=>{techs=techs.filter(x=>x.id!==t.id);persist('techs',techs);refresh();toast('Teknisi dihapus.');});
  });
}

/* ===================== RIWAYAT STOK ===================== */
function renderLog(el){
  const L={Semua:()=>true,Masuk:l=>l.type==='in',Keluar:l=>l.type==='out',Penyesuaian:l=>l.type==='adj'};
  const list=stocklog.filter(L[logState.type]||L.Semua);
  el.innerHTML=`
  <div class="toolbar">
    <div class="chip-row" id="log-chips">
      ${['Semua','Masuk','Keluar','Penyesuaian'].map(s=>`<button class="chip ${logState.type===s?'active':''}" data-v="${s}">${s}</button>`).join('')}
    </div>
    <div class="spacer"></div>
    <span class="mono dim" style="font-size:11px">${list.length} CATATAN</span>
  </div>
  <div class="card"><div class="card-body table-wrap">
    ${list.length?`<table class="tbl"><thead><tr>
      <th>Waktu</th><th>Kegiatan</th><th>Jenis</th><th class="num">Qty</th></tr></thead><tbody>
      ${list.slice(0,300).map(l=>`<tr>
        <td class="mono dim" style="font-size:11.5px;white-space:nowrap">${fmtDT(l.t)}</td>
        <td><b>${esc(l.name)}</b>${l.note?' <span class="dim">— '+esc(l.note)+'</span>':''}</td>
        <td><span class="tag t-${l.type}">${LOG_LABEL[l.type]||l.type}</span></td>
        <td class="num mono" style="color:${l.qty>0?'var(--green)':'var(--red)'}">${l.qty>0?'+':''}${fmtNum(l.qty)}</td>
      </tr>`).join('')}
    </tbody></table>`
    :`<div class="empty"><i data-lucide="history"></i><p>Belum ada catatan pada filter ini.</p></div>`}
  </div></div>`;
  $('#log-chips').addEventListener('click',e=>{
    const c=e.target.closest('.chip'); if(!c)return;
    logState.type=c.dataset.v; renderLog(el);
  });
}

/* ===================== PENGATURAN ===================== */
function renderSettings(el){
  el.innerHTML=`
  <div class="card"><div class="card-head"><h3 class="card-title">Identitas Perusahaan</h3></div>
    <div class="card-body" style="display:flex;flex-direction:column;gap:16px">
      <label>Nama Perusahaan<input id="st-company" value="${esc(settings.company)}"></label>
      <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
        <div class="login-logo" style="margin:0;width:84px;height:84px;cursor:default">
          <img id="st-logo" src="${settings.logo||''}" alt="Logo" ${settings.logo?'':'hidden'} style="max-width:70px;max-height:70px">
          ${settings.logo?'':'<span>TANPA<br>LOGO</span>'}
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn" id="st-logo-btn"><i data-lucide="upload"></i>Ganti Logo</button>
          <button class="btn ghost" id="st-logo-del"><i data-lucide="trash-2"></i>Hapus Logo</button>
          <button class="btn primary" id="st-save"><i data-lucide="check"></i>Simpan Nama</button>
        </div>
        <input type="file" id="st-logo-file" accept="image/*" hidden>
      </div>
    </div>
  </div>
  <div class="card"><div class="card-head"><h3 class="card-title">Keamanan Akun</h3></div>
    <div class="card-body">
      <div class="form-grid">
        <label>Username Baru<input id="st-user" value="${esc(settings.user)}"></label>
        <label>Password Lama<input type="password" id="st-old"></label>
        <label>Password Baru (kosong = tetap)<input type="password" id="st-new"></label>
      </div>
      <div style="margin-top:14px"><button class="btn primary" id="st-acc"><i data-lucide="check"></i>Simpan Akun</button></div>
    </div>
  </div>
  <div class="card"><div class="card-head"><h3 class="card-title">Data &amp; Backup</h3></div>
    <div class="card-body" style="display:flex;flex-direction:column;gap:14px">
      <p class="mono" style="font-size:12px;color:var(--ink-soft)">
        ${items.length} SKU · ${outT.length} ticket keluar · ${fixT.length} perbaikan · ${photos.length} foto · ${techs.length} teknisi
      </p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn" id="st-bak"><i data-lucide="download"></i>Unduh Backup JSON</button>
        <button class="btn" id="st-res"><i data-lucide="upload"></i>Import Backup</button>
        <button class="btn danger" id="st-reset"><i data-lucide="rotate-ccw"></i>Reset ke Data Awal</button>
        <input type="file" id="st-res-file" accept="application/json" hidden>
      </div>
    </div>
  </div>`;
  bindLogoPick($('#st-logo-file'));
  $('#st-logo-btn').onclick=()=>$('#st-logo-file').click();
  $('#st-logo-del').onclick=()=>{settings.logo='';persist('settings',settings);applyBrand();refresh();toast('Logo dihapus.');};
  $('#st-save').onclick=()=>{
    settings.company=$('#st-company').value.trim()||DEFAULT_SETTINGS.company;
    persist('settings',settings);applyBrand();refresh();toast('Identitas perusahaan disimpan.');
  };
  $('#st-acc').onclick=()=>{
    if($('#st-old').value!==settings.pass){toast('Password lama salah.','err');return;}
    const u=$('#st-user').value.trim(),n=$('#st-new').value;
    if(u.length<3){toast('Username minimal 3 karakter.','err');return;}
    if(n&&n.length<4){toast('Password baru minimal 4 karakter.','err');return;}
    settings.user=u; if(n)settings.pass=n;
    persist('settings',settings);
    store.set('logged',{user:u,t:Date.now()});
    $('#top-user').textContent='@'+u; $('#side-user').textContent='@'+u;
    toast('Akun diperbarui.');
  };
  $('#st-bak').onclick=()=>{
    const data={inventory:items,out:outT,fix:fixT,photos,techs,stocklog,settings,seq};
    _dl(new Blob([JSON.stringify(data,null,1)],{type:'application/json'}),'backup-softstudio-'+todayComp()+'.json');
    toast('Backup JSON diunduh.');
  };
  $('#st-res').onclick=()=>$('#st-res-file').click();
  $('#st-res-file').addEventListener('change',e=>{
    const f=e.target.files[0]; if(!f)return;
    const r=new FileReader();
    r.onload=()=>{
      try{
        const d=JSON.parse(r.result);
        if(!Array.isArray(d.inventory))throw 0;
        ['inventory','out','fix','photos','techs','stocklog','settings','seq'].forEach(k=>{
          if(d[k]!==undefined)store.set(k,d[k]);
        });
        toast('Backup dipulihkan — memuat ulang…');
        setTimeout(()=>location.reload(),700);
      }catch(err){toast('File backup tidak valid.','err');}
    };
    r.readAsText(f); e.target.value='';
  });
  $('#st-reset').onclick=()=>askConfirm('Reset Data',
    'Semua data (barang, ticket, foto, teknisi) dikembalikan ke <b>data awal</b>. Tindakan ini tidak bisa dibatalkan — unduh backup dulu bila perlu.',
    ()=>{Object.keys(localStorage).filter(k=>k.startsWith('ssn_')).forEach(k=>localStorage.removeItem(k));
      location.reload();},'Ya, Reset Semua');
}

/* ===================== INIT ===================== */
function init(){
  loadState();
  applyBrand();
  initLightbox();

  $('#login-form').addEventListener('submit',e=>{
    e.preventDefault();
    const u=$('#login-user').value.trim(),p=$('#login-pass').value;
    if(u===settings.user&&p===settings.pass){
      store.set('logged',{user:u,t:Date.now()});
      $('#login-err').textContent='';
      enterApp();
    }else{
      $('#login-err').textContent='Username atau password salah.';
      const c=$('.login-card'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake');
    }
  });
  $('#login-logo-box').onclick=()=>$('#logo-input').click();
  bindLogoPick($('#logo-input'));

  $$('#side-nav .nav-item').forEach(b=>b.addEventListener('click',()=>go(b.dataset.page)));
  $('#btn-logout').onclick=()=>{localStorage.removeItem('ssn_logged');location.reload();};

  if(store.get('logged',null))enterApp();
}
document.addEventListener('DOMContentLoaded',init);