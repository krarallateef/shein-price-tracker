// صفحة لوحة التحكم — HTML+CSS+JS في ملف واحد (بلا إطار، بلا خطوة بناء).
export const DASHBOARD_HTML = /* html */ `<!doctype html>
<html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>متتبّع أسعار شي إن</title>
<style>
  :root{--bg:#0f172a;--card:#1e293b;--line:#334155;--ink:#e2e8f0;--sub:#94a3b8;--accent:#38bdf8;--green:#4ade80;--red:#f87171;--amber:#fbbf24}
  *{box-sizing:border-box}body{margin:0;font-family:system-ui,'Segoe UI',Tahoma,sans-serif;background:var(--bg);color:var(--ink);font-size:14px}
  .wrap{max-width:960px;margin:0 auto;padding:20px}
  h1{font-size:19px;margin:0 0 4px}.muted{color:var(--sub);font-size:12px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:16px}
  input,select,button{font:inherit;border-radius:9px;border:1px solid var(--line);background:#0b1220;color:var(--ink);padding:9px 11px}
  button{background:var(--accent);color:#04222f;font-weight:800;border:0;cursor:pointer}
  button.ghost{background:transparent;color:var(--sub);border:1px solid var(--line)}
  button.danger{background:transparent;color:var(--red);border:1px solid #7f1d1d}
  table{width:100%;border-collapse:collapse;font-size:12.5px}
  th,td{text-align:right;padding:8px;border-bottom:1px solid var(--line)}th{color:var(--sub);font-weight:700}
  .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .tabbar{display:flex;gap:6px;margin-bottom:14px}.tabbar button{background:#0b1220;color:var(--sub);border:1px solid var(--line)}
  .tabbar button.on{background:var(--card);color:var(--ink)}
  .pill{padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700}
  .drop{background:#052e1a;color:var(--green)}.rise{background:#3b0a0a;color:var(--red)}.stock{background:#3b2c05;color:var(--amber)}
  a{color:var(--accent)}.hidden{display:none}
  #msg{font-size:12px;color:var(--accent);min-height:16px}
</style></head><body>
<div class="wrap">

  <div id="loginView" class="hidden">
    <div class="card" style="max-width:340px;margin:60px auto">
      <h1>متتبّع أسعار شي إن</h1><p class="muted">أدخل كلمة المرور للمتابعة</p>
      <div class="row" style="margin-top:12px">
        <input id="pw" type="password" placeholder="كلمة المرور" style="flex:1" onkeydown="if(event.key==='Enter')doLogin()">
        <button onclick="doLogin()">دخول</button>
      </div>
      <div id="loginErr" class="muted" style="color:var(--red);margin-top:8px"></div>
    </div>
  </div>

  <div id="appView" class="hidden">
    <div class="row" style="justify-content:space-between">
      <div><h1>متتبّع أسعار شي إن</h1><div class="muted" id="stat"></div></div>
      <div class="row">
        <button class="ghost" onclick="checkNow()">↻ افحص الآن</button>
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
          <input id="p_target" type="number" step="0.01" placeholder="سعر مستهدف" style="width:120px">
          <select id="p_channel"><option value="default">القناة الافتراضية</option><option value="telegram">تلغرام</option><option value="email">إيميل</option><option value="both">الاثنان</option></select>
          <button onclick="addProduct()">إضافة</button>
        </div>
      </div>
      <div class="card"><table><thead><tr>
        <th>المنتج</th><th>السعر الحالي</th><th>المستهدف</th><th>مخزون</th><th>آخر فحص</th><th>القناة</th><th></th>
      </tr></thead><tbody id="pRows"></tbody></table></div>
    </div>

    <div id="tab-events" class="hidden">
      <div class="card"><table><thead><tr>
        <th>التاريخ والوقت</th><th>المنتج</th><th>التغيّر</th><th>السعر</th>
      </tr></thead><tbody id="eRows"></tbody></table></div>
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
          <button onclick="saveSettings()">حفظ الإعدادات</button>
        </div>
      </div>
    </div>
  </div>
</div>

<script>
const $=s=>document.querySelector(s);
let msgT;
function flash(t){$('#msg').textContent=t;clearTimeout(msgT);msgT=setTimeout(()=>$('#msg').textContent='',5000)}
async function api(path,opts){const r=await fetch('/api'+path,{headers:{'Content-Type':'application/json'},...opts});if(r.status===401){show('login');throw new Error('unauth')}return r.json()}
function show(v){$('#loginView').classList.toggle('hidden',v!=='login');$('#appView').classList.toggle('hidden',v==='login');if(v==='app')loadAll()}
function tab(t){for(const b of document.querySelectorAll('.tabbar button'))b.classList.toggle('on',b.dataset.tab===t);
  for(const id of ['products','events','settings'])$('#tab-'+id).classList.toggle('hidden',id!==t)}

async function doLogin(){const j=await api('/login',{method:'POST',body:JSON.stringify({password:$('#pw').value})});
  if(j.ok)show('app');else $('#loginErr').textContent='كلمة مرور خاطئة'}
async function doLogout(){await api('/logout',{method:'POST'});show('login')}

async function loadAll(){loadProducts();loadEvents();loadSettings()}
async function loadProducts(){const j=await api('/products');const cnt=j.products.length;
  $('#stat').textContent=cnt+' منتج · فحص كل دقيقة (دفعة '+j.batch+')';
  $('#pRows').innerHTML=j.products.map(p=>\`<tr>
    <td><a href="\${p.url}" target="_blank">\${p.label||('#'+p.id)}</a></td>
    <td>\${p.last_price??'—'} \${p.currency||''}</td>
    <td>\${p.target_price??'—'}</td>
    <td>\${p.last_in_stock==null?'—':(p.last_in_stock?'✅':'⛔️')}</td>
    <td class="muted">\${p.last_checked_at?new Date(p.last_checked_at).toLocaleString('ar'):'—'}\${p.consecutive_failures?' ⚠️'+p.consecutive_failures:''}</td>
    <td>\${({telegram:'تلغرام',email:'إيميل',both:'الاثنان'})[p.notify_channel]||'افتراضي'}</td>
    <td class="row">
      <button class="ghost" onclick="toggleP(\${p.id},\${p.active?0:1})">\${p.active?'إيقاف':'تفعيل'}</button>
      <button class="danger" onclick="delP(\${p.id})">حذف</button>
    </td></tr>\`).join('')||'<tr><td colspan=7 class="muted">لا منتجات بعد</td></tr>'}
async function addProduct(){const url=$('#p_url').value.trim();if(!url)return;
  await api('/products',{method:'POST',body:JSON.stringify({url,label:$('#p_label').value.trim(),target_price:parseFloat($('#p_target').value)||null,notify_channel:$('#p_channel').value})});
  $('#p_url').value=$('#p_label').value=$('#p_target').value='';flash('أُضيف — سيُفحص خلال دقيقة');loadProducts()}
async function toggleP(id,active){await api('/products/'+id,{method:'PATCH',body:JSON.stringify({active})});loadProducts()}
async function delP(id){if(!confirm('حذف المنتج وسجلّه؟'))return;await api('/products/'+id,{method:'DELETE'});loadProducts();loadEvents()}

async function loadEvents(){const j=await api('/events');
  $('#eRows').innerHTML=j.events.map(e=>{
    const cls=e.event_type==='price_drop'||e.event_type==='target_hit'?'drop':e.event_type==='price_rise'?'rise':'stock';
    const lbl=({price_drop:'📉 نزول '+e.pct_change+'%',price_rise:'📈 صعود +'+e.pct_change+'%',back_in_stock:'✅ رجع للمخزون',out_of_stock:'⛔️ نفد',target_hit:'🎯 سعر مستهدف'})[e.event_type]||e.event_type;
    return \`<tr><td class="muted">\${new Date(e.detected_at).toLocaleString('ar')}</td><td>\${e.label||('#'+e.product_id)}</td>
      <td><span class="pill \${cls}">\${lbl}</span></td><td>\${e.old_price??'—'} ← <b>\${e.new_price??'—'}</b></td></tr>\`}).join('')
    ||'<tr><td colspan=4 class="muted">لا تغيّرات مسجّلة بعد</td></tr>'}

async function loadSettings(){const j=await api('/settings');const s=j.settings;
  s_tg_token.value=s.telegram_token||'';s_tg_chat.value=s.telegram_chat_id||'';
  s_re_key.value=s.resend_api_key||'';s_re_from.value=s.resend_from||'';s_re_to.value=s.resend_to||'';
  s_default.value=s.default_channel||'telegram'}
async function saveSettings(){await api('/settings',{method:'PUT',body:JSON.stringify({
  telegram_token:s_tg_token.value.trim(),telegram_chat_id:s_tg_chat.value.trim(),
  resend_api_key:s_re_key.value.trim(),resend_from:s_re_from.value.trim(),resend_to:s_re_to.value.trim(),
  default_channel:s_default.value})});flash('حُفظت')}
async function testTelegram(){const j=await api('/test-telegram',{method:'POST'});flash(j.ok?'✅ وصلت رسالة الاختبار':'تعذّر: '+(j.reason||''))}
async function checkNow(){flash('جاري الفحص…');const j=await api('/check-now',{method:'POST'});flash('فُحص '+j.checked+' منتج · '+(j.results.filter(r=>r.events).length)+' تغيّر');loadProducts();loadEvents()}

(async()=>{try{const j=await api('/me');show(j.authed?'app':'login')}catch{show('login')}})();
</script></body></html>`;
