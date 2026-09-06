import { Kernel } from './kernel/eventBus.js';

const WindowManagerEvents = Object.freeze({
    WINDOW_CREATED: 'WINDOW_CREATED',
    WINDOW_OPENED: 'WINDOW_OPENED',
    WINDOW_CLOSED: 'WINDOW_CLOSED',
    WINDOW_MINIMIZED: 'WINDOW_MINIMIZED',
    WINDOW_RESTORED: 'WINDOW_RESTORED',
    WINDOW_FOCUSED: 'WINDOW_FOCUSED',
    WINDOW_MOVED: 'WINDOW_MOVED',
    WINDOW_MAXIMIZED: 'WINDOW_MAXIMIZED',
    WINDOW_UNMAXIMIZED: 'WINDOW_UNMAXIMIZED',
    WINDOW_MANAGER_READY: 'WINDOW_MANAGER_READY',
    WINDOW_MANAGER_ERROR: 'WINDOW_MANAGER_ERROR'
});

const DEFAULT_WINDOW_WIDTH = 640;
const DEFAULT_WINDOW_HEIGHT = 420;
const MIN_WINDOW_WIDTH = 280;
const MIN_WINDOW_HEIGHT = 180;

class WindowManager {
    constructor() {
        this.initialized = false;
        this.windows = new Map();
        this.activeWindowId = null;
        this.zIndex = 100;

        this.dom = {
            windowManager: null,
            desktopArea: null,
            taskbar: null
        };

        this.boundHandlers = {
            pointerDown: (event) => this.handlePointerDown(event),
            taskbarClick: (event) => this.handleTaskbarClick(event)
        };
    }

    initialize() {
        if (this.initialized) {
            return;
        }

        try {
            this.resolveDOM();
            this.validateDOM();
            this.createTaskbar();
            this.bindEvents();

            this.initialized = true;

            Kernel.publish(WindowManagerEvents.WINDOW_MANAGER_READY, {
                initialized: true
            });
        } catch (error) {
            this.handleError(error);
        }
    }

    resolveDOM() {
        this.dom.windowManager = document.getElementById('window-manager');
        this.dom.desktopArea = document.getElementById('desktop-area');
    }

    validateDOM() {
        if (!this.dom.windowManager) {
            throw new Error('WindowManager: #window-manager no encontrado.');
        }

        if (!this.dom.desktopArea) {
            throw new Error('WindowManager: #desktop-area no encontrado.');
        }
    }

    bindEvents() {
        this.dom.windowManager.addEventListener(
            'pointerdown',
            this.boundHandlers.pointerDown
        );

        if (this.dom.taskbar) {
            this.dom.taskbar.addEventListener(
                'click',
                this.boundHandlers.taskbarClick
            );
        }
    }

    unbindEvents() {
        if (this.dom.windowManager) {
            this.dom.windowManager.removeEventListener(
                'pointerdown',
                this.boundHandlers.pointerDown
            );
        }

        if (this.dom.taskbar) {
            this.dom.taskbar.removeEventListener(
                'click',
                this.boundHandlers.taskbarClick
            );
        }
    }

