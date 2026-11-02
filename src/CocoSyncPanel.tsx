import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { RefreshCw, ExternalLink, Info, CheckCircle2 } from "lucide-react";

const db = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

type CatalogItem = { key: string; name: string; price: number; size: string; description: string; sourceUrl: string };
type Deal = { key: string; title: string; description: string; startsAt: string; endsAt: string; sourceUrl: string };

const productSource = "https://www.beauty321.com/post/68035";
const menuSource = "https://supertaste.tvbs.com.tw/food/347016";
const dealSource = "https://www.dealbureau.tw/deal/deal-approved-cmvvrgni6007tkx08rp011lm7";
const couponSource = "https://www.sacro.tw/coupon/coco-tea/16/1";

const catalog: CatalogItem[] = [
  { key: "coco-avo-bubu-m", name: "酪梨布布牛乳（中杯）", price: 69, size: "中杯", description: "CoCo都可酪梨系列；實際供應依門市為準。", sourceUrl: productSource },
  { key: "coco-avo-bubu-l", name: "酪梨布布牛乳（大杯）", price: 79, size: "大杯", description: "CoCo都可酪梨系列；實際供應依門市為準。", sourceUrl: productSource },
  { key: "coco-avo-tea-milk-l", name: "酪梨茶牛乳（大杯）", price: 79, size: "大杯", description: "CoCo都可酪梨系列；實際供應依門市為準。", sourceUrl: productSource },
  { key: "coco-cocoa-pearl-m", name: "可可甜心珍奶（中杯）", price: 60, size: "中杯", description: "CoCo都可可可甜心系列；實際供應依門市為準。", sourceUrl: productSource },
  { key: "coco-cocoa-pearl-l", name: "可可甜心珍奶（大杯）", price: 70, size: "大杯", description: "CoCo都可可可甜心系列；實際供應依門市為準。", sourceUrl: productSource },
  { key: "coco-buckwheat-cocoa-m", name: "蕎麥可可甜心（中杯）", price: 60, size: "中杯", description: "CoCo都可可可甜心系列；實際供應依門市為準。", sourceUrl: productSource },
  { key: "coco-buckwheat-cocoa-l", name: "蕎麥可可甜心（大杯）", price: 70, size: "大杯", description: "CoCo都可可可甜心系列；實際供應依門市為準。", sourceUrl: productSource },
  { key: "coco-cocoa-milk-m", name: "可可甜心牛乳（中杯）", price: 65, size: "中杯", description: "CoCo都可可可甜心系列；實際供應依門市為準。", sourceUrl: productSource },
  { key: "coco-cocoa-milk-l", name: "可可甜心牛乳（大杯）", price: 75, size: "大杯", description: "CoCo都可可可甜心系列；實際供應依門市為準。", sourceUrl: productSource },
  { key: "coco-milktea-trio-l", name: "奶茶三兄弟（大杯）", price: 70, size: "大杯", description: "珍珠、布丁與仙草；原價資料需依門市再次確認。", sourceUrl: menuSource }
];

const deals: Deal[] = [
  { key: "coco-deal-milktea-trio-202611", title: "CoCo 奶茶三兄弟大杯特價 $45", description: "活動資訊標示 2026/11/1～11/30。來源頁面列示原價 $70、優惠價 $45；適用門市、通路及數量限制請以 CoCo 官方公告與門市為準。此優惠先匯入草稿，不會自動改動點餐價格。", startsAt: "2026-11-01T00:00:00+08:00", endsAt: "2026-11-30T23:59:59+08:00", sourceUrl: couponSource },
  { key: "coco-deal-two-99-20261105", title: "CoCo 指定飲品任選 2 杯 $99", description: "活動資訊標示 2026/10/29～11/5，包含指定大杯飲品；臨櫃與都可訂限定，非全門市活動，部分門市不適用。品項與適用條件請依官方公告確認。此優惠先匯入草稿，不會自動改動點餐價格。", startsAt: "2026-10-29T00:00:00+08:00", endsAt: "2026-11-05T23:59:59+08:00", sourceUrl: dealSource }
];

