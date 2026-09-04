/**
 * CIIS OS
 * Window Manager
 *
 * Archivo:
 *     js/windows.js
 *
 * Responsabilidad:
 *     Administrar las ventanas dinámicas del escritorio:
 *
 *     - Crear ventanas.
 *     - Abrir ventanas.
 *     - Cerrar ventanas.
 *     - Minimizar ventanas.
 *     - Restaurar ventanas.
 *     - Maximizar ventanas.
 *     - Activar/focalizar ventanas.
 *     - Mover ventanas.
 *     - Administrar la barra de ventanas minimizadas.
 *
 * Arquitectura:
 *     - ES Modules nativos.
 *     - Exportaciones nombradas.
 *     - Sin dependencias externas.
 *     - Comunicación mediante Kernel/EventBus.
 *
 * IMPORTANTE:
 *     Este módulo administra ventanas.
 *     No contiene lógica de aplicaciones.
 */

import { Kernel } from './kernel/eventBus.js';


/* =========================================================
   EVENTOS
   ========================================================= */

const EVENTS = Object.freeze({

    WINDOW_CREATED:
        'WINDOW_CREATED',

    WINDOW_OPENED:
        'WINDOW_OPENED',

    WINDOW_CLOSED:
        'WINDOW_CLOSED',

    WINDOW_MINIMIZED:
        'WINDOW_MINIMIZED',

    WINDOW_RESTORED:
        'WINDOW_RESTORED',

    WINDOW_FOCUSED:
        'WINDOW_FOCUSED',

    WINDOW_MOVED:
        'WINDOW_MOVED',

    WINDOW_MAXIMIZED:
        'WINDOW_MAXIMIZED',

    WINDOW_UNMAXIMIZED:
        'WINDOW_UNMAXIMIZED',

    WINDOW_MANAGER_READY:
        'WINDOW_MANAGER_READY',

    WINDOW_MANAGER_ERROR:
        'WINDOW_MANAGER_ERROR',

});


/* =========================================================
   CONFIGURACIÓN
   ========================================================= */

const DEFAULT_WINDOW_WIDTH =
    640;

const DEFAULT_WINDOW_HEIGHT =
    420;

const MIN_WINDOW_WIDTH =
    280;

const MIN_WINDOW_HEIGHT =
    180;


/* =========================================================
   WINDOW MANAGER
   ========================================================= */

class WindowManager {

    constructor() {

        this.initialized =
            false;

        this.windows =
            new Map();

        this.activeWindowId =
            null;

        this.zIndex =
            100;


        this.dom = {

            windowManager:
                null,

            desktopArea:
                null,

            taskbar:
                null,

        };


        this.boundHandlers = {

            pointerDown:
                this.handlePointerDown.bind(this),

            taskbarClick:
                this.handleTaskbarClick.bind(this),

        };

    }


    /* =====================================================
       INICIALIZACIÓN
       ===================================================== */

    initialize() {

        if (this.initialized) {
            return;
        }


        try {

            this.resolveDOM();

            this.validateDOM();

            this.createTaskbar();

            this.bindEvents();

            this.initialized =
                true;


            Kernel.publish(
                EVENTS.WINDOW_MANAGER_READY,
                {
                    timestamp:
                        new Date().toISOString(),
                }
            );


            console.info(
                '[CIIS WindowManager] Inicializado correctamente.'
            );

        } catch (error) {

            this.handleError(error);

        }

    }


    /* =====================================================
       DOM
       ===================================================== */

    resolveDOM() {

        this.dom.windowManager =
            document.getElementById(
                'window-manager'
            );


        this.dom.desktopArea =
            document.getElementById(
                'desktop-area'
            );

    }