    createTaskbar() {
        if (this.dom.taskbar && this.dom.taskbar.isConnected) {
            return;
        }

        const existingTaskbar = document.getElementById(
            'ciis-window-taskbar'
        );

        if (existingTaskbar) {
            this.dom.taskbar = existingTaskbar;
            this.updateTaskbar();
            return;
        }

        const taskbar = document.createElement('nav');

        taskbar.id = 'ciis-window-taskbar';
        taskbar.setAttribute(
            'aria-label',
            'Ventanas minimizadas'
        );

        taskbar.style.position = 'absolute';
        taskbar.style.left = '10px';
        taskbar.style.right = '10px';
        taskbar.style.bottom = '10px';

        taskbar.style.minHeight = '44px';
        taskbar.style.maxHeight = '56px';

        taskbar.style.display = 'flex';
        taskbar.style.alignItems = 'center';
        taskbar.style.gap = '8px';

        taskbar.style.padding = '5px 8px';
        taskbar.style.boxSizing = 'border-box';

        taskbar.style.overflowX = 'auto';
        taskbar.style.overflowY = 'hidden';

        taskbar.style.pointerEvents = 'auto';
        taskbar.style.zIndex = '10000';

        taskbar.style.border =
            '1px solid rgba(0, 229, 255, 0.22)';

        taskbar.style.borderRadius = '8px';

        taskbar.style.background =
            'rgba(4, 7, 13, 0.88)';

        taskbar.style.backdropFilter =
            'blur(14px)';

        taskbar.style.webkitBackdropFilter =
            'blur(14px)';

        taskbar.style.boxShadow =
            '0 8px 30px rgba(0, 0, 0, 0.45)';

        taskbar.style.scrollbarWidth = 'thin';

        this.dom.windowManager.appendChild(taskbar);
        this.dom.taskbar = taskbar;

        this.updateTaskbar();
    }

    updateTaskbar() {
        if (!this.dom.taskbar) {
            return;
        }

        this.dom.taskbar.innerHTML = '';

        const minimizedWindows = Array.from(
            this.windows.values()
        ).filter((state) => state.minimized);

        if (minimizedWindows.length === 0) {
            this.dom.taskbar.hidden = true;
            return;
        }

        this.dom.taskbar.hidden = false;

        minimizedWindows.forEach((state) => {
            const button = document.createElement('button');

            button.type = 'button';
            button.className = 'taskbar-app-btn';

            button.dataset.windowId = state.id;

            button.setAttribute(
                'aria-label',
                `Restaurar ${state.title}`
            );

            /*
             * Presentación visual del botón.
             * La lógica de interacción continúa utilizando
             * el listener delegado de la barra.
             */
            button.style.minWidth = '180px';
            button.style.height = '44px';

            button.style.padding = '0 14px';
            button.style.boxSizing = 'border-box';

            button.style.display = 'inline-flex';
            button.style.alignItems = 'center';
            button.style.justifyContent = 'flex-start';

            button.style.gap = '10px';

            button.style.flex = '0 0 auto';

            button.style.borderRadius = '8px';

            button.style.fontSize = '14px';
            button.style.fontWeight = '600';

            button.style.overflow = 'hidden';
            button.style.whiteSpace = 'nowrap';

            button.style.cursor = 'pointer';
            button.style.touchAction = 'manipulation';

            /*
             * Icono de aplicación.
             */
            const icon = document.createElement('span');

            icon.className = 'taskbar-app-icon';
            icon.setAttribute('aria-hidden', 'true');
            icon.textContent = '▣';

            icon.style.width = '22px';
            icon.style.height = '22px';
            icon.style.minWidth = '22px';

            icon.style.display = 'inline-flex';
            icon.style.alignItems = 'center';
            icon.style.justifyContent = 'center';

            icon.style.fontSize = '15px';
            icon.style.lineHeight = '1';

            /*
             * Indicador de ventana minimizada.
             */
            const dot = document.createElement('span');

            dot.className = 'active-dot';
            dot.setAttribute('aria-hidden', 'true');

            dot.style.width = '8px';
            dot.style.height = '8px';
            dot.style.minWidth = '8px';

            dot.style.borderRadius = '50%';

            dot.style.display = 'inline-block';
            dot.style.flex = '0 0 auto';

            /*
             * Nombre de la aplicación.
             */
            const label = document.createElement('span');

            label.className = 'taskbar-app-label';
            label.textContent = state.title;

            label.style.display = 'block';

            label.style.minWidth = '0';

            label.style.overflow = 'hidden';
            label.style.textOverflow = 'ellipsis';
            label.style.whiteSpace = 'nowrap';

            label.style.flex = '1 1 auto';

            /*
             * Orden visual:
             * icono → nombre → indicador.
             */
            button.appendChild(icon);
            button.appendChild(label);
            button.appendChild(dot);

            this.dom.taskbar.appendChild(button);
        });
    }

