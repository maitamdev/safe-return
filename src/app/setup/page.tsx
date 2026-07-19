import Link from "next/link";
import { ArrowSquareOut, CheckCircle, Database, Key, Terminal } from "@phosphor-icons/react/dist/ssr";

export default function SetupPage() {
  return (
    <main className="min-h-[100dvh] bg-bg px-4 py-12 text-ink sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-semibold text-forest hover:underline">Về trang chủ</Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">Thiết lập dữ liệu thật</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">SafeReturn không tạo tài khoản hoặc tin mẫu khi thiếu backend. Hoàn thành ba mục dưới đây rồi khởi động lại ứng dụng.</p>

        <ol className="mt-8 grid gap-4">
          <SetupItem icon={Key} title="Thêm biến môi trường">
            <p>Trong <code>.env.local</code>, thêm Project URL và anon public key từ Supabase Dashboard.</p>
            <pre className="mt-3 overflow-x-auto rounded-xl border border-line bg-bg-deep p-4 font-mono text-xs leading-6 text-forest">{`NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...`}</pre>
          </SetupItem>
          <SetupItem icon={Database} title="Tạo bảng và chính sách RLS">
            <p>Mở SQL Editor, sao chép toàn bộ nội dung file <code>supabase/schema.sql</code> trong repository rồi chạy một lần.</p>
            <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="app-button-secondary mt-4">Mở Supabase Dashboard <ArrowSquareOut size={16} /></a>
          </SetupItem>
          <SetupItem icon={Terminal} title="Khởi động lại Next.js">
            <pre className="mt-2 overflow-x-auto rounded-xl border border-line bg-bg-deep p-4 font-mono text-xs text-forest">npm run dev</pre>
            <p className="mt-3">Sau khi cấu hình đúng, trang đăng nhập sẽ dùng Supabase Auth và danh sách tin sẽ đọc từ bảng thật.</p>
          </SetupItem>
        </ol>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup" className="app-button-primary"><CheckCircle size={17} />Tạo tài khoản</Link>
          <Link href="/login" className="app-button-secondary">Đăng nhập</Link>
        </div>
      </div>
    </main>
  );
}

function SetupItem({ icon: Icon, title, children }: { icon: typeof Key; title: string; children: React.ReactNode }) {
  return <li className="app-card grid gap-4 p-5 sm:grid-cols-[auto_1fr] sm:p-6"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint-soft text-forest"><Icon size={22} weight="duotone" /></span><div><h2 className="text-lg font-bold">{title}</h2><div className="mt-2 text-sm leading-6 text-ink-soft">{children}</div></div></li>;
}
