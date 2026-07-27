/**
 * CIIS OS - Módulo de Escritorio y Telemetría HUD
 */

export function initDesktop() {
    initClock();
    initHardwareTelemetry();
    initStartMenu();
}

function initClock() {
    const timeElem = document.getElementById('current-time');
    const trayClockElem = document.getElementById('tray-clock');

    function updateClock() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');

        if (timeElem) timeElem.textContent = `${hours}:${minutes}:${seconds}`;
        if (trayClockElem) trayClockElem.textContent = `${hours}:${minutes}`;
    }

    updateClock();
    setInterval(updateClock, 1000);
}

function initHardwareTelemetry() {
    const cpuElem = document.getElementById('hw-cpu');
    const ramElem = document.getElementById('hw-ram');
    const netElem = document.getElementById('hw-net');

    setInterval(() => {
        if (cpuElem) {
            const cpuVal = Math.floor(Math.random() * 8) + 2; // Simulación 2% - 10%
            cpuElem.textContent = `${cpuVal}%`;
        }
        if (ramElem) {
            const ramVal = (18 + Math.sin(Date.now() / 5000) * 2).toFixed(1);
            ramElem.textContent = `${ramVal}%`;
        }
        if (netElem) {
            netElem.textContent = 'ON';
        }
    }, 3000);
}

function initStartMenu() {
    const startBtn = document.getElementById('start-button');
    const startMenu = document.getElementById('start-menu');

    if (startBtn && startMenu) {
        startBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            startMenu.classList.toggle('hidden');
        });

        // Cerrar menú al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (!startMenu.contains(e.target) && !startBtn.contains(e.target)) {
                startMenu.classList.add('hidden');
            }
        });
    }
}