    handleTaskbarClick(event) {
        if (!this.dom.taskbar) {
            return;
        }

        const button = event.target.closest(
            '[data-window-id]'
        );

        if (!button || !this.dom.taskbar.contains(button)) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const id = button.dataset.windowId;

        if (id) {
            this.restoreWindow(id);
        }
    }

    createWindow(options = {}) {
        if (!this.initialized) {
            this.initialize();
        }

        const id =
            options.id ||
            this.generateWindowId();

        if (this.windows.has(id)) {
            return this.windows.get(id);
        }

        const title =
            options.title ||
            'CIIS OS';

        const width = this.normalizeDimension(
            options.width,
            DEFAULT_WINDOW_WIDTH,
            MIN_WINDOW_WIDTH
        );

        const height = this.normalizeDimension(
            options.height,
            DEFAULT_WINDOW_HEIGHT,
            MIN_WINDOW_HEIGHT
        );

        const x =
            Number.isFinite(options.x)
                ? options.x
                : 40;

        const y =
            Number.isFinite(options.y)
                ? options.y
                : 40;

        const content =
            options.content || '';

        const element = this.buildWindowElement({
            id,
            title,
            width,
            height,
            x,
            y
        });

        const contentElement =
            element.querySelector(
                '.ciis-window-content'
            );

        if (contentElement) {
            if (typeof content === 'string') {
                contentElement.innerHTML = content;
            } else if (content instanceof Node) {
                contentElement.appendChild(content);
            }
        }

        this.dom.windowManager.appendChild(element);

        const state = {
            id,
            title,
            element,

            minimized: false,
            maximized: false,

            x,
            y,
            width,
            height,

            previousGeometry: null
        };

        this.windows.set(id, state);

        this.focusWindow(id);
        this.updateTaskbar();

        Kernel.publish(
            WindowManagerEvents.WINDOW_CREATED,
            {
                id,
                title
            }
        );

        return state;
    }

    buildWindowElement(options) {
        const {
            id,
            title,
            width,
            height,
            x,
            y
        } = options;

        const element =
            document.createElement('article');

        element.className = 'ciis-window';

        element.dataset.windowId = id;

        element.style.position = 'absolute';

        element.style.left = `${x}px`;
        element.style.top = `${y}px`;

        element.style.width = `${width}px`;
        element.style.height = `${height}px`;

        const header =
            document.createElement('header');

        header.className =
            'ciis-window-header';

        const titleElement =
            document.createElement('span');

        titleElement.className =
            'ciis-window-title';

        titleElement.textContent = title;

        const controls =
            document.createElement('div');

        controls.className =
            'ciis-window-controls';

        const minimizeButton =
            document.createElement('button');

        minimizeButton.type = 'button';
        minimizeButton.className =
            'ciis-window-control';

        minimizeButton.dataset.windowAction =
            'minimize';

        minimizeButton.setAttribute(
            'aria-label',
            `Minimizar ${title}`
        );

        minimizeButton.textContent = '−';

        const maximizeButton =
            document.createElement('button');

        maximizeButton.type = 'button';
        maximizeButton.className =
            'ciis-window-control';

        maximizeButton.dataset.windowAction =
            'maximize';

        maximizeButton.setAttribute(
            'aria-label',
            `Maximizar ${title}`
        );

        maximizeButton.textContent = '□';

        const closeButton =
            document.createElement('button');

        closeButton.type = 'button';
        closeButton.className =
            'ciis-window-control';

        closeButton.dataset.windowAction =
            'close';

        closeButton.setAttribute(
            'aria-label',
            `Cerrar ${title}`
        );

        closeButton.textContent = '×';

        controls.appendChild(minimizeButton);
        controls.appendChild(maximizeButton);
        controls.appendChild(closeButton);

        header.appendChild(titleElement);
        header.appendChild(controls);

        const content =
            document.createElement('div');

        content.className =
            'ciis-window-content';

        element.appendChild(header);
        element.appendChild(content);

        return element;
    }

