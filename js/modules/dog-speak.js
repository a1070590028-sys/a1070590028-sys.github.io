// js/modules/dog-speak.js
// AES-CTR + HMAC-SHA256 (truncated tag 12 bytes) + LZ77-light compression (on plaintext)
// Base168 tokenization (emoji + real animal onomatopoeia), 3-byte packing -> 4 tokens
// No external libraries. Uses WebCrypto (browser).

// ---------------------------
// CONFIG
const CONFIG = {
  KDF_ITERATIONS: 200000,
  DERIVE_BITS: 512,
  HMAC_TRUNCATE_BYTES: 12, // structure compression: shorter tag (12 bytes). Change to 16 if you prefer.
  USE_COMPRESSION: true     // true = compress plaintext before encrypting; false = skip compression
};

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

// Utility: get first emoji/codepoint of token (animal prefix)
function firstCodepoint(str) { return Array.from(str)[0] || ""; }

// ---------------------------
// WebCrypto helpers
async function randomBytes(n) {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

async function deriveKeyMaterial(password, salt, bits = CONFIG.DERIVE_BITS, iterations = CONFIG.KDF_ITERATIONS) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, baseKey, bits);
  return new Uint8Array(derived);
}

function makeCtrFromIv(iv12) {
  const ctr = new Uint8Array(16);
  ctr.set(iv12, 0);
  return ctr;
}

// ---------------------------
// Lightweight LZ77-style compressor (bytes -> bytes)
// Simple, deterministic, fast in JS, suitable for textual repetition.
// Format (encoded stream of tokens):
// [header: 2 bytes version][...tokens...]
// token:
//  - literal: 0x00 + byte
//  - match:   0x01 + offsetHigh(1) + offsetLow(1) + length(1)   (offset 16-bit, length 1..255)
// window size = 4096, minMatchLen = 3
// Note: This is not optimal LZ77; it's a small working compressor that handles repetitions.

const LZ = {
  WINDOW: 4096,
  MIN_MATCH: 3,
  VERSION: 1
};

function compressBytesLZ77(input) {
  if (!input || input.length === 0) return new Uint8Array([LZ.VERSION, 0, 0]); // header only
  const out = [];
  // header: version (1 byte) + reserved (2 bytes)
  out.push(LZ.VERSION, 0, 0);

  let pos = 0;
  const n = input.length;
  while (pos < n) {
    const endWindow = Math.max(0, pos - LZ.WINDOW);
    let bestLen = 0;
    let bestOffset = 0;
    // naive search for longest match (simple, O(n * window))
    // To keep JS performance acceptable, limit search: only search last 1024 bytes
    const searchStart = Math.max(endWindow, pos - 1024);
    for (let j = searchStart; j < pos; j++) {
      let k = 0;
      while (k < 255 && pos + k < n && input[j + k] === input[pos + k]) k++;
      if (k > bestLen && k >= LZ.MIN_MATCH) {
        bestLen = k;
        bestOffset = pos - j;
        if (bestLen >= 255) break;
      }
    }
    if (bestLen >= LZ.MIN_MATCH) {
      // emit match token
      out.push(0x01);
      const off = bestOffset;
      out.push((off >> 8) & 0xFF, off & 0xFF);
      out.push(bestLen & 0xFF);
      pos += bestLen;
    } else {
      // emit literal
      out.push(0x00, input[pos]);
      pos++;
    }
  }

  return new Uint8Array(out);
}

function decompressBytesLZ77(buf) {
  if (!buf || buf.length < 3) return new Uint8Array(0);
  const ver = buf[0];
  if (ver !== LZ.VERSION) throw new Error("Unsupported LZ version");
  // reserved bytes ignored
  let pos = 3;
  const out = [];
  while (pos < buf.length) {
    const t = buf[pos++];
    if (t === 0x00) {
      const b = buf[pos++];
      out.push(b);
    } else if (t === 0x01) {
      const hi = buf[pos++], lo = buf[pos++];
      const off = (hi << 8) | lo;
      const len = buf[pos++];
      const start = out.length - off;
      if (start < 0) throw new Error("LZ decompress error: invalid offset");
      for (let i = 0; i < len; i++) out.push(out[start + i]);
    } else {
      throw new Error("LZ decompress error: unknown token");
    }
  }
  return new Uint8Array(out);
}

// ---------------------------
// Packing: bytes <-> Base168 tokens (3-byte -> 4 tokens)
// Prepend uint16 BE of original byte length (2 bytes)
const TOKENS_PER_CHUNK = 4;

