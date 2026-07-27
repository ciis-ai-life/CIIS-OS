/**
 * CIIS OS - Gestor de Ventanas (WindowManager)
 */

let activeZIndex = 100;
const openWindows = new Map();

export function initWindowManager() {
    // Inicialización de escuchas o estados del WindowManager
}

export function openWindow(moduleId, title, contentHtml) {
    const windowManager = document.getElementById('window-manager');
    const startMenu = document.getElementById('start-menu');

    // Ocultar Menú de Inicio al abrir módulo
    if (startMenu) startMenu.classList.add('hidden');

    // Si la ventana ya existe, la enfoca y la muestra
    if (openWindows.has(moduleId)) {
        const existingWin = openWindows.get(moduleId);
        existingWin.style.display = 'flex';
        bringToFront(existingWin);
        return;
    }

    // Crear la ventana principal
    const win = document.createElement('div');
    win.className = 'ciis-window';
    win.id = `win-${moduleId}`;
    win.style.zIndex = ++activeZIndex;

    // Posicionamiento escalonado
    const offset = (openWindows.size % 5) * 25;
    win.style.top = `${80 + offset}px`;
    win.style.left = `${100 + offset}px`;

    win.innerHTML = `
        <div class="window-header">
            <div class="window-title">
                <span class="win-icon">⚙</span>
                <span>${title}</span>
            </div>
            <div class="window-controls">
                <button class="win-btn win-minimize" title="Minimizar">—</button>
                <button class="win-btn win-maximize" title="Maximizar">□</button>
                <button class="win-btn win-close" title="Cerrar">✕</button>
            </div>
        </div>
        <div class="window-content">
            ${contentHtml || `<div class="module-placeholder"><h3>Módulo ${title}</h3><p>Conectando con el motor de cómputo...</p></div>`}
        </div>
    `;

    windowManager.appendChild(win);
    openWindows.set(moduleId, win);

    // Agregar elemento a la Barra de Tareas
    addTaskbarItem(moduleId, title);

    // Eventos de la ventana
    win.addEventListener('mousedown', () => bringToFront(win));

    // Permitir arrastrar la ventana desde el encabezado
    makeDraggable(win, win.querySelector('.window-header'));

    // Botones de control
    win.querySelector('.win-close').addEventListener('click', () => closeWindow(moduleId));
    win.querySelector('.win-minimize').addEventListener('click', () => {
        win.style.display = 'none';
    });
    win.querySelector('.win-maximize').addEventListener('click', () => {
        win.classList.toggle('maximized');
    });
}

export function closeWindow(moduleId) {
    if (openWindows.has(moduleId)) {
        const win = openWindows.get(moduleId);
        win.remove();
        openWindows.delete(moduleId);
        removeTaskbarItem(moduleId);
    }
}

function bringToFront(win) {
    activeZIndex++;
    win.style.zIndex = activeZIndex;
}

function makeDraggable(win, header) {
    let posX = 0, posY = 0, mouseX = 0, mouseY = 0;

    header.onmousedown = (e) => {
        if (e.target.classList.contains('win-btn')) return;
        e.preventDefault();
        mouseX = e.clientX;
        mouseY = e.clientY;

        document.onmousemove = (e) => {
            e.preventDefault();
            posX = mouseX - e.clientX;
            posY = mouseY - e.clientY;
            mouseX = e.clientX;
            mouseY = e.clientY;

            win.style.top = (win.offsetTop - posY) + "px";
            win.style.left = (win.offsetLeft - posX) + "px";
        };

        document.onmouseup = () => {
            document.onmousemove = null;
            document.onmouseup = null;
        };
    };
}

function addTaskbarItem(moduleId, title) {
    const runningApps = document.getElementById('running-apps');
    if (!runningApps) return;

    const btn = document.createElement('button');
    btn.className = 'taskbar-app-btn active';
    btn.id = `dock-item-${moduleId}`;
    btn.title = title;
    btn.textContent = title;

    btn.addEventListener('click', () => {
        const win = openWindows.get(moduleId);
        if (win) {
            if (win.style.display === 'none') {
                win.style.display = 'flex';
                bringToFront(win);
            } else if (parseInt(win.style.zIndex) === activeZIndex) {
                win.style.display = 'none';
            } else {
                bringToFront(win);
            }
        }
    });

    runningApps.appendChild(btn);
}

function removeTaskbarItem(moduleId) {
    const item = document.getElementById(`dock-item-${moduleId}`);
    if (item) item.remove();
}
