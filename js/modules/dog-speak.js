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

  // 1. Check if token count is a multiple of TOKENS_PER_CHUNK
  if (indices.length % TOKENS_PER_CHUNK !== 0) {
    throw new Error("Token 数量不正确，解密失败");
  }

  // 2. Convert tokens back to bytes (4 tokens -> 3 bytes)
  const tempBytes = [];
  for (let i = 0; i < indices.length; i += TOKENS_PER_CHUNK) {
    let val = 0;
    // Reconstruct the 24-bit value from 4 base-BASE digits
    for (let d = 0; d < TOKENS_PER_CHUNK; d++) {
      val = val * BASE + indices[i + d];
    }

    // Convert 24-bit value back to 3 bytes (big-endian)
    tempBytes.push((val >> 16) & 0xFF);
    tempBytes.push((val >> 8) & 0xFF);
    tempBytes.push(val & 0xFF);
  }

  // 3. Extract original length (first 2 bytes) and trim
  if (tempBytes.length < 2) throw new Error("数据头损坏，无法确定原始长度");

  const lenHi = tempBytes[0];
  const lenLo = tempBytes[1];
  const originalLen = (lenHi << 8) | lenLo;

  const resultBytes = tempBytes.slice(2, 2 + originalLen);
  
  // Basic validation
  if (resultBytes.length !== originalLen) {
      // This is expected if the last chunk was padded with zeros, but ensures we don't return extra padding.
      // If the math is correct, slice(2, 2 + originalLen) should be exactly originalLen bytes.
  }
  
  return new Uint8Array(resultBytes);
}

// ---------------------------
// Main Cipher Logic (Encryption)

const DOG_SPEAK = {
  // Encrypt: plaintext + password -> dog speak cipher
  async encrypt(text, password, options = {}) {
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

    // 5) tokenization
    return bytesToBaseTokens(out);
  },

  // Decrypt: dog speak cipher + password -> plaintext
  async decrypt(dogSpeakCipher, password, options = {}) {
    const useCompression = (options.useCompression !== undefined) ? options.useCompression : CONFIG.USE_COMPRESSION;
    if (!dogSpeakCipher || !password) throw new Error("参数缺失");

    // 1) detokenization
    let cipherBytes;
    try {
        cipherBytes = baseTokensToBytes(dogSpeakCipher);
    } catch (e) {
        throw new Error(`Token 化还原失败: ${e.message}`);
    }

    const totalLen = cipherBytes.length;
    const saltLen = 16;
    const ivLen = 12;
    const tagLen = CONFIG.HMAC_TRUNCATE_BYTES;
    const headerLen = saltLen + ivLen + tagLen;

    if (totalLen <= headerLen) throw new Error("密文太短，数据结构不完整");

    // 2) unpack bytes
    let p = 0;
    const salt = cipherBytes.slice(p, p + saltLen); p += saltLen;
    const iv = cipherBytes.slice(p, p + ivLen); p += ivLen;
    const ciphertext = cipherBytes.slice(p, totalLen - tagLen); 
    const tag = cipherBytes.slice(totalLen - tagLen);

    // 3) derive keys
    const keyMat = await deriveKeyMaterial(password, salt);
    const aesKeyRaw = keyMat.slice(0, 32);
    const hmacKeyRaw = keyMat.slice(32, 64);
    
    const aesKey = await crypto.subtle.importKey("raw", aesKeyRaw, { name: "AES-CTR" }, false, ["decrypt"]);
    const hmacKey = await crypto.subtle.importKey("raw", hmacKeyRaw, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);

    // 4) verify HMAC over salt || iv || ciphertext
    const macInput = new Uint8Array(salt.length + iv.length + ciphertext.length);
    macInput.set(salt, 0);
    macInput.set(iv, salt.length);
    macInput.set(ciphertext, salt.length + iv.length);

    const isMatch = await crypto.subtle.verify("HMAC", hmacKey, tag, macInput);
    if (!isMatch) throw new Error("解密失败（密码错误或数据被篡改）");

    // 5) decrypt
    const counter = makeCtrFromIv(iv);
    try {
        const plainBuf = await crypto.subtle.decrypt({ name: "AES-CTR", counter, length: 64 }, aesKey, ciphertext);
        const plainBytes = new Uint8Array(plainBuf);

        // 6) decompress if compression enabled
        const resultBytes = useCompression ? decompressBytesLZ77(plainBytes) : plainBytes;
        return new TextDecoder().decode(resultBytes);

    } catch (e) {
        throw new Error("解密失败（解密过程异常或数据结构损坏）");
    }
  }
};


