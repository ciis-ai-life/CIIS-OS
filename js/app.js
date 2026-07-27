/**
 * CIIS OS - Punto de Entrada Principal (Orquestador)
 */

import { Kernel } from './kernel.js';
import { initDesktop } from './desktop.js';
import { initWindowManager, openWindow } from './windows.js';
import { getCiismatriaHTML, initCiismatriaEvents } from './ciismatria.js';

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

document.addEventListener('DOMContentLoaded', () => {
    Kernel.init();

    Object.keys(MODULE_CONFIG).forEach(id => {
        Kernel.registerModule({ id, ...MODULE_CONFIG[id] });
    });

    initDesktop();
    initWindowManager();

    const appButtons = document.querySelectorAll('#start-menu .app-btn');
    appButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const moduleId = btn.getAttribute('data-module');
            const config = MODULE_CONFIG[moduleId] || { title: moduleId, icon: '📄' };

            let content = '';

            // Si es el módulo de CIISMATRÍA, cargamos su HTML dinámico
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

            // Si es CIISMATRÍA, activamos sus eventos en la ventana recién creada
            if (moduleId === 'ciismatria') {
                const winElem = document.getElementById(`win-${moduleId}`);
                if (winElem) initCiismatriaEvents(winElem);
            }
        });
    });

    console.log('[CIIS OS] Sistema Operativo Web inicializado correctamente.');
});
