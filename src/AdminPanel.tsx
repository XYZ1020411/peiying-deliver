import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Plus, Pencil, Trash2, Megaphone, Package, X } from "lucide-react";

const db = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
type Product = { id: string; name: string; description: string | null; price: number; image_url: string | null; stock: number; is_available: boolean; category: string; sort_order: number };
type Activity = { id: string; title: string; description: string | null; image_url: string | null; starts_at: string | null; ends_at: string | null; is_active: boolean };
const blankProduct = { name: "", description: "", price: "0", image_url: "", stock: "0", category: "餐點", is_available: true };
const blankActivity = { title: "", description: "", image_url: "", starts_at: "", ends_at: "", is_active: true };

export default function AdminPanel({ onRefresh, onMessage }: { onRefresh: () => Promise<void>; onMessage: (s: string) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [product, setProduct] = useState({ ...blankProduct, id: "" });
  const [activity, setActivity] = useState({ ...blankActivity, id: "" });
  const [section, setSection] = useState<"products" | "activities">("products");
  const [loading, setLoading] = useState(false);

  async function load() {
    const [p, a] = await Promise.all([
      db.from("menu_items").select("id,name,description,price,image_url,stock,is_available,category,sort_order").order("sort_order"),
      db.from("activities").select("id,title,description,image_url,starts_at,ends_at,is_active").order("created_at", { ascending: false })
    ]);
    if (p.error) onMessage(p.error.message); else setProducts((p.data || []) as Product[]);
    if (a.error) onMessage(a.error.message); else setActivities((a.data || []) as Activity[]);
  }
  useEffect(() => { void load(); }, []);

  async function saveProduct() {
    if (!product.name.trim()) return onMessage("請填寫商品名稱。");
    setLoading(true);
    const payload = { name: product.name.trim(), description: product.description.trim() || null, price: Math.max(0, Number(product.price)), image_url: product.image_url.trim() || null, stock: Math.max(0, Number(product.stock)), category: product.category.trim() || "餐點", is_available: product.is_available };
    const result = product.id ? await db.from("menu_items").update(payload).eq("id", product.id) : await db.from("menu_items").insert({ ...payload, sort_order: products.length });
    setLoading(false);
    if (result.error) onMessage(result.error.message);
    else { onMessage(product.id ? "商品已更新。" : "商品已建立。"); setProduct({ ...blankProduct, id: "" }); await load(); await onRefresh(); }
  }
  async function removeProduct(p: Product) {
    if (!window.confirm("確定刪除商品「" + p.name + "」？")) return;
    const { error } = await db.from("menu_items").delete().eq("id", p.id);
    onMessage(error ? error.message : "商品已刪除。"); await load(); await onRefresh();
  }
  async function saveActivity() {
    if (!activity.title.trim()) return onMessage("請填寫活動名稱。");
    setLoading(true);
    const payload = { title: activity.title.trim(), description: activity.description.trim() || null, image_url: activity.image_url.trim() || null, starts_at: activity.starts_at ? new Date(activity.starts_at).toISOString() : null, ends_at: activity.ends_at ? new Date(activity.ends_at).toISOString() : null, is_active: activity.is_active };
    const result = activity.id ? await db.from("activities").update(payload).eq("id", activity.id) : await db.from("activities").insert(payload);
    setLoading(false);
    if (result.error) onMessage(result.error.message);
    else { onMessage(activity.id ? "活動已更新。" : "活動已發布。"); setActivity({ ...blankActivity, id: "" }); await load(); }
  }
  async function removeActivity(a: Activity) {
    if (!window.confirm("確定刪除活動「" + a.title + "」？")) return;
    const { error } = await db.from("activities").delete().eq("id", a.id);
    onMessage(error ? error.message : "活動已刪除。"); await load();
  }
  return <section className="admin-manager">
    <div className="admin-switch"><button className={section === "products" ? "selected" : ""} onClick={() => setSection("products")}><Package size={16}/> 商品管理</button><button className={section === "activities" ? "selected" : ""} onClick={() => setSection("activities")}><Megaphone size={16}/> 活動管理</button></div>
    {section === "products" && <>
      <div className="admin-manager-head"><div><h3>{product.id ? "編輯商品" : "建立新商品"}</h3><p>設定商品資訊、價格、庫存及上架狀態</p></div><button className="admin-clear" onClick={() => setProduct({ ...blankProduct, id: "" })}><X size={15}/> 清空</button></div>
      <div className="admin-form-grid">
        <label>商品名稱<input value={product.name} onChange={e => setProduct(v => ({ ...v, name: e.target.value }))} placeholder="例如：雞腿便當"/></label>
        <label>商品分類<input value={product.category} onChange={e => setProduct(v => ({ ...v, category: e.target.value }))} placeholder="便當／飲料／點心"/></label>
        <label>價格（NT$）<input type="number" min="0" value={product.price} onChange={e => setProduct(v => ({ ...v, price: e.target.value }))}/></label>
        <label>庫存數量<input type="number" min="0" value={product.stock} onChange={e => setProduct(v => ({ ...v, stock: e.target.value }))}/></label>
        <label className="admin-wide">商品圖片網址<input value={product.image_url} onChange={e => setProduct(v => ({ ...v, image_url: e.target.value }))} placeholder="https://..."/></label>
        <label className="admin-wide">商品介紹<textarea value={product.description} onChange={e => setProduct(v => ({ ...v, description: e.target.value }))} placeholder="介紹商品特色、份量或口味"/></label>
        <label className="admin-check"><input type="checkbox" checked={product.is_available} onChange={e => setProduct(v => ({ ...v, is_available: e.target.checked }))}/> 立即上架</label>
      </div>
      <button className="admin-primary" disabled={loading} onClick={saveProduct}><Plus size={16}/>{loading ? "儲存中…" : product.id ? "儲存商品修改" : "建立商品"}</button>
      <h3 className="admin-list-title">商品列表（{products.length}）</h3>
      <div className="admin-record-list">{products.map(p => <article key={p.id}><div className="admin-record-image">{p.image_url ? <img src={p.image_url} alt=""/> : "🍱"}</div><div className="admin-record-info"><b>{p.name}</b><small>{p.category || "餐點"} · NT$ {p.price} · 庫存 {p.stock}</small><span className={p.is_available ? "admin-on" : "admin-off"}>{p.is_available ? "上架中" : "已下架"}</span></div><div className="admin-record-actions"><button onClick={() => { setProduct({ id: p.id, name: p.name, description: p.description || "", price: String(p.price), image_url: p.image_url || "", stock: String(p.stock || 0), category: p.category || "餐點", is_available: p.is_available }); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil size={15}/></button><button className="admin-delete" onClick={() => void removeProduct(p)}><Trash2 size={15}/></button></div></article>)}</div>
    </>}
    {section === "activities" && <>
      <div className="admin-manager-head"><div><h3>{activity.id ? "編輯活動" : "建立新活動"}</h3><p>發布公告、優惠或期間限定活動</p></div><button className="admin-clear" onClick={() => setActivity({ ...blankActivity, id: "" })}><X size={15}/> 清空</button></div>
      <div className="admin-form-grid">
        <label>活動名稱<input value={activity.title} onChange={e => setActivity(v => ({ ...v, title: e.target.value }))} placeholder="例如：新品上市優惠"/></label>
        <label className="admin-wide">活動圖片網址<input value={activity.image_url} onChange={e => setActivity(v => ({ ...v, image_url: e.target.value }))} placeholder="https://..."/></label>
        <label className="admin-wide">活動內容<textarea value={activity.description} onChange={e => setActivity(v => ({ ...v, description: e.target.value }))} placeholder="輸入活動說明、優惠內容或注意事項"/></label>
        <label>開始時間<input type="datetime-local" value={activity.starts_at} onChange={e => setActivity(v => ({ ...v, starts_at: e.target.value }))}/></label>
        <label>結束時間<input type="datetime-local" value={activity.ends_at} onChange={e => setActivity(v => ({ ...v, ends_at: e.target.value }))}/></label>
        <label className="admin-check"><input type="checkbox" checked={activity.is_active} onChange={e => setActivity(v => ({ ...v, is_active: e.target.checked }))}/> 啟用並公開活動</label>
      </div>
      <button className="admin-primary" disabled={loading} onClick={saveActivity}><Megaphone size={16}/>{loading ? "發布中…" : activity.id ? "儲存活動修改" : "發布活動"}</button>
      <h3 className="admin-list-title">活動列表（{activities.length}）</h3>
      <div className="admin-record-list">{activities.map(a => <article key={a.id}><div className="admin-record-image">{a.image_url ? <img src={a.image_url} alt=""/> : "📣"}</div><div className="admin-record-info"><b>{a.title}</b><small>{a.starts_at ? new Date(a.starts_at).toLocaleString("zh-TW") : "立即開始"} ～ {a.ends_at ? new Date(a.ends_at).toLocaleString("zh-TW") : "未設定結束"}</small><span className={a.is_active ? "admin-on" : "admin-off"}>{a.is_active ? "啟用中" : "已停用"}</span></div><div className="admin-record-actions"><button onClick={() => setActivity({ id: a.id, title: a.title, description: a.description || "", image_url: a.image_url || "", starts_at: a.starts_at ? a.starts_at.slice(0,16) : "", ends_at: a.ends_at ? a.ends_at.slice(0,16) : "", is_active: a.is_active })}><Pencil size={15}/></button><button className="admin-delete" onClick={() => void removeActivity(a)}><Trash2 size={15}/></button></div></article>)}</div>
    </>}
  </section>;
}

export function ActivityFeed() {
  const [items, setItems] = useState<Activity[]>([]);
  useEffect(() => {
    let active = true;
    db.from("activities").select("id,title,description,image_url,starts_at,ends_at,is_active").eq("is_active", true).order("created_at", { ascending: false }).then(({ data }) => {
      if (active) setItems(((data || []) as Activity[]).filter(a => (!a.starts_at || new Date(a.starts_at) <= new Date()) && (!a.ends_at || new Date(a.ends_at) >= new Date())));
    });
    return () => { active = false; };
  }, []);
  if (!items.length) return null;
  return <section className="activity-feed"><h3><Megaphone size={17}/> 最新活動與公告</h3>{items.map(a => <article key={a.id}>{a.image_url && <img src={a.image_url} alt=""/>}<div><b>{a.title}</b>{a.description && <p>{a.description}</p>}</div></article>)}</section>;
}
