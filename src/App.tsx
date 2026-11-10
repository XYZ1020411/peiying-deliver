import { useEffect, useMemo, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import AdminPanel, { ActivityFeed } from "./AdminPanel";
import LoyaltyPanel from "./LoyaltyPanel";
import PhoneAdminVerification from "./PhoneAdminVerification";
import { ShoppingBag, LogOut, Plus, Minus, ClipboardList, ShieldCheck, Clock3, MapPin, RefreshCw, Utensils, PackageCheck, Gift } from "lucide-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const ADMIN_EMAIL = "liu1060426510@gmail.com";
type MenuItem = { id: string; name: string; description: string | null; price: number; image_url: string | null; stock: number; is_available: boolean };
type Delivery = { id: string; weekday: number; destination: string; is_enabled: boolean };
type Order = { id: string; customer_name: string; customer_email: string; delivery_date: string; delivery_destination: string; status: string; total_amount: number; note: string | null; created_at: string };
const dayNames = ["日", "一", "二", "三", "四", "五", "六"];
const statusNames: Record<string, string> = { pending: "待確認", confirmed: "已接單", preparing: "準備中", ready: "可取餐", completed: "已完成", cancelled: "已取消" };

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [application, setApplication] = useState<any>(null);
  const [applicationLoading, setApplicationLoading] = useState(false);
  const [applicationForm, setApplicationForm] = useState({ student_name: "", grade: "國二", class_name: "", courses: [] as string[], notification_method: "email", line_contact: "" });
  const [studentName, setStudentName] = useState("");
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [schedule, setSchedule] = useState<Delivery[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [tab, setTab] = useState<"menu" | "orders" | "rewards" | "admin">("menu");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const email = session?.user.email?.toLowerCase() ?? "";
  
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const weekday = today.getDay();
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
  const todaysDelivery = schedule.find(x => x.weekday === weekday && x.is_enabled);

  useEffect(() => {
    if (!supabase) { setChecking(false); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let live = true;
    async function verifySpecialAccount() {
      if (!supabase || !session || !email) { setIsAdmin(false); return; }
      if (email === ADMIN_EMAIL) { setIsAdmin(true); return; }
      const verifiedPhone = (session.user.phone || "").replace(/\\D/g, "");
      if (verifiedPhone.endsWith("855")) { setIsAdmin(true); return; }
      const { data } = await supabase.from("special_accounts").select("role").eq("email", email).maybeSingle();
      if (live) setIsAdmin(data?.role === "admin" || data?.role === "manager");
    }
    void verifySpecialAccount();
    return () => { live = false; };
  }, [session, email]);

  useEffect(() => {
    let live = true;
    async function load() {
      if (!supabase || !session) { setChecking(false); setApplication(null); return; }
      setChecking(true);
      if (isAdmin) { if (live) setStudentName("平台管理員"); }
      else {
        const { data: appData } = await supabase.from("student_applications").select("*").eq("user_id", session.user.id).maybeSingle();
        if (live) {
          setApplication(appData);
          if (appData) {
            setStudentName(appData.student_name || "培英同學");
            setApplicationForm({ student_name: appData.student_name || "", grade: appData.grade || "國二", class_name: appData.class_name || "", courses: appData.courses || [], notification_method: appData.notification_method || "email", line_contact: appData.line_contact || "" });
          } else {
            setStudentName("");
            setApplicationForm(v => ({ ...v, student_name: session.user.user_metadata?.name || session.user.user_metadata?.full_name || "" }));
          }
        }
      }
      const [m, d, o] = await Promise.all([
        supabase.from("menu_items").select("id,name,description,price,image_url,stock,is_available").eq("is_available", true).order("sort_order"),
        supabase.from("delivery_schedule").select("id,weekday,destination,is_enabled").order("weekday"),
        supabase.from("orders").select("id,customer_name,customer_email,delivery_date,delivery_destination,status,total_amount,note,created_at").order("created_at", { ascending: false }).limit(isAdmin ? 100 : 30)
      ]);
      if (live) {
        setMenu((m.data || []) as MenuItem[]);
        setSchedule((d.data || []) as Delivery[]);
        setOrders((o.data || []) as Order[]);
        setChecking(false);
      }
    }
    void load();
    return () => { live = false; };
  }, [session, email, isAdmin]);

  useEffect(() => {
    if (!supabase || !session || (!isAdmin && application?.status !== "approved")) return;
    const channel = supabase.channel("peiying-orders-live").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, async () => {
      const { data } = await supabase.from("orders").select("id,customer_name,customer_email,delivery_date,delivery_destination,status,total_amount,note,created_at").order("created_at", { ascending: false }).limit(isAdmin ? 100 : 30);
      setOrders((data || []) as Order[]);
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [session, application?.status, isAdmin]);

  const total = useMemo(() => menu.reduce((sum, item) => sum + item.price * (cart[item.id] || 0), 0), [menu, cart]);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  async function signIn(provider: "google" | "custom:line" = "google") {
    if (!supabase) return;
    setMessage("");
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin, ...(provider === "custom:line" ? { scopes: "openid profile email" } : {}) } });
    if (error) setMessage(provider === "custom:line" ? `LINE 登入尚未完成設定：${error.message}` : `Google 登入失敗：${error.message}`);
  }
  async function signOut() { await supabase?.auth.signOut(); setCart({}); }
  async function submitEmailAuth() {
    if (!supabase) return;
    const e = authEmail.trim().toLowerCase();
    if (!e || authPassword.length < 8) { setMessage("請輸入有效電子郵件，密碼至少 8 個字元。"); return; }
    setBusy(true); setMessage("");
    if (authMode === "register") {
      const { data, error } = await supabase.auth.signUp({ email: e, password: authPassword, options: { emailRedirectTo: window.location.origin } });
      setBusy(false);
      if (error) setMessage("註冊失敗：" + error.message);
      else if (data.session) setMessage("註冊成功，正在登入…");
      else setMessage("註冊申請已建立，請至信箱完成電子郵件驗證後登入。");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: e, password: authPassword });
      setBusy(false); if (error) setMessage("登入失敗：" + error.message);
    }
  }
  async function submitApplication() {
    if (!supabase || !session) return;
    if (!applicationForm.student_name.trim() || !applicationForm.class_name.trim() || !applicationForm.courses.length) {
      setMessage("請填寫姓名、班級並至少勾選一項課程。"); return;
    }
    setApplicationLoading(true); setMessage("");
    const payload = { user_id: session.user.id, email, student_name: applicationForm.student_name.trim(), grade: applicationForm.grade, class_name: applicationForm.class_name.trim(), courses: applicationForm.courses, notification_method: applicationForm.notification_method, line_contact: applicationForm.line_contact.trim() || null, status: "pending" };
    const result = application?.id
      ? await supabase.from("student_applications").update(payload).eq("user_id", session.user.id).select("*").single()
      : await supabase.from("student_applications").insert(payload).select("*").single();
    setApplicationLoading(false);
    if (result.error) { setMessage("申請送出失敗：" + result.error.message); return; }
    setApplication(result.data); setStudentName(result.data.student_name); setMessage("申請已送出，請等待管理員審核。");
  }
  async function refresh() {
    if (!supabase) return;
    const { data } = await supabase.from("orders").select("id,customer_name,customer_email,delivery_date,delivery_destination,status,total_amount,note,created_at").order("created_at", { ascending: false }).limit(isAdmin ? 100 : 30);
    setOrders((data || []) as Order[]);
    const { data: items } = await supabase.from("menu_items").select("id,name,description,price,image_url,stock,is_available").eq("is_available", true).order("sort_order");
    setMenu((items || []) as MenuItem[]);
  }
  async function placeOrder() {
    if (!supabase || !session || !todaysDelivery || !count) return;
    setBusy(true); setMessage("");
    const { data: order, error } = await supabase.from("orders").insert({
      user_id: session.user.id, customer_email: email, customer_name: studentName,
      delivery_date: todayKey, delivery_destination: todaysDelivery.destination, note
    }).select("id").single();
    if (error || !order) { setMessage(error?.message || "訂單建立失敗，請稍後再試。"); setBusy(false); return; }
    const rows = Object.entries(cart).filter(([, quantity]) => quantity > 0).map(([menu_item_id, quantity]) => ({ order_id: order.id, menu_item_id, quantity }));
    const { error: itemError } = await supabase.from("order_items").insert(rows);
    if (itemError) { setMessage("訂單已建立，但餐點明細寫入失敗，請聯絡管理員。"); }
    else { setMessage("訂單送出成功！可在「我的訂單」查看進度。"); setCart({}); setNote(""); await refresh(); setTab("orders"); }
    setBusy(false);
  }
  async function changeStatus(id: string, status: string) {
    if (!supabase) return;
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    setMessage(error ? error.message : "訂單狀態已更新。"); await refresh();
  }
  async function updateStock(item: MenuItem, delta: number) {
    if (!supabase) return;
    const { error } = await supabase.from("menu_items").update({ stock: Math.max(0, item.stock + delta) }).eq("id", item.id);
    setMessage(error ? error.message : "庫存已更新。"); await refresh();
  }

  if (!supabase) return <main className="center"><section className="login-card"><div className="brand-mark"><Utensils /></div><h1>培英外送點餐平台</h1><p>尚未設定 Supabase 前端環境變數。</p><p className="muted">請在 Cloudflare Pages 設定 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY。</p></section></main>;
  if (checking) return <main className="center"><div className="loader" /><p>正在確認登入與學生資格…</p></main>;
  if (!session) return <main className="center"><section className="login-card"><div className="brand-mark"><Utensils /></div><span className="eyebrow">PEIYING STUDENT SERVICE</span><h1>培英外送<br/><em>點餐平台</em></h1><p>今天想吃什麼？快速選餐、線上送單，輕鬆掌握訂單進度。</p><div className="auth-switch"><button className={authMode==="login"?"selected":""} onClick={()=>{setAuthMode("login");setMessage("");}}>登入</button><button className={authMode==="register"?"selected":""} onClick={()=>{setAuthMode("register");setMessage("");}}>建立帳號</button></div><div className="auth-fields"><label>電子郵件<input type="email" autoComplete="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="name@example.com"/></label><label>密碼<input type="password" autoComplete={authMode==="login"?"current-password":"new-password"} value={authPassword} onChange={e=>setAuthPassword(e.target.value)} placeholder="至少 8 個字元"/></label><button className="admin-primary" disabled={busy} onClick={()=>void submitEmailAuth()}>{busy?"處理中…":authMode==="login"?"電子郵件登入":"註冊新帳號"}</button></div><div className="auth-divider">或使用其他方式</div><button className="google-btn" onClick={() => signIn("google")}><span className="google-g">G</span> 使用 Google 帳號登入</button><button className="line-btn" onClick={() => signIn("custom:line")}><span className="line-logo">LINE</span> 使用 LINE 帳號登入</button>{message && <p className="login-error" role="alert">{message}</p>}<small>註冊後請完成信箱驗證，再填寫學生資料申請使用。特殊管理帳戶由管理員授權。</small></section></main>;
  if (!isAdmin && application?.status !== "approved") return <main className="center"><section className="login-card application-card">
    <div className="brand-mark"><Utensils /></div><span className="eyebrow">STUDENT ACCESS APPLICATION</span>
    <h1>{application?.status === "pending" ? "申請審核中" : application?.status === "rejected" ? "申請需要補充" : "歡迎加入培英外送"}</h1>
    <p>登入帳號：<b>{email}</b></p><PhoneAdminVerification />
    {application?.status === "pending" ? <><p>已收到你的申請，管理員確認後會更新審核結果。</p><p className="muted">通知方式：{application.notification_method === "line" ? "LINE" : "電子郵件"}。你也可以稍後重新登入查看狀態。</p><button className="outline-btn" onClick={signOut}>登出</button></> :
    <>
      {application?.status === "rejected" && <p className="login-error">管理員備註：{application.admin_note || "請確認資料後重新送出。"}</p>}
      <p className="muted">請填寫基本資料與目前實際參加的課程，送出後由管理員審核。</p>
      <div className="application-form">
        <label>你的姓名<input value={applicationForm.student_name} onChange={e => setApplicationForm(v => ({...v,student_name:e.target.value}))} placeholder="請輸入姓名"/></label>
        <label>年級<select value={applicationForm.grade} onChange={e => setApplicationForm(v => ({...v,grade:e.target.value}))}>{["國一","國二","國三","高一","高二","高三","其他"].map(x=><option key={x}>{x}</option>)}</select></label>
        <label>班級<input value={applicationForm.class_name} onChange={e => setApplicationForm(v => ({...v,class_name:e.target.value}))} placeholder="例如：3 班"/></label>
        <fieldset><legend>目前有上哪些課程？（至少選一項）</legend>
          {["國文閱讀與寫作","英文會話加強","數學解題實作","自然科學探究","社會議題討論","程式設計入門","AI 創作實驗室（示範課程）","星際數學探索（示範課程）","量子自然研究社（示範課程）"].map(c=><label className="course-option" key={c}><input type="checkbox" checked={applicationForm.courses.includes(c)} onChange={e=>setApplicationForm(v=>({...v,courses:e.target.checked?[...v.courses,c]:v.courses.filter(x=>x!==c)}))}/>{c}</label>)}
          <small>標示「示範課程」為平台測試選項，請依實際情況勾選，管理員會再核對。</small>
        </fieldset>
        <label>審核結果通知方式<select value={applicationForm.notification_method} onChange={e=>setApplicationForm(v=>({...v,notification_method:e.target.value}))}><option value="email">電子郵件（登入信箱）</option><option value="line">LINE（需提供可聯絡的 LINE ID）</option></select></label>
        {applicationForm.notification_method === "line" && <label>LINE ID／聯絡方式<input value={applicationForm.line_contact} onChange={e=>setApplicationForm(v=>({...v,line_contact:e.target.value}))} placeholder="請填寫可聯絡的 LINE ID"/></label>}
        <button className="line-btn" disabled={applicationLoading} onClick={submitApplication}>{applicationLoading ? "送出中…" : "送出審核申請"}</button>
      </div>
      {message && <p className="login-error" role="alert">{message}</p>}
      <button className="outline-btn" onClick={signOut}>登出</button>
    </>}
  </section></main>;

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#"><span className="brand-mark small"><Utensils size={18}/></span><span>培英外送<small>STUDENT FOOD ORDER</small></span></a><div className="user-area"><span className="avatar">{studentName.slice(0,1)}</span><span className="user-name">{studentName}</span><button className="icon-btn" title="登出" onClick={signOut}><LogOut size={18}/></button></div></header>
    <main className="content">
      <section className="welcome"><div><span className="eyebrow">GOOD FOOD, GOOD DAY</span><h1>午餐時間，<em>交給我們。</em></h1><p>嗨，{studentName}！今天也要好好吃飯。</p></div><div className="date-pill"><Clock3 size={16}/>{todayKey} 星期{dayNames[weekday]}</div></section>
      <PhoneAdminVerification />
      <section className="delivery-banner"><div className="delivery-icon"><MapPin/></div><div><b>今日配送地點</b><strong>{todaysDelivery?.destination || "今日暫停配送"}</strong><small>{todaysDelivery ? "請於送出訂單前確認配送地點" : "目前沒有安排配送，請留意最新公告"}</small></div><span className={todaysDelivery ? "open-tag" : "closed-tag"}>{todaysDelivery ? "開放訂餐" : "未開放"}</span></section>
      {message && <div className="notice" role="status">{message}<button onClick={() => setMessage("")}>×</button></div>}
      <nav className="tabs"><button className={tab === "menu" ? "active" : ""} onClick={() => setTab("menu")}><Utensils size={17}/> 今日菜單</button><button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}><ClipboardList size={17}/> 我的訂單</button><button className={tab === "rewards" ? "active" : ""} onClick={() => setTab("rewards")}><Gift size={17}/> 會員中心</button>{isAdmin && <button className={tab === "admin" ? "active" : ""} onClick={() => setTab("admin")}><ShieldCheck size={17}/> 管理面板</button>}</nav>
      {tab === "menu" && <><div className="section-heading"><div><span className="eyebrow">TODAY'S MENU</span><h2>挑選你的餐點</h2></div><button className="refresh-btn" onClick={refresh}><RefreshCw size={16}/> 更新</button></div>
        <ActivityFeed />
        {menu.length ? <div className="menu-grid">{menu.map(item => <article className="menu-card" key={item.id}><div className="food-photo">{item.image_url ? <img src={item.image_url} alt={item.name}/> : <span>🍱</span>}</div><div className="menu-info"><div className="food-title"><h3>{item.name}</h3><b>NT$ {item.price}</b></div><p>{item.description || "每日新鮮準備，讓你吃得滿足。"}</p><div className="food-bottom"><small>剩餘 {item.stock} 份</small><div className="quantity"><button disabled={!cart[item.id]} onClick={() => setCart(c => ({...c,[item.id]:Math.max(0,(c[item.id]||0)-1)}))}><Minus size={15}/></button><b>{cart[item.id] || 0}</b><button disabled={item.stock <= (cart[item.id]||0)} onClick={() => setCart(c => ({...c,[item.id]:(c[item.id]||0)+1}))}><Plus size={15}/></button></div></div></div></article>)}</div> : <div className="empty"><span>🍽️</span><h3>菜單準備中</h3><p>管理員上架餐點後，就會顯示在這裡。</p></div>}
        <section className="checkout"><div><span className="eyebrow">YOUR ORDER</span><h3><ShoppingBag size={19}/> 訂單摘要</h3><p>{count} 項餐點 · 配送至 {todaysDelivery?.destination || "—"}</p></div><div className="checkout-action"><strong>NT$ {total}</strong><button disabled={!todaysDelivery || !count || busy} onClick={placeOrder}>{busy ? "送出中…" : "確認送出訂單"}</button></div><textarea value={note} onChange={e => setNote(e.target.value)} placeholder="餐點備註（選填）例如：不要加辣、少冰…" /></section>
      </>}
      {tab === "rewards" && <LoyaltyPanel userId={session.user.id} onMessage={setMessage}/>}
      {tab === "orders" && <><div className="section-heading"><div><span className="eyebrow">ORDER HISTORY</span><h2>我的訂單</h2></div><button className="refresh-btn" onClick={refresh}><RefreshCw size={16}/> 更新</button></div>{orders.length ? <div className="orders-list">{orders.map(o => <article className="order-card" key={o.id}><div className="order-head"><div><small>訂單編號</small><b>#{o.id.slice(0,8).toUpperCase()}</b></div><span className={"status status-"+o.status}>{statusNames[o.status] || o.status}</span></div><div className="order-meta"><span><MapPin size={14}/>{o.delivery_destination}</span><span>{o.delivery_date}</span></div><div className="order-total"><small>{new Date(o.created_at).toLocaleString("zh-TW")}</small><b>NT$ {o.total_amount}</b></div>{o.note && <p className="order-note">備註：{o.note}</p>}{isAdmin && <div className="admin-status"><label>更新狀態</label><select value={o.status} onChange={e => changeStatus(o.id,e.target.value)}>{Object.entries(statusNames).map(([k,v]) => <option value={k} key={k}>{v}</option>)}</select></div>}</article>)}</div> : <div className="empty"><PackageCheck/><h3>還沒有訂單</h3><p>選好今天的餐點後，訂單會出現在這裡。</p></div>}</>}
      {tab === "admin" && isAdmin && <><div className="section-heading"><div><span className="eyebrow">ADMIN CONSOLE</span><h2>管理面板</h2></div><span className="admin-chip"><ShieldCheck size={15}/> 管理員</span></div><div className="stats-grid"><div className="stat-card"><small>今日訂單</small><strong>{orders.filter(o => o.delivery_date === todayKey && o.status !== "cancelled").length}</strong></div><div className="stat-card"><small>今日營業額</small><strong>NT$ {orders.filter(o => o.delivery_date === todayKey && o.status !== "cancelled").reduce((s,o)=>s+o.total_amount,0)}</strong></div><div className="stat-card"><small>待確認訂單</small><strong>{orders.filter(o=>o.status==="pending").length}</strong></div></div><AdminPanel onRefresh={refresh} onMessage={setMessage}/></>}
    </main>
    <footer>培英外送點餐平台 <span>·</span> 讓每一餐都剛剛好</footer>
  </div>;
}