    openWindow(id) {
        const state = this.windows.get(id);

        if (!state) {
            return false;
        }

        state.minimized = false;

        state.element.hidden = false;

        this.focusWindow(id);
        this.updateTaskbar();

        Kernel.publish(
            WindowManagerEvents.WINDOW_OPENED,
            {
                id
            }
        );

        return true;
    }

    closeWindow(id) {
        const state = this.windows.get(id);

        if (!state) {
            return false;
        }

        state.element.remove();

        this.windows.delete(id);

        if (this.activeWindowId === id) {
            this.activeWindowId = null;
            this.activateMostRecentWindow();
        }

        this.updateTaskbar();

        Kernel.publish(
            WindowManagerEvents.WINDOW_CLOSED,
            {
                id
            }
        );

        return true;
    }

    minimizeWindow(id) {
        const state = this.windows.get(id);

        if (!state) {
            return false;
        }

        state.minimized = true;

        state.element.hidden = true;

        if (this.activeWindowId === id) {
            this.activeWindowId = null;
            this.activateMostRecentWindow();
        }

        this.updateTaskbar();

        Kernel.publish(
            WindowManagerEvents.WINDOW_MINIMIZED,
            {
                id
            }
        );

        return true;
    }

    restoreWindow(id) {
        const state = this.windows.get(id);

        if (!state) {
            return false;
        }

        state.minimized = false;

        state.element.hidden = false;

        this.focusWindow(id);
        this.updateTaskbar();

        Kernel.publish(
            WindowManagerEvents.WINDOW_RESTORED,
            {
                id
            }
        );

        return true;
    }

    toggleMaximize(id) {
        const state = this.windows.get(id);

        if (!state || state.minimized) {
            return false;
        }

        const element = state.element;

        if (state.maximized) {
            const previousGeometry =
                state.previousGeometry;

            element.classList.remove(
                'ciis-window-maximized'
            );

            element.style.position =
                'absolute';

            if (previousGeometry) {
                element.style.left =
                    `${previousGeometry.x}px`;

                element.style.top =
                    `${previousGeometry.y}px`;

                element.style.width =
                    `${previousGeometry.width}px`;

                element.style.height =
                    `${previousGeometry.height}px`;

                state.x =
                    previousGeometry.x;

                state.y =
                    previousGeometry.y;

                state.width =
                    previousGeometry.width;

                state.height =
                    previousGeometry.height;
            }

            state.maximized = false;
            state.previousGeometry = null;

            Kernel.publish(
                WindowManagerEvents.WINDOW_UNMAXIMIZED,
                {
                    id
                }
            );

            this.focusWindow(id);

            return true;
        }

        const managerRect =
            this.dom.windowManager.getBoundingClientRect();

        const elementRect =
            element.getBoundingClientRect();

        state.previousGeometry = {
            x:
                elementRect.left -
                managerRect.left,

            y:
                elementRect.top -
                managerRect.top,

            width:
                elementRect.width,

            height:
                elementRect.height
        };

        const width =
            this.dom.windowManager.clientWidth;

        const height =
            this.dom.windowManager.clientHeight;

        element.classList.remove(
            'ciis-window-maximized'
        );

        element.style.position =
            'absolute';

        element.style.left = '0px';
        element.style.top = '0px';

        element.style.width =
            `${width}px`;

        element.style.height =
            `${height}px`;

        state.x = 0;
        state.y = 0;

        state.width = width;
        state.height = height;

        state.maximized = true;

        element.classList.add(
            'ciis-window-maximized'
        );

        element.style.setProperty(
            'left',
            '0px',
            'important'
        );

        element.style.setProperty(
            'top',
            '0px',
            'important'
        );

        element.style.setProperty(
            'width',
            `${width}px`,
            'important'
        );

        element.style.setProperty(
            'height',
            `${height}px`,
            'important'
        );

        Kernel.publish(
            WindowManagerEvents.WINDOW_MAXIMIZED,
            {
                id
            }
        );

        this.focusWindow(id);

        return true;
    }

