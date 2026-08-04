/**
 * @file app.js
 * @description Punto de entrada principal de CIIS OS (API Real del Kernel).
 */
import { Kernel } from '../src/kernel/eventBus.js';
import { initDesktop } from './desktop.js';
import { initWindowManager, openWindow } from './windows.js';
import { getCiismatriaHTML, initCiismatriaEvents } from './ciismatria.js';
import { PIC140 } from '../src/pic140/pic140.js';

const MODULE_CONFIG = {
    dashboard: { title: 'Dashboard General', icon: '📊' },
    ciismatria: { title: 'CIISMATRÍA', icon: '🔢' },
    expedientes: { title: 'Expedientes', icon: '📂' },
    investigaciones: { title: 'Investigaciones', icon: '🔍' },
    archivo: { title: 'Archivo Histórico', icon: '🗄️' },
    protocolos: { title: 'Protocolos de Identidad', icon: '📜' },
    auditoria: { title: 'Auditoría', icon: '🛡️' },
    consola: { title: 'Consola del Sistema', icon: '💻' },
    configuracion: { title: 'Configuración', icon: '⚙️' }
};

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Levantar el entorno visual base de inmediato (Reloj, HUD, Menú)
    initDesktop();
    initWindowManager();

    // 2. Inicializar el motor de auditoría PIC-140 de forma segura
    try {
        await PIC140.init();
        
        // Publicar evento inicial al Bus de Eventos
        Kernel.publish('SYS_KERNEL_START', {
            client: navigator.userAgent,
            resolution: `${window.innerWidth}x${window.innerHeight}`
        }, { severity: 'INFO' });

    } catch (error) {
        console.error("⚠️ Advertencia en subsistema de auditoría PIC-140:", error);
    }

    // 3. Configurar eventos de los botones del menú de inicio con cierre automático
    const appButtons = document.querySelectorAll('#start-menu .app-btn');
    appButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const startMenu = document.getElementById('start-menu');
            if (startMenu) startMenu.classList.add('hidden');

            const moduleId = btn.getAttribute('data-module');
            const config = MODULE_CONFIG[moduleId] || { title: moduleId, icon: '📄' };

            // Publicar apertura de módulo a la cadena de auditoría
            Kernel.publish('UI_MODULE_OPEN', {
                module_id: moduleId,
                module_title: config.title
            }, { severity: 'INFO' });

            let content = '';
            if (moduleId === 'ciismatria') {
                content = getCiismatriaHTML();
            } else {
                content = `<div class="module-container">
                    <div class="module-header">
                        <h2>${config.icon} ${config.title}</h2>
                        <span class="status-badge">Estado: Operativo</span>
                    </div>
                    <hr class="module-divider">
                    <div class="module-body">
                        <p>Iniciando módulo de <strong>${config.title}</strong> dentro del entorno seguro de CIIS OS...</p>
                    </div>
                 </div>`;
            }

            openWindow(moduleId, `${config.icon} ${config.title}`, content);

            if (moduleId === 'ciismatria') {
                const winElem = document.getElementById(`win-${moduleId}`);
                if (winElem) initCiismatriaEvents(winElem);
            }
        });
    });

    console.log('%c[CIIS OS] Sistema de arranque completado con éxito.', 'color: #00e5ff; font-weight: bold;');
});