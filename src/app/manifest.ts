import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SafeReturn — tìm đồ thất lạc",
    short_name: "SafeReturn",
    description: "Đăng tin thất lạc, đối chiếu bằng chứng và trao thưởng minh bạch trên mạng thử nghiệm Solana.",
    start_url: "/bounties",
    display: "standalone",
    background_color: "#0c1411",
    theme_color: "#1fad6c",
    lang: "vi",
    categories: ["utilities", "social"],
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
