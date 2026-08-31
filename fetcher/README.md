# الجالب المحلي — إعداد جهاز أندرويد (Termux)

الجالب يجلب صفحات شي إن من IP منزلي/جوّال (غير محظور) ويرسل الأسعار للـ Worker.

## ١. ثبّت التطبيقات (من F-Droid — ليس Play Store)

- **Termux**: https://f-droid.org/packages/com.termux/
- **Termux:Boot**: https://f-droid.org/packages/com.termux.boot/  ← ليعمل بعد إعادة التشغيل

بعد تثبيت Termux:Boot، افتحه مرة واحدة (يكفي فتحه ثم إغلاقه).

## ٢. جهّز Termux

```sh
pkg update && pkg upgrade -y
pkg install -y nodejs git termux-api
termux-setup-storage           # اختياري

# استنسخ المشروع (ادفعه إلى GitHub أولاً، أو انسخه يدوياً)
cd ~
git clone <رابط-الريبو> shein-price-tracker
cd shein-price-tracker/fetcher

# ملف الإعدادات
cp .env.example .env
nano .env      # ضع WORKER_URL و INGEST_TOKEN
```

## ٣. جرّب يدوياً

```sh
node check.mjs
```
يجب أن يطبع سطراً مثل: `فُحص 3 · نجح 3 · تغيّرات 0`.
لو ظهر `block_page` → جرّب إيقاف الواي‑فاي واستخدام بيانات الجوّال (IP مختلف).

## ٤. التشغيل التلقائي الدائم

```sh
mkdir -p ~/.termux/boot
cp ~/shein-price-tracker/fetcher/boot-start.sh ~/.termux/boot/start.sh
chmod +x ~/.termux/boot/start.sh

# شغّله الآن بلا انتظار إعادة تشغيل:
sh ~/.termux/boot/start.sh &
```

- الافتراضي: فحص **كل ٥ دقائق**. لأقصى تكرار: `nano ~/.termux/boot/start.sh` وغيّر `INTERVAL=300` إلى `INTERVAL=60`.
- السجلّ: `tail -f ~/shein-price-tracker/fetcher/last-run.log`

## ٥. إعدادات أندرويد (مهم لئلا يوقفه النظام)

- الإعدادات ← التطبيقات ← Termux ← البطارية ← **بلا قيود / لا تُحسّن**
- أبقِ الجهاز موصولاً بالشاحن، أو على الأقل لا يدخل سبات عميق

## استكشاف الأخطاء

| العرَض | الحل |
|---|---|
| `block_page` | بدّل الشبكة (واي‑فاي ↔ بيانات جوّال) — IP آخر |
| `price_not_found` | شي إن غيّر شكل الصفحة → حدّث `../src/parse.js` وادفع، ثم `git pull` على الجهاز |
| `/api/due → 401` | `INGEST_TOKEN` في `.env` لا يطابق سرّ الـ Worker |
| توقّف بعد ساعات | قيود البطارية على Termux لم تُلغَ / الجهاز أطفأ الواي‑فاي بالسبات |
| وصلك «📵 الجالب متوقّف» | الجهاز أو Termux توقّف — أعد `sh ~/.termux/boot/start.sh &` |
