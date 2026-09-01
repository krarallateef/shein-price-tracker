#!/data/data/com.termux/files/usr/bin/sh
# مشرف بسيط: يُبقي CPU مستيقظاً، يشغّل شاشة X افتراضية (لازمة للمتصفّح
# بوضع نافذة — شي إن تكشف headless)، ويُشغّل الجالب كل INTERVAL ثانية.
# يُوضع في ~/.termux/boot/start.sh ليعمل تلقائياً بعد إقلاع الجهاز
# (يتطلّب إضافة Termux:Boot من F-Droid).

INTERVAL=${INTERVAL:-300}   # 300 = كل 5 دقائق. غيّره لـ 60 لأقصى تكرار.
REPO="$HOME/shein-price-tracker"
LOG="$REPO/fetcher/last-run.log"

termux-wake-lock 2>/dev/null

# شاشة X افتراضية على :1 (إن لم تكن تعمل)
export DISPLAY=:1
if ! pgrep -f "Xvnc.*:1" >/dev/null 2>&1; then
  vncserver -localhost -SecurityTypes None :1 >/dev/null 2>&1 || vncserver -localhost :1 >/dev/null 2>&1
  sleep 3
fi

cd "$REPO/fetcher" || exit 1
while true; do
  node check.mjs >> "$LOG" 2>&1
  tail -n 500 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
  sleep "$INTERVAL"
done
