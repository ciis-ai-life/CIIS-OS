import { Kernel } from './kernel.js';
import { WindowManager } from './windows.js';

export const Desktop = {
    init() {
        this.initClock();
        this.initStartMenu();
    },
    initClock() {
        setInterval(() => {
            const d = new Date();
            document.getElementById('current-time').textContent = d.toLocaleTimeString('es-MX', {hour12:false});
            document.getElementById('tray-clock').textContent = d.toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit', hour12:false});
        }, 1000);
    },
    initStartMenu() {
        const menu = document.getElementById('start-menu');
        const btn = document.getElementById('start-button');
        const grid = document.getElementById('start-menu-grid');
        
        btn.onclick = (e) => { e.stopPropagation(); menu.classList.toggle('hidden'); };
        document.onclick = (e) => { if(!menu.contains(e.target) && !btn.contains(e.target)) menu.classList.add('hidden'); };

        // Renderizar iconos de aplicaciones basados en los módulos del Kernel
        Kernel.getModules().forEach(mod => {
            const appBtn = document.createElement('button');
            appBtn.className = 'app-btn';
            appBtn.textContent = mod.title;
            appBtn.onclick = () => { WindowManager.open(mod); menu.classList.add('hidden'); };
            grid.appendChild(appBtn);
        });
    }
};
