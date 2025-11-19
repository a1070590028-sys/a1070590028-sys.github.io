// js/modules/vanta-bg.js
document.addEventListener("DOMContentLoaded", () => {
    VANTA.NET({
        el: document.getElementById("vanta-bg"),
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200,
        minWidth: 200,
        scale: 1.0,
        scaleMobile: 1.0,
        color: 0x60a5fa,
        backgroundColor: 0x0f172a,
        points: 12,
        maxDistance: 22,
        spacing: 16
    });
});
