// js/modules/dog-speak.js (最终稳定版 - 仅支持216个英数字和标点符号)

// 密语参数
const BASE = 6; // 6进制
const MAX_VALUE = BASE * BASE * BASE; // 6 * 6 * 6 = 216
const DOG_SPEAK_WORDS = ["汪", "汪汪", "呜", "嗷嗷", "吠", "嗷呜"]; // 6个词汇

// 最终稳定版 CHAR_MAP (必须严格是216个字符: 英文、数字和符号)
const CHAR_MAP = 
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" + // 62个英数字
    "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~" + // 32个常用标点
    "£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ"; // 122个扩展ASCII/拉丁字符
    // 总计: 216 个字符。

/**
 * 确定性扰动值生成器 (基于密钥)
 * @param {string} seedText 种子文本 (密钥)
 * @returns {number} 0 到 MAX_VALUE - 1 之间的整数扰动值
 */
function getPerturbValue(seedText) {
    if (!seedText) return 0; // 无密钥，不扰动
    
    let hash = 0;
    for (let i = 0; i < seedText.length; i++) {
        hash = hash + seedText.charCodeAt(i) + (hash << 9);
    }
    return Math.abs(hash) % MAX_VALUE;
}

/**
 * 将十进制值转换为三位 BASE 进制的狗叫词序列
 * @param {number} value 十进制值 (0 - 215)
 * @returns {string} 狗叫词序列 (例如: "汪 嗷嗷 吠")
 */
function valueToDogSpeak(value) {
    value = value % MAX_VALUE;
    
    // 转换为三位 6 进制数 d2 d1 d0
    const d0 = value % BASE; 
    const d1 = Math.floor(value / BASE) % BASE;
    const d2 = Math.floor(value / (BASE * BASE)) % BASE; 

    // 映射到狗叫词并拼接，用空格分隔
    // 顺序是 d2 (最高位) -> d1 -> d0 (最低位)
    return DOG_SPEAK_WORDS[d2] + " " + DOG_SPEAK_WORDS[d1] + " " + DOG_SPEAK_WORDS[d0];
}

/**
 * 将三位 BASE 进制的狗叫词序列还原为十进制值
 * @param {string[]} speakParts 三个狗叫词组成的数组
 * @returns {number | null} 十进制值 (0 - 215) 或 null (失败)
 */
function dogSpeakToValue(speakParts) {
    // 还原三位 6 进制数： d2*B^2 + d1*B^1 + d0*B^0
    let value = 0;
    
    // 从左到右处理：d2, d1, d0
    for (let i = 0; i < 3; i++) {
        const wordIndex = DOG_SPEAK_WORDS.indexOf(speakParts[i]);
        if (wordIndex === -1) return null; // 无法识别的词汇
        
        value += wordIndex * Math.pow(BASE, 2 - i);
    }
    return value;
}


// ===========================================
// ⭐ 核心转换逻辑 ⭐
// ===========================================

/**
 * 转换函数 (Encode)
 */
function encodeToDogSpeak(text, key) {
    if (!text.trim()) return "嗷呜！请输入要转换的文字。";

    const perturbValue = getPerturbValue(key);
    let encoded = [];
    
    // 遍历所有字符
    for (const char of Array.from(text)) {
        const index = CHAR_MAP.indexOf(char);
        
        if (index === -1) {
            // 不支持的字符，保留原样，用空狗叫词表示，方便解码时跳过
            encoded.push(char); 
            continue;
        }

        // 1. 计算加密后的值: EncodedValue = (Index + PerturbValue) mod M
        const encodedValue = (index + perturbValue) % MAX_VALUE;

        // 2. 将值转换为狗叫词序列
        encoded.push(valueToDogSpeak(encodedValue));
    }
    
    // 使用 ' | ' 分隔每个字符转换后的狗叫词序列，确保可读性和解码稳定性
    return encoded.join(' | ').replace(/\s{2,}/g, ' ').trim();
}

/**
 * 还原函数 (Decode)
 */
