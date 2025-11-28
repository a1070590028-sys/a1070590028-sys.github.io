// js/modules/encryption.js

/**
 * 模拟 /picture 目录下的图片列表
 * 实际应用中，此列表可能需要通过服务器端 API 获取
 */
const MOCK_CARRIER_IMAGES = [
    'default_cover.jpg',
    'bg_pattern.png',
    'secret_carrier.webp',
    'user_image_1.jpeg',
    'landscape_1080p.png'
];

/**
 * 初始化加密模块的图片载体选择下拉菜单 (#carrierImage)
 */
export function initCarrierImageSelector() {
    const selector = document.getElementById('carrierImage');
    if (!selector) return;

    // 清除占位符并设置默认选项
    selector.innerHTML = '<option value="" disabled selected>请选择一张图片作为载体...</option>';

    MOCK_CARRIER_IMAGES.forEach(fileName => {
        const option = document.createElement('option');
        option.value = fileName;
        option.textContent = fileName;
        selector.appendChild(option);
    });
    
    console.log('Encryption module initialized: Carrier image list loaded.');
}

// 确保在 DOM 加载完成后执行初始化
document.addEventListener('DOMContentLoaded', () => {
    initCarrierImageSelector();
});

// 导出所有功能以备将来在其他模块中调用
export default {
    initCarrierImageSelector
};
