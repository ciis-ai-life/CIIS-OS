/**
 * @file app.js
 * @description Punto de entrada principal de CIIS OS.
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
    archivo: { title: 'Archivo Histórico', icon: '🄼' },
    protocolos: { title: 'Protocolos de Identidad', icon: '📜' },
    auditoria: { title: 'Auditoría', icon: '🛡️' },
    consola: { title: 'Consola del Sistema', icon: '💻' },
    configuracion: { title: 'Configuración', icon: '⚙️' }
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 0. Inicializar Motor de Auditoría Transversal PIC-140
        await PIC140.init();
    } catch (e) {
        console.error("Error al inicializar PIC140:", e);
    }

    // 1. Inicializar Kernel y registrar módulos
    Kernel.init();
    Object.keys(MODULE_CONFIG).forEach(id => {
        if (typeof Kernel.registerModule === 'function') {
            Kernel.registerModule({ id, ...MODULE_CONFIG[id] });
        }
    });
    
    // 2. Inicializar el entorno de escritorio (HUD, Reloj, Menú)
    initDesktop();
    
    // 3. Inicializar el Gestor de Ventanas y Aplicaciones
    initWindowManager();

    // 4. Configurar eventos de los botones del menú de inicio con cierre automático
    const appButtons = document.querySelectorAll('#start-menu .app-btn');
    appButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Ocultar el menú de inicio para que no obstruya la ventana abierta
            const startMenu = document.getElementById('start-menu');
            if (startMenu) startMenu.classList.add('hidden');

            const moduleId = btn.getAttribute('data-module');
            const config = MODULE_CONFIG[moduleId] || { title: moduleId, icon: '📄' };

            // Registrar apertura de módulo en el Kernel para la auditoría PIC-140
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

    // Mensaje de auditoría en consola nativa
    console.log('%c[CIIS OS] Sistema de arranque completado.', 'color: #00e5ff; font-weight: bold;');
    console.log('%c[CIIS OS] Entorno Glassmorphism y WindowManager activos.', 'color: #1de9b6;');
});