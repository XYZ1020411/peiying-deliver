# 培英外送點餐平台

培英學生專用線上點餐平台。前端使用 React + TypeScript + Vite，登入與資料服務使用 Supabase。

## 本機開發
1. 複製 `.env.example` 為 `.env.local`。
2. 填入 Supabase Project URL 與 Publishable key（不要使用 service_role key）。
3. 執行 `npm install`、`npm run dev`。

## Cloudflare Pages
- Framework preset: Vite
- Build command: `npm run build`
- Build output directory: `dist`
- 環境變數：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`

Google OAuth callback:
`https://qkwgqgfllfmrljnkfdjf.supabase.co/auth/v1/callback`

## 學生資格
Google 登入後，以 Supabase `student_allowlist` 白名單驗證；管理員 email 為 `liu1060426510@gmail.com`。資料庫 RLS 與訂單觸發器負責最終權限驗證。
