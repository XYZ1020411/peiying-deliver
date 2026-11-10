import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Phone, ShieldCheck } from "lucide-react";

const db = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

export default function PhoneAdminVerification() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState("");

  async function sendCode() {
    const normalized = phone.replace(/[\\s-]/g, "");
    if (!/^\\+?[0-9]{8,15}$/.test(normalized)) {
      setMessage("請輸入有效的手機號碼，台灣手機可輸入 09xxxxxxxx。");
      return;
    }
    setPending(true); setMessage("");
    const e164 = normalized.startsWith("+") ? normalized : normalized.startsWith("0") ? "+886" + normalized.slice(1) : "+" + normalized;
    const { error } = await db.auth.updateUser({ phone: e164 });
    setPending(false);
    if (error) setMessage("簡訊發送失敗：" + error.message);
    else { setPhone(e164); setSent(true); setMessage("驗證碼已發送，請輸入收到的簡訊驗證碼。"); }
  }

  async function verifyCode() {
    if (!code.trim()) { setMessage("請輸入簡訊驗證碼。"); return; }
    setPending(true); setMessage("");
    const { error } = await db.auth.verifyOtp({ phone, token: code.trim(), type: "phone_change" });
    if (!error) {
      await db.auth.refreshSession();
      const { data } = await db.auth.getUser();
      setVerifiedPhone(data.user?.phone || phone);
      setMessage((data.user?.phone || phone).replace(/\\D/g, "").endsWith("855")
        ? "手機驗證成功！此帳號符合 855 管理員資格，請重新整理頁面更新權限。"
        : "手機驗證成功。此號碼末三碼不是 855，因此不會取得管理員權限。");
    } else setMessage("驗證失敗：" + error.message);
    setPending(false);
  }

  return <section style={{margin:"16px 0",padding:16,border:"1px solid #dbe4e0",borderRadius:14,background:"#f8fbf9"}}>
    <h3 style={{display:"flex",alignItems:"center",gap:8,margin:"0 0 8px",fontSize:16}}><ShieldCheck size={18}/> 手機驗證／855 管理員資格</h3>
    <p style={{fontSize:13,color:"#64748b",margin:"0 0 12px"}}>透過 Supabase 簡訊驗證手機號碼。完成驗證後，末三碼為 855 的帳號會自動取得管理員權限。</p>
    {verifiedPhone ? <p style={{fontSize:14}}>已驗證號碼：{verifiedPhone}</p> : <>
      <label style={{display:"block",fontSize:13,marginBottom:8}}>手機號碼<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="09xxxxxxxx 或 +8869xxxxxxxx" disabled={sent} style={{display:"block",width:"100%",padding:10,marginTop:5,border:"1px solid #cbd5e1",borderRadius:8}}/></label>
      {sent && <label style={{display:"block",fontSize:13,marginBottom:8}}>簡訊驗證碼<input value={code} onChange={e=>setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="輸入驗證碼" style={{display:"block",width:"100%",padding:10,marginTop:5,border:"1px solid #cbd5e1",borderRadius:8}}/></label>}
      <button type="button" disabled={pending} onClick={()=>void (sent?verifyCode():sendCode())} style={{padding:"9px 14px",border:0,borderRadius:8,background:"#176b50",color:"white",fontWeight:600,opacity:pending ? 0.65 : 1}}>{pending?"處理中…":sent?"確認驗證":"發送簡訊驗證碼"}</button>
    </>}
    {message && <p role="status" style={{fontSize:13,margin:"10px 0 0",color:"#176b50"}}>{message}</p>}
    <small style={{display:"block",marginTop:10,color:"#64748b"}}>此驗證是網站簡訊驗證，不代表 LINE 本身已向網站提供電話資料。</small>
  </section>;
}
