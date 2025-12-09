// js/modules/dog-speak.js
// AES-CTR + HMAC-SHA256 (16-byte truncated tag) implementation
// Base168 tokenization (emoji + real animal onomatopoeia), 3-byte packing -> 4 tokens
// Inserts paragraph tags like <🐱> when animal prefix changes (visual only).
// No external libraries. Uses WebCrypto (browser).

// ---------------------------
// DOG_SPEAK_WORDS (Base = 168)
// Format: emoji + real animal sound token, no spaces, unique
const DOG_SPEAK_WORDS = [
  // Cats (12)
  "🐱喵","🐱喵喵","🐱喵~","🐱喵—","🐱喵呜","🐱喵呜~","🐱喵呜—","🐱呜","🐱呜~","🐱呜—","🐱咕噜","🐱咕噜~",
  // Dogs (12)
  "🐶汪","🐶汪汪","🐶汪~","🐶汪—","🐶汪汪汪","🐶呜","🐶呜~","🐶呜—","🐶呜呜","🐶嗷","🐶嗷~","🐶嗷呜",
  // Rabbits (9)
  "🐰嘶","🐰嘶~","🐰嘶—","🐰嗒","🐰嗒~","🐰嗒—","🐰吱","🐰吱~","🐰吱—",
  // Pigs (9)
  "🐷哼","🐷哼哼","🐷哼~","🐷哼—","🐷嗷~","🐷嗷—","🐷嗷嗷","🐷咕","🐷咕~",
  // Cows (7)
  "🐮哞","🐮哞~","🐮哞—","🐮哞哞","🐮呜哞","🐮呜哞~","🐮幼哞",
  // Sheep (7)
  "🐑咩","🐑咩~","🐑咩—","🐑咩咩","🐑呜咩","🐑呜咩~","🐑幼咩",
  // Chicken (9)
  "🐔咯","🐔咯~","🐔咯—","🐔咯咯","🐔咯咯~","🐔咯咯—","🐔喔","🐔喔~","🐔喔—",
  // Duck (6)
  "🦆嘎","🦆嘎~","🦆嘎—","🦆嘎嘎","🦆呱","🦆呱~",
  // Goose (4)
  "🦢嘎","🦢嘎~","🦢咯","🦢咯~",
  // Lion (6)
  "🦁吼","🦁吼~","🦁吼—","🦁嗷吼","🦁嗷吼~","🦁嗷吼—",
  // Tiger (6)
  "🐯嗷","🐯嗷~","🐯嗷—","🐯吼~","🐯嘶","🐯嘶~",
  // Bear (6)
  "🐻吼","🐻吼~","🐻呜","🐻呜~","🐻嘶","🐻嘶~",
  // Horse (6)
  "🐴嘶","🐴嘶~","🐴嘶—","🐴嘶鸣","🐴嘶鸣~","🐴嘶鸣—",
  // Bird (6)
  "🐦叽","🐦叽~","🐦叽—","🐦啾","🐦啾~","🐦啾—",
  // Mouse (9)
  "🐭吱","🐭吱~","🐭吱—","🐭吱吱","🐭吱吱~","🐭吱吱—","🐭嘶","🐭嘶~","🐭嘶—",
  // Monkey (12)
  "🐒吼","🐒吼~","🐒吼—","🐒嗷","🐒嗷~","🐒嗷—","🐒呜","🐒呜~","🐒呜—","🐒嘶","🐒嘶~","🐒嘶—"
];
const BASE = DOG_SPEAK_WORDS.length; // 168

// ---------------------------
// Helpers: build token index map and sorted token list for greedy matching
const TOKEN_TO_INDEX = new Map();
for (let i = 0; i < DOG_SPEAK_WORDS.length; i++) TOKEN_TO_INDEX.set(DOG_SPEAK_WORDS[i], i);

// For decoding without separators, we use greedy longest-match
const TOKENS_BY_LENGTH = [...DOG_SPEAK_WORDS].sort((a,b) => b.length - a.length);

// ---------------------------
// Utility: get first emoji/codepoint of token (animal prefix)
// Use Array.from to handle surrogate pairs properly
function firstCodepoint(str) {
  return Array.from(str)[0] || "";
}

// ---------------------------
// WebCrypto helpers
async function randomBytes(n) {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

async function deriveKeyMaterial(password, salt, bits = 512, iterations = 200000) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256"
    },
    baseKey,
    bits
  );
  return new Uint8Array(derived);
}

// AES-CTR requires a 16-byte counter; we'll use iv(12) + 4 zero bytes
function makeCtrFromIv(iv12) {
  const ctr = new Uint8Array(16);
  ctr.set(iv12, 0);
  return ctr;
}

// ---------------------------
// Packing: bytes <-> Base168 tokens
// Strategy:
//  - Prepend uint16 BE of original byte length (2 bytes) to the raw bytes.
//  - Process in 3-byte chunks (24 bits). Each 3-byte chunk is converted to exactly 4 Base168 digits
//    (since 168^4 > 2^24 and 168^3 < 2^24). We pad the chunk to 3 bytes with zeros if needed.
//  - No separators between tokens, but we insert paragraph tags like <🐱> when animal prefix changes.
//  - Decoder first strips all <...> tags, then performs greedy token parsing.

