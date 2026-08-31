// استخراج السعر/المخزون من HTML صفحة منتج شي إن. بلا أي تبعية — يستورده
// كلٌّ من الـ Worker والجالب المحلي (fetcher/check.mjs). حدّث هذا الملف وحده
// إذا غيّرت شي إن شكل صفحاتها.

export function extractGoodsId(url) {
  const s = String(url);
  const m = s.match(/-p-(\d+)/) || s.match(/[?&](?:goods_id|goodsId)=(\d+)/);
  return m ? m[1] : null;
}

// يُعيد { price:Number, currency:String|null, inStock:Boolean|null } أو null.
export function parsePrice(html) {
  if (!html || html.length < 500) return null;

  // أ) JSON-LD (الأنظف حين يتوفّر)
  for (const b of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(b[1].trim());
      const nodes = Array.isArray(data) ? data : data['@graph'] || [data];
      for (const n of nodes) {
        if (!n || !/product/i.test(n['@type'] || '')) continue;
        const offer = Array.isArray(n.offers) ? n.offers[0] : n.offers;
        if (!offer) continue;
        const price = parseFloat(offer.price ?? offer.lowPrice ?? offer.priceSpecification?.price);
        if (Number.isFinite(price) && price > 0) {
          const avail = String(offer.availability || '').toLowerCase();
          return { price, currency: offer.priceCurrency || null, inStock: avail ? avail.includes('instock') : null };
        }
      }
    } catch { /* التالي */ }
  }

  // ب) كتلة شي إن الداخلية (productIntroData / detail JSON)
  const b1 =
    html.match(/"salePrice"\s*:\s*\{[^{}]*?"amount"\s*:\s*"([\d.]+)"/) ||
    html.match(/"salePrice"\s*:\s*\{[^{}]*?"amountWithSymbol"\s*:\s*"[^\d]*([\d.,]+)"/) ||
    html.match(/"retailPrice"\s*:\s*\{[^{}]*?"amount"\s*:\s*"([\d.]+)"/) ||
    html.match(/"unit_price"\s*:\s*"?([\d.]+)/) ||
    html.match(/"price"\s*:\s*"?([\d.]+)"?/);
  if (b1) {
    const price = parseFloat(String(b1[1]).replace(/,/g, ''));
    if (Number.isFinite(price) && price > 0) {
      const cur =
        html.match(/"currency"\s*:\s*"([A-Z]{3})"/) ||
        html.match(/priceCurrency["\s:]+"([A-Z]{3})"/);
      const soldOut = /"is_on_sale"\s*:\s*0[\s\S]{0,200}"stock"\s*:\s*0|"sold_out_tips"|out.?of.?stock|SOLD\s*OUT/i.test(html);
      const inStockHint = /"is_sold_out"\s*:\s*0|"stock"\s*:\s*[1-9]/i.test(html);
      return { price, currency: cur ? cur[1] : null, inStock: soldOut ? false : inStockHint ? true : null };
    }
  }

  // ج) وسوم meta / OpenGraph
  const mp =
    html.match(/<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([\d.]+)["']/i) ||
    html.match(/<meta[^>]+property=["']og:price:amount["'][^>]+content=["']([\d.]+)["']/i) ||
    html.match(/itemprop=["']price["'][^>]+content=["']([\d.]+)["']/i);
  if (mp) {
    const price = parseFloat(mp[1]);
    if (Number.isFinite(price) && price > 0) {
      const mc = html.match(/<meta[^>]+property=["']product:price:currency["'][^>]+content=["']([A-Z]{3})["']/i);
      return { price, currency: mc ? mc[1] : null, inStock: null };
    }
  }

  return null;
}

// يكشف صفحة حظر الزواحف (لا تُعامَل كخطأ سعر — بل كإشارة IP محظور).
export function isBlockPage(html) {
  return /page_risk_crawler_block|risk_crawler|Access Denied|unusual traffic|verify you are human/i.test(html || '');
}
