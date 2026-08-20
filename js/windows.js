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
 *     - Activar/focalizar ventanas.
 *     - Mover ventanas.
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

    WINDOW_CREATED: 'WINDOW_CREATED',

    WINDOW_OPENED: 'WINDOW_OPENED',

    WINDOW_CLOSED: 'WINDOW_CLOSED',

    WINDOW_MINIMIZED: 'WINDOW_MINIMIZED',

    WINDOW_RESTORED: 'WINDOW_RESTORED',

    WINDOW_FOCUSED: 'WINDOW_FOCUSED',

    WINDOW_MOVED: 'WINDOW_MOVED',

    WINDOW_MANAGER_READY: 'WINDOW_MANAGER_READY',

    WINDOW_MANAGER_ERROR: 'WINDOW_MANAGER_ERROR',

});


/* =========================================================
   CONFIGURACIÓN
   ========================================================= */

const DEFAULT_WINDOW_WIDTH = 640;

const DEFAULT_WINDOW_HEIGHT = 420;

const MIN_WINDOW_WIDTH = 280;

const MIN_WINDOW_HEIGHT = 180;


/* =========================================================
   WINDOW MANAGER
   ========================================================= */

class WindowManager {

    constructor() {

        this.initialized = false;

        this.windows = new Map();

        this.activeWindowId = null;

        this.zIndex = 100;


        this.dom = {

            windowManager: null,

            desktopArea: null,

        };


        this.boundHandlers = {

            pointerDown:
                this.handlePointerDown.bind(this),

        };

    }


    /* =====================================================
       INICIALIZACIÓN
       ===================================================== */

    /**
     * Inicializa el administrador de ventanas.
     *
     * @returns {void}
     */
    initialize() {

        if (this.initialized) {
            return;
        }


        try {

            this.resolveDOM();

            this.validateDOM();

            this.bindEvents();

            this.initialized = true;


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

    /**
     * Obtiene referencias al DOM.
     *
     * @returns {void}
     */
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


    /**
     * Valida el DOM.
     *
     * @returns {void}
     */
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


    /**
     * Registra eventos globales.
     *
     * @returns {void}
     */
    bindEvents() {

        this.dom.windowManager.addEventListener(
            'pointerdown',
            this.boundHandlers.pointerDown
        );

    }


    /**
     * Elimina eventos.
     *
     * @returns {void}
     */
    unbindEvents() {

        if (!this.dom.windowManager) {
            return;
        }


        this.dom.windowManager.removeEventListener(
            'pointerdown',
            this.boundHandlers.pointerDown
        );

    }


    /* =====================================================
       CREACIÓN
       ===================================================== */

    /**
     * Crea una ventana.
     *
     * @param {Object} options
     * @returns {Object}
     */
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
            options.content ?? '';


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


        if (typeof content === 'string') {

            contentElement.innerHTML = content;

        }


        this.dom.windowManager.appendChild(
            windowElement
        );


        const windowState = {

            id,

            title,

            element: windowElement,

            minimized: false,

            maximized: false,

            x,

            y,

            width,

            height,

        };


        this.windows.set(
            id,
            windowState
        );


        this.focusWindow(id);


        Kernel.publish(
            EVENTS.WINDOW_CREATED,
            {
                windowId: id,

                title,

                timestamp:
                    new Date().toISOString(),

            }
        );


        return windowState;

    }


    /**
     * Construye el elemento HTML de una ventana.
     *
     * @param {Object} options
     * @returns {HTMLElement}
     */
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
            document.createElement('article');


        windowElement.className =
            'ciis-window';


        windowElement.dataset.windowId =
            id;


        windowElement.style.width =
            `${width}px`;


        windowElement.style.height =
            `${height}px`;


        windowElement.style.left =
            `${x}px`;


        windowElement.style.top =
            `${y}px`;


        windowElement.innerHTML = `

            <header class="ciis-window-header">

                <div class="ciis-window-title">
                    ${this.escapeHTML(title)}
                </div>

                <div class="ciis-window-controls">

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

            <div class="ciis-window-content"></div>

        `;


        return windowElement;

    }


