// js/modules/dog-speak.js
// 使用 AES-256-GCM + PBKDF2 实现真正安全的加密，并保持原有狗语编码与前端交互逻辑。

// ---------------------------
// 狗语词库
const DOG_SPEAK_WORDS = [
    "汪",
    "汪汪",
    "呜",
    "呀呜",
    "吠",
    "嗷呜",
    "嗷嗷",
    "哼"
];

const BASE = DOG_SPEAK_WORDS.length;
const MAX_VALUE = 65536; // 0..65535
const SEPARATOR = "、";   // 中文顿号

// ---------------------------
// 单个 0..65535 → 狗语
function valueToDogSpeak(value) {
    value = value >>> 0;
    if (value === 0) return DOG_SPEAK_WORDS[0];

    const out = [];
    while (value > 0) {
        out.push(DOG_SPEAK_WORDS[value % BASE]);
        value = Math.floor(value / BASE);
    }
    return out.reverse().join(" ");
}

// 狗语 → 数字（0..65535）
function dogSpeakToValue(words) {
    let arr;
    if (Array.isArray(words)) arr = words;
    else arr = words.split(/\s+/).filter(x => x);

    let v = 0;
    for (let w of arr) {
        const idx = DOG_SPEAK_WORDS.indexOf(w);
        if (idx === -1) return null;
        v = v * BASE + idx;
    }
    return v >>> 0;
}

// ---------------------------
// Uint8Array → 狗语（按 2 字节一组）
function bytesToDogSpeak(bytes) {
    const out = [];
    for (let i = 0; i < bytes.length; i += 2) {
        const hi = bytes[i] || 0;
        const lo = bytes[i + 1] || 0;
        const v = (hi << 8) | lo;
        out.push(valueToDogSpeak(v));
    }
    return out.join(SEPARATOR);
}

// 狗语 → Uint8Array
function dogSpeakToBytes(dogSpeak) {
    const blocks = dogSpeak
        .split(/、| {2,}|\|+|\r?\n+/)
        .map(b => b.trim())
        .filter(b => b.length > 0);

    const arr = [];
    for (let b of blocks) {
        const v = dogSpeakToValue(b.split(/\s+/));
        const num = v ?? 0;
        arr.push((num >> 8) & 0xFF, num & 0xFF);
    }
    return new Uint8Array(arr);
}

// ---------------------------
// WebCrypto 工具函数
async function randomBytes(n) {
    const out = new Uint8Array(n);
    crypto.getRandomValues(out);
    return out;
}

async function deriveKey(password, salt) {
    const enc = new TextEncoder();
    const passKey = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        "PBKDF2",
        false,
        ["deriveKey"]
    );

    return await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        passKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

// ---------------------------
// AES-256-GCM 加密 → 狗语
async function encryptAES(text, password) {
    if (!text || !password) throw new Error("参数缺失");

    const encoder = new TextEncoder();
    const salt = await randomBytes(16);
    const iv = await randomBytes(12);

    const key = await deriveKey(password, salt);

    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt(
            { name: "AES-GCM", iv, tagLength: 128 },
            key,
            encoder.encode(text)
        )
    );

    // salt + iv + ciphertext
    const pack = new Uint8Array(salt.length + iv.length + ciphertext.length);
    pack.set(salt, 0);
    pack.set(iv, salt.length);
    pack.set(ciphertext, salt.length + iv.length);

    return bytesToDogSpeak(pack);
}

// ---------------------------
// 狗语 → AES-256-GCM 解密
async function decryptAES(dogSpeak, password) {
    if (!dogSpeak || !password) throw new Error("参数缺失");

    const allBytes = dogSpeakToBytes(dogSpeak);
    if (allBytes.length < 28) throw new Error("密文格式错误");

    const salt = allBytes.slice(0, 16);
    const iv = allBytes.slice(16, 28);
    const ciphertext = allBytes.slice(28);

    const key = await deriveKey(password, salt);

    try {
        const plainBuf = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv, tagLength: 128 },
            key,
            ciphertext
        );
        return new TextDecoder().decode(plainBuf);
    } catch (e) {
        throw new Error("解密失败（密码错误或数据损坏）");
    }
}

// ---------------------------
// DOM 绑定（完全保留你原来的交互逻辑）
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

        if (!text) { dogOutputLog.textContent = "嗷呜！请输入要转换的文字。"; return; }
        if (!key)  { dogOutputLog.textContent = "嗷！密钥必填，请填写。"; return; }

        try {
            const out = await encryptAES(text, key);
            dogOutputLog.textContent = out;
        } catch (err) {
            dogOutputLog.textContent = "加密失败：" + err.message;
        }
    };

    if (dogDecodeBtn) dogDecodeBtn.onclick = async () => {
        const speak = dogInputSpeak.value.trim();
        const key = dogDecodeKey.value.trim();

        if (!speak) { dogDecodeLog.textContent = "汪？请输入要还原的汪星语。"; return; }
        if (!key)   { dogDecodeLog.textContent = "汪？密钥必填，请填写。"; return; }

        try {
            const out = await decryptAES(speak, key);
            dogDecodeLog.textContent = out;
        } catch (err) {
            dogDecodeLog.textContent = "解密失败：" + err.message;
        }
    };
});
