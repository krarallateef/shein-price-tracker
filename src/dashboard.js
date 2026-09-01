// صفحة لوحة التحكم — HTML+CSS+JS في ملف واحد (بلا إطار، بلا خطوة بناء). سمة فاتحة.
export const DASHBOARD_HTML = /* html */ `<!doctype html>
<html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%232563eb'/%3E%3C/svg%3E">
<title>متتبّع أسعار شي إن</title>
<style>
  :root{
    --bg:#f1f5f9;--card:#ffffff;--line:#e2e8f0;--ink:#0f172a;--sub:#64748b;
    --accent:#2563eb;--accent-bg:#eff6ff;
    --green:#16a34a;--green-bg:#f0fdf4;--red:#dc2626;--red-bg:#fef2f2;--amber:#d97706;--amber-bg:#fffbeb;
  }
  *{box-sizing:border-box}
  html{-webkit-text-size-adjust:100%}
  body{margin:0;font-family:system-ui,'Segoe UI',Tahoma,sans-serif;background:var(--bg);color:var(--ink);font-size:14px}
  .wrap{max-width:1240px;margin:0 auto;padding:20px}
  @media(max-width:640px){.wrap{padding:12px}}
  h1{font-size:19px;margin:0 0 4px}.muted{color:var(--sub);font-size:12px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:16px;box-shadow:0 1px 3px rgba(15,23,42,.04)}
  @media(max-width:640px){.card{padding:12px}}
  input,select,button{font:inherit;border-radius:9px;border:1px solid var(--line);background:#fff;color:var(--ink);padding:9px 11px;max-width:100%}
  input:focus,select:focus{outline:2px solid var(--accent-bg);border-color:var(--accent)}
  button{background:var(--accent);color:#fff;font-weight:800;border:0;cursor:pointer}
  button.ghost{background:#fff;color:var(--sub);border:1px solid var(--line)}
  button.danger{background:#fff;color:var(--red);border:1px solid #fecaca}
  .tablewrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -4px}
  table{width:100%;border-collapse:collapse;font-size:13px;min-width:620px}
  th,td{text-align:right;padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:middle;white-space:nowrap}
  td.wrap-cell{white-space:normal;min-width:160px}
  th{color:var(--sub);font-weight:700}
  .usd{font-weight:800}.orig{color:var(--sub);font-size:11px}
  .ind{display:inline-block;width:13px;height:13px;border-radius:4px;background:var(--accent);vertical-align:middle}
  .ind.off{background:#cbd5e1}.ind.warn{background:var(--red)}
  .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .tabbar{display:flex;gap:6px;margin-bottom:14px}
  .tabbar button{background:#fff;color:var(--sub);border:1px solid var(--line)}
  .tabbar button.on{background:var(--accent-bg);color:var(--accent);border-color:var(--accent)}
  .pill{padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700}
  .drop{background:var(--green-bg);color:var(--green)}.rise{background:var(--red-bg);color:var(--red)}.stock{background:var(--amber-bg);color:var(--amber)}
  .thumb{width:44px;height:44px;border-radius:8px;object-fit:cover;background:#f1f5f9;border:1px solid var(--line)}
  .sku{font-family:ui-monospace,monospace;font-size:11px;color:var(--sub);background:#f8fafc;padding:1px 6px;border-radius:6px}
  a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
  .hidden{display:none}
  #msg{font-size:12px;color:var(--accent);min-height:16px}
  .modal-bg{position:fixed;inset:0;background:rgba(15,23,42,.4);display:flex;align-items:center;justify-content:center;z-index:50;padding:16px}
  .modal{background:var(--card);border-radius:14px;padding:18px;width:100%;max-width:420px;box-shadow:0 10px 40px rgba(15,23,42,.2)}
  .modal label{display:block;font-size:12px;color:var(--sub);margin:10px 0 4px}
  .modal input,.modal select{width:100%}
</style></head><body>
<div class="wrap">

  <div id="loginView" class="hidden">
    <div class="card" style="max-width:360px;margin:60px auto">
      <h1>متتبّع أسعار شي إن</h1><p class="muted">سجّل الدخول للمتابعة</p>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">
        <input id="em" type="email" placeholder="البريد الإلكتروني" autocomplete="username">
        <input id="pw" type="password" placeholder="كلمة المرور" autocomplete="current-password" onkeydown="if(event.key==='Enter')doLogin()">
        <button onclick="doLogin()">دخول</button>
      </div>
      <div id="loginErr" class="muted" style="color:var(--red);margin-top:8px"></div>
    </div>
  </div>

  <div id="appView" class="hidden">
    <div class="row" style="justify-content:space-between">
      <div><h1>متتبّع أسعار شي إن</h1><div class="muted" id="stat"></div></div>
      <div class="row">
        <button class="ghost" onclick="loadAll()">↻ تحديث</button>
        <button class="ghost" onclick="doLogout()">خروج</button>
      </div>
    </div>
    <div id="msg"></div>

    <div class="tabbar">
      <button class="on" data-tab="products" onclick="tab('products')">المنتجات</button>
      <button data-tab="events" onclick="tab('events')">سجلّ التغيّرات</button>
      <button data-tab="settings" onclick="tab('settings')">الإعدادات</button>
    </div>

    <div id="tab-products">
      <div class="card">
        <div class="row">
          <input id="p_url" placeholder="رابط منتج شي إن" style="flex:1;min-width:220px">
          <input id="p_label" placeholder="تسمية (اختياري)" style="width:150px">
          <input id="p_target" type="number" step="0.01" placeholder="سعر مستهدف $" style="width:120px">
          <select id="p_channel"><option value="default">القناة الافتراضية</option><option value="telegram">تلغرام</option><option value="email">إيميل</option><option value="both">الاثنان</option></select>
          <button onclick="addProduct()">إضافة</button>
        </div>
      </div>
      <div class="card"><div class="tablewrap"><table><thead><tr>
        <th>صورة</th><th>المنتج</th><th>SKU</th><th>السعر الحالي</th><th>المستهدف</th><th>مخزون</th><th>آخر فحص</th><th>القناة</th><th></th>
      </tr></thead><tbody id="pRows"></tbody></table></div>
      <p class="muted">الأسعار والسعر المستهدف بالدولار الأمريكي (تحويل تقريبي). القيمة الأصلية بعملة المتجر تحت السعر الحالي.</p></div>
    </div>

    <div id="tab-events" class="hidden">
      <div class="card"><div class="tablewrap"><table><thead><tr>
        <th>التاريخ والوقت</th><th>المنتج</th><th>التغيّر</th><th>السعر</th>
      </tr></thead><tbody id="eRows"></tbody></table></div></div>
    </div>

    <div id="tab-settings" class="hidden">
      <div class="card">
        <h1 style="font-size:15px">تلغرام</h1>
        <div class="row" style="margin-top:8px">
          <input id="s_tg_token" placeholder="Bot Token" style="flex:1;min-width:240px">
          <input id="s_tg_chat" placeholder="Chat ID" style="width:160px">
          <button class="ghost" onclick="testTelegram()">اختبار</button>
        </div>
        <p class="muted">أنشئ بوتاً عبر @BotFather، وخذ Chat ID من @userinfobot بعد مراسلة البوت.</p>
      </div>
      <div class="card">
        <h1 style="font-size:15px">إيميل (Resend — اختياري)</h1>
        <div class="row" style="margin-top:8px">
          <input id="s_re_key" placeholder="Resend API Key" style="flex:1;min-width:200px">
          <input id="s_re_from" placeholder="من: name@yourdomain" style="width:200px">
          <input id="s_re_to" placeholder="إلى: بريدك" style="width:200px">
        </div>
      </div>
      <div class="card">
        <div class="row">
          <label>القناة الافتراضية</label>
          <select id="s_default"><option value="telegram">تلغرام</option><option value="email">إيميل</option><option value="both">الاثنان</option></select>
          <label>تنبيه توقّف الجالب بعد (دقائق)</label>
          <input id="s_watchdog" type="number" value="150" style="width:90px">
          <button onclick="saveSettings()">حفظ الإعدادات</button>
        </div>
      </div>
    </div>
  </div>
</div>

<script>
const $=s=>document.querySelector(s);
let msgT;
// أسعار صرف تقريبية: وحدات لكل 1 دولار (SAR/AED مربوطتان بثبات).
const FX={USD:1,SAR:3.75,AED:3.6725,QAR:3.64,KWD:0.307,BHD:0.376,OMR:0.385,JOD:0.709,ILS:3.7,MAD:10,EGP:48,EUR:0.92,GBP:0.79,IQD:1310,TRY:34,CAD:1.37,AUD:1.5};
function usd(price,cur){if(price==null||isNaN(price))return null;const r=FX[(cur||'USD').toUpperCase()];if(!r)return null;return price/r}
function priceCell(price,cur){const u=usd(price,cur);if(u==null)return (price??'—')+' '+(cur||'');
  return '<span class="usd">$'+u.toFixed(2)+'</span>'+(cur&&cur!=='USD'?'<div class="orig">'+price+' '+cur+'</div>':'')}
function flash(t){$('#msg').textContent=t;clearTimeout(msgT);msgT=setTimeout(()=>$('#msg').textContent='',5000)}
async function api(path,opts){const r=await fetch('/api'+path,{headers:{'Content-Type':'application/json'},...opts});if(r.status===401&&path!=='/login'){show('login');throw new Error('unauth')}return r.json()}
function show(v){$('#loginView').classList.toggle('hidden',v!=='login');$('#appView').classList.toggle('hidden',v==='login');if(v==='app')loadAll()}
function tab(t){for(const b of document.querySelectorAll('.tabbar button'))b.classList.toggle('on',b.dataset.tab===t);
  for(const id of ['products','events','settings'])$('#tab-'+id).classList.toggle('hidden',id!==t)}

async function doLogin(){const j=await api('/login',{method:'POST',body:JSON.stringify({email:$('#em').value.trim(),password:$('#pw').value})});
  if(j.ok)show('app');else $('#loginErr').textContent='بيانات دخول خاطئة'}
async function doLogout(){await api('/logout',{method:'POST'});show('login')}

async function loadAll(){loadProducts();loadEvents();loadSettings()}
async function loadProducts(){const j=await api('/products');const cnt=j.products.length;
  const latest=j.products.map(p=>p.last_checked_at).filter(Boolean).sort().pop();
  $('#stat').textContent=cnt+' منتج · آخر تحديث من الجالب: '+(latest?new Date(latest).toLocaleString('ar'):'لم يصل بعد');
  window._products=j.products;
  $('#pRows').innerHTML=j.products.map(p=>\`<tr>
    <td>\${p.image_url?\`<a href="\${p.url}" target="_blank"><img class="thumb" src="\${p.image_url}" loading="lazy" onerror="this.style.visibility='hidden'"></a>\`:'<div class="thumb"></div>'}</td>
    <td class="wrap-cell"><a href="\${p.url}" target="_blank">\${p.label||('#'+p.id)}</a></td>
    <td>\${p.sku?\`<span class="sku">\${p.sku}</span>\`:(p.goods_id?\`<span class="sku">\${p.goods_id}</span>\`:'—')}</td>
    <td>\${priceCell(p.last_price,p.currency)}</td>
    <td>\${p.target_price!=null?'<span class="usd">$'+p.target_price+'</span>':'—'}</td>
    <td>\${p.last_in_stock==null?'<span class="muted">—</span>':'<span class="ind'+(p.last_in_stock?'':' off')+'" title="'+(p.last_in_stock?'متوفّر':'نفد')+'"></span>'}</td>
    <td class="muted">\${p.last_checked_at?new Date(p.last_checked_at).toLocaleString('ar'):'<span class="pill stock">قيد الجلب…</span>'}\${p.consecutive_failures?' <span class="ind warn" title="فشل الجلب '+p.consecutive_failures+' مرات متتالية"></span>':''}</td>
    <td>\${({telegram:'تلغرام',email:'إيميل',both:'الاثنان'})[p.notify_channel]||'افتراضي'}</td>
    <td class="row">
      <button class="ghost" onclick="editP(\${p.id})">تعديل</button>
      <button class="ghost" onclick="toggleP(\${p.id},\${p.active?0:1})">\${p.active?'إيقاف':'تفعيل'}</button>
      <button class="danger" onclick="delP(\${p.id})">حذف</button>
    </td></tr>\`).join('')||'<tr><td colspan=9 class="muted">لا منتجات بعد</td></tr>'}
async function addProduct(){const url=$('#p_url').value.trim();if(!url)return;
  await api('/products',{method:'POST',body:JSON.stringify({url,label:$('#p_label').value.trim(),target_price:parseFloat($('#p_target').value)||null,notify_channel:$('#p_channel').value})});
  $('#p_url').value=$('#p_label').value=$('#p_target').value='';flash('أُضيف — تظهر تفاصيله خلال ٣ دقائق تقريباً');loadProducts();setTimeout(loadProducts,60000);setTimeout(loadProducts,180000)}
async function toggleP(id,active){await api('/products/'+id,{method:'PATCH',body:JSON.stringify({active})});loadProducts()}
async function delP(id){if(!confirm('حذف المنتج وسجلّه؟'))return;await api('/products/'+id,{method:'DELETE'});loadProducts();loadEvents()}

function editP(id){
  const p=(window._products||[]).find(x=>x.id===id);if(!p)return;
  const esc=s=>String(s==null?'':s).replace(/"/g,'&quot;');
  const wrap=document.createElement('div');wrap.className='modal-bg';wrap.onclick=e=>{if(e.target===wrap)wrap.remove()};
  wrap.innerHTML=\`<div class="modal">
    <h1 style="font-size:16px;margin:0">تعديل المنتج</h1>
    <div class="muted" style="margin-top:2px">\${esc(p.label||('#'+p.id))}</div>
    <label>الاسم / التسمية</label><input id="e_label" value="\${esc(p.label)}">
    <label>الرابط</label><input id="e_url" value="\${esc(p.url)}">
    <label>السعر المستهدف (بالدولار $)</label><input id="e_target" type="number" step="0.01" value="\${esc(p.target_price)}">
    <label>قناة التنبيه</label>
    <select id="e_channel">
      <option value="default">القناة الافتراضية</option><option value="telegram">تلغرام</option>
      <option value="email">إيميل</option><option value="both">الاثنان</option>
    </select>
    <div class="row" style="margin-top:16px;justify-content:flex-end">
      <button class="ghost" id="e_cancel">إلغاء</button>
      <button id="e_save">حفظ</button>
    </div>
  </div>\`;
  document.body.appendChild(wrap);
  wrap.querySelector('#e_channel').value=p.notify_channel||'default';
  wrap.querySelector('#e_cancel').onclick=()=>wrap.remove();
  wrap.querySelector('#e_save').onclick=async()=>{
    const body={label:wrap.querySelector('#e_label').value.trim()||null,
      url:wrap.querySelector('#e_url').value.trim(),
      target_price:parseFloat(wrap.querySelector('#e_target').value)||null,
      notify_channel:wrap.querySelector('#e_channel').value};
    const j=await api('/products/'+id,{method:'PATCH',body:JSON.stringify(body)});
    if(j&&j.error){flash('خطأ: '+j.error);return}
    wrap.remove();flash('حُفظت التعديلات');loadProducts()};
}

async function loadEvents(){const j=await api('/events');
  $('#eRows').innerHTML=j.events.map(e=>{
    const cls=e.event_type==='price_drop'||e.event_type==='target_hit'?'drop':e.event_type==='price_rise'?'rise':'stock';
    const lbl=({price_drop:'نزول '+e.pct_change+'%',price_rise:'صعود +'+e.pct_change+'%',back_in_stock:'رجع للمخزون',out_of_stock:'نفد المخزون',target_hit:'بلغ السعر المستهدف'})[e.event_type]||e.event_type;
    return \`<tr><td class="muted">\${new Date(e.detected_at).toLocaleString('ar')}</td><td>\${e.label||('#'+e.product_id)}</td>
      <td><span class="pill \${cls}">\${lbl}</span></td><td>\${priceCell(e.old_price,e.currency)} ← \${priceCell(e.new_price,e.currency)}</td></tr>\`}).join('')
    ||'<tr><td colspan=4 class="muted">لا تغيّرات مسجّلة بعد</td></tr>'}

async function loadSettings(){const j=await api('/settings');const s=j.settings;
  s_tg_token.value=s.telegram_token||'';s_tg_chat.value=s.telegram_chat_id||'';
  s_re_key.value=s.resend_api_key||'';s_re_from.value=s.resend_from||'';s_re_to.value=s.resend_to||'';
  s_default.value=s.default_channel||'telegram';s_watchdog.value=s.watchdog_minutes||'150'}
async function saveSettings(){await api('/settings',{method:'PUT',body:JSON.stringify({
  telegram_token:s_tg_token.value.trim(),telegram_chat_id:s_tg_chat.value.trim(),
  resend_api_key:s_re_key.value.trim(),resend_from:s_re_from.value.trim(),resend_to:s_re_to.value.trim(),
  default_channel:s_default.value,watchdog_minutes:s_watchdog.value})});flash('حُفظت')}
async function testTelegram(){const j=await api('/test-telegram',{method:'POST'});flash(j.ok?'✅ وصلت رسالة الاختبار':'تعذّر: '+(j.reason||''))}

(async()=>{try{const j=await api('/me');show(j.authed?'app':'login')}catch{show('login')}})();
</script></body></html>`;
