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
    body: "Mô tả đồ, khu vực và mức thưởng FIND trên mạng thử nghiệm.",
  },
  {
    icon: MagnifyingGlass,
    title: "Nộp bằng chứng",
    body: "Người tìm thấy gửi đặc điểm, thời gian và ảnh liên quan.",
  },
  {
    icon: Brain,
    title: "Đối chiếu",
    body: "Hệ thống nêu điểm trùng khớp, mâu thuẫn và rủi ro để bạn tham khảo.",
  },
  {
    icon: Coins,
    title: "Trả thưởng",
    body: "Chủ đồ tự kiểm tra rồi ký xác nhận trả thưởng trên mạng.",
  },
];

export function LandingPage() {
  return (
    <main className="min-h-[100dvh] text-ink">
      <section className="mx-auto grid min-h-[100dvh] max-w-[1440px] items-center gap-10 px-4 pb-12 pt-24 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
        <div className="relative z-10 max-w-xl py-8 lg:py-0">
          <p className="inline-flex items-center gap-2 text-sm font-bold text-forest">
            <ShieldCheck size={19} weight="fill" />
            Giao dịch thật trên mạng thử nghiệm Solana
          </p>
          <h1 className="font-display mt-5 text-5xl font-bold leading-[1.02] tracking-[-0.055em] text-ink sm:text-6xl lg:text-[4.5rem]">
            Tìm lại điều quan trọng.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-ink-soft sm:text-lg">
            Đăng tin thất lạc, xác minh bằng chứng và trao thưởng minh bạch — mọi quyết định đều do bạn ký xác nhận.
          </p>
          <div className="mt-8 flex flex-wrap gap-3" data-tour="landing-cta">
            <Link href="/bounties" className="app-button-primary px-5">
              <MagnifyingGlass size={18} weight="bold" />
              Xem tin thất lạc
            </Link>
            <Link href="/bounties/create" className="app-button-secondary px-5">
              Đăng tin mới <ArrowRight size={17} weight="bold" />
            </Link>
          </div>
        </div>

        <div className="relative min-h-[30rem] overflow-hidden rounded-2xl border border-line bg-bg-elevated shadow-[0_28px_80px_rgba(34,65,51,0.13)] lg:min-h-[34rem] xl:min-h-[39rem]">
          <Image
            src="/images/safereturn-hero-map.png"
            alt="Bản đồ khu vực với một chiếc ví thất lạc và các điểm đánh dấu"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 58vw"
            className="object-cover"
          />
          <div className="absolute bottom-5 left-5 right-5 grid gap-3 sm:left-auto sm:w-[21rem]">
            <div className="rounded-2xl border border-line bg-bg-elevated/94 p-4 shadow-[0_18px_50px_rgba(35,61,49,0.16)] backdrop-blur-md">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint-soft text-forest">
                  <LockKey size={21} weight="duotone" />
                </span>
                <div>
                  <p className="text-sm font-bold text-ink">Phần thưởng được khóa an toàn</p>
                  <p className="mt-0.5 text-xs text-ink-soft">FIND tạm giữ đến khi bạn chấp nhận hồ sơ hợp lệ</p>
                </div>
                <CheckCircle size={22} weight="fill" className="ml-auto text-forest" />
              </div>
            </div>
            <div className="badge-devnet flex items-center justify-between rounded-xl px-4 py-3 text-xs font-semibold backdrop-blur-md">
              <span>Solana Devnet</span>
              <span>Không dùng tiền thật</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-bg-elevated" aria-label="Cam kết hệ thống">
        <div className="mx-auto grid max-w-7xl divide-y divide-line px-4 sm:px-6 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-8">
          <HeroFact icon={Fingerprint} title="Minh bạch" body="Mỗi giao dịch có chữ ký để bạn tự kiểm tra." />
          <HeroFact icon={LockKey} title="An toàn" body="Phần thưởng được tạm giữ đến khi trao trả." />
          <HeroFact icon={MapPin} title="Tin do người dùng đăng" body="Danh sách chỉ gồm tin thật do cộng đồng tạo." />
        </div>
      </section>

      <section id="how" className="py-20 sm:py-24" data-tour="landing-how">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Một quy trình rõ ràng</h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-ink-soft">
              Mỗi bước cho biết ai chịu trách nhiệm, thông tin nào được bảo mật và khi nào cần ký xác nhận.
            </p>
          </div>
          <ol className="mt-10 overflow-hidden rounded-2xl border border-line bg-bg-elevated md:grid md:grid-cols-2 xl:grid-cols-4">
            {steps.map((step) => (
              <li key={step.title} className="relative border-b border-line p-5 last:border-b-0 sm:p-6 md:[&:nth-child(odd)]:border-r md:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0">
                <div className="flex items-center gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint-soft text-forest">
                    <step.icon size={23} weight="duotone" />
                  </span>
                </div>
                <h3 className="mt-6 text-lg font-bold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="trust" className="pb-20 sm:pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-2xl border border-line bg-bg-deep">
            <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.95fr_1.05fr] lg:p-10">
              <div>
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest text-white shadow-[0_12px_28px_rgba(8,120,74,0.22)]">
                  <ShieldCheck size={30} weight="fill" />
                </span>
                <h2 className="font-display mt-6 max-w-md text-3xl font-bold tracking-tight sm:text-4xl">
                  Minh bạch trên mạng, riêng tư ngoài mạng
                </h2>
                <p className="mt-4 max-w-lg text-sm leading-7 text-ink-soft">
                  Mạng ghi nhận trạng thái, mã kiểm tra bằng chứng và lệnh trả thưởng. Ảnh cùng mô tả chi tiết không bị công khai trên mạng.
                </p>
                <a
                  href={explorerAddressUrl(FINDBACK_PROGRAM_ID)}
                  target="_blank"
                  rel="noreferrer"
                  className="app-button-secondary mt-6"
                >
                  Xem hợp đồng trên Explorer <ArrowSquareOut size={16} />
                </a>
              </div>
              <div className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
                <TrustItem icon={Database} title="Dữ liệu người dùng" body="Hệ thống lưu tin do bạn tạo và cập nhật theo giao dịch đã xác nhận." />
                <TrustItem icon={Fingerprint} title="Có thể kiểm tra" body="Chữ ký giao dịch mở trực tiếp trên Solana Explorer." />
                <TrustItem icon={LockKey} title="Khóa thưởng an toàn" body="FIND trên mạng thử nghiệm được tạm giữ đến khi chủ đồ quyết định." />
                <TrustItem icon={Brain} title="AI chỉ hỗ trợ" body="Kết quả đối chiếu không có quyền tự chuyển phần thưởng." />
              </div>
            </div>
            <div className="border-t border-line bg-bg-elevated/70 px-6 py-4 sm:px-8">
              <p className="break-all font-mono text-[11px] leading-5 text-ink-soft">
                Hợp đồng: {FINDBACK_PROGRAM_ID}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-bg-elevated py-14">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 sm:px-6 md:flex-row md:items-center lg:px-8">
          <div>
            <h2 className="font-display text-2xl font-bold">Bắt đầu với tài sản thử nghiệm miễn phí</h2>
            <p className="mt-2 text-sm text-ink-soft">Không gửi SOL mạng chính hoặc tài sản có giá trị thật vào ứng dụng.</p>
          </div>
          <Link href="/signup" className="app-button-primary px-5">
            Tạo tài khoản <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-line bg-bg-elevated py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 text-sm text-ink-soft sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <p><span className="font-bold text-ink">SafeReturn.</span> Nền tảng tìm đồ thất lạc trên mạng thử nghiệm Solana.</p>
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
    <div className="grid grid-cols-[auto_1fr] gap-4 border-b border-line p-5 last:border-b-0 sm:p-6">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint-soft text-forest">
        <Icon size={21} weight="duotone" />
      </span>
      <div>
        <h3 className="font-bold text-ink">{title}</h3>
        <p className="mt-1.5 text-sm leading-6 text-ink-soft">{body}</p>
      </div>
    </div>
  );
}
