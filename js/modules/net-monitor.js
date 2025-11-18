class NetworkMonitor {
    constructor() {
        this.btn = document.getElementById("net-monitor-btn");
        this.panel = document.getElementById("net-monitor-panel");
        this.statusEl = document.getElementById("nm-status");
        this.requestEl = document.getElementById("nm-request");
        this.speedEl = document.getElementById("nm-speed");
        this.latencyEl = document.getElementById("nm-latency");

        this.btn.onclick = () => this.toggle();
        window.addEventListener("online", () => this.update());
        window.addEventListener("offline", () => this.update());
        this.update();
        setInterval(() => this.update(), 5000);
    }

    toggle() {
        this.panel.style.display = (this.panel.style.display === "block") ? "none" : "block";
    }

    update() {
        this.statusEl.textContent = navigator.onLine ? "在线" : "离线";
        this.testRequest();
        this.testSpeed();
        this.testLatency();
    }

    async testRequest() {
        const url = "net/test.png?t=" + Date.now();
        const t1 = performance.now();
        try {
            await fetch(url, { cache: "no-store" });
            this.requestEl.textContent = (performance.now() - t1).toFixed(1) + " ms";
        } catch { this.requestEl.textContent = "失败"; }
    }

    async testSpeed() {
        const url = "net/test_1mb.bin?t=" + Date.now();
        const size = 1048576;
        const t1 = performance.now();
        try {
            const res = await fetch(url);
            await res.arrayBuffer();
            const sec = (performance.now() - t1) / 1000;
            this.speedEl.textContent = (size / sec / 1024 / 1024).toFixed(2) + " MB/s";
        } catch { this.speedEl.textContent = "失败"; }
    }

    async testLatency() {
        const url = "net/ping.txt?t=" + Date.now();
        const t1 = performance.now();
        try {
            await fetch(url, { method: "HEAD", cache: "no-store" });
            this.latencyEl.textContent = (performance.now() - t1).toFixed(1) + " ms";
        } catch { this.latencyEl.textContent = "失败"; }
    }
}

new NetworkMonitor();
