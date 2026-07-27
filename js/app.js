/**
 * CIIS OS - Punto de Entrada Principal (Orquestador)
 */

import { initDesktop } from './desktop.js';
import { initWindowManager, openWindow } from './windows.js';

// Mapeo de nombres e iconos institucionales para los módulos
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
    // 1. Inicializar HUD, Reloj y Menú de Inicio
    initDesktop();

    // 2. Inicializar Gestor de Ventanas
    initWindowManager();

    // 3. Registrar eventos en los botones del Menú de Inicio
    const appButtons = document.querySelectorAll('#start-menu .app-btn');
    appButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const moduleId = btn.getAttribute('data-module');
            const config = MODULE_CONFIG[moduleId] || { title: moduleId, icon: '📄' };

            openWindow(
                moduleId,
                config.title,
                `<div class="module-container">
                    <div class="module-header">
                        <h2>${config.icon} ${config.title}</h2>
                        <span class="status-badge">Estado: Operativo</span>
                    </div>
                    <hr class="module-divider">
                    <div class="module-body">
                        <p>Iniciando módulo de <strong>${config.title}</strong> dentro del entorno seguro de CIIS OS...</p>
                    </div>
                 </div>`
            );
        });
    });

    console.log('[CIIS OS] Sistema Operativo Web inicializado correctamente.');
});