const TOKENS_PER_CHUNK = 4;

function bytesToBaseTokens(bytes) {
  // prepend length (uint16 BE)
  const len = bytes.length;
  if (len > 0xFFFF) throw new Error("data too long to encode (max 65535 bytes)");
  const outBytes = new Uint8Array(2 + bytes.length);
  outBytes[0] = (len >> 8) & 0xFF;
  outBytes[1] = len & 0xFF;
  outBytes.set(bytes, 2);

  const tokens = [];
  for (let i = 0; i < outBytes.length; i += 3) {
    const b0 = outBytes[i] || 0;
    const b1 = outBytes[i+1] || 0;
    const b2 = outBytes[i+2] || 0;
    const val = (b0 << 16) | (b1 << 8) | b2; // 0 .. 2^24-1

    // convert val into exactly TOKENS_PER_CHUNK base-BASE digits, big-endian
    let rem = val;
    const digits = new Array(TOKENS_PER_CHUNK).fill(0);
    for (let d = TOKENS_PER_CHUNK - 1; d >= 0; d--) {
      digits[d] = rem % BASE;
      rem = Math.floor(rem / BASE);
    }
    for (let d = 0; d < TOKENS_PER_CHUNK; d++) {
      tokens.push(DOG_SPEAK_WORDS[digits[d]]);
    }
  }

  // Insert paragraph tags <emoji> whenever animal prefix changes
  let outStr = "";
  let lastPrefix = null;
  for (const t of tokens) {
    const prefix = firstCodepoint(t);
    if (lastPrefix === null || prefix !== lastPrefix) {
      // insert tag like <🐱> before this token
      outStr += `<${prefix}>`;
      lastPrefix = prefix;
    }
    outStr += t;
  }
  return outStr;
}

function baseTokensToBytes(strWithTags) {
  // Remove all paragraph tags like <...>
  const cleaned = strWithTags.replace(/<[^>]+>/g, "");

  // parse tokens greedily (longest-match)
  const indices = [];
  let pos = 0;
  while (pos < cleaned.length) {
    let matched = false;
    for (const token of TOKENS_BY_LENGTH) {
      if (cleaned.startsWith(token, pos)) {
        indices.push(TOKEN_TO_INDEX.get(token));
        pos += token.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      throw new Error("无法解析 token（未识别的词表片段），解码失败");
    }
  }

  if (indices.length % TOKENS_PER_CHUNK !== 0) {
    throw new Error("token 数量不对，非完整块");
  }

  const bytesArr = [];
  for (let i = 0; i < indices.length; i += TOKENS_PER_CHUNK) {
    let val = 0;
    for (let d = 0; d < TOKENS_PER_CHUNK; d++) {
      val = val * BASE + indices[i + d];
    }
    const b0 = (val >> 16) & 0xFF;
    const b1 = (val >> 8) & 0xFF;
    const b2 = val & 0xFF;
    bytesArr.push(b0, b1, b2);
  }
  const all = new Uint8Array(bytesArr);
  // first two bytes are length
  const realLen = (all[0] << 8) | all[1];
  const payload = all.slice(2, 2 + realLen);
  return payload;
}

// ---------------------------
// Encrypt / Decrypt using AES-CTR + HMAC-SHA256 (truncated tag)
// Pack: [salt(16) | iv(12) | ciphertext | tag(16)]
// Final output is Base168 tokens with paragraph tags inserted.

async function encrypt(text, password) {
  if (!text || !password) throw new Error("参数缺失");
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  const salt = await randomBytes(16);
  const iv = await randomBytes(12); // 12 bytes
  const keyMat = await deriveKeyMaterial(password, salt, 512, 200000); // 64 bytes
  const aesKeyRaw = keyMat.slice(0, 32);
  const hmacKeyRaw = keyMat.slice(32, 64);

  const aesKey = await crypto.subtle.importKey("raw", aesKeyRaw, { name: "AES-CTR" }, false, ["encrypt"]);
  const hmacKey = await crypto.subtle.importKey("raw", hmacKeyRaw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);

  const counter = makeCtrFromIv(iv);
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-CTR", counter, length: 64 }, aesKey, data);
  const ciphertext = new Uint8Array(cipherBuf);

  // compute HMAC over salt || iv || ciphertext
  const macInput = new Uint8Array(salt.length + iv.length + ciphertext.length);
  macInput.set(salt, 0);
  macInput.set(iv, salt.length);
  macInput.set(ciphertext, salt.length + iv.length);

  const fullTagBuf = await crypto.subtle.sign("HMAC", hmacKey, macInput);
  const fullTag = new Uint8Array(fullTagBuf);
  const tag = fullTag.slice(0, 16); // truncate to 16 bytes

  // pack final bytes
  const out = new Uint8Array(salt.length + iv.length + ciphertext.length + tag.length);
  let p = 0;
  out.set(salt, p); p += salt.length;
  out.set(iv, p); p += iv.length;
  out.set(ciphertext, p); p += ciphertext.length;
  out.set(tag, p); p += tag.length;

  // encode to tokens and insert paragraph tags
  const tokenStrWithTags = bytesToBaseTokens(out);
  return tokenStrWithTags;
}

async function decrypt(tokenStrWithTags, password) {
  if (!tokenStrWithTags || !password) throw new Error("参数缺失");
  // remove tags and parse tokens -> bytes
  const allBytes = baseTokensToBytes(tokenStrWithTags);
  if (allBytes.length < 16 + 12 + 16) throw new Error("密文格式错误（长度太短）");

  // extract parts
  const salt = allBytes.slice(0, 16);
  const iv = allBytes.slice(16, 28);
  const tag = allBytes.slice(allBytes.length - 16);
  const ciphertext = allBytes.slice(28, allBytes.length - 16);

  const keyMat = await deriveKeyMaterial(password, salt, 512, 200000);
  const aesKeyRaw = keyMat.slice(0, 32);
  const hmacKeyRaw = keyMat.slice(32, 64);
  const aesKey = await crypto.subtle.importKey("raw", aesKeyRaw, { name: "AES-CTR" }, false, ["decrypt"]);
  const hmacKey = await crypto.subtle.importKey("raw", hmacKeyRaw, { name: "HMAC", hash: "SHA-256" }, false, ["verify", "sign"]);

  // verify HMAC
  const macInput = new Uint8Array(salt.length + iv.length + ciphertext.length);
  macInput.set(salt, 0);
  macInput.set(iv, salt.length);
  macInput.set(ciphertext, salt.length + iv.length);

  const expectedFull = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, macInput));
  const expectedTag = expectedFull.slice(0, 16);

  // constant-time compare
  if (expectedTag.length !== tag.length) throw new Error("解密失败（MAC 不匹配）");
  let mismatch = 0;
  for (let i = 0; i < tag.length; i++) mismatch |= (expectedTag[i] ^ tag[i]);
  if (mismatch !== 0) throw new Error("解密失败（密码错误或数据被篡改）");

  // decrypt
  const counter = makeCtrFromIv(iv);
  try {
    const plainBuf = await crypto.subtle.decrypt({ name: "AES-CTR", counter, length: 64 }, aesKey, ciphertext);
    return new TextDecoder().decode(plainBuf);
  } catch (e) {
    throw new Error("解密失败（解密过程异常）");
  }
}

