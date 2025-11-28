// js/modules/dog-speak.js

// 🚨 关键词已更新为用户指定的中文狗叫词汇 🚨
const DOG_SPEAK_WORDS = ["汪", "汪汪", "呜", "嗷嗷", "吠", "嗷呜"];
const CHAR_MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789\u4e00\u4e01\u4e02\u4e03\u4e04\u4e05\u4e06\u4e07\u4e08\u4e09\u4e0a\u4e0b\u4e0c\u4e0d\u4e0e\u4e0f\u4f00\u4f01\u4f02\u4f03\u4f04\u4f05\u4f06\u4f07\u4f08\u4f09\u4f0a\u4f0b\u4f0c\u4f0d\u4f0e\u4f0f\u4800\u4801\u4802\u4803\u4804\u4805\u4806\u4807\u4808\u4809\u480a\u480b\u480c\u480d\u480e\u480f\u9fa5\u9fa6\u9fa7\u9fa8\u9fa9\u9faa\u9fab\u9fac\u9fad\u9fae\u9faf\u9fb0\u9fb1\u9fb2\u9fb3\u9fb4\u9fb5\u9fb6\u9fb7\u9fb8\u9fb9\u9fba\u9fbb\u9fbc\u9fbd\u9fbe\u9fbf\u9fc0\u9fc1\u9fc2\u9fc3\u9fc4\u9fc5\u9fc6\u9fc7\u9fc8\u9fc9\u9fca\u9fcb\u9fcc\u9fcd\u9fce\u9fcf\uff0c\uff01\uff1f\uff1b\uff1a\u3002\u3001\u300c\u300d"; // 字符映射表保持不变

/**
 * 简单哈希函数 (用于生成密钥模式)
 * @param {string} key 密钥
 * @returns {number} 0-99 的哈希值
 */
function simpleHash(key) {
    if (!key) return 0;
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash % 100);
}

/**
 * 转换函数 (Encode)
 * 将普通文本转换为狗叫密语
 * @param {string} text 原始文本
 * @param {string} key 密钥
 * @returns {string} 狗叫密语
 */
function encodeToDogSpeak(text, key) {
    const hash = simpleHash(key);
    let encoded = [];
    
    // 过滤掉不支持的字符，只保留 CHAR_MAP 中的字符进行转换
    const filteredText = Array.from(text).filter(char => CHAR_MAP.includes(char)).join('');

    for (const char of filteredText) {
        const index = CHAR_MAP.indexOf(char);
        
        // 实际上经过过滤，index 不会是 -1，但作为安全检查
        if (index === -1) {
            encoded.push(char);
            continue;
        }

        // 使用密钥扰乱索引: (原始索引 + 哈希值) % 词汇库大小
        const offset = (index + hash) % DOG_SPEAK_WORDS.length;
        const dogWord = DOG_SPEAK_WORDS[offset];
        
        // 每个转换词后加一个空格占位符，便于还原
        encoded.push(dogWord + " ");
    }
    
    return encoded.join('').trim();
}

/**
 * 还原函数 (Decode)
 * 将狗叫密语还原为普通文本
 * @param {string} dogSpeak 狗叫密语
 * @param {string} key 密钥
 * @returns {string} 还原文本
 */
function decodeFromDogSpeak(dogSpeak, key) {
    const hash = simpleHash(key);
    let decoded = [];
    
    // 1. 去除空白，并根据词汇库分割
    const parts = dogSpeak.split(/\s+/).filter(p => p.length > 0); 
    
    for (const part of parts) {
        const dogIndex = DOG_SPEAK_WORDS.indexOf(part);

        if (dogIndex === -1) {
            // 如果不是识别的狗叫词，说明密语格式有误或使用了非转换字符，用问号代替
             decoded.push('?');
            continue;
        }

        // 2. 还原索引: (狗叫索引 - 哈希值) % 词汇库大小，并确保结果为正数
        // 原始索引 = (狗叫索引 - 哈希值 + CHAR_MAP.length) % CHAR_MAP.length 
        // DOG_SPEAK_WORDS.length 只有 6 个，但 CHAR_MAP 非常大，所以这里应该是 % CHAR_MAP.length
        
        const decodedIndex = (dogIndex - hash);
        const originalIndex = (decodedIndex % CHAR_MAP.length + CHAR_MAP.length) % CHAR_MAP.length;
        
        // 3. 查找原始字符
        const originalChar = CHAR_MAP[originalIndex];
        decoded.push(originalChar);
    }
    
    return decoded.join('');
}


// ... (接下来的功能绑定代码不变)
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
            const text = dogInputText.value.trim();
            const key = dogEncodeKey.value.trim();

            if (!text) {
                dogOutputLog.textContent = '嗷！请输入要转换的文字。';
                return;
            }

            const encodedSpeak = encodeToDogSpeak(text, key);
            dogOutputLog.textContent = encodedSpeak;
            
            // 提示成功并复制到剪贴板
            if (navigator.clipboard) {
                navigator.clipboard.writeText(encodedSpeak).then(() => {
                    dogEncodeBtn.textContent = '✅ 转换成功并已复制！';
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
            
            // 提示成功并复制到剪贴板
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
