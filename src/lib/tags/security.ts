import { createHmac, randomBytes } from "node:crypto";

const SAFE_TAG_CODE = /^[A-Za-z0-9_-]{24}$/;

export function createSafeTagCode() {
  return randomBytes(18).toString("base64url");
}

export function isSafeTagCode(value: unknown): value is string {
  return typeof value === "string" && SAFE_TAG_CODE.test(value);
}

export function cleanSafeTagText(value: unknown, maxLength: number) {
  if (typeof value !== "string" || maxLength < 1) return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export function reporterFingerprint(args: {
  secret: string;
  code: string;
  ip: string;
  userAgent: string;
}) {
  return createHmac("sha256", args.secret)
    .update(`${args.code}|${args.ip}|${args.userAgent}`)
    .digest("hex");
}

export function requestIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