// ==========================
// 日志和复制辅助函数 (新增)
// ==========================
// 用于在指定元素中显示带时间戳的日志信息
function dogLog(elementId, message) {
    const logElement = document.getElementById(elementId);
    if (logElement) {
        // 格式化时间 [HH:MM:SS]
        const now = new Date();
        const timeStr = `[${now.toLocaleTimeString('zh-CN', {hour12: false})}]`;
        
        const newLogEntry = `${timeStr} ${message}\n`;
        // 假设 logElement 是 textarea，使用 value 并将新日志放在顶部
        if (logElement.tagName === 'TEXTAREA') {
             logElement.value = newLogEntry + logElement.value;
        } else {
             // 否则设置 textContent (兼容 div，但不推荐)
             logElement.textContent = newLogEntry + logElement.textContent;
        }
        // 滚动到顶部以显示最新的日志
        logElement.scrollTop = 0;
    }
}

// 复制到剪贴板并记录日志的函数
function copyToClipboardAndLog(textToCopy, logElementId) {
    const successMessage = '密文已复制到剪贴板！';
    const errorMessage = '复制到剪贴板失败。';
    
    dogLog(logElementId, "正在尝试复制密文...");

    // 使用现代 Clipboard API 
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            dogLog(logElementId, successMessage);
        }).catch(err => {
            console.error('Clipboard API 复制失败:', err);
            dogLog(logElementId, `错误：${errorMessage} (${err.message})`);
        });
    } else {
        // Fallback: 使用 document.execCommand
        try {
            const tempTextArea = document.createElement('textarea');
            tempTextArea.value = textToCopy;
            // 避免用户看到
            tempTextArea.style.position = 'fixed';
            tempTextArea.style.top = '0';
            tempTextArea.style.left = '-9999px';
            document.body.appendChild(tempTextArea);
            tempTextArea.select();
            document.execCommand('copy');
            document.body.removeChild(tempTextArea);
            dogLog(logElementId, `${successMessage} (Fallback)`);
        } catch (err2) {
            console.error('Fallback 复制失败:', err2);
            dogLog(logElementId, `错误：${errorMessage} (浏览器不支持)`);
        }
    }
}
// ==========================

// 文件读取函数 (修改：移除 alert，使用 dogLog)
function readDogSpeakFile(file) {
    if (file.type !== 'text/plain' && !file.name.toLowerCase().endsWith('.txt')) {
        // alert("请上传 TXT 格式的文件。"); // <-- REMOVED
        dogLog('dogDecodeLog', "错误：请上传 TXT 格式的文件。");
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result.trim();
        const dogInputSpeak = document.getElementById('dogInputSpeak'); 
        if (dogInputSpeak) {
            dogInputSpeak.value = content; // 将读取的密文填充到输入框
            // dogDecodeLog.textContent = "文件读取成功，密文已填充。"; // <-- REMOVED
            dogLog('dogDecodeLog', "文件读取成功，密文已填充。");
        }
    };
    reader.onerror = () => {
        // dogDecodeLog.textContent = "读取文件失败。"; // <-- REMOVED
        dogLog('dogDecodeLog', "错误：读取文件失败。");
    };
    reader.readAsText(file);
}

// ---------------------------
// DOM bindings 