function decodeFromDogSpeak(dogSpeak, key) {
    if (!dogSpeak.trim()) return "汪？请输入要还原的汪星语。";

    const perturbValue = getPerturbValue(key);
    let decoded = [];
    
    // 1. 通过 ' | ' 分割，获取每个字符的狗叫密语块 (例如: "汪 嗷嗷 吠")
    const charBlocks = dogSpeak.split(' | ').filter(b => b.trim().length > 0);
    
    for (const block of charBlocks) {
        // 2. 将每个块分割成三个词
        const speakParts = block.trim().split(/\s+/).filter(w => w.length > 0);

        if (speakParts.length !== 3) {
            // 如果不是三个词，说明是未转换的原始字符或格式错误
            if (speakParts.length === 1 && CHAR_MAP.includes(speakParts[0])) {
                decoded.push(speakParts[0]); // 可能是未转换的单个字符
            } else {
                decoded.push('?'); // 格式错误，用问号代替
            }
            continue;
        }
        
        // 3. 将狗叫词序列还原为 EncodedValue
        const encodedValue = dogSpeakToValue(speakParts);

        if (encodedValue === null) {
            decoded.push('?'); // 词汇无法识别
            continue;
        }

        // 4. 还原原始索引: Index = (EncodedValue - PerturbValue + M) mod M
        const originalIndex = (encodedValue - perturbValue + MAX_VALUE) % MAX_VALUE; 
        
        // 5. 查找原始字符
        const originalChar = CHAR_MAP[originalIndex];
        decoded.push(originalChar);
    }
    
    return decoded.join('');
}


// ===========================================
// ⭐ 功能绑定 ⭐
// ===========================================

document.addEventListener('DOMContentLoaded', () => {
    // 转换 (Encode) 元素
    const dogEncodeBtn = document.getElementById('dogEncodeBtn');
    const dogInputText = document.getElementById('dogInputText');
    const dogEncodeKey = document.getElementById('dogEncodeKey');
    const dogOutputLog = document.getElementById('dogOutputLog');

    // 还原 (Decode) 元素
    const dogDecodeBtn = document.getElementById('dogDecodeBtn');
    const dogInputSpeak = document.getElementById('dogInputSpeak');
    const dogDecodeKey = document.getElementById('dogDecodeKey');
    const dogDecodeLog = document.getElementById('dogDecodeLog');


    // 绑定转换事件
    if (dogEncodeBtn) {
        dogEncodeBtn.onclick = () => {
            const text = dogInputText.value;
            const key = dogEncodeKey.value.trim();

            if (!text) {
                dogOutputLog.textContent = '嗷！请输入要转换的文字。';
                return;
            }

            const encodedSpeak = encodeToDogSpeak(text, key);
            dogOutputLog.textContent = encodedSpeak;
            
            // 复制到剪贴板
            if (navigator.clipboard) {
                navigator.clipboard.writeText(encodedSpeak).then(() => {
                    dogEncodeBtn.textContent = '✅ 转换成功并已复制！';
                    // 自动填充到还原输入框 (方便测试)
                    if (dogInputSpeak) dogInputSpeak.value = encodedSpeak; 
                    
                    setTimeout(() => {
                        dogEncodeBtn.textContent = '🐕 开始转换 🐕';
                    }, 1500);
                });
            } else {
                 dogEncodeBtn.textContent = '🐕 转换完成 🐕';
            }
        };
    }

    // 绑定还原事件
    if (dogDecodeBtn) {
        dogDecodeBtn.onclick = () => {
            const speak = dogInputSpeak.value.trim();
            const key = dogDecodeKey.value.trim();

            if (!speak) {
                dogDecodeLog.textContent = '汪？请输入要还原的汪星语。';
                return;
            }

            const decodedText = decodeFromDogSpeak(speak, key);
            dogDecodeLog.textContent = decodedText;
            
            // 复制到剪贴板
             if (navigator.clipboard) {
                navigator.clipboard.writeText(decodedText).then(() => {
                    dogDecodeBtn.textContent = '✅ 还原成功并已复制！';
                    setTimeout(() => {
                        dogDecodeBtn.textContent = '🔓 开始还原 🔓';
                    }, 1500);
                });
            } else {
                 dogDecodeBtn.textContent = '🔓 还原完成 🔓';
            }
        };
    }
});
