// js/modules/dog-speak.js (使用中文顿号“、”分段 + 更健壮的解析)

// 狗语词库 (真实狗叫声)
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
const MAX_VALUE = 65536; // UTF-16 范围
const SEPARATOR = "、"; // ← 输出分段符：中文顿号

// ---------------------------
// 高安全 KeyStream
function getKeyStreamValue(seedText, position) {
    if (!seedText) return 0;
    let hash = 0;
    for (let i = 0; i < seedText.length; i++) {
        const code = seedText.charCodeAt(i);
        const posFactor = (position + i) % 256;
        hash = (hash + code + (hash << 9) + (hash >> 5) + posFactor) ^ code;
    }
    return Math.abs(hash * 31 + position * 13 + seedText.length * 37) % MAX_VALUE;
}

// ---------------------------
// UTF16 value -> 狗语（可变长度）
function valueToDogSpeak(value) {
    value = value >>> 0;
    if (value === 0) return DOG_SPEAK_WORDS[0];

    const arr = [];
    while (value > 0) {
        let d = value % BASE;
        arr.push(DOG_SPEAK_WORDS[d]);
        value = Math.floor(value / BASE);
    }
    return arr.reverse().join(" ");
}

// 狗语 -> value（支持传入字符串或数组）
function dogSpeakToValue(words) {
    let arr;
    if (Array.isArray(words)) {
        arr = words;
    } else if (typeof words === "string") {
        arr = words.trim().split(/\s+/).filter(w => w.length > 0);
    } else {
        return null;
    }

    let v = 0;
    for (let i = 0; i < arr.length; i++) {
        const idx = DOG_SPEAK_WORDS.indexOf(arr[i]);
        if (idx === -1) return null;
        v = v * BASE + idx;
    }
    return v;
}

// ---------------------------
// 加密（使用顿号分段）
function encodeToDogSpeak(text, key) {
    if (!text || !text.toString().trim()) return "嗷呜！请输入要转换的文字。";
    if (!key || !key.toString().trim()) return "嗷！密钥必填，请填写。";

    const IV_Base = getKeyStreamValue(key + "IV_SEED", 0);
    const encoded = [];
    let prev = IV_Base;

    // 遍历字符（支持代理对等）
    for (let i = 0, len = text.length; i < len; i++) {
        const code = text.charCodeAt(i);
        const Ki = getKeyStreamValue(key, i + 1);
        const enc = (code + Ki + prev) % MAX_VALUE;
        encoded.push(valueToDogSpeak(enc));
        prev = enc;
    }

    const ivSpeak = valueToDogSpeak(IV_Base);
    // 按约定用中文顿号分段（IV 首段 + 每字符段，用顿号连接）
    return ivSpeak + SEPARATOR + encoded.join(SEPARATOR);
}

// ---------------------------
// 解密（更健壮：支持顿号、双空格、竖线、换行等分隔）
function decodeFromDogSpeak(dogSpeak, key) {
    if (!dogSpeak || !dogSpeak.toString().trim()) return "汪？请输入要还原的汪星语。";
    if (!key || !key.toString().trim()) return "汪？密钥必填，请填写。";

    // 兼容多种分隔：中文顿号、两个及以上空格、竖线、换行
    const rawBlocks = dogSpeak.split(/、| {2,}|\|+|\r?\n+/).map(b => b.trim()).filter(b => b.length > 0);

    if (rawBlocks.length < 2) return "密文格式错误，缺少 IV 或密文段。";

    // IV 可以是若干个狗语词（以空格分隔），所以对第一个块再拆分词
    const ivWords = rawBlocks[0].split(/\s+/).filter(w => w.length > 0);
    const IV_Base = dogSpeakToValue(ivWords);
    if (IV_Base === null) return "IV 解码失败，IV 包含未知词汇。";

    let decoded = [];
    let prev = IV_Base;

    // blocks 从 1 开始，对应第一个明文字节（i 与 KeyStream 位置对齐：i）
    for (let i = 1; i < rawBlocks.length; i++) {
        const part = rawBlocks[i].trim();
        if (!part) {
            decoded.push("?");
            prev = 0;
            continue;
        }

        const words = part.split(/\s+/).filter(w => w.length > 0);
        const enc = dogSpeakToValue(words);
        if (enc === null) {
            decoded.push("?");
            prev = 0;
            continue;
        }

        const Ki = getKeyStreamValue(key, i);
        const orig = (enc - Ki - prev + MAX_VALUE * 2) % MAX_VALUE;
        decoded.push(String.fromCharCode(orig));
        prev = enc;
    }

    return decoded.join("");
}

// ---------------------------
// 绑定 DOM（无自动复制）
document.addEventListener("DOMContentLoaded", () => {

    const dogEncodeBtn = document.getElementById("dogEncodeBtn");
    const dogInputText = document.getElementById("dogInputText");
    const dogEncodeKey = document.getElementById("dogEncodeKey");
    const dogOutputLog = document.getElementById("dogOutputLog");

    const dogDecodeBtn = document.getElementById("dogDecodeBtn");
    const dogInputSpeak = document.getElementById("dogInputSpeak");
    const dogDecodeKey = document.getElementById("dogDecodeKey");
    const dogDecodeLog = document.getElementById("dogDecodeLog");

    if (dogEncodeBtn) dogEncodeBtn.onclick = () => {
        const text = dogInputText.value;
        const key = dogEncodeKey.value.trim();

        if (!text) { dogOutputLog.textContent = "嗷呜！请输入要转换的文字。"; return; }
        if (!key) { dogOutputLog.textContent = "嗷！密钥必填，请填写。"; return; }

        const encoded = encodeToDogSpeak(text, key);
        dogOutputLog.textContent = encoded;
    };

    if (dogDecodeBtn) dogDecodeBtn.onclick = () => {
        const speak = dogInputSpeak.value.trim();
        const key = dogDecodeKey.value.trim();

        if (!speak) { dogDecodeLog.textContent = "汪？请输入要还原的汪星语。"; return; }
        if (!key) { dogDecodeLog.textContent = "汪？密钥必填，请填写。"; return; }

        const decoded = decodeFromDogSpeak(speak, key);
        dogDecodeLog.textContent = decoded;
    };
});
