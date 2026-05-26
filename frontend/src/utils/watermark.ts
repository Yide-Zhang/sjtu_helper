/**
 * LSB 水印 + PNG 元数据扰动工具
 */

import UPNG from 'upng-js';
import { CHAR_SPRITESHEET } from './charSpritesheet';

const CELL_H = 100;        // 每个方格高度（像素）

// 缓存已解码的字母图案
const charCache = new Map<string, { rgba: Uint8Array; w: number; h: number }>();

function getCharData(ch: string): { rgba: Uint8Array; w: number; h: number } {
  const cached = charCache.get(ch);
  if (cached) return cached;
  const entry = CHAR_SPRITESHEET[ch];
  if (!entry) throw new Error(`Unknown char: ${ch}`);
  const b64 = entry.b64;
  const binStr = atob(b64);
  const len = binStr.length;
  const buf = new Uint8Array(len);
  for (let i = 0; i < len; i++) buf[i] = binStr.charCodeAt(i);
  const decoded = UPNG.decode(buf.buffer);
  const w = decoded.width;
  const h = decoded.height;
  const rgbaBufs = UPNG.toRGBA8(decoded);
  const rgba = new Uint8Array(rgbaBufs[0]);
  const result = { rgba, w, h };
  charCache.set(ch, result);
  return result;
}

// ============ 字母生成 ============
export function generateWatermarkLetters(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 3; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ============ 方格宽度计算（基于实际字宽）============
export function estimateCellWidth(letters: string): number {
  let total = 0;
  for (const ch of letters) {
    const entry = CHAR_SPRITESHEET[ch];
    total += entry ? entry.w : 60;
  }
  return total;
}

// ============ 水印掩码生成（基于预渲染字模） ============
export function generateWatermarkMask(
  imgWidth: number,
  imgHeight: number,
  letters: string
): Uint8Array {
  const len = imgWidth * imgHeight;
  const mask = new Uint8Array(len);

  // 获取 3 个字母的图案
  const charDataList = letters.split('').map(getCharData);
  const cellW = charDataList.reduce((s, d) => s + d.w, 0);
  const cellH = CELL_H;

  // 预计算每个字母在 cell 中的 x 偏移
  const charOffsets: number[] = [];
  let offset = 0;
  for (const cd of charDataList) {
    charOffsets.push(offset);
    offset += cd.w;
  }

  for (let y = 0; y < imgHeight; y++) {
    const row = Math.floor(y / cellH);
    const ly = y % cellH;

    for (let x = 0; x < imgWidth; x++) {
      const col = Math.floor(x / cellW);
      const lx = x % cellW;
      const isBlack = (row + col) % 2 === 0;

      // 找到当前 lx 落在哪个字母上
      let charIdx = 0;
      let charX = lx;
      for (let ci = 0; ci < charDataList.length; ci++) {
        if (lx < charOffsets[ci] + charDataList[ci].w) {
          charIdx = ci;
          charX = lx - charOffsets[ci];
          break;
        }
      }
      const cd = charDataList[charIdx];
      // 缩放 ly 到字母图案高度
      const patY = Math.floor((ly / cellH) * cd.h);
      const patX = Math.floor((charX / cd.w) * cd.w);
      const pi = (patY * cd.w + patX) << 2;
      const isLetter = cd.rgba[pi] < 128; // 白底黑字 → R<128 是前景

      if (isBlack) {
        mask[y * imgWidth + x] = isLetter ? 255 : 0;
      } else {
        mask[y * imgWidth + x] = isLetter ? 0 : 255;
      }
    }
  }
  return mask;
}

// ============ LSB 嵌入 ============
export function embedLSB(rgba: Uint8Array | Uint8ClampedArray, mask: Uint8Array): void {
  const pixelCount = mask.length;
  for (let i = 0; i < pixelCount; i++) {
    const pi = i << 2;
    const isWhite = mask[i] > 128;
    if (isWhite) {
      rgba[pi]     |= 1;     // R 奇数
      rgba[pi + 1] |= 1;     // G 奇数
      rgba[pi + 2] |= 1;     // B 奇数
    } else {
      rgba[pi]     &= 0xFE;  // R 偶数
      rgba[pi + 1] &= 0xFE;  // G 偶数
      rgba[pi + 2] &= 0xFE;  // B 偶数
    }
  }
}

export function decodePngBase64(b64: string): { rgba: Uint8Array; width: number; height: number } {
  const binStr = atob(b64);
  const len = binStr.length;
  const buf = new Uint8Array(len);
  for (let i = 0; i < len; i++) buf[i] = binStr.charCodeAt(i);
  const decoded = UPNG.decode(buf.buffer);
  const w = decoded.width;
  const h = decoded.height;
  const rgbaBufs = UPNG.toRGBA8(decoded);
  return { rgba: new Uint8Array(rgbaBufs[0]), width: w, height: h };
}

// ============ PNG 元数据扰动 ============
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[i] = c;
}

