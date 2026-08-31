#!/data/data/com.termux/files/usr/bin/sh
# مشرف بسيط: يُبقي CPU مستيقظاً ويُشغّل الجالب كل INTERVAL ثانية.
# يُوضع في ~/.termux/boot/start.sh ليعمل تلقائياً بعد إقلاع الجهاز
# (يتطلّب إضافة Termux:Boot من F-Droid).

INTERVAL=${INTERVAL:-300}   # 300 = كل 5 دقائق. غيّره لـ 60 لأقصى تكرار.
REPO="$HOME/shein-price-tracker"

termux-wake-lock 2>/dev/null

cd "$REPO/fetcher" || exit 1
while true; do
  node check.mjs >> "$REPO/fetcher/last-run.log" 2>&1
  # قصّ السجلّ إلى آخر 500 سطر
  tail -n 500 "$REPO/fetcher/last-run.log" > "$REPO/fetcher/last-run.log.tmp" && mv "$REPO/fetcher/last-run.log.tmp" "$REPO/fetcher/last-run.log"
  sleep "$INTERVAL"
done