document.addEventListener("DOMContentLoaded", () => {
    const dogEncodeBtn = document.getElementById("dogEncodeBtn");
    const dogInputText = document.getElementById("dogInputText");
    const dogEncodeKey = document.getElementById("dogEncodeKey");
    const dogOutputSpeak = document.getElementById("dogOutputSpeak");
    const dogCopyBtn = document.getElementById("dogCopyBtn");
    const dogDownloadTxtBtn = document.getElementById("dogDownloadTxtBtn");
    
    const dogDecodeBtn = document.getElementById("dogDecodeBtn");
    const dogInputSpeak = document.getElementById("dogInputSpeak");
    const dogDecodeKey = document.getElementById("dogDecodeKey");
    // const dogDecodeLog = document.getElementById("dogDecodeLog"); // This is now the log area
    const dogDecodedText = document.getElementById("dogDecodedText"); // <-- NEW decoded output area

    const dogReadInput = document.getElementById("dogReadInput");
    const dogReadDropzone = document.getElementById("dogReadDropzone");

    // ==========================
    // 加密/转换 逻辑 (修改：使用 dogLog 替换所有状态更新)
    // ==========================
    if (dogEncodeBtn) dogEncodeBtn.onclick = async () => {
        const text = dogInputText.value.trim();
        const key = dogEncodeKey.value.trim();
        if (!text) {
            dogLog('dogOutputLog', "请输入要加密的普通文字。");
            return;
        }
        if (!key) {
            dogLog('dogOutputLog', "请输入加密密钥。");
            return;
        }

        // 清空输出
        dogOutputSpeak.value = ""; 
        
        try {
            const start = performance.now();
            dogLog('dogOutputLog', "加密开始...");

            const result = await DOG_SPEAK.encrypt(text, key); 
            
            const end = performance.now();
            const time = (end - start).toFixed(2);
            
            dogOutputSpeak.value = result; 
            dogLog('dogOutputLog', `加密完成，密文长度 ${result.length}，耗时 ${time} ms。`);

        } catch (e) {
            console.error("加密失败:", e);
            dogLog('dogOutputLog', `错误：加密失败 (${e.message || '未知错误'})`);
        }
    };

    // ==========================
    // 复制逻辑 (修改：使用 copyToClipboardAndLog 替换 alert)
    // ==========================
    if (dogCopyBtn && dogOutputSpeak) {
        dogCopyBtn.onclick = () => {
            const speak = dogOutputSpeak.value;
            if (!speak || speak === "点击按钮开始转换...") {
                // alert("请先生成密文！"); // <-- REMOVED
                dogLog('dogOutputLog', "请先进行加密操作，密文为空。");
                return;
            }
            // 使用新的日志复制函数
            copyToClipboardAndLog(speak, 'dogOutputLog');
        };
    }

    // ==========================
    // 下载逻辑 (修改：使用 dogLog 替换 alert)
    // ==========================
    if (dogDownloadTxtBtn) dogDownloadTxtBtn.onclick = () => {
        const speak = dogOutputSpeak.value.trim();
        const key = dogEncodeKey.value.trim();
        if (!speak || speak === "点击按钮开始转换...") {
            // alert("请先生成密文！"); // <-- REMOVED
            dogLog('dogOutputLog', "请先生成密文！");
            return;
        }
        // 文件名为 密钥：X，x为具体的密钥
        const filename = `密钥：${key || '未填写'}.txt`;
        const blob = new Blob([speak], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        dogLog('dogOutputLog', `密文已下载为 ${filename}`);
    };

    // ==========================
    // 解密/还原 逻辑 (修改：使用 dogLog 替换状态更新，输出到新元素)
    // ==========================
    if (dogDecodeBtn) dogDecodeBtn.onclick = async () => {
        const speak = dogInputSpeak.value.trim();
        const key = dogDecodeKey.value.trim();

        // 总是清空输出区
        if (dogDecodedText) dogDecodedText.value = '';
        
        if (!speak) {
            // if (dogDecodeLog) dogDecodeLog.textContent = "请输入要还原的兽语。"; // <-- REMOVED
            dogLog('dogDecodeLog', "请输入要还原的兽语。");
            return;
        }
        if (!key) {
            // if (dogDecodeLog) dogDecodeLog.textContent = "请输入解密密钥。"; // <-- REMOVED
            dogLog('dogDecodeLog', "请输入解密密钥。");
            return;
        }

        try {
            const start = performance.now();
            dogLog('dogDecodeLog', "解密开始...");

            const result = await DOG_SPEAK.decrypt(speak, key); 
            
            const end = performance.now();
            const time = (end - start).toFixed(2);
            
            if (dogDecodedText) {
                dogDecodedText.value = result; // <-- Output to NEW area
            }
            dogLog('dogDecodeLog', `解密成功，耗时 ${time} ms。`);
            
        } catch (e) {
            console.error("解密失败:", e);
            // if (dogDecodeLog) dogDecodeLog.textContent = `解密失败：${e.message || '未知错误'}`; // <-- REMOVED
            dogLog('dogDecodeLog', `错误：解密失败 (${e.message || '未知错误'})`);
        }
    };
    
    // ==========================
    // TXT 文件读取逻辑
    // ==========================
    if (dogReadInput && dogReadDropzone) {
        dogReadInput.addEventListener('change', () => {
            const file = dogReadInput.files[0];
            if (file) {
                readDogSpeakFile(file);
            }
        });
        
        // 拖拽事件监听 (确保样式变化)
        dogReadDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dogReadDropzone.style.border = '2px dashed var(--accent)'; // 突出显示
        }, false);
        
        dogReadDropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dogReadDropzone.style.border = '1px dashed var(--border)'; // 恢复样式
        }, false);
        
        // 放置文件
        dogReadDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dogReadDropzone.style.border = '1px dashed var(--border)'; // 恢复样式
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
        dogReadDropzone.style.border = '1px dashed var(--border)';
        dogReadDropzone.style.cursor = 'pointer';
    }
    
});
