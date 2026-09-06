/* =========================================================
   excel.js — Ekspor Excel (.xlsx) memakai ExcelJS (CDN).
   Jika ExcelJS tidak tersedia (offline), otomatis fallback CSV.
   ========================================================= */
'use strict';

function _dl(blob, name){
  const a=document.createElement('a'); const u=URL.createObjectURL(blob);
  a.href=u; a.download=name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(u), 4000);
}
function _csvEsc(v){ v=String(v??''); return /[",;\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; }
function _dlCSV(name, headers, rows){
  const lines=[headers,...rows].map(r=>r.map(_csvEsc).join(';')).join('\r\n');
  _dl(new Blob(['\uFEFF'+lines],{type:'text/csv;charset=utf-8'}), name+'.csv');
  toast('ExcelJS tidak tersedia — file CSV diunduh sebagai gantinya.','warn');
}
const _XLS = {
  ink:'FF1D1B16', paper:'FFFBF8F0', accent:'FFE8590C', zebra:'FFF4F0E4',
  border(){ return {top:{style:'thin'},left:{style:'thin'},bottom:{style:'thin'},right:{style:'thin'}}; },
  header(ws){
    const r=ws.getRow(1); r.height=23;
    r.eachCell(c=>{
      c.font={bold:true,size:11,color:{argb:_XLS.paper}};
      c.fill={type:'pattern',pattern:'solid',fgColor:{argb:_XLS.ink}};
      c.alignment={vertical:'middle',horizontal:'center'};
      c.border=_XLS.border();
    });
  },
  body(ws, opt){
    for(let rn=2; rn<=ws.rowCount; rn++){
      const row=ws.getRow(rn);
      row.eachCell(c=>{
        if(rn===1) return;
        c.border=_XLS.border(); c.font={size:11};
        if(opt.right.includes(c.col-1)) c.alignment={horizontal:'right'};
        if(opt.rp.includes(c.col-1)) c.numFmt='"Rp "#,##0';
        else if(opt.num.includes(c.col-1)) c.numFmt='#,##0';
        if(rn%2===0) c.fill={type:'pattern',pattern:'solid',fgColor:{argb:_XLS.zebra}};
      });
    }
  },
  total(ws){
    const r=ws.getRow(ws.rowCount); r.height=20;
    r.eachCell(c=>{
      c.font={bold:true,size:11,color:{argb:_XLS.paper}};
      c.fill={type:'pattern',pattern:'solid',fgColor:{argb:_XLS.accent}};
      c.border=_XLS.border();
    });
  }
};
const _stamp = {date:d=>{const p=d.split('-');return p[2]+'/'+p[1]+'/'+p[0];}};

/* ---------- Ekspor Inventaris ---------- */
async function exportInventoryExcel(){
  const list = items.slice().sort((a,b)=>a.cat.localeCompare(b.cat)||a.name.localeCompare(b.name));
  const tUnit = list.reduce((s,i)=>s+i.qty,0), tVal = list.reduce((s,i)=>s+i.qty*i.price,0);
  const fname = 'inventaris-softstudio-'+todayComp();
  try{
    if(!window.ExcelJS) throw 0;
    const wb=new ExcelJS.Workbook(); wb.creator=settings.company;
    const ws=wb.addWorksheet('Inventaris',{views:[{state:'frozen',ySplit:1}]});
    ws.columns=[
      {header:'No',key:'no',width:5},{header:'SKU',key:'sku',width:10},
      {header:'Nama Barang',key:'name',width:34},{header:'Kategori',key:'cat',width:16},
      {header:'Stok',key:'qty',width:9},{header:'Satuan',key:'unit',width:8},
      {header:'Harga Satuan',key:'price',width:15},{header:'Nilai Stok',key:'value',width:16},
      {header:'Status',key:'status',width:11}
    ];
    list.forEach((it,ix)=>ws.addRow({no:ix+1,sku:it.sku,name:it.name,cat:it.cat,qty:it.qty,
      unit:it.unit,price:it.price,value:it.qty*it.price,status:statusOf(it)}));
    ws.addRow({no:'',sku:'',name:'TOTAL',cat:list.length+' SKU',qty:tUnit,unit:'',price:'',value:tVal,status:''});
    _XLS.header(ws); _XLS.body(ws,{right:[0,4,6,7],rp:[6,7],num:[4]}); _XLS.total(ws);
    ws.autoFilter={from:'A1',to:{row:1,column:9}};
    const buf=await wb.xlsx.writeBuffer();
    _dl(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}), fname+'.xlsx');
    toast('Excel inventaris ('+list.length+' SKU) berhasil diunduh.');
  }catch(e){
    _dlCSV(fname, ['No','SKU','Nama Barang','Kategori','Stok','Satuan','Harga Satuan','Nilai Stok','Status'],
      list.map((it,ix)=>[ix+1,it.sku,it.name,it.cat,it.qty,it.unit,it.price,it.qty*it.price,statusOf(it)])
      .concat([['','','TOTAL',list.length+' SKU',tUnit,'','',tVal,'']]));
  }
}

