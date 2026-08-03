/**
 * CIIS OS - Gestor de Ventanas Profesional (Window Manager con Auditoría)
 */
import { Kernel } from '../src/kernel/eventBus.js';

let highestZIndex = 100;
let windowCascadeOffset = 0;

export function initWindowManager() {
    console.log('[CIIS OS] Gestor de Ventanas Avanzado Inicializado.');
}

export function openWindow(id, title, htmlContent) {
    const wm = document.getElementById('window-manager');
    const runningApps = document.getElementById('running-apps');
    
    // Si la ventana ya existe, la traemos al frente
    let win = document.getElementById(`win-${id}`);
    if (win) {
        if (win.classList.contains('minimized')) {
            win.classList.remove('minimized');
        }
        bringToFront(win);
        updateTaskbarActiveState(id);
        return;
    }

    // Calcular posición escalonada (cascada)
    const topPos = 60 + (windowCascadeOffset % 150);
    const leftPos = 80 + (windowCascadeOffset % 250);
    windowCascadeOffset += 30;

    // Crear la estructura de la ventana
    win = document.createElement('div');
    win.id = `win-${id}`;
    win.className = 'window';
    win.style.top = `${topPos}px`;
    win.style.left = `${leftPos}px`;
    win.style.zIndex = ++highestZIndex;

    win.innerHTML = `
        <div class="window-header">
            <span class="window-title">${title}</span>
            <div class="window-controls">
                <button class="window-btn btn-minimize" title="Minimizar"></button>
                <button class="window-btn btn-maximize" title="Maximizar"></button>
                <button class="window-btn btn-close" title="Cerrar"></button>
            </div>
        </div>
        <div class="window-body">${htmlContent}</div>
    `;

    wm.appendChild(win);

    // Registrar en la Barra de Tareas
    let taskBtn = document.getElementById(`task-btn-${id}`);
    if (!taskBtn) {
        taskBtn = document.createElement('button');
        taskBtn.id = `task-btn-${id}`;
        taskBtn.className = 'taskbar-app-btn active';
        taskBtn.innerText = title;
        taskBtn.addEventListener('click', () => toggleWindow(id));
        runningApps.appendChild(taskBtn);
    }

    // Eventos de la ventana
    win.addEventListener('mousedown', () => bringToFront(win));
    makeDraggable(win);

    // Botones de control
    win.querySelector('.btn-close').addEventListener('click', () => closeWindow(id));
    win.querySelector('.btn-minimize').addEventListener('click', () => minimizeWindow(id));
    win.querySelector('.btn-maximize').addEventListener('click', () => toggleMaximize(win));

    updateTaskbarActiveState(id);

    // 🛡️ Registrar apertura de ventana en el Motor de Auditoría
    Kernel.publish('UI_WINDOW_OPEN', { window_id: id, window_title: title }, { severity: 'INFO' });
}

function bringToFront(win) {
    highestZIndex++;
    win.style.zIndex = highestZIndex;
    const id = win.id.replace('win-', '');
    updateTaskbarActiveState(id);
}

function toggleWindow(id) {
    const win = document.getElementById(`win-${id}`);
    if (!win) return;

    if (win.classList.contains('minimized')) {
        win.classList.remove('minimized');
        bringToFront(win);
    } else if (parseInt(win.style.zIndex) === highestZIndex) {
        win.classList.add('minimized');
        updateTaskbarActiveState(null);
    } else {
        bringToFront(win);
    }
}

function minimizeWindow(id) {
    const win = document.getElementById(`win-${id}`);
    if (win) {
        win.classList.add('minimized');
        updateTaskbarActiveState(null);
    }
}

function closeWindow(id) {
    const win = document.getElementById(`win-${id}`);
    if (win) win.remove();

    const taskBtn = document.getElementById(`task-btn-${id}`);
    if (taskBtn) taskBtn.remove();

    // 🛡️ Registrar cierre de ventana en el Motor de Auditoría
    Kernel.publish('UI_WINDOW_CLOSE', { window_id: id }, { severity: 'INFO' });
}

function toggleMaximize(win) {
    win.classList.toggle('maximized');
}

function updateTaskbarActiveState(activeId) {
    document.querySelectorAll('.taskbar-app-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (activeId) {
        const activeBtn = document.getElementById(`task-btn-${activeId}`);
        if (activeBtn) activeBtn.classList.add('active');
    }
}

// Lógica de Arrastre (Drag & Drop)
function makeDraggable(win) {
    const header = win.querySelector('.window-header');
    let isDragging = false;
    let offsetX = 0, offsetY = 0;

    header.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('window-btn')) return;
        isDragging = true;
        offsetX = e.clientX - win.offsetLeft;
        offsetY = e.clientY - win.offsetTop;
        bringToFront(win);
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging || win.classList.contains('maximized')) return;
        win.style.left = `${e.clientX - offsetX}px`;
        win.style.top = `${e.clientY - offsetY}px`;
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}