function bytesToBaseTokens(bytes) {
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
  // join into single string without separators
  return tokens.join("");
}

function baseTokensToBytes(str) {
  // parse tokens greedily (longest-match)
  const indices = [];
  let pos = 0;
  while (pos < str.length) {
    let matched = false;
    for (const token of TOKENS_BY_LENGTH) {
      if (str.startsWith(token, pos)) {
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
  const realLen = (all[0] << 8) | all[1];
  const payload = all.slice(2, 2 + realLen);
  return payload;
}

// ---------------------------
// Encrypt / Decrypt using AES-CTR + HMAC-SHA256 (truncated)
// Pack: [salt(16) | iv(12) | ciphertext | tag(truncated bytes)]
// Final output is Base168 tokens (no separators)

async function encrypt(text, password, options = {}) {
  const useCompression = (options.useCompression !== undefined) ? options.useCompression : CONFIG.USE_COMPRESSION;
  if (!text || !password) throw new Error("参数缺失");

  // 1) compress plaintext if enabled
  const encoder = new TextEncoder();
  const rawBytes = encoder.encode(text);
  const plainBytes = useCompression ? compressBytesLZ77(rawBytes) : rawBytes;

  // 2) generate salt/iv and derive keys
  const salt = await randomBytes(16);
  const iv = await randomBytes(12);
  const keyMat = await deriveKeyMaterial(password, salt);
  const aesKeyRaw = keyMat.slice(0, 32);
  const hmacKeyRaw = keyMat.slice(32, 64);

  const aesKey = await crypto.subtle.importKey("raw", aesKeyRaw, { name: "AES-CTR" }, false, ["encrypt"]);
  const hmacKey = await crypto.subtle.importKey("raw", hmacKeyRaw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);

  const counter = makeCtrFromIv(iv);
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-CTR", counter, length: 64 }, aesKey, plainBytes);
  const ciphertext = new Uint8Array(cipherBuf);

  // 3) compute HMAC over salt || iv || ciphertext
  const macInput = new Uint8Array(salt.length + iv.length + ciphertext.length);
  macInput.set(salt, 0);
  macInput.set(iv, salt.length);
  macInput.set(ciphertext, salt.length + iv.length);

  const fullTagBuf = await crypto.subtle.sign("HMAC", hmacKey, macInput);
  const fullTag = new Uint8Array(fullTagBuf);
  const tag = fullTag.slice(0, CONFIG.HMAC_TRUNCATE_BYTES);

  // 4) pack final bytes
  const out = new Uint8Array(salt.length + iv.length + ciphertext.length + tag.length);
  let p = 0;
  out.set(salt, p); p += salt.length;
  out.set(iv, p); p += iv.length;
  out.set(ciphertext, p); p += ciphertext.length;
  out.set(tag, p); p += tag.length;

  // 5) encode to tokens and return string
  const tokenStr = bytesToBaseTokens(out);
  return tokenStr;
}

async function decrypt(tokenStr, password, options = {}) {
  const useCompression = (options.useCompression !== undefined) ? options.useCompression : CONFIG.USE_COMPRESSION;
  if (!tokenStr || !password) throw new Error("参数缺失");

  // tokens -> bytes
  const allBytes = baseTokensToBytes(tokenStr);
  // minimum lengths: salt(16)+iv(12)+tag + maybe zero ciphertext
  const minLen = 16 + 12 + CONFIG.HMAC_TRUNCATE_BYTES;
  if (allBytes.length < minLen) throw new Error("密文格式错误（长度太短）");

  const salt = allBytes.slice(0, 16);
  const iv = allBytes.slice(16, 28);
  const tag = allBytes.slice(allBytes.length - CONFIG.HMAC_TRUNCATE_BYTES);
  const ciphertext = allBytes.slice(28, allBytes.length - CONFIG.HMAC_TRUNCATE_BYTES);

  const keyMat = await deriveKeyMaterial(password, salt);
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
  const expectedTag = expectedFull.slice(0, CONFIG.HMAC_TRUNCATE_BYTES);

  // constant-time compare
  if (expectedTag.length !== tag.length) throw new Error("解密失败（MAC 长度不对）");
  let mismatch = 0;
  for (let i = 0; i < tag.length; i++) mismatch |= (expectedTag[i] ^ tag[i]);
  if (mismatch !== 0) throw new Error("解密失败（密码错误或数据被篡改）");

  // decrypt
  const counter = makeCtrFromIv(iv);
  try {
    const plainBuf = await crypto.subtle.decrypt({ name: "AES-CTR", counter, length: 64 }, aesKey, ciphertext);
    const plainBytes = new Uint8Array(plainBuf);
    // decompress if compression enabled
    const resultBytes = useCompression ? decompressBytesLZ77(plainBytes) : plainBytes;
    return new TextDecoder().decode(resultBytes);
  } catch (e) {
    throw new Error("解密失败（解密过程异常）");
  }
}

// ---------------------------
// DOM bindings (keeps original element ids)
// - dogEncodeBtn, dogInputText, dogEncodeKey, dogOutputLog
// - dogDecodeBtn, dogInputSpeak, dogDecodeKey, dogDecodeLog
// 新增：
// - dogCopyBtn, dogDownloadTxtBtn
// - dogReadInput, dogReadDropzone (for reading txt)

document.addEventListener("DOMContentLoaded", () => {
  const dogEncodeBtn = document.getElementById("dogEncodeBtn");
  const dogInputText = document.getElementById("dogInputText");
  const dogEncodeKey = document.getElementById("dogEncodeKey");
  const dogOutputLog = document.getElementById("dogOutputLog");
  const dogCopyBtn = document.getElementById("dogCopyBtn");
  const dogDownloadTxtBtn = document.getElementById("dogDownloadTxtBtn");

  const dogDecodeBtn = document.getElementById("dogDecodeBtn");
  const dogInputSpeak = document.getElementById("dogInputSpeak");
  const dogDecodeKey = document.getElementById("dogDecodeKey");
  const dogDecodeLog = document.getElementById("dogDecodeLog");
  const dogReadInput = document.getElementById("dogReadInput");
  const dogReadDropzone = document.getElementById("dogReadDropzone");

  // ⭐ NEW: Log Elements ⭐
  const dogEncLog = document.getElementById("dogEncLog");
  const dogDecLog = document.getElementById("dogDecLog"); 
  
  // ⭐ NEW: Log Helper Function ⭐
  /**
   * @param {string} message - 日志消息.
   * @param {boolean} isError - 是否为错误消息.
   * @param {boolean} isDecode - 是否为解密面板日志 (true = dogDecLog, false = dogEncLog).
   */
  function dogLog(message, isError = false, isDecode = false) {
      const logElement = isDecode ? dogDecLog : dogEncLog;
      if (!logElement) return;
      const date = new Date().toLocaleTimeString('zh-CN', { hour12: false });
      // 使用 accent/error 颜色来保持与其它模块日志的风格一致性
      // 假设 style.css 中已经定义了 --accent 和 --error 变量
      const color = isError ? "var(--error, #f04747)" : "var(--accent, #60a5fa)"; 
      
      // Prepend new message and use <br> for newline
      logElement.innerHTML = `<span style="color:${color};">[${date}] ${message}</span><br>` + logElement.innerHTML;
  }

  // ==========================
  // 加密/转换 逻辑
  // ==========================
  if (dogEncodeBtn) dogEncodeBtn.onclick = async () => {
    const text = dogInputText.value;
    const key = dogEncodeKey.value.trim();
    
    if (!key) {
        dogLog("密钥必填，请填写。", true, false); 
        return;
    }
    
    if (!text) { 
        dogLog("请输入要转换的文字。", true, false); 
        return; 
    }

    dogLog("开始转换...", false, false);

    try {
      const out = await encrypt(text, key, { useCompression: CONFIG.USE_COMPRESSION });
      if (dogOutputLog) dogOutputLog.textContent = out;
      dogLog("加密完成，密文已生成！", false, false);
    } catch (err) {
      if (dogOutputLog) dogOutputLog.textContent = "转换失败。";
      dogLog("加密失败：" + err.message, true, false);
    }
  };

  // ==========================
  // 新增：加密卡片 - 复制密文 (替换 alert)
  // ==========================
  if (dogCopyBtn) dogCopyBtn.onclick = async () => {
    const speak = dogOutputLog.textContent.trim();
    if (!speak || speak === "点击按钮开始转换...") {
      dogLog("请先生成密文！", true, false); // 替换 alert
      return;
    }
    try {
      // Use navigator.clipboard
      await navigator.clipboard.writeText(speak);
      dogLog("密文已复制到剪贴板！", false, false); // 替换 alert
    } catch (err) {
      console.error("复制失败:", err);
      // Fallback for older browsers (替换 alert)
      const textarea = document.createElement('textarea');
      textarea.value = speak;
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand('copy');
        dogLog("密文已复制到剪贴板！", false, false); // 替换 alert
      } catch (err) {
        dogLog("复制失败，请手动选择复制。", true, false); // 替换 alert
      }
      document.body.removeChild(textarea);
    }
  };

  // ==========================
  // 新增：加密卡片 - 下载为 TXT (替换 alert)
  // ==========================
  if (dogDownloadTxtBtn) dogDownloadTxtBtn.onclick = () => {
    const speak = dogOutputLog.textContent.trim();
    const key = dogEncodeKey.value.trim();
    if (!speak || speak === "点击按钮开始转换...") {
      dogLog("请先生成密文！", true, false); // 替换 alert
      return;
    }

    // 文件名为 密钥：X，x为具体的密钥
    const filename = `密钥：${key || '未填写'}.txt`;
    dogLog(`开始下载文件: ${filename}`, false, false); // 增加日志
    
    const blob = new Blob([speak], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ==========================
  // 解密/还原 逻辑
  // ==========================
  if (dogDecodeBtn) dogDecodeBtn.onclick = async () => {
    const speak = dogInputSpeak.value.trim();
    const key = dogDecodeKey.value.trim();
    
    if (!speak) {
      dogLog("请输入要还原的兽语。", true, true); // 替换原有提示
      // 保持输出框状态
      return;
    }
    if (!key)   { 
      dogLog("密钥必填，请填写。", true, true); // 替换原有提示
      return; 
    }

    dogLog("开始还原...", false, true);

    try {
      const out = await decrypt(speak, key, { useCompression: CONFIG.USE_COMPRESSION });
      if (dogDecodeLog) dogDecodeLog.textContent = out;
      dogLog("还原成功！", false, true); // 替换原有提示
    } catch (err) {
      if (dogDecodeLog) dogDecodeLog.textContent = "还原失败。";
      dogLog("解密失败：" + err.message, true, true); // 替换原有错误提示
    }
  };
  
  // ==========================
  // 新增：解密卡片 - 上传并读取 TXT 文件
  // ==========================
  if (dogReadInput) {
      dogReadInput.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (file) {
              readDogSpeakFile(file);
          }
          // 清空 input，以便再次上传同一个文件触发 change 事件
          e.target.value = '';
      });
  }
  
  if (dogReadDropzone) {
      // 阻止默认行为，允许放置
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
          dogReadDropzone.addEventListener(eventName, (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (eventName === 'dragenter' || eventName === 'dragover') {
                  // 假设存在 --accent 变量
                  dogReadDropzone.style.border = '2px solid var(--accent, #60a5fa)'; 
              } else if (eventName === 'dragleave' || eventName === 'drop') {
                  // 假设存在 --border 变量
                  dogReadDropzone.style.border = '1px dashed var(--border, #333333)'; 
              }
          }, false);
      });
      
      // 放置文件
      dogReadDropzone.addEventListener('drop', (e) => {
          const file = e.dataTransfer.files[0];
          if (file) {
              readDogSpeakFile(file);
          }
      });
      
      // 点击打开文件选择器
      dogReadDropzone.onclick = () => {
          dogReadInput.click();
      };
      
      // 初始样式设置（如果 dropzone 样式未在 CSS 中定义）
      dogReadDropzone.style.border = '1px dashed var(--border, #333333)';
      dogReadDropzone.style.cursor = 'pointer';
  }
  
  function readDogSpeakFile(file) {
      if (file.type !== 'text/plain' && !file.name.toLowerCase().endsWith('.txt')) {
          dogLog("请上传 TXT 格式的文件。", true, true); // 替换 alert
          return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
          const content = e.target.result.trim();
          if (dogInputSpeak) {
              dogInputSpeak.value = content; // 将读取的密文填充到输入框
              dogLog("文件读取成功，密文已填充。", false, true); // 替换 dogDecodeLog.textContent 提示
          }
      };
      reader.onerror = () => {
          dogLog("读取文件失败。", true, true); // 替换 dogDecodeLog.textContent 提示
      };
      reader.readAsText(file);
  }
  // ==========================
  
});

// ---------------------------
// Expose functions for external use (optional)
window.DogSpeak = {
  encrypt,
  decrypt,
  DOG_SPEAK_WORDS,
  BASE,
  CONFIG,
  // utility for migrating or testing:
  compressBytesLZ77,
  decompressBytesLZ77
};
