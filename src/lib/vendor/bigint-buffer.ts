import { Buffer } from "buffer";

/** Pure JavaScript bigint-buffer implementation for predictable browser/SSR builds. */
export function toBigIntLE(input: Uint8Array): bigint {
  const bytes = Buffer.from(input);
  bytes.reverse();
  return fromHex(bytes.toString("hex"));
}

export function toBigIntBE(input: Uint8Array): bigint {
  return fromHex(Buffer.from(input).toString("hex"));
}

export function toBufferLE(value: bigint, width: number): Buffer {
  const bytes = toBufferBE(value, width);
  bytes.reverse();
  return bytes;
}

export function toBufferBE(value: bigint, width: number): Buffer {
  if (!Number.isInteger(width) || width < 0) throw new RangeError("width must be a positive integer");
  if (width === 0) return Buffer.alloc(0);
  const normalized = BigInt.asUintN(width * 8, value);
  return Buffer.from(normalized.toString(16).padStart(width * 2, "0"), "hex");
}

function fromHex(hex: string): bigint {
  return hex ? BigInt(`0x${hex}`) : BigInt(0);
}
