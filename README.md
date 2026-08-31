# متتبّع أسعار شي إن (Shein) — Cloudflare Worker

مشروع **مستقل تماماً** — لا علاقة له بـ KIDA. Worker واحد يخدم لوحة تحكم + API + كرون
يفحص أسعار منتجات محدّدة كل دقيقة (دفعة صغيرة دوّارة) ويُنبّه عبر تلغرام/إيميل عند التغيّر.

## المكوّنات

| | |
|---|---|
| التشغيل | Cloudflare Workers (مجاني) |
| التخزين | D1 (`shein-tracker-db`) — جداول: `products`, `price_events`, `settings` |
| الجدولة | Cron `* * * * *` — كل دقيقة، `BATCH_SIZE` منتجات/تشغيل |
| جلب السعر | `fetch` مباشر → `r.jina.ai` (احتياطي، مجاني) |
| التنبيه | Telegram Bot API (مجاني) · Resend (إيميل، اختياري) |
| اللوحة | صفحة واحدة بكلمة مرور — إضافة روابط + سجلّ تغيّرات + إعدادات البوت |

## الإعداد (مرة واحدة)

> نفّذ كل شيء من داخل مجلد المشروع هذا. لن يمسّ أي حساب/مشروع آخر.

```bash
# 1) التبعيات
npm install

# 2) سجّل الدخول لحساب Cloudflare المخصّص لهذا المشروع (يُفضّل حساب منفصل عن KIDA)
npx wrangler login
npx wrangler whoami            # تأكّد أنه الحساب الصحيح

# 3) أنشئ قاعدة D1 — انسخ database_id الناتج إلى wrangler.jsonc
npx wrangler d1 create shein-tracker-db

# 4) طبّق المخطّط
npx wrangler d1 execute shein-tracker-db --remote --file schema.sql

# 5) الأسرار (لا تُكتب بالكود)
npx wrangler secret put ADMIN_PASSWORD      # كلمة مرور اللوحة
npx wrangler secret put AUTH_SECRET         # أي نص عشوائي طويل لتوقيع الجلسة
npx wrangler secret put JINA_API_KEY        # اختياري — من jina.ai لرفع حد الطلبات

# 6) انشر
npx wrangler deploy
```

بعد النشر: افتح `https://shein-price-tracker.<اسمك>.workers.dev` ← أدخل كلمة المرور ←
تبويب «الإعدادات» ← ضع توكن بوت تلغرام + Chat ID ← «اختبار» ← أضف روابط المنتجات.

### إنشاء بوت تلغرام
1. راسل **@BotFather** ← `/newbot` ← خذ الـ **token**.
2. راسل بوتك الجديد بأي رسالة.
3. راسل **@userinfobot** ← يعطيك **Chat ID**.

## التطوير المحلي

```bash
cp .dev.vars.example .dev.vars      # واملأ القيم
npm run db:local                    # مخطّط على D1 المحلي
npm run dev
# اختبار الكرون: curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"
```

## الضبط (`wrangler.jsonc` → `vars`)

- `BATCH_SIZE` (6) — منتجات تُفحص كل دقيقة. ارفعه لدورة أسرع، راقب `wrangler tail`.
- `MIN_CHANGE_PCT` (3) — لا تنبيه إلا إذا تغيّر السعر بأكثر من هذه النسبة.
- `MAX_FAILURES` (5) — بعدها يُنبَّه المنتج مرة ويُباعَد فحصه.

## ملاحظات

- شروط شي إن تمنع الوصول الآلي؛ هذا للاستخدام الشخصي منخفض الحجم (كـ Keepa/CamelCamelCamel).
  أبقِ عدد المنتجات معقولاً ولا تُعِد نشر البيانات.
- لو تغيّر شكل صفحات شي إن وتوقّف استخراج السعر: عدّل `parsePrice()` في `src/checker.js`
  (سلسلة بدائل: JSON-LD → كتلة شي إن الداخلية → وسم meta).
- حدود الباقة المجانية: 100k طلب/يوم، 10ms CPU/تشغيل كرون، 3 كرون/Worker.
