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
 *     - Maximizar/restaurar ventanas.
 *     - Activar/focalizar ventanas.
 *     - Mover ventanas.
 *     - Arrastrar ventanas mediante pointer events.
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

    WINDOW_MAXIMIZED: 'WINDOW_MAXIMIZED',

    WINDOW_UNMAXIMIZED: 'WINDOW_UNMAXIMIZED',

    WINDOW_MANAGER_READY:
        'WINDOW_MANAGER_READY',

    WINDOW_MANAGER_ERROR:
        'WINDOW_MANAGER_ERROR',

});


/* =========================================================
   CONFIGURACIÓN
   ========================================================= */

const DEFAULT_WINDOW_WIDTH = 640;

const DEFAULT_WINDOW_HEIGHT = 420;

const MIN_WINDOW_WIDTH = 280;

const MIN_WINDOW_HEIGHT = 180;

const DEFAULT_WINDOW_X = 40;

const DEFAULT_WINDOW_Y = 40;

const INITIAL_Z_INDEX = 100;


/* =========================================================
   WINDOW MANAGER
   ========================================================= */

class WindowManager {

    constructor() {

        this.initialized = false;

        this.windows = new Map();

        this.activeWindowId = null;

        this.zIndex = INITIAL_Z_INDEX;


        this.dom = {

            windowManager: null,

            desktopArea: null,

        };


        this.dragState = null;


        this.boundHandlers = {

            pointerDown:
                this.handlePointerDown.bind(this),

            pointerMove:
                this.handlePointerMove.bind(this),

            pointerUp:
                this.handlePointerUp.bind(this),

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
     * Registra eventos globales del administrador.
     *
     * @returns {void}
     */
    bindEvents() {

        this.dom.windowManager.addEventListener(
            'pointerdown',
            this.boundHandlers.pointerDown
        );


        document.addEventListener(
            'pointermove',
            this.boundHandlers.pointerMove
        );


        document.addEventListener(
            'pointerup',
            this.boundHandlers.pointerUp
        );


        document.addEventListener(
            'pointercancel',
            this.boundHandlers.pointerUp
        );

    }


    /**
     * Elimina eventos registrados.
     *
     * @returns {void}
     */
    unbindEvents() {

        if (this.dom.windowManager) {

            this.dom.windowManager.removeEventListener(
                'pointerdown',
                this.boundHandlers.pointerDown
            );

        }


        document.removeEventListener(
            'pointermove',
            this.boundHandlers.pointerMove
        );


        document.removeEventListener(
            'pointerup',
            this.boundHandlers.pointerUp
        );


        document.removeEventListener(
            'pointercancel',
            this.boundHandlers.pointerUp
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


        if (
            options === null ||
            typeof options !== 'object' ||
            Array.isArray(options)
        ) {

            throw new TypeError(
                '[CIIS WindowManager] options debe ser un objeto.'
            );

        }


        const id =
            options.id ??
            this.generateWindowId();


        if (
            typeof id !== 'string' ||
            id.trim().length === 0
        ) {

            throw new TypeError(
                '[CIIS WindowManager] El identificador de ventana es inválido.'
            );

        }


        if (this.windows.has(id)) {

            throw new Error(
                `[CIIS WindowManager] Ya existe la ventana "${id}".`
            );

        }


        const title =
            typeof options.title === 'string' &&
            options.title.trim().length > 0
                ? options.title.trim()
                : 'CIIS OS';


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
                ? Math.floor(options.x)
                : DEFAULT_WINDOW_X;


        const y =
            Number.isFinite(options.y)
                ? Math.floor(options.y)
                : DEFAULT_WINDOW_Y;


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


        if (!contentElement) {

            throw new Error(
                '[CIIS WindowManager] No se pudo crear el área de contenido.'
            );

        }


        if (typeof content === 'string') {

            contentElement.innerHTML =
                content;

        } else if (
            content instanceof Node
        ) {

            contentElement.appendChild(
                content
            );

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

            previousGeometry: null,

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


        windowElement.setAttribute(
            'role',
            'dialog'
        );


        windowElement.setAttribute(
            'aria-label',
            title
        );


        windowElement.style.width =
            `${width}px`;


        windowElement.style.height =
            `${height}px`;


        windowElement.style.left =
            `${x}px`;


        windowElement.style.top =
            `${y}px`;


        windowElement.innerHTML = `

            <header
                class="ciis-window-header"
                data-window-drag-handle
            >

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


        if (
            this.dragState &&
            this.dragState.windowId === id
        ) {

            this.cancelDrag();

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


        if (windowState.minimized) {
            return true;
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
                    windowState.width,

                height:
                    windowState.height,

                x:
                    windowState.x,

                y:
                    windowState.y,

            };


            element.classList.add(
                'ciis-window-maximized'
            );


            element.style.left =
                '0px';

            element.style.top =
                '0px';

            element.style.width =
                '100%';

            element.style.height =
                '100%';


            windowState.maximized = true;


            this.focusWindow(id);


            Kernel.publish(
                EVENTS.WINDOW_MAXIMIZED,
                {
                    windowId: id,

                    timestamp:
                        new Date().toISOString(),
                }
            );

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


                windowState.width =
                    geometry.width;

                windowState.height =
                    geometry.height;

                windowState.x =
                    geometry.x;

                windowState.y =
                    geometry.y;

            }


            windowState.previousGeometry =
                null;

            windowState.maximized = false;


            this.focusWindow(id);


            Kernel.publish(
                EVENTS.WINDOW_UNMAXIMIZED,
                {
                    windowId: id,

                    timestamp:
                        new Date().toISOString(),
                }
            );

        }


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


        if (windowState.minimized) {

            return false;

        }


        this.zIndex += 1;


        windowState.element.style.zIndex =
            String(this.zIndex);


        this.activeWindowId =
            id;


        for (
            const [windowId, state]
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


        if (windowState.maximized) {

            return false;

        }


        const position =
            this.clampWindowPosition(
                windowState,
                x,
                y
            );


        windowState.x =
            position.x;

        windowState.y =
            position.y;


        windowState.element.style.left =
            `${position.x}px`;


        windowState.element.style.top =
            `${position.y}px`;


        Kernel.publish(
            EVENTS.WINDOW_MOVED,
            {
                windowId: id,

                x:
                    position.x,

                y:
                    position.y,

                timestamp:
                    new Date().toISOString(),
            }
        );


        return true;

    }


    /**
     * Limita la posición de una ventana al área disponible.
     *
     * Se conserva una pequeña porción visible de la ventana
     * para evitar que desaparezca completamente.
     *
     * @param {Object} windowState
     * @param {number} x
     * @param {number} y
     * @returns {{x:number,y:number}}
     */
    clampWindowPosition(
        windowState,
        x,
        y
    ) {

        const desktop =
            this.dom.desktopArea;


        if (!desktop) {

            return {
                x,
                y,
            };

        }


        const desktopWidth =
            desktop.clientWidth;


        const desktopHeight =
            desktop.clientHeight;


        const windowWidth =
            windowState.element.offsetWidth ||
            windowState.width;


        const windowHeight =
            windowState.element.offsetHeight ||
            windowState.height;


        const visibleMargin =
            40;


        const maxX =
            Math.max(
                0,
                desktopWidth -
                visibleMargin
            );


        const maxY =
            Math.max(
                0,
                desktopHeight -
                visibleMargin
            );


        const minX =
            -(windowWidth -
            visibleMargin);


        const minY =
            0;


        return {

            x: Math.min(
                maxX,
                Math.max(minX, x)
            ),

            y: Math.min(
                maxY,
                Math.max(minY, y)
            ),

        };

    }


    /* =====================================================
       ARRASTRE
       ===================================================== */

    /**
     * Inicia un arrastre cuando el pointer se encuentra
     * sobre la barra de título.
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


        if (actionButton) {

            event.preventDefault();

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


            return;

        }


        const dragHandle =
            event.target.closest(
                '[data-window-drag-handle]'
            );


        if (!dragHandle) {
            return;
        }


        const windowState =
            this.getWindow(id);


        if (
            !windowState ||
            windowState.maximized
        ) {

            return;

        }


        const currentX =
            windowState.x;


        const currentY =
            windowState.y;


        this.dragState = {

            windowId: id,

            pointerId:
                event.pointerId,

            offsetX:
                event.clientX -
                currentX,

            offsetY:
                event.clientY -
                currentY,

        };


        try {

            dragHandle.setPointerCapture(
                event.pointerId
            );

        } catch {

            /*
             * Algunos entornos no permiten pointer capture.
             * El arrastre continúa mediante document events.
             */

        }


        event.preventDefault();

    }


    /**
     * Procesa el movimiento durante un arrastre.
     *
     * @param {PointerEvent} event
     * @returns {void}
     */
    handlePointerMove(event) {

        if (!this.dragState) {
            return;
        }


        if (
            event.pointerId !==
            this.dragState.pointerId
        ) {

            return;

        }


        const windowState =
            this.getWindow(
                this.dragState.windowId
            );


        if (!windowState) {

            this.cancelDrag();

            return;

        }


        if (windowState.maximized) {

            this.cancelDrag();

            return;

        }


        const x =
            event.clientX -
            this.dragState.offsetX;


        const y =
            event.clientY -
            this.dragState.offsetY;


        this.moveWindow(
            windowState.id,
            x,
            y
        );

    }


    /**
     * Finaliza un arrastre.
     *
     * @param {PointerEvent} event
     * @returns {void}
     */
    handlePointerUp(event) {

        if (!this.dragState) {
            return;
        }


        if (
            event.pointerId !==
            this.dragState.pointerId
        ) {

            return;

        }


        this.cancelDrag();

    }


    /**
     * Cancela el estado interno de arrastre.
     *
     * @returns {void}
     */
    cancelDrag() {

        this.dragState = null;

    }


    /* =====================================================
       ACTIVACIÓN AUTOMÁTICA
       ===================================================== */

    /**
     * Activa la ventana visible con mayor z-index.
     *
     * @returns {void}
     */
    activateMostRecentWindow() {

        const visibleWindows =
            Array.from(
                this.windows.values()
            )
                .filter(
                    state =>
                        !state.minimized
                )
                .sort(
                    (a, b) =>
                        Number(
                            b.element.style.zIndex || 0
                        ) -
                        Number(
                            a.element.style.zIndex || 0
                        )
                );


        if (
            visibleWindows.length === 0
        ) {

            this.activeWindowId =
                null;

            return;

        }


        this.focusWindow(
            visibleWindows[0].id
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


    /**
     * Devuelve el identificador de la ventana activa.
     *
     * @returns {string|null}
     */
    getActiveWindowId() {

        return this.activeWindowId;

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


        if (
            typeof crypto !== 'undefined' &&
            typeof crypto.getRandomValues === 'function'
        ) {

            const bytes =
                new Uint8Array(16);


            crypto.getRandomValues(
                bytes
            );


            return (
                'window-' +
                Array.from(bytes)
                    .map(
                        byte =>
                            byte
                                .toString(16)
                                .padStart(2, '0')
                    )
                    .join('')
            );

        }


        throw new Error(
            '[CIIS WindowManager] Web Crypto no está disponible para generar identificadores.'
        );

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
            .replaceAll(
                '&',
                '&amp;'
            )
            .replaceAll(
                '<',
                '&lt;'
            )
            .replaceAll(
                '>',
                '&gt;'
            )
            .replaceAll(
                '"',
                '&quot;'
            )
            .replaceAll(
                "'",
                '&#039;'
            );

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

        this.cancelDrag();

        this.unbindEvents();


        for (
            const windowState
            of this.windows.values()
        ) {

            windowState.element.remove();

        }


        this.windows.clear();

        this.activeWindowId =
            null;

        this.zIndex =
            INITIAL_Z_INDEX;

        this.dom.windowManager =
            null;

        this.dom.desktopArea =
            null;

        this.initialized =
            false;

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