/* ---------- Ekspor Ticket Pengeluaran ---------- */
async function exportOutExcel(){
  if(!outT.length){ toast('Belum ada ticket pengeluaran.','warn'); return; }
  const flat=[];
  outT.slice().sort((a,b)=>a.date.localeCompare(b.date)).forEach(t=>{
    t.items.forEach(i=>flat.push([t.no,_stamp.date(t.date),t.tech,i.name,i.sku,i.qty,i.unit,i.price,i.qty*i.price,
      t.purpose||'-', t.status==='void'?'DIBATALKAN':'AKTIF']));
  });
  const tVal=flat.reduce((s,r)=>s+r[8],0);
  const fname='pengeluaran-softstudio-'+todayComp();
  try{
    if(!window.ExcelJS) throw 0;
    const wb=new ExcelJS.Workbook(); wb.creator=settings.company;
    const ws=wb.addWorksheet('Pengeluaran Barang',{views:[{state:'frozen',ySplit:1}]});
    ws.columns=[
      {header:'No Ticket',key:'a',width:15},{header:'Tanggal',key:'b',width:12},
      {header:'Teknisi',key:'c',width:19},{header:'Nama Barang',key:'d',width:34},
      {header:'SKU',key:'e',width:10},{header:'Qty',key:'f',width:7},
      {header:'Satuan',key:'g',width:8},{header:'Harga Satuan',key:'h',width:15},
      {header:'Nilai',key:'i',width:15},{header:'Keperluan',key:'j',width:28},{header:'Status',key:'k',width:12}
    ];
    flat.forEach(r=>ws.addRow({a:r[0],b:r[1],c:r[2],d:r[3],e:r[4],f:r[5],g:r[6],h:r[7],i:r[8],j:r[9],k:r[10]}));
    ws.addRow({d:'TOTAL',f:flat.reduce((s,r)=>s+r[5],0),i:tVal});
    _XLS.header(ws); _XLS.body(ws,{right:[5,7,8],rp:[7,8],num:[5]}); _XLS.total(ws);
    ws.autoFilter={from:'A1',to:{row:1,column:11}};
    const buf=await wb.xlsx.writeBuffer();
    _dl(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}), fname+'.xlsx');
    toast('Excel pengeluaran barang berhasil diunduh.');
  }catch(e){
    _dlCSV(fname, ['No Ticket','Tanggal','Teknisi','Nama Barang','SKU','Qty','Satuan','Harga Satuan','Nilai','Keperluan','Status'],
      flat.concat([['','','','TOTAL','',''+flat.reduce((s,r)=>s+r[5],0),'','',tVal,'','']]));
  }
}

/* ---------- Ekspor Ticket Perbaikan ---------- */
async function exportFixExcel(){
  if(!fixT.length){ toast('Belum ada ticket perbaikan.','warn'); return; }
  const rows=fixT.map(f=>[f.no,_stamp.date(f.date),f.customer,f.device,f.desc,f.tech||'-',f.prio,f.status]);
  const fname='perbaikan-softstudio-'+todayComp();
  try{
    if(!window.ExcelJS) throw 0;
    const wb=new ExcelJS.Workbook(); wb.creator=settings.company;
    const ws=wb.addWorksheet('Ticket Perbaikan',{views:[{state:'frozen',ySplit:1}]});
    ws.columns=[
      {header:'No Ticket',key:'a',width:15},{header:'Tanggal',key:'b',width:12},
      {header:'Pelanggan / Lokasi',key:'c',width:26},{header:'Perangkat',key:'d',width:22},
      {header:'Kerusakan',key:'e',width:44},{header:'Teknisi',key:'f',width:19},
      {header:'Prioritas',key:'g',width:10},{header:'Status',key:'h',width:10}
    ];
    rows.forEach(r=>ws.addRow({a:r[0],b:r[1],c:r[2],d:r[3],e:r[4],f:r[5],g:r[6],h:r[7]}));
    _XLS.header(ws); _XLS.body(ws,{right:[],rp:[],num:[]});
    ws.autoFilter={from:'A1',to:{row:1,column:8}};
    const buf=await wb.xlsx.writeBuffer();
    _dl(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}), fname+'.xlsx');
    toast('Excel ticket perbaikan berhasil diunduh.');
  }catch(e){
    _dlCSV(fname, ['No Ticket','Tanggal','Pelanggan / Lokasi','Perangkat','Kerusakan','Teknisi','Prioritas','Status'], rows);
  }
}