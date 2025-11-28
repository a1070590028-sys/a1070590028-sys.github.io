// js/modules/encryption.js (简化后)

// 移除 MOCK_CARRIER_IMAGES 数组和 initCarrierImageSelector 函数
// 因为用户不再通过下拉菜单选择，而是通过输入框（模拟）或服务器选择（未来）

// 占位函数，确保 main.js 导入时不报错
export function initEncryptionModule() {
    console.log('Encryption module initialized.');
}

// 确保在 DOM 加载完成后执行初始化
document.addEventListener('DOMContentLoaded', () => {
    initEncryptionModule();
});

export default {
    initEncryptionModule
};