// ---------------------------
// DOM bindings (keeps original element ids)
// - dogEncodeBtn, dogInputText, dogEncodeKey, dogOutputLog
// - dogDecodeBtn, dogInputSpeak, dogDecodeKey, dogDecodeLog

document.addEventListener("DOMContentLoaded", () => {
  const dogEncodeBtn = document.getElementById("dogEncodeBtn");
  const dogInputText = document.getElementById("dogInputText");
  const dogEncodeKey = document.getElementById("dogEncodeKey");
  const dogOutputLog = document.getElementById("dogOutputLog");

  const dogDecodeBtn = document.getElementById("dogDecodeBtn");
  const dogInputSpeak = document.getElementById("dogInputSpeak");
  const dogDecodeKey = document.getElementById("dogDecodeKey");
  const dogDecodeLog = document.getElementById("dogDecodeLog");

  if (dogEncodeBtn) dogEncodeBtn.onclick = async () => {
    const text = dogInputText.value;
    const key = dogEncodeKey.value.trim();
    if (!text) { if (dogOutputLog) dogOutputLog.textContent = "请输入要转换的文字。"; return; }
    if (!key)  { if (dogOutputLog) dogOutputLog.textContent = "密钥必填，请填写。"; return; }

    try {
      const out = await encrypt(text, key);
      if (dogOutputLog) dogOutputLog.textContent = out;
    } catch (err) {
      if (dogOutputLog) dogOutputLog.textContent = "加密失败：" + err.message;
    }
  };

  if (dogDecodeBtn) dogDecodeBtn.onclick = async () => {
    const speak = dogInputSpeak.value.trim();
    const key = dogDecodeKey.value.trim();
    if (!speak) { if (dogDecodeLog) dogDecodeLog.textContent = "请输入要还原的兽语。"; return; }
    if (!key)   { if (dogDecodeLog) dogDecodeLog.textContent = "密钥必填，请填写。"; return; }

    try {
      const out = await decrypt(speak, key);
      if (dogDecodeLog) dogDecodeLog.textContent = out;
    } catch (err) {
      if (dogDecodeLog) dogDecodeLog.textContent = "解密失败：" + err.message;
    }
  };
});

// ---------------------------
// Expose functions for external use (optional)
window.DogSpeak = {
  encrypt,
  decrypt,
  DOG_SPEAK_WORDS,
  BASE
};
