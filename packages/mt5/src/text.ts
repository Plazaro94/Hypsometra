/**
 * MT5 writes .set, symbol JSON and reports as UTF-16LE with BOM; files edited
 * by hand are often UTF-8. Decode by BOM, then by the NUL-byte pattern.
 */
export function decodeMt5Text(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }
  // UTF-16LE without BOM: ASCII text has a NUL in every odd byte.
  const sample = bytes.subarray(0, Math.min(bytes.length, 200));
  let oddNuls = 0;
  for (let i = 1; i < sample.length; i += 2) if (sample[i] === 0) oddNuls++;
  if (sample.length > 8 && oddNuls > sample.length / 4) {
    return new TextDecoder("utf-16le").decode(bytes);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

/** UTF-16LE with BOM, which is what MT5 expects when loading a .set. */
export function encodeUtf16le(text: string): Uint8Array {
  const out = new Uint8Array(2 + text.length * 2);
  out[0] = 0xff;
  out[1] = 0xfe;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    out[2 + i * 2] = c & 0xff;
    out[3 + i * 2] = c >> 8;
  }
  return out;
}
