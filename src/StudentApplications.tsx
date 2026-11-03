import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { CheckCircle2, XCircle, RefreshCw, Copy, Mail } from "lucide-react";

const db = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
type Application = { id: string; user_id: string; email: string; student_name: string; grade: string; class_name: string; courses: string[]; notification_method: string; line_contact: string | null; status: string; admin_note: string | null; created_at: string };
const statusText: Record<string,string> = { pending: "待審核", approved: "已核准", rejected: "需補件" };

export default function StudentApplications({ onMessage }: { onMessage: (s: string) => void }) {
  const [items, setItems] = useState<Application[]>([]);
  const [notes, setNotes] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true);
    const { data, error } = await db.from("student_applications").select("*").order("created_at", { ascending: false });
    setLoading(false);
    if (error) onMessage(error.message); else setItems((data || []) as Application[]);
  }
  useEffect(() => { void load(); }, []);
  async function review(item: Application, status: "approved" | "rejected") {
    const { data: userData } = await db.auth.getUser();
    const { error } = await db.from("student_applications").update({
      status, admin_note: notes[item.id]?.trim() || null, reviewed_at: new Date().toISOString(), reviewed_by: userData.user?.id || null, updated_at: new Date().toISOString()
    }).eq("id", item.id);
    if (error) onMessage(error.message);
    else onMessage(status === "approved" ? "已核准申請；請依申請者選擇的方式通知對方。" : "已退回申請；請通知對方補充資料。");
    await load();
  }
  function copyNotice(item: Application) {
    const approved = item.status === "approved";
    const msg = approved
      ? `培英外送平台通知：${item.student_name} 同學，你的使用資格申請已審核通過，現在可以登入平台點餐。`
      : `培英外送平台通知：${item.student_name} 同學，你的申請需要補充資料。管理員備註：${item.admin_note || "請聯絡管理員"}。`;
    void navigator.clipboard?.writeText(msg);
    onMessage("通知文字已複製，可透過電子郵件或 LINE 官方帳號傳送。");
  }
  return <section className="student-applications">
    <div className="admin-manager-head"><div><h3>學生資格申請</h3><p>審核新使用者資料；核准後即可開放點餐</p></div><button className="refresh-btn" onClick={()=>void load()}><RefreshCw size={15}/> 更新</button></div>
    {!items.length ? <div className="empty"><p>目前沒有申請紀錄。</p></div> : <div className="admin-record-list">{items.map(item=><article className="application-record" key={item.id}>
      <div className="admin-record-info">
        <b>{item.student_name} · {item.grade}{item.class_name}</b>
        <small>{item.email}</small>
        <small>課程：{(item.courses || []).join("、")}</small>
        <small>通知：{item.notification_method === "line" ? `LINE ${item.line_contact || "（未提供 ID）"}` : "電子郵件"}</small>
        <span className={item.status === "approved" ? "admin-on" : item.status === "pending" ? "admin-off" : "admin-off"}>{statusText[item.status] || item.status}</span>
        {item.admin_note && <small>審核備註：{item.admin_note}</small>}
        {item.status === "pending" && <label className="admin-wide">審核備註<input value={notes[item.id] || ""} onChange={e=>setNotes(v=>({...v,[item.id]:e.target.value}))} placeholder="選填：說明通過或需補件原因"/></label>}
      </div>
      <div className="admin-record-actions">
        {item.status === "pending" && <><button title="核准" onClick={()=>void review(item,"approved")}><CheckCircle2 size={17}/></button><button className="admin-delete" title="退回補件" onClick={()=>void review(item,"rejected")}><XCircle size={17}/></button></>}
        {item.status !== "pending" && <button title="複製通知" onClick={()=>copyNotice(item)}><Copy size={16}/></button>}
        {item.notification_method === "email" && <a title="寄送電子郵件" href={`mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent("培英外送平台申請審核通知")}`}><Mail size={16}/></a>}
      </div>
    </article>)}</div>}
  </section>;
}