    focusWindow(id) {
        const state = this.windows.get(id);

        if (!state || state.minimized) {
            return false;
        }

        this.zIndex += 1;

        state.element.style.zIndex =
            String(this.zIndex);

        this.activeWindowId = id;

        this.windows.forEach(
            (windowState) => {
                windowState.element.classList.toggle(
                    'ciis-window-active',
                    windowState.id === id
                );
            }
        );

        Kernel.publish(
            WindowManagerEvents.WINDOW_FOCUSED,
            {
                id
            }
        );

        return true;
    }

    moveWindow(id, x, y) {
        const state = this.windows.get(id);

        if (
            !state ||
            state.minimized ||
            state.maximized
        ) {
            return false;
        }

        if (
            !Number.isFinite(x) ||
            !Number.isFinite(y)
        ) {
            return false;
        }

        state.x = x;
        state.y = y;

        state.element.style.left =
            `${x}px`;

        state.element.style.top =
            `${y}px`;

        Kernel.publish(
            WindowManagerEvents.WINDOW_MOVED,
            {
                id,
                x,
                y
            }
        );

        return true;
    }

    handlePointerDown(event) {
        const windowElement =
            event.target.closest(
                '.ciis-window'
            );

        if (!windowElement) {
            return;
        }

        const id =
            windowElement.dataset.windowId;

        if (!id) {
            return;
        }

        this.focusWindow(id);

        const actionElement =
            event.target.closest(
                '[data-window-action]'
            );

        if (!actionElement) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const action =
            actionElement.dataset.windowAction;

        switch (action) {
            case 'minimize':
                this.minimizeWindow(id);
                break;

            case 'maximize':
                this.toggleMaximize(id);
                break;

            case 'close':
                this.closeWindow(id);
                break;

            default:
                break;
        }
    }

    activateMostRecentWindow() {
        const visibleWindows =
            Array.from(
                this.windows.values()
            ).filter(
                (state) =>
                    !state.minimized &&
                    state.element.isConnected
            );

        if (visibleWindows.length === 0) {
            return;
        }

        visibleWindows.sort(
            (a, b) =>
                Number(b.element.style.zIndex || 0) -
                Number(a.element.style.zIndex || 0)
        );

        this.focusWindow(
            visibleWindows[0].id
        );
    }

    getWindow(id) {
        return this.windows.get(id) || null;
    }

    hasWindow(id) {
        return this.windows.has(id);
    }

    getWindows() {
        return Array.from(
            this.windows.values()
        );
    }

    normalizeDimension(
        value,
        fallback,
        minimum
    ) {
        const numeric =
            Number(value);

        if (!Number.isFinite(numeric)) {
            return fallback;
        }

        return Math.max(
            numeric,
            minimum
        );
    }

    generateWindowId() {
        return `window-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`;
    }

    escapeHTML(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    destroy() {
        this.unbindEvents();

        this.windows.forEach(
            (state) => {
                state.element.remove();
            }
        );

        this.windows.clear();

        if (this.dom.taskbar) {
            this.dom.taskbar.remove();
        }

        this.dom.taskbar = null;
        this.activeWindowId = null;
        this.initialized = false;
    }

    handleError(error) {
        console.error(
            '[WindowManager]',
            error
        );

        Kernel.publish(
            WindowManagerEvents.WINDOW_MANAGER_ERROR,
            {
                message:
                    error?.message ||
                    String(error)
            }
        );
    }
}

const windowManager =
    new WindowManager();

export {
    WindowManager,
    windowManager,
    WindowManagerEvents
};