    /* =====================================================
       APERTURA
       ===================================================== */

    /**
     * Abre una ventana existente.
     *
     * @param {string} id
     * @returns {boolean}
     */
    openWindow(id) {

        const windowState =
            this.getWindow(id);


        if (!windowState) {
            return false;
        }


        windowState.element.hidden = false;

        windowState.minimized = false;


        this.focusWindow(id);


        Kernel.publish(
            EVENTS.WINDOW_OPENED,
            {
                windowId: id,

                timestamp:
                    new Date().toISOString(),
            }
        );


        return true;

    }


    /* =====================================================
       CIERRE
       ===================================================== */

    /**
     * Cierra y elimina una ventana.
     *
     * @param {string} id
     * @returns {boolean}
     */
    closeWindow(id) {

        const windowState =
            this.getWindow(id);


        if (!windowState) {
            return false;
        }


        windowState.element.remove();

        this.windows.delete(id);


        if (this.activeWindowId === id) {

            this.activeWindowId = null;

            this.activateMostRecentWindow();

        }


        Kernel.publish(
            EVENTS.WINDOW_CLOSED,
            {
                windowId: id,

                timestamp:
                    new Date().toISOString(),
            }
        );


        return true;

    }


    /* =====================================================
       MINIMIZACIÓN
       ===================================================== */

    /**
     * Minimiza una ventana.
     *
     * @param {string} id
     * @returns {boolean}
     */
    minimizeWindow(id) {

        const windowState =
            this.getWindow(id);


        if (!windowState) {
            return false;
        }


        windowState.element.hidden = true;

        windowState.minimized = true;


        if (this.activeWindowId === id) {

            this.activeWindowId = null;

            this.activateMostRecentWindow();

        }


        Kernel.publish(
            EVENTS.WINDOW_MINIMIZED,
            {
                windowId: id,

                timestamp:
                    new Date().toISOString(),
            }
        );


        return true;

    }


    /* =====================================================
       RESTAURACIÓN
       ===================================================== */

    /**
     * Restaura una ventana minimizada.
     *
     * @param {string} id
     * @returns {boolean}
     */
    restoreWindow(id) {

        const windowState =
            this.getWindow(id);


        if (!windowState) {
            return false;
        }


        windowState.element.hidden = false;

        windowState.minimized = false;


        this.focusWindow(id);


        Kernel.publish(
            EVENTS.WINDOW_RESTORED,
            {
                windowId: id,

                timestamp:
                    new Date().toISOString(),
            }
        );


        return true;

    }


    /* =====================================================
       MAXIMIZACIÓN
       ===================================================== */

    /**
     * Alterna maximización/restauración.
     *
     * @param {string} id
     * @returns {boolean}
     */
    toggleMaximize(id) {

        const windowState =
            this.getWindow(id);


        if (!windowState) {
            return false;
        }


        const element =
            windowState.element;


        if (!windowState.maximized) {

            windowState.previousGeometry = {

                width:
                    element.offsetWidth,

                height:
                    element.offsetHeight,

                x:
                    element.offsetLeft,

                y:
                    element.offsetTop,

            };


            element.classList.add(
                'ciis-window-maximized'
            );


            element.style.left = '0px';

            element.style.top = '0px';

            element.style.width = '100%';

            element.style.height = '100%';


            windowState.maximized = true;

        } else {

            const geometry =
                windowState.previousGeometry;


            element.classList.remove(
                'ciis-window-maximized'
            );


            if (geometry) {

                element.style.width =
                    `${geometry.width}px`;

                element.style.height =
                    `${geometry.height}px`;

                element.style.left =
                    `${geometry.x}px`;

                element.style.top =
                    `${geometry.y}px`;

            }


            windowState.maximized = false;

        }


        this.focusWindow(id);


        return true;

    }


    /* =====================================================
       ENFOQUE
       ===================================================== */

