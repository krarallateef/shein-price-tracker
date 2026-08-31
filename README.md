# متتبّع أسعار شي إن (Shein)

مشروع **مستقل تماماً** — لا علاقة له بـ KIDA.

شي إن يحظر عناوين مراكز البيانات (جرّبناه: `page_risk_crawler_block`)، فالمعمارية **هجينة**:

```
جهاز أندرويد (Termux, IP منزلي)          Cloudflare Worker (مجاني)
  fetcher/check.mjs                        GET  /api/due    → قائمة المنتجات
  • يجلب صفحات شي إن كل 1–5 دقائق  ───────▶ POST /api/ingest → مقارنة + تسجيل + تنبيه
  • يستخرج السعر (src/parse.js)             GET  /           → لوحة التحكم
  • يرسل النتائج للـ Worker                 Cron */15        → حارس: ينبّه لو توقّف الجالب
                                           D1: products · price_events · settings
```

| المكوّن | الدور |
|---|---|
| **Worker** | لوحة تحكم بكلمة مرور · تخزين D1 · مقارنة الأسعار · التنبيهات · حارس التوقّف |
| **الجالب (Termux)** | جلب صفحات شي إن + استخراج السعر فقط (بلا حالة) |
| التنبيه | Telegram (مجاني) · Resend (إيميل، اختياري) |

---

## أ) إعداد الـ Worker (مرة واحدة)

> نفّذ من داخل هذا المجلد. لا يمسّ أي حساب/مشروع آخر.

```bash
npm install

npx wrangler login            # حساب Cloudflare مخصّص لهذا المشروع (يُفضّل منفصل عن KIDA)
npx wrangler whoami           # تأكّد من الحساب

npx wrangler d1 create shein-tracker-db          # انسخ database_id → wrangler.jsonc
npx wrangler d1 execute shein-tracker-db --remote --file schema.sql

npx wrangler secret put ADMIN_PASSWORD          # كلمة مرور اللوحة
npx wrangler secret put AUTH_SECRET             # نص عشوائي طويل
npx wrangler secret put INGEST_TOKEN            # نص عشوائي طويل (نفسه في fetcher/.env)

npx wrangler deploy
```

بعده: افتح `https://shein-price-tracker.<اسمك>.workers.dev` ← كلمة المرور ←
تبويب «الإعدادات» ← توكن بوت تلغرام + Chat ID ← «اختبار» ← أضف روابط المنتجات.

### بوت تلغرام
راسل **@BotFather** ← `/newbot` ← خذ الـ token. راسل بوتك بأي رسالة.
راسل **@userinfobot** ← يعطيك الـ Chat ID.

## ب) إعداد الجالب على أندرويد

راجع **[fetcher/README.md](fetcher/README.md)** — خطوات Termux + Termux:Boot كاملة.
باختصار: `git clone` المشروع على الجهاز، `cp fetcher/.env.example fetcher/.env` واملأه،
ثم انسخ `fetcher/boot-start.sh` إلى `~/.termux/boot/start.sh`.

---

## الضبط

- **`wrangler.jsonc` → vars**: `MIN_CHANGE_PCT` (٣٪ — عتبة التنبيه)، `MAX_FAILURES` (٥).
- **اللوحة → الإعدادات**: «تنبيه توقّف الجالب بعد (دقائق)» — الافتراضي ٦٠.
- **`fetcher/boot-start.sh` → `INTERVAL`**: ٣٠٠ ثانية (٥ دقائق). غيّره لـ ٦٠ لأقصى تكرار.

## التطوير المحلي للـ Worker

```bash
cp .dev.vars.example .dev.vars    # واملأ القيم
npm run db:local
npm run dev
```

## ملاحظات

- شروط شي إن تمنع الوصول الآلي؛ هذا استخدام شخصي منخفض الحجم (كـ Keepa/CamelCamelCamel).
- لو توقّف استخراج السعر: عدّل `src/parse.js` (سلسلة بدائل: JSON-LD → كتلة شي إن → meta)،
  ادفع، ثم `git pull` على جهاز الأندرويد.
- حدود Worker المجاني: 100k طلب/يوم، 3 كرون/Worker.
