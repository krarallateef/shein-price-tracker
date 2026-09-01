# الجالب المحلي — إعداد جهاز أندرويد (Termux)

الجالب يجلب صفحات شي إن من IP منزلي/جوّال (غير محظور) ويرسل الأسعار للـ Worker.

## ١. ثبّت التطبيقات (من F-Droid — ليس Play Store)

- **Termux**: https://f-droid.org/packages/com.termux/
- **Termux:Boot**: https://f-droid.org/packages/com.termux.boot/  ← ليعمل بعد إعادة التشغيل

بعد تثبيت Termux:Boot، افتحه مرة واحدة (يكفي فتحه ثم إغلاقه).

## ٢. جهّز Termux

```sh
pkg update && pkg upgrade -y
pkg install -y nodejs git

# متصفّح Chromium + شاشة X افتراضية — ضروري:
# شي إن تحظر طلبات غير المتصفّح، وتكشف وضع headless. لذا نشغّل نافذة حقيقية.
pkg install -y x11-repo
pkg install -y chromium tigervnc

# جهّز شاشة X افتراضية على :1 (أول مرة يطلب كلمة مرور — اكتب أي شيء، ثم n لـ view-only)
vncserver -localhost -SecurityTypes None :1
export DISPLAY=:1

# استنسخ المشروع
cd ~
git clone <رابط-الريبو> shein-price-tracker
cd shein-price-tracker/fetcher

npm install            # يثبّت puppeteer-core فقط (بلا تنزيل متصفّح — نستخدم chromium أعلاه)

# ملف الإعدادات
cp .env.example .env
nano .env              # ضع WORKER_URL و INGEST_TOKEN
```

> إذا فشل `pkg install chromium` (بعض الأجهزة/المعماريات): الجالب سيرجع تلقائياً
> لطلب `fetch` عادي — لكنه غالباً محظور. Chromium هو الطريق الموثوق.

## ٣. جرّب يدوياً

```sh
export DISPLAY=:1
node check.mjs
```
يجب أن يطبع: `[browser] فُحص 1 · نجح 1 · تغيّرات 0`.
- لو ظهر `block_page (browser)` → تأكّد أن `DISPLAY=:1` مضبوط وأن `vncserver :1` يعمل
  (المتصفّح لازم يعمل بنافذة، لا headless).

## ٤. التشغيل التلقائي الدائم

```sh
mkdir -p ~/.termux/boot
cp ~/shein-price-tracker/fetcher/boot-start.sh ~/.termux/boot/start.sh
chmod +x ~/.termux/boot/start.sh

# شغّله الآن بلا انتظار إعادة تشغيل:
sh ~/.termux/boot/start.sh &
```

- الافتراضي: فحص **كل ٦٠ دقيقة** (`INTERVAL=3600`). لتغييره: `nano ~/.termux/boot/start.sh`.
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