    /**
     * Coloca una ventana al frente.
     *
     * @param {string} id
     * @returns {boolean}
     */
    focusWindow(id) {

        const windowState =
            this.getWindow(id);


        if (!windowState) {
            return false;
        }


        this.zIndex += 1;


        windowState.element.style.zIndex =
            String(this.zIndex);


        this.activeWindowId = id;


        for (const [windowId, state]
            of this.windows.entries()) {

            state.element.classList.toggle(
                'ciis-window-active',
                windowId === id
            );

        }


        Kernel.publish(
            EVENTS.WINDOW_FOCUSED,
            {
                windowId: id,

                timestamp:
                    new Date().toISOString(),
            }
        );


        return true;

    }


    /* =====================================================
       MOVIMIENTO
       ===================================================== */

    /**
     * Establece la posición de una ventana.
     *
     * @param {string} id
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
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


        windowState.x = x;

        windowState.y = y;


        windowState.element.style.left =
            `${x}px`;


        windowState.element.style.top =
            `${y}px`;


        Kernel.publish(
            EVENTS.WINDOW_MOVED,
            {
                windowId: id,

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

    /**
     * Maneja eventos de pointer sobre ventanas.
     *
     * @param {PointerEvent} event
     * @returns {void}
     */
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


        const actionButton =
            event.target.closest(
                '[data-window-action]'
            );


        if (!actionButton) {
            return;
        }


        const action =
            actionButton.dataset.windowAction;


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


    /* =====================================================
       ACTIVACIÓN AUTOMÁTICA
       ===================================================== */

    /**
     * Activa la ventana más recientemente creada.
     *
     * @returns {void}
     */
    activateMostRecentWindow() {

        const windowStates =
            Array.from(
                this.windows.values()
            );


        if (windowStates.length === 0) {
            return;
        }


        const visibleWindows =
            windowStates.filter(
                state => !state.minimized
            );


        if (visibleWindows.length === 0) {
            return;
        }


        const mostRecent =
            visibleWindows[
                visibleWindows.length - 1
            ];


        this.focusWindow(
            mostRecent.id
        );

    }


    /* =====================================================
       CONSULTAS
       ===================================================== */

    /**
     * Obtiene una ventana.
     *
     * @param {string} id
     * @returns {Object|null}
     */
    getWindow(id) {

        return this.windows.get(id) ?? null;

    }


    /**
     * Comprueba si existe una ventana.
     *
     * @param {string} id
     * @returns {boolean}
     */
    hasWindow(id) {

        return this.windows.has(id);

    }


    /**
     * Devuelve todas las ventanas.
     *
     * @returns {Array}
     */
    getAllWindows() {

        return Array.from(
            this.windows.values()
        );

    }


    /**
     * Devuelve el número de ventanas.
     *
     * @returns {number}
     */
    getWindowCount() {

        return this.windows.size;

    }


    /* =====================================================
       UTILIDADES
       ===================================================== */

    /**
     * Genera un identificador único para una ventana.
     *
     * @returns {string}
     */
    generateWindowId() {

        if (
            typeof crypto !== 'undefined' &&
            typeof crypto.randomUUID === 'function'
        ) {

            return `window-${crypto.randomUUID()}`;

        }


        return `window-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;

    }


    /**
     * Normaliza una dimensión.
     *
     * @param {*} value
     * @param {number} fallback
     * @param {number} minimum
     * @returns {number}
     */
    normalizeDimension(
        value,
        fallback,
        minimum
    ) {

        if (!Number.isFinite(value)) {
            return fallback;
        }


        return Math.max(
            minimum,
            Math.floor(value)
        );

    }


    /**
     * Escapa texto antes de insertarlo en HTML.
     *
     * @param {*} value
     * @returns {string}
     */
    escapeHTML(value) {

        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');

    }


    /* =====================================================
       ERROR
       ===================================================== */

    /**
     * Maneja errores del WindowManager.
     *
     * @param {Error} error
     * @returns {void}
     */
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


    /* =====================================================
       DESTRUCCIÓN
       ===================================================== */

    /**
     * Destruye todas las ventanas y libera recursos.
     *
     * @returns {void}
     */
    destroy() {

        this.unbindEvents();


        for (
            const windowState
            of this.windows.values()
        ) {

            windowState.element.remove();

        }


        this.windows.clear();

        this.activeWindowId = null;

        this.initialized = false;

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
    EVENTS as WindowEvents,
};
