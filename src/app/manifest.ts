import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SafeReturn trên Solana Devnet",
    short_name: "SafeReturn",
    description: "Đăng tin thất lạc, đối chiếu bằng chứng và trao thưởng minh bạch trên Solana Devnet.",
    start_url: "/bounties",
    display: "standalone",
    background_color: "#f5f8f6",
    theme_color: "#08784a",
    lang: "vi",
    categories: ["utilities", "social"],
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
