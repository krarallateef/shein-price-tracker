// استخراج السعر/المخزون/الصورة/SKU من HTML صفحة منتج شي إن. بلا أي تبعية —
// يستورده كلٌّ من الـ Worker والجالب المحلي (fetcher/check.mjs). حدّث هذا الملف
// وحده إذا غيّرت شي إن شكل صفحاتها.

export function extractGoodsId(url) {
  const s = String(url);
  const m = s.match(/-p-(\d+)/) || s.match(/[?&](?:goods_id|goodsId)=(\d+)/);
  return m ? m[1] : null;
}

// الصورة الرئيسية — og:image ثم JSON-LD image ثم أول صورة منتج في كتلة شي إن.
function extractImage(html) {
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (og) return og[1];
  const ld = html.match(/"image"\s*:\s*"(https?:[^"]+)"/) || html.match(/"image"\s*:\s*\[\s*"(https?:[^"]+)"/);
  if (ld) return ld[1];
  const sh = html.match(/"(?:goods_img|original_img|img_url)"\s*:\s*"(https?:[^"]+)"/);
  if (sh) return sh[1].replace(/\\u002F/g, '/').replace(/\\\//g, '/');
  return null;
}

// اسم المنتج — og:title ثم JSON-LD name ثم <title> (منظّفاً من لاحقة شي إن).
function extractName(html) {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  let n = og ? og[1] : null;
  if (!n) { const ld = html.match(/"name"\s*:\s*"([^"]{4,160})"/); if (ld) n = ld[1]; }
  if (!n) { const t = html.match(/<title[^>]*>([^<]+)<\/title>/i); if (t) n = t[1]; }
  if (!n) return null;
  n = n.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
       .replace(/\s*[|\-–]\s*(SHEIN|شي\s*إن|شي\s*ان).*$/i, '').replace(/\s+/g, ' ').trim();
  return n.slice(0, 140) || null;
}

// SKU — رمز المنتج (goods_sn في شي إن) ثم JSON-LD sku/mpn.
function extractSku(html) {
  const sn = html.match(/"goods_sn"\s*:\s*"([A-Za-z0-9_-]+)"/);
  if (sn) return sn[1];
  const ld = html.match(/"(?:sku|mpn)"\s*:\s*"([A-Za-z0-9_-]+)"/);
  if (ld) return ld[1];
  return null;
}

// يُعيد { price, currency, inStock, image, sku } أو null.
export function parsePrice(html) {
  if (!html || html.length < 500) return null;
  const image = extractImage(html);
  const sku = extractSku(html);
  const name = extractName(html);
  const withExtras = (o) => ({ ...o, image: o.image ?? image, sku: o.sku ?? sku, name: o.name ?? name });

  // أ) JSON-LD
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
          const img = Array.isArray(n.image) ? n.image[0] : n.image;
          return withExtras({
            price, currency: offer.priceCurrency || null,
            inStock: avail ? !/(soldout|outofstock|discontinued)/.test(avail) : null,
            image: img || null, sku: n.sku || n.mpn || null,
          });
        }
      }
    } catch { /* التالي */ }
  }

  // ب) كتلة شي إن الداخلية
  const b1 =
    html.match(/"salePrice"\s*:\s*\{[^{}]*?"amount"\s*:\s*"([\d.]+)"/) ||
    html.match(/"salePrice"\s*:\s*\{[^{}]*?"amountWithSymbol"\s*:\s*"[^\d]*([\d.,]+)"/) ||
    html.match(/"retailPrice"\s*:\s*\{[^{}]*?"amount"\s*:\s*"([\d.]+)"/) ||
    html.match(/"unit_price"\s*:\s*"?([\d.]+)/) ||
    html.match(/"price"\s*:\s*"?([\d.]+)"?/);
  if (b1) {
    const price = parseFloat(String(b1[1]).replace(/,/g, ''));
    if (Number.isFinite(price) && price > 0) {
      const cur = html.match(/"currency"\s*:\s*"([A-Z]{3})"/) || html.match(/priceCurrency["\s:]+"([A-Z]{3})"/);
      const soldOut = /"is_on_sale"\s*:\s*0[\s\S]{0,200}"stock"\s*:\s*0|"sold_out_tips"|out.?of.?stock|SOLD\s*OUT/i.test(html);
      const inStockHint = /"is_sold_out"\s*:\s*0|"stock"\s*:\s*[1-9]/i.test(html);
      return withExtras({ price, currency: cur ? cur[1] : null, inStock: soldOut ? false : inStockHint ? true : null });
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
      return withExtras({ price, currency: mc ? mc[1] : null, inStock: null });
    }
  }

  return null;
}

// يكشف صفحة حظر الزواحف (لا تُعامَل كخطأ سعر — بل كإشارة IP محظور).
export function isBlockPage(html) {
  return /page_risk_crawler_block|risk_crawler|Access Denied|unusual traffic|verify you are human/i.test(html || '');
}