function crc32(data: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xFF] ^ (c >>> 8);
  return c ^ 0xFFFFFFFF;
}

function buildTextChunk(keyword: string, text: string): Uint8Array {
  const str = keyword + '\x00' + text;
  const data = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) data[i] = str.charCodeAt(i) & 0xFF;

  const len = data.length;
  const typeBytes = new Uint8Array([0x74, 0x45, 0x58, 0x74]);

  const chunk = new Uint8Array(4 + 4 + len + 4);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, len);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  const crcInput = new Uint8Array(4 + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, 4);
  dv.setUint32(8 + len, crc32(crcInput));

  return chunk;
}

const FAKE_MODELS = ['iPhone 14 Pro', 'iPhone 15 Pro Max', 'SM-S918B', 'Pixel 8 Pro', 'Xiaomi 14 Ultra', 'OPPO Find X7'];
const FAKE_MAKES = ['Apple Inc.', 'Apple Inc.', 'Samsung', 'Google', 'Xiaomi', 'OPPO'];

function dmsStr(dec: number): string {
  const d = Math.floor(dec);
  const m = Math.floor((dec - d) * 60);
  const s = Math.round(((dec - d) * 60 - m) * 100);
  return `${d}/1,${m}/1,${s}/100`;
}

export function perturbPngMetadata(pngBytes: Uint8Array): Uint8Array {
  const idx = Math.floor(Math.random() * FAKE_MODELS.length);
  const model = FAKE_MODELS[idx];
  const make = FAKE_MAKES[idx];
  const fakeTime = new Date(Date.now() - Math.random() * 7 * 24 * 3600 * 1000);
  const timeISO = fakeTime.toISOString().replace('T', ' ').substring(0, 19);
  const lat = 31.2 + Math.random() * 0.3;
  const lng = 121.4 + Math.random() * 0.2;

  const chunks: Uint8Array[] = [
    buildTextChunk('Make', make),
    buildTextChunk('Model', model),
    buildTextChunk('CreationTime', timeISO),
    buildTextChunk('GPSLatitude', dmsStr(lat)),
    buildTextChunk('GPSLongitude', dmsStr(lng)),
    buildTextChunk('Software', 'Adobe Lightroom 7.5'),
  ];

  let insertPos = pngBytes.length;
  for (let i = 8; i < pngBytes.length - 4; i++) {
    if (pngBytes[i] === 0x49 && pngBytes[i + 1] === 0x44 &&
        pngBytes[i + 2] === 0x41 && pngBytes[i + 3] === 0x54) {
      insertPos = i - 4;
      break;
    }
  }

  let totalExtra = 0;
  for (const c of chunks) totalExtra += c.length;

  const result = new Uint8Array(pngBytes.length + totalExtra);
  result.set(pngBytes.subarray(0, insertPos), 0);
  let offset = insertPos;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  result.set(pngBytes.subarray(insertPos), offset);
  return result;
}