import Link from "next/link";
import { ArrowLeft, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-xl items-center px-4 py-20 text-center">
      <div className="w-full">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-mint-soft text-forest">
          <MagnifyingGlass size={28} weight="duotone" />
        </span>
        <p className="mt-5 font-mono text-xs font-bold text-forest">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Không tìm thấy trang</h1>
        <p className="mt-3 text-sm leading-6 text-ink-soft">
          Liên kết có thể đã thay đổi hoặc bounty không còn tồn tại trong dữ liệu bạn được phép xem.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/bounties" className="app-button-primary"><MagnifyingGlass size={17} /> Xem danh sách</Link>
          <Link href="/" className="app-button-secondary"><ArrowLeft size={17} /> Về trang chủ</Link>
        </div>
      </div>
    </main>
  );
}
