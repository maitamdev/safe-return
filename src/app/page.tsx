import { Hero } from "@/components/landing/Hero";
import { Problem } from "@/components/landing/Problem";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { AiWeb3 } from "@/components/landing/AiWeb3";
import { Roles } from "@/components/landing/Roles";
import { Demo } from "@/components/landing/Demo";
import { Compare } from "@/components/landing/Compare";
import { Mvp } from "@/components/landing/Mvp";
import { Footer } from "@/components/layout/Footer";

export default function HomePage() {
  return (
    <main className="flex-1">
      <Hero />
      <Problem />
      <HowItWorks />
      <AiWeb3 />
      <Roles />
      <Demo />
      <Compare />
      <Mvp />
      <Footer />
    </main>
  );
}
