#!/data/data/com.termux/files/usr/bin/sh
# مشرف: يبقي CPU مستيقظاً، يشغّل شاشة X افتراضية (المتصفّح يعمل بنافذة — شي إن تكشف headless)،
# ثم حلقتان:
#   • كل FAST ثانية: جلب سريع للمنتجات المضافة حديثاً فقط (تظهر تفاصيلها بسرعة)
#   • كل FULL ثانية: فحص كامل لكل المنتجات
# يوضع في ~/.termux/boot/start.sh (يتطلب Termux:Boot من F-Droid).

FULL=${INTERVAL:-3600}   # فحص كامل كل 60 دقيقة
FAST=${FAST:-180}        # فحص المضاف حديثاً كل 3 دقائق
REPO="$HOME/shein-price-tracker"
LOG="$REPO/fetcher/last-run.log"

termux-wake-lock 2>/dev/null

export DISPLAY=:1
if ! pgrep -f "Xvnc.*:1" >/dev/null 2>&1; then
  vncserver -localhost -SecurityTypes None :1 >/dev/null 2>&1 || vncserver -localhost :1 >/dev/null 2>&1
  sleep 3
fi

cd "$REPO/fetcher" || exit 1
last_full=0
while true; do
  now=$(date +%s)
  if [ $((now - last_full)) -ge "$FULL" ]; then
    node check.mjs >> "$LOG" 2>&1
    last_full=$now
  else
    NEW_ONLY=1 node check.mjs >> "$LOG" 2>&1
  fi
  tail -n 500 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
  sleep "$FAST"
done