    validateDOM() {

        if (!this.dom.windowManager) {

            throw new Error(
                '[CIIS WindowManager] No existe #window-manager.'
            );

        }


        if (!this.dom.desktopArea) {

            throw new Error(
                '[CIIS WindowManager] No existe #desktop-area.'
            );

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


    /* =====================================================
       BARRA DE VENTANAS MINIMIZADAS
       ===================================================== */

    createTaskbar() {

        if (
            this.dom.taskbar &&
            this.dom.taskbar.isConnected
        ) {
            return;
        }


        const existingTaskbar =
            document.getElementById(
                'ciis-window-taskbar'
            );


        if (existingTaskbar) {

            this.dom.taskbar =
                existingTaskbar;

            this.updateTaskbar();

            return;

        }


        const taskbar =
            document.createElement(
                'nav'
            );


        taskbar.id =
            'ciis-window-taskbar';

        taskbar.setAttribute(
            'aria-label',
            'Ventanas minimizadas'
        );


        taskbar.style.position =
            'absolute';

        taskbar.style.left =
            '10px';

        taskbar.style.right =
            '10px';

        taskbar.style.bottom =
            '10px';

        taskbar.style.minHeight =
            '44px';

        taskbar.style.maxHeight =
            '56px';

        taskbar.style.display =
            'flex';

        taskbar.style.alignItems =
            'center';

        taskbar.style.gap =
            '8px';

        taskbar.style.padding =
            '5px 8px';

        taskbar.style.boxSizing =
            'border-box';

        taskbar.style.overflowX =
            'auto';

        taskbar.style.overflowY =
            'hidden';

        taskbar.style.pointerEvents =
            'auto';

        taskbar.style.zIndex =
            '10000';

        taskbar.style.border =
            '1px solid rgba(0, 229, 255, 0.22)';

        taskbar.style.borderRadius =
            '8px';

        taskbar.style.background =
            'rgba(4, 7, 13, 0.88)';

        taskbar.style.backdropFilter =
            'blur(14px)';

        taskbar.style.webkitBackdropFilter =
            'blur(14px)';

        taskbar.style.boxShadow =
            '0 8px 30px rgba(0, 0, 0, 0.45)';

        taskbar.style.scrollbarWidth =
            'thin';


        this.dom.windowManager.appendChild(
            taskbar
        );


        this.dom.taskbar =
            taskbar;


        this.updateTaskbar();

    }


    updateTaskbar() {

        if (!this.dom.taskbar) {
            return;
        }


        this.dom.taskbar.innerHTML =
            '';


        const minimizedWindows =
            Array.from(
                this.windows.values()
            ).filter(
                state =>
                    state.minimized
            );


        if (
            minimizedWindows.length ===
            0
        ) {

            this.dom.taskbar.hidden =
                true;

            return;

        }


        this.dom.taskbar.hidden =
            false;


        for (
            const state
            of minimizedWindows
        ) {

            const button =
                document.createElement(
                    'button'
                );


            button.type =
                'button';

            button.className =
                'taskbar-app-btn';

            button.dataset.windowId =
                state.id;

            button.setAttribute(
                'aria-label',
                `Restaurar ${state.title}`
            );


            const dot =
                document.createElement(
                    'span'
                );


            dot.className =
                'active-dot';

            dot.setAttribute(
                'aria-hidden',
                'true'
            );


            const label =
                document.createElement(
                    'span'
                );


            label.textContent =
                state.title;


            button.appendChild(
                dot
            );

            button.appendChild(
                label
            );


            this.dom.taskbar.appendChild(
                button
            );

        }

    }


    handleTaskbarClick(event) {

        const button =
            event.target.closest(
                '[data-window-id]'
            );


        if (!button) {
            return;
        }


        if (
            !this.dom.taskbar ||
            !this.dom.taskbar.contains(
                button
            )
        ) {
            return;
        }


        event.preventDefault();

        event.stopPropagation();


        const id =
            button.dataset.windowId;


        if (!id) {
            return;
        }


        this.restoreWindow(
            id
        );

    }


    /* =====================================================
       CREACIÓN
       ===================================================== */

    createWindow(options = {}) {

        if (!this.initialized) {

            throw new Error(
                '[CIIS WindowManager] No está inicializado.'
            );

        }


        const id =
            options.id ??
            this.generateWindowId();


        if (this.windows.has(id)) {

            throw new Error(
                `[CIIS WindowManager] Ya existe la ventana "${id}".`
            );

        }


        const title =
            options.title ??
            'CIIS OS';


        const width =
            this.normalizeDimension(
                options.width,
                DEFAULT_WINDOW_WIDTH,
                MIN_WINDOW_WIDTH
            );


        const height =
            this.normalizeDimension(
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
            options.content ??
            '';


        const windowElement =
            this.buildWindowElement({

                id,

                title,

                width,

                height,

                x,

                y,

            });


        const contentElement =
            windowElement.querySelector(
                '.ciis-window-content'
            );


        if (
            typeof content ===
            'string'
        ) {

            contentElement.innerHTML =
                content;

        }


        this.dom.windowManager.appendChild(
            windowElement
        );


        const windowState = {

            id,

            title,

            element:
                windowElement,

            minimized:
                false,

            maximized:
                false,

            x,

            y,

            width,

            height,

            previousGeometry:
                null,

        };


        this.windows.set(
            id,
            windowState
        );


        this.focusWindow(
            id
        );


        this.updateTaskbar();


        Kernel.publish(
            EVENTS.WINDOW_CREATED,
            {

                windowId:
                    id,

                title,

                timestamp:
                    new Date().toISOString(),

            }
        );


        return windowState;

    }


    /* =====================================================
       CONSTRUCCIÓN DE VENTANA
       ===================================================== */

    buildWindowElement(options) {

        const {

            id,

            title,

            width,

            height,

            x,

            y,

        } = options;


        const windowElement =
            document.createElement(
                'article'
            );


        windowElement.className =
            'ciis-window';


        windowElement.dataset.windowId =
            id;


        windowElement.style.position =
            'absolute';


        windowElement.style.left =
            `${x}px`;


        windowElement.style.top =
            `${y}px`;


        windowElement.style.width =
            `${width}px`;


        windowElement.style.height =
            `${height}px`;


        windowElement.innerHTML = `

            <header
                class="ciis-window-header"
            >

                <div
                    class="ciis-window-title"
                >
                    ${this.escapeHTML(title)}
                </div>


                <div
                    class="ciis-window-controls"
                >

                    <button
                        type="button"
                        class="ciis-window-button"
                        data-window-action="minimize"
                        aria-label="Minimizar ventana"
                    >
                        −
                    </button>


                    <button
                        type="button"
                        class="ciis-window-button"
                        data-window-action="maximize"
                        aria-label="Maximizar ventana"
                    >
                        □
                    </button>


                    <button
                        type="button"
                        class="ciis-window-button"
                        data-window-action="close"
                        aria-label="Cerrar ventana"
                    >
                        ×
                    </button>

                </div>

            </header>


            <div
                class="ciis-window-content"
            ></div>

        `;


        return windowElement;

    }


    /* =====================================================
       APERTURA
       ===================================================== */

    openWindow(id) {

        const windowState =
            this.getWindow(id);


        if (!windowState) {
            return false;
        }


        windowState.element.hidden =
            false;

        windowState.minimized =
            false;


        this.focusWindow(
            id
        );


        this.updateTaskbar();


        Kernel.publish(
            EVENTS.WINDOW_OPENED,
            {

                windowId:
                    id,

                timestamp:
                    new Date().toISOString(),

            }
        );


        return true;

    }


    /* =====================================================
       CIERRE
       ===================================================== */

    closeWindow(id) {

        const windowState =
            this.getWindow(id);


        if (!windowState) {
            return false;
        }


        windowState.element.remove();


        this.windows.delete(
            id
        );


        if (
            this.activeWindowId ===
            id
        ) {

            this.activeWindowId =
                null;

            this.activateMostRecentWindow();

        }


        this.updateTaskbar();


        Kernel.publish(
            EVENTS.WINDOW_CLOSED,
            {

                windowId:
                    id,

                timestamp:
                    new Date().toISOString(),

            }
        );


        return true;

    }


    /* =====================================================
       MINIMIZACIÓN
       ===================================================== */

    minimizeWindow(id) {

        const windowState =
            this.getWindow(id);


        if (!windowState) {
            return false;
        }


        windowState.element.hidden =
            true;

        windowState.minimized =
            true;


        if (
            this.activeWindowId ===
            id
        ) {

            this.activeWindowId =
                null;

            this.activateMostRecentWindow();

        }


        this.updateTaskbar();


        Kernel.publish(
            EVENTS.WINDOW_MINIMIZED,
            {

                windowId:
                    id,

                timestamp:
                    new Date().toISOString(),

            }
        );


        return true;

    }


    /* =====================================================
       RESTAURACIÓN
       ===================================================== */

    restoreWindow(id) {

        const windowState =
            this.getWindow(id);


        if (!windowState) {
            return false;
        }


        windowState.element.hidden =
            false;

        windowState.minimized =
            false;


        this.focusWindow(
            id
        );


        this.updateTaskbar();


        Kernel.publish(
            EVENTS.WINDOW_RESTORED,
            {

                windowId:
                    id,

                timestamp:
                    new Date().toISOString(),

            }
        );


        return true;

    }


    /* =====================================================
       MAXIMIZACIÓN
       ===================================================== */

    toggleMaximize(id) {

        const windowState =
            this.getWindow(id);


        if (!windowState) {
            return false;
        }


        const element =
            windowState.element;


        /*
         * =================================================
         * RESTAURAR
         * =================================================
         */

        if (
            windowState.maximized
        ) {

            const geometry =
                windowState.previousGeometry;


            if (geometry) {

                /*
                 * Primero eliminamos cualquier regla
                 * visual de maximización.
                 */

                element.classList.remove(
                    'ciis-window-maximized'
                );


                /*
                 * Restauramos geometría física.
                 */

                element.style.position =
                    'absolute';


                element.style.left =
                    `${geometry.x}px`;


                element.style.top =
                    `${geometry.y}px`;


                element.style.width =
                    `${geometry.width}px`;


                element.style.height =
                    `${geometry.height}px`;


                windowState.x =
                    geometry.x;


                windowState.y =
                    geometry.y;


                windowState.width =
                    geometry.width;


                windowState.height =
                    geometry.height;

            }


            windowState.maximized =
                false;


            windowState.previousGeometry =
                null;


            Kernel.publish(
                EVENTS.WINDOW_UNMAXIMIZED,
                {

                    windowId:
                        id,

                    timestamp:
                        new Date().toISOString(),

                }
            );


            this.focusWindow(
                id
            );


            return true;

        }


        /*
         * =================================================
         * MAXIMIZAR
         * =================================================
         *
         * IMPORTANTE:
         *
         * #window-manager ya está situado debajo de
         * #system-bar mediante:
         *
         *     top: 54px
         *
         * Por tanto, NO debemos calcular respecto a
         * #desktop ni respecto al viewport.
         *
         * Utilizamos directamente las dimensiones reales
         * del contenedor WindowManager.
         */

        const manager =
            this.dom.windowManager;


        if (!manager) {

            this.handleError(
                new Error(
                    '[CIIS WindowManager] #window-manager no está disponible.'
                )
            );

            return false;

        }


        const managerRect =
            manager.getBoundingClientRect();


        const rect =
            element.getBoundingClientRect();


        /*
         * Guardamos la geometría REAL antes de
         * maximizar.
         */

        const currentGeometry = {

            x:
                rect.left -
                managerRect.left,

            y:
                rect.top -
                managerRect.top,

            width:
                rect.width,

            height:
                rect.height,

        };


        windowState.previousGeometry =
            currentGeometry;


        /*
         * Dimensiones reales disponibles.
         *
         * No utilizamos window.innerWidth ni
         * window.innerHeight.
         */

        const maximizedWidth =
            Math.max(
                0,
                manager.clientWidth
            );


        const maximizedHeight =
            Math.max(
                0,
                manager.clientHeight
            );


        /*
         * Eliminamos primero cualquier regla
         * CSS anterior que pudiera interferir.
         */

        element.classList.remove(
            'ciis-window-maximized'
        );


        /*
         * Aplicamos la geometría maximizada
         * directamente en píxeles.
         */

        element.style.position =
            'absolute';


        element.style.left =
            '0px';


        element.style.top =
            '0px';


        element.style.width =
            `${maximizedWidth}px`;


        element.style.height =
            `${maximizedHeight}px`;


        /*
         * Estado interno.
         */

        windowState.x =
            0;

        windowState.y =
            0;

        windowState.width =
            maximizedWidth;

        windowState.height =
            maximizedHeight;

        windowState.maximized =
            true;


        /*
         * Añadimos la clase únicamente para permitir
         * estilos visuales, NO para definir geometría.
         */

        element.classList.add(
            'ciis-window-maximized'
        );


        /*
         * Importante:
         *
         * La clase CSS existente tiene reglas !important
         * para width/height/top/left.
         *
         * Las neutralizamos mediante propiedades inline
         * con prioridad important.
         */

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
            `${maximizedWidth}px`,
            'important'
        );


        element.style.setProperty(
            'height',
            `${maximizedHeight}px`,
            'important'
        );


        Kernel.publish(
            EVENTS.WINDOW_MAXIMIZED,
            {

                windowId:
                    id,

                width:
                    maximizedWidth,

                height:
                    maximizedHeight,

                timestamp:
                    new Date().toISOString(),

            }
        );


        this.focusWindow(
            id
        );


        return true;

    }


    /* =====================================================
       ENFOQUE
       ===================================================== */

    focusWindow(id) {

        const windowState =
            this.getWindow(id);


        if (!windowState) {
            return false;
        }


        this.zIndex += 1;


        windowState.element.style.zIndex =
            String(this.zIndex);


        this.activeWindowId =
            id;


        for (
            const [
                windowId,
                state
            ]
            of this.windows.entries()
        ) {

            state.element.classList.toggle(
                'ciis-window-active',
                windowId === id
            );

        }


        Kernel.publish(
            EVENTS.WINDOW_FOCUSED,
            {

                windowId:
                    id,

                timestamp:
                    new Date().toISOString(),

            }
        );


        return true;

    }


    /* =====================================================
       MOVIMIENTO
       ===================================================== */

    moveWindow(id, x, y) {

        const windowState =
            this.getWindow(id);


        if (!windowState) {
            return false;
        }


        if (
            !Number.isFinite(x) ||
            !Number.isFinite(y)
        ) {

            return false;

        }


        if (
            windowState.maximized
        ) {

            return false;

        }


        windowState.x =
            x;

        windowState.y =
            y;


        windowState.element.style.left =
            `${x}px`;


        windowState.element.style.top =
            `${y}px`;


        Kernel.publish(
            EVENTS.WINDOW_MOVED,
            {

                windowId:
                    id,

                x,

                y,

                timestamp:
                    new Date().toISOString(),

            }
        );


        return true;

    }


    /* =====================================================
       EVENTOS DE VENTANA
       ===================================================== */

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


        this.focusWindow(
            id
        );


        const actionButton =
            event.target.closest(
                '[data-window-action]'
            );


        if (!actionButton) {
            return;
        }


        /*
         * Evita que el clic en los controles
         * produzca comportamientos secundarios.
         */

        event.preventDefault();

        event.stopPropagation();


        const action =
            actionButton.dataset.windowAction;


        switch (action) {

            case 'minimize':

                this.minimizeWindow(
                    id
                );

                break;


            case 'maximize':

                this.toggleMaximize(
                    id
                );

                break;


            case 'close':

                this.closeWindow(
                    id
                );

                break;


            default:

                break;

        }

    }


    /* =====================================================
       ACTIVACIÓN AUTOMÁTICA
       ===================================================== */

    activateMostRecentWindow() {

        const windowStates =
            Array.from(
                this.windows.values()
            );


        if (
            windowStates.length ===
            0
        ) {

            return;

        }


        const visibleWindows =
            windowStates.filter(
                state =>
                    !state.minimized &&
                    !state.element.hidden
            );


        if (
            visibleWindows.length ===
            0
        ) {

            return;

        }


        visibleWindows.sort(
            (a, b) => {

                const za =
                    Number(
                        a.element.style.zIndex ||
                        0
                    );

                const zb =
                    Number(
                        b.element.style.zIndex ||
                        0
                    );

                return zb - za;

            }
        );


        const mostRecent =
            visibleWindows[0];


        this.focusWindow(
            mostRecent.id
        );

    }


    /* =====================================================
       CONSULTAS
       ===================================================== */

    getWindow(id) {

        return this.windows.get(
            id
        ) ?? null;

    }


    hasWindow(id) {

        return this.windows.has(
            id
        );

    }


    getWindows() {

        return Array.from(
            this.windows.values()
        );

    }


    /* =====================================================
       UTILIDADES
       ===================================================== */

    normalizeDimension(
        value,
        fallback,
        minimum
    ) {

        if (
            !Number.isFinite(value)
        ) {

            return fallback;

        }


        return Math.max(
            minimum,
            Math.round(value)
        );

    }


    generateWindowId() {

        return (
            'window-' +
            Date.now().toString(36) +
            '-' +
            Math.random()
                .toString(36)
                .slice(2, 8)
        );

    }


    escapeHTML(value) {

        return String(
            value ?? ''
        )
            .replace(
                /&/g,
                '&amp;'
            )
            .replace(
                /</g,
                '&lt;'
            )
            .replace(
                />/g,
                '&gt;'
            )
            .replace(
                /"/g,
                '&quot;'
            )
            .replace(
                /'/g,
                '&#039;'
            );

    }


    /* =====================================================
       DESTRUCCIÓN
       ===================================================== */

    destroy() {

        this.unbindEvents();


        for (
            const state
            of this.windows.values()
        ) {

            state.element.remove();

        }


        this.windows.clear();


        if (
            this.dom.taskbar
        ) {

            this.dom.taskbar.remove();

        }


        this.dom.taskbar =
            null;


        this.activeWindowId =
            null;


        this.initialized =
            false;


        this.zIndex =
            100;

    }


    /* =====================================================
       ERRORES
       ===================================================== */

    handleError(error) {

        console.error(
            '[CIIS WindowManager] Error.',
            error
        );


        Kernel.publish(
            EVENTS.WINDOW_MANAGER_ERROR,
            {

                error: {

                    name:
                        error?.name ??
                        'Error',

                    message:
                        error?.message ??
                        'Error desconocido.',

                },

                timestamp:
                    new Date().toISOString(),

            }
        );

    }

}


/* =========================================================
   INSTANCIA ÚNICA
   ========================================================= */

const windowManager =
    new WindowManager();


/* =========================================================
   EXPORTACIONES
   ========================================================= */

export {

    WindowManager,

    windowManager,

    EVENTS as WindowManagerEvents,

};
