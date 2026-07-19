import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowSquareOut,
  Brain,
  CheckCircle,
  Coins,
  Database,
  Fingerprint,
  LockKey,
  MagnifyingGlass,
  MapPin,
  ShieldCheck,
  Wallet,
} from "@phosphor-icons/react/dist/ssr";
import {
  FINDBACK_PROGRAM_ID,
  explorerAddressUrl,
} from "@/lib/findback/config";

const steps = [
  {
    icon: Wallet,
    title: "Đăng tin",
    body: "Cung cấp mô tả, khu vực và mức thưởng FIND Devnet.",
  },
  {
    icon: MagnifyingGlass,
    title: "Nộp bằng chứng",
    body: "Người tìm thấy gửi đặc điểm, thời gian và ảnh liên quan.",
  },
  {
    icon: Brain,
    title: "Kiểm tra",
    body: "Hệ thống nêu điểm trùng khớp, mâu thuẫn và rủi ro.",
  },
  {
    icon: Coins,
    title: "Trao thưởng",
    body: "Chủ đồ kiểm tra rồi tự ký lệnh giải ngân on-chain.",
  },
];

export function LandingPage() {
  return (
    <main className="min-h-[100dvh] text-ink">
      <section className="mx-auto grid min-h-[100dvh] max-w-[1440px] items-center gap-10 px-4 pb-12 pt-24 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
        <div className="relative z-10 max-w-xl py-8 lg:py-0">
          <p className="inline-flex items-center gap-2 text-sm font-bold text-forest">
            <ShieldCheck size={19} weight="fill" />
            Giao dịch thật trên Solana Devnet
          </p>
          <h1 className="font-display mt-5 text-5xl font-bold leading-[1.02] tracking-[-0.055em] text-ink sm:text-6xl lg:text-[4.5rem]">
            Tìm lại điều quan trọng.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-ink-soft sm:text-lg">
            Đăng tin, xác minh bằng chứng và trao thưởng minh bạch bằng giao dịch có thể kiểm tra.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/bounties" className="app-button-primary px-5">
              <MagnifyingGlass size={18} weight="bold" />
              Xem tin thất lạc
            </Link>
            <Link href="/bounties/create" className="app-button-secondary px-5">
              Đăng tin mới <ArrowRight size={17} weight="bold" />
            </Link>
          </div>
        </div>

        <div className="relative min-h-[30rem] overflow-hidden rounded-2xl border border-line bg-white shadow-[0_28px_80px_rgba(34,65,51,0.13)] lg:min-h-[34rem] xl:min-h-[39rem]">
          <Image
            src="/images/safereturn-hero-map.png"
            alt="Bản đồ khu vực với một chiếc ví thất lạc và các điểm đánh dấu"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 58vw"
            className="object-cover"
          />
          <div className="absolute bottom-5 left-5 right-5 grid gap-3 sm:left-auto sm:w-[21rem]">
            <div className="rounded-2xl border border-white/80 bg-white/94 p-4 shadow-[0_18px_50px_rgba(35,61,49,0.16)] backdrop-blur-md">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint-soft text-forest">
                  <LockKey size={21} weight="duotone" />
                </span>
                <div>
                  <p className="text-sm font-bold text-ink">Ký quỹ được bảo vệ</p>
                  <p className="mt-0.5 text-xs text-ink-soft">FIND nằm trong vault của program</p>
                </div>
                <CheckCircle size={22} weight="fill" className="ml-auto text-forest" />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/95 px-4 py-3 text-xs font-semibold text-amber-900 backdrop-blur-md">
              <span>Solana Devnet</span>
              <span>Không dùng tiền thật</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-white" aria-label="Cam kết hệ thống">
        <div className="mx-auto grid max-w-7xl divide-y divide-line px-4 sm:px-6 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-8">
          <HeroFact icon={Fingerprint} title="Minh bạch" body="Mỗi giao dịch có chữ ký để kiểm tra." />
          <HeroFact icon={LockKey} title="An toàn" body="Phần thưởng được khóa bằng escrow." />
          <HeroFact icon={MapPin} title="Dữ liệu có nguồn" body="Danh sách chỉ có tin do người dùng tạo." />
        </div>
      </section>

      <section id="how" className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Một quy trình dễ hiểu</h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-ink-soft">
              Mỗi bước đều cho biết ai chịu trách nhiệm, dữ liệu nằm ở đâu và giao dịch nào cần ký.
            </p>
          </div>
          <div className="relative mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {steps.map((step, index) => (
              <article key={step.title} className="app-card relative p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint-soft text-forest">
                    <step.icon size={23} weight="duotone" />
                  </span>
                  <span className="font-mono text-xs font-bold text-forest">0{index + 1}</span>
                </div>
                <h3 className="mt-7 text-lg font-bold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-soft">{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="trust" className="pb-20 sm:pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-2xl border border-line bg-[#eaf2ed]">
            <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.95fr_1.05fr] lg:p-10">
              <div>
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest text-white shadow-[0_12px_28px_rgba(8,120,74,0.22)]">
                  <ShieldCheck size={30} weight="fill" />
                </span>
                <h2 className="font-display mt-6 max-w-md text-3xl font-bold tracking-tight sm:text-4xl">
                  Minh bạch trên chuỗi, riêng tư ngoài chuỗi
                </h2>
                <p className="mt-4 max-w-lg text-sm leading-7 text-ink-soft">
                  Blockchain lưu trạng thái, hash bằng chứng và lệnh giải ngân. Ảnh cùng mô tả chi tiết không bị công khai trên chuỗi.
                </p>
                <a
                  href={explorerAddressUrl(FINDBACK_PROGRAM_ID)}
                  target="_blank"
                  rel="noreferrer"
                  className="app-button-secondary mt-6"
                >
                  Xem program <ArrowSquareOut size={16} />
                </a>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TrustItem icon={Database} title="Dữ liệu thật" body="Supabase lưu tin do người dùng tạo, không chèn dữ liệu mẫu." />
                <TrustItem icon={Fingerprint} title="Có thể kiểm tra" body="Chữ ký giao dịch mở trực tiếp trên Solana Explorer." />
                <TrustItem icon={LockKey} title="Escrow an toàn" body="FIND Devnet nằm trong vault đến khi chủ đồ quyết định." />
                <TrustItem icon={Brain} title="AI chỉ tư vấn" body="Kết quả so khớp không có quyền tự chuyển phần thưởng." />
              </div>
            </div>
            <div className="border-t border-line bg-white/70 px-6 py-4 sm:px-8">
              <p className="break-all font-mono text-[11px] leading-5 text-ink-soft">
                Program: {FINDBACK_PROGRAM_ID}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-white py-14">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 sm:px-6 md:flex-row md:items-center lg:px-8">
          <div>
            <h2 className="font-display text-2xl font-bold">Bắt đầu bằng tài sản Devnet miễn phí</h2>
            <p className="mt-2 text-sm text-ink-soft">Không gửi SOL mainnet hoặc tài sản có giá trị vào ứng dụng.</p>
          </div>
          <Link href="/signup" className="app-button-primary px-5">
            Tạo tài khoản <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-line bg-white py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 text-sm text-ink-soft sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <p><span className="font-bold text-ink">SafeReturn.</span> Lost and found trên Solana Devnet.</p>
          <div className="flex gap-5">
            <Link href="/bounties" className="font-semibold hover:text-forest">Danh sách tin</Link>
            <Link href="/login" className="font-semibold hover:text-forest">Đăng nhập</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function HeroFact({ icon: Icon, title, body }: { icon: typeof LockKey; title: string; body: string }) {
  return (
    <div className="flex items-center gap-4 px-2 py-5 md:px-6">
      <Icon size={24} className="shrink-0 text-forest" weight="duotone" />
      <div>
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        <p className="mt-0.5 text-xs leading-5 text-ink-soft">{body}</p>
      </div>
    </div>
  );
}

function TrustItem({ icon: Icon, title, body }: { icon: typeof Database; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-[0_12px_34px_rgba(31,62,48,0.05)]">
      <Icon size={23} className="text-forest" weight="duotone" />
      <h3 className="mt-5 font-bold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink-soft">{body}</p>
    </div>
  );
}
