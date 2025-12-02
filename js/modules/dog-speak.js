// js/modules/dog-speak.js (全新 UTF16 + 高安全 CFB 版本)

// 狗语词库 (9 个真实狗叫声)
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
const BASE = DOG_SPEAK_WORDS.length; // BASE = 9
const MAX_VALUE = 65536; // UTF-16 字符范围

// ---------------------------
// 高安全 KeyStream 生成器
function getKeyStreamValue(seedText, position) {
    if (!seedText) return 0;
    let hash = 0;
    for (let i = 0; i < seedText.length; i++) {
        const charCode = seedText.charCodeAt(i);
        const posFactor = (position + i) % 256;
        hash = (hash + charCode + (hash << 9) + (hash >> 5) + posFactor) ^ charCode;
    }
    const finalHash = Math.abs((hash * 31) + (position * 13) + (seedText.length * 37)) % MAX_VALUE;
    return finalHash;
}

// ---------------------------
// UTF16 value -> 狗语 (动态长度)
function valueToDogSpeak(value) {
    value = value >>> 0; // 转 32bit 正整数
    if (value === 0) return DOG_SPEAK_WORDS[0];
    const arr = [];
    while (value > 0) {
        const digit = value % BASE;
        arr.push(DOG_SPEAK_WORDS[digit]);
        value = Math.floor(value / BASE);
    }
    return arr.reverse().join(" ");
}

// 狗语 -> UTF16 value
function dogSpeakToValue(words) {
    let value = 0;
    for (let i = 0; i < words.length; i++) {
        const idx = DOG_SPEAK_WORDS.indexOf(words[i]);
        if (idx === -1) return null;
        value = value * BASE + idx;
    }
    return value;
}

// ---------------------------
// 编码 (CFB 高安全)
function encodeToDogSpeak(text, key) {
    if (!text.trim()) return "嗷呜！请输入要转换的文字。";
    if (!key.trim()) return "汪！密钥必填，请填写。";

    const IV_Base = getKeyStreamValue(key + "IV_SEED", 0);
    let encoded = [];
    let prev = IV_Base;

    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        const Ki = getKeyStreamValue(key, i + 1);
        const encValue = (code + Ki + prev) % MAX_VALUE;
        encoded.push(valueToDogSpeak(encValue));
        prev = encValue;
    }

    const iv_speak = valueToDogSpeak(IV_Base);
    return iv_speak + " | " + encoded.join(" | ");
}

// ---------------------------
// 解码 (CFB 高安全)
function decodeFromDogSpeak(dogSpeak, key) {
    if (!dogSpeak.trim()) return "汪？请输入要还原的汪星语。";
    if (!key.trim()) return "汪？密钥必填，请填写。";

    const blocks = dogSpeak.split(" | ").filter(b => b.trim().length > 0);
    if (blocks.length < 2) return "密文格式错误或 IV 缺失";

    const IV_Block = blocks[0].trim().split(/\s+/);
    const IV_Base = dogSpeakToValue(IV_Block);
    if (IV_Base === null) return "IV 解码失败";

    let decoded = [];
    let prev = IV_Base;

    for (let i = 1; i < blocks.length; i++) {
        const speakParts = blocks[i].trim().split(/\s+/);
        const encValue = dogSpeakToValue(speakParts);
        if (encValue === null) {
            decoded.push("?");
            prev = 0;
            continue;
        }

        const Ki = getKeyStreamValue(key, i);
        const orig = (encValue - Ki - prev + MAX_VALUE * 2) % MAX_VALUE;
        decoded.push(String.fromCharCode(orig));
        prev = encValue;
    }

    return decoded.join("");
}

// ---------------------------
// 功能绑定 (DOM)
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

        if (navigator.clipboard) {
            navigator.clipboard.writeText(encoded).then(() => {
                dogEncodeBtn.textContent = "✅ 转换成功并已复制！";
                if (dogInputSpeak) dogInputSpeak.value = encoded;
                setTimeout(() => { dogEncodeBtn.textContent = "🐕 开始转换 🐕"; }, 1500);
            });
        }
    };

    if (dogDecodeBtn) dogDecodeBtn.onclick = () => {
        const speak = dogInputSpeak.value.trim();
        const key = dogDecodeKey.value.trim();
        if (!speak) { dogDecodeLog.textContent = "汪？请输入要还原的汪星语。"; return; }
        if (!key) { dogDecodeLog.textContent = "汪？密钥必填，请填写。"; return; }

        const decoded = decodeFromDogSpeak(speak, key);
        dogDecodeLog.textContent = decoded;

        if (navigator.clipboard) {
            navigator.clipboard.writeText(decoded).then(() => {
                dogDecodeBtn.textContent = "✅ 还原成功并已复制！";
                setTimeout(() => { dogDecodeBtn.textContent = "🔓 开始还原 🔓"; }, 1500);
            });
        }
    };
});
