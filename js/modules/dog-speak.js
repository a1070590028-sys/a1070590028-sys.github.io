// js/modules/dog-speak.js

// 用户指定的狗叫词汇
const DOG_SPEAK_WORDS = ["汪", "汪汪", "呜", "嗷嗷", "吠", "嗷呜"];

/**
 * 确定性随机数生成器 (SRNG)
 * 使用密钥生成一个可重复的随机数序列。
 * @param {string} seedText 种子文本 (密钥)
 * @returns {function(): number} 每次调用返回 0 到 1 之间的伪随机数
 */
function createSeededRandom(seedText) {
    let seed = 0;
    if (seedText) {
        // 使用简单的哈希算法生成种子
        for (let i = 0; i < seedText.length; i++) {
            seed = seed + seedText.charCodeAt(i) + (seed << 9);
        }
    }
    // 默认种子，如果密钥为空
    if (seed === 0) seed = 12345; 

    // LCG (线性同余生成器) 参数
    // m = 2^35 - 31 (一个大的梅森素数)
    const M = 2147483647; // 2^31 - 1
    const A = 16807;
    
    // 初始化种子
    let currentSeed = seed % M;
    if (currentSeed <= 0) currentSeed += M;

    return function() {
        // 更新种子
        currentSeed = (currentSeed * A) % M;
        // 返回 0 到 1 之间的浮点数
        return currentSeed / M;
    };
}

/**
 * 转换函数 (Encode)
 * 将普通文本转换为狗叫密语
 * @param {string} text 原始文本
 * @param {string} key 密钥
 * @returns {string} 狗叫密语
 */
function encodeToDogSpeak(text, key) {
    if (!text.trim()) {
        return "汪呜！请输入要转换的文字。";
    }

    // 初始化 SRNG，保证密钥相同的输入总是产生相同的密文
    const random = createSeededRandom(key);
    let dogSpeak = [];
    
    // 1. 拆分文本为字符数组 (支持中文、英文等)
    const characters = Array.from(text);

    for (let i = 0; i < characters.length; i++) {
        const char = characters[i];

        // 遇到空格或标点符号，则将其替换为分隔符或句式结束符
        if (/\s/.test(char) || /[。，？！；：\.,?!;:]/.test(char)) {
             // 随机添加一个句末/段末狗叫
            if (dogSpeak.length > 0 && dogSpeak[dogSpeak.length - 1] !== ' ') {
                dogSpeak.push(DOG_SPEAK_WORDS[Math.floor(random() * DOG_SPEAK_WORDS.length)] + "。");
            }
            // 使用空格分隔
            dogSpeak.push(" "); 
            continue;
        }

        // 遇到其他字符 (中文、英文、数字)，则进行替换
        
        // 2. 使用随机数选择狗叫词
        const wordIndex = Math.floor(random() * DOG_SPEAK_WORDS.length);
        const dogWord = DOG_SPEAK_WORDS[wordIndex];

        // 随机重复次数 (1 到 3 次)
        const repeatCount = Math.floor(random() * 3) + 1; 
        dogSpeak.push(dogWord.repeat(repeatCount));

        // 随机加入符号
        if (random() < 0.2) {
            dogSpeak.push("!");
        } else if (random() < 0.3) {
            dogSpeak.push("~");
        }
        
        // 每个有效字符转换后，小概率加一个分隔符
        if (random() < 0.3) {
            dogSpeak.push(" ");
        }
    }
    
    // 确保结尾干净并有结束符
    let finalSpeak = dogSpeak.join('').replace(/\s{2,}/g, ' ').trim();
    if (finalSpeak.length > 0 && finalSpeak[finalSpeak.length - 1] !== '。') {
        finalSpeak += "。";
    }

    return finalSpeak;
}


// ===========================================
// ⭐ 功能绑定 (仅保留 Encode) ⭐
// ===========================================

document.addEventListener('DOMContentLoaded', () => {
    // 转换 (Encode) 元素
    const dogEncodeBtn = document.getElementById('dogEncodeBtn');
    const dogInputText = document.getElementById('dogInputText');
    const dogEncodeKey = document.getElementById('dogEncodeKey');
    const dogOutputLog = document.getElementById('dogOutputLog');

    // 由于我们已经移除了还原功能，这里只绑定转换事件
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
            
            // 提示成功并复制到剪贴板
            if (navigator.clipboard) {
                navigator.clipboard.writeText(encodedSpeak).then(() => {
                    dogEncodeBtn.textContent = '✅ 转换成功并已复制！';
                    setTimeout(() => {
                        dogEncodeBtn.textContent = '🐕 开始转换为汪星语 🐕';
                    }, 1500);
                }).catch(err => {
                    // 复制失败处理 (例如浏览器权限限制)
                    console.error('复制失败:', err);
                    dogEncodeBtn.textContent = '⚠️ 转换完成，复制失败！';
                     setTimeout(() => {
                        dogEncodeBtn.textContent = '🐕 开始转换为汪星语 🐕';
                    }, 1500);
                });
            } else {
                 // 浏览器不支持 navigator.clipboard
                 dogEncodeBtn.textContent = '🐕 转换完成，请手动复制 🐕';
            }
        };
    }
});