export default function CocoSyncPanel({ onMessage, onRefresh }: { onMessage: (message: string) => void; onRefresh: () => Promise<void> }) {
  const [busy, setBusy] = useState<"products" | "deals" | "">("");
  const [lastResult, setLastResult] = useState("");

  async function syncProducts() {
    setBusy("products");
    try {
      const keys = catalog.map(item => item.key);
      const { data: existing, error: readError } = await db.from("menu_items").select("id,source_key").in("source_key", keys);
      if (readError) throw readError;
      const existingMap = new Map((existing || []).map((row: any) => [row.source_key, row.id]));
      const now = new Date().toISOString();
      let created = 0, updated = 0;
      for (const item of catalog) {
        const payload = { name: item.name, description: item.description, price: item.price, category: "CoCo飲料", source_brand: "coco", source_key: item.key, source_url: item.sourceUrl, source_checked_at: now };
        const id = existingMap.get(item.key);
        const result = id
          ? await db.from("menu_items").update({ name: payload.name, description: payload.description, price: payload.price, category: payload.category, source_url: payload.source_url, source_checked_at: now }).eq("id", id)
          : await db.from("menu_items").insert({ ...payload, stock: 0, is_available: false, sort_order: 500 + created });
        if (result.error) throw result.error;
        if (id) updated++; else created++;
      }
      const message = `CoCo 商品同步完成：新增 ${created} 項、更新 ${updated} 項。新商品預設下架且庫存為 0，請先核對價格與庫存再上架。`;
      setLastResult(message); onMessage(message); await onRefresh();
    } catch (error: any) {
      onMessage("CoCo 商品同步失敗：" + (error?.message || "未知錯誤"));
    } finally { setBusy(""); }
  }

  async function syncDeals() {
    setBusy("deals");
    try {
      const keys = deals.map(item => item.key);
      const { data: existing, error: readError } = await db.from("activities").select("id,source_key").in("source_key", keys);
      if (readError) throw readError;
      const existingMap = new Map((existing || []).map((row: any) => [row.source_key, row.id]));
      const now = new Date().toISOString();
      let created = 0, updated = 0;
      for (const deal of deals) {
        const payload = { title: deal.title, description: deal.description, starts_at: deal.startsAt, ends_at: deal.endsAt, source_brand: "coco", source_key: deal.key, source_url: deal.sourceUrl, source_checked_at: now };
        const id = existingMap.get(deal.key);
        const result = id
          ? await db.from("activities").update({ title: payload.title, description: payload.description, starts_at: payload.starts_at, ends_at: payload.ends_at, source_url: payload.source_url, source_checked_at: now }).eq("id", id)
          : await db.from("activities").insert({ ...payload, is_active: false });
        if (result.error) throw result.error;
        if (id) updated++; else created++;
      }
      const message = `CoCo 優惠同步完成：新增 ${created} 則、更新 ${updated} 則。活動維持草稿，請核對適用門市與期限後再發布。`;
      setLastResult(message); onMessage(message);
    } catch (error: any) {
      onMessage("CoCo 優惠同步失敗：" + (error?.message || "未知錯誤"));
    } finally { setBusy(""); }
  }

  return <section className="coco-sync">
    <div className="coco-sync-heading"><div><span className="eyebrow">COCO CATALOG & DEALS</span><h3>CoCo 都可同步中心</h3><p>匯入可核對的飲品資料與優惠公告，並保留來源及同步時間。</p></div><span className="coco-brand-mark">CoCo</span></div>
    <div className="coco-sync-warning"><Info size={18}/><p>目前採「來源資料匯入＋管理員確認」方式，並非 CoCo 官方即時 API。不同門市可能有不同售價、供應品項與活動條件。匯入商品會先下架、庫存設為 0；優惠會先存成未發布草稿，不會直接影響訂單金額。</p></div>
    <div className="coco-sync-actions">
      <article><div><b>飲品商品目錄</b><small>{catalog.length} 個品項（含容量與價格）</small><p>依近期公開菜單／新品資料建立初始目錄。同步會更新 CoCo 品項價格與描述，但保留你已設定的庫存、圖片及上架狀態。</p><a href={productSource} target="_blank" rel="noreferrer">新品價格來源 <ExternalLink size={13}/></a> · <a href={menuSource} target="_blank" rel="noreferrer">菜單參考 <ExternalLink size={13}/></a></div><button disabled={!!busy} onClick={() => void syncProducts()}><RefreshCw size={15}/>{busy === "products" ? "同步中…" : "同步 CoCo 商品"}</button></article>
      <article><div><b>優惠與活動</b><small>{deals.length} 則優惠公告</small><p>同步優惠標題、活動期限、條件及來源。已存在的活動只更新內容，不會擅自改變你設定的發布狀態。</p><a href={couponSource} target="_blank" rel="noreferrer">奶茶三兄弟優惠來源 <ExternalLink size={13}/></a> · <a href={dealSource} target="_blank" rel="noreferrer">任選 2 杯 $99 來源 <ExternalLink size={13}/></a></div><button disabled={!!busy} onClick={() => void syncDeals()}><RefreshCw size={15}/>{busy === "deals" ? "同步中…" : "同步 CoCo 優惠"}</button></article>
    </div>
    {lastResult && <p className="coco-sync-result"><CheckCircle2 size={16}/>{lastResult}</p>}
    <small className="coco-sync-footnote">商品價格參考：Beauty321 2026/11 新品資訊、TVBS 食尚玩家菜單整理；優惠來源為公開優惠整理頁，並非 CoCo 官方 API。上架及對外公告前請再向供應門市確認。</small>
  </section>;
}
