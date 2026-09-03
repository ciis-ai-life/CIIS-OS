/**
 * CIIS OS
 * CIISMATRÍA Application
 *
 * Archivo:
 *     js/ciismatria.js
 *
 * Responsabilidad:
 *     Proporcionar la interfaz de la aplicación CIISMATRÍA
 *     dentro de CIIS OS.
 *
 *     Este módulo NO implementa todavía el motor matemático
 *     de CIISMATRÍA. Su responsabilidad actual es:
 *
 *     - Definir la aplicación.
 *     - Crear su interfaz.
 *     - Integrarse con WindowManager.
 *     - Recibir solicitudes de apertura.
 *     - Emitir eventos de aplicación.
 *
 * Arquitectura:
 *     - ES Modules nativos.
 *     - Exportaciones nombradas.
 *     - Comunicación mediante Kernel/EventBus.
 *     - Ventanas administradas por WindowManager.
 *     - Sin dependencias externas.
 */

import { Kernel } from './kernel/eventBus.js';

import {
    windowManager
} from './windows.js';


/* =========================================================
   CONFIGURACIÓN
   ========================================================= */

const CIISMATRIA_CONFIG = Object.freeze({

    id: 'ciismatria',

    name: 'CIISMATRÍA',

    version: '1.0.0',

    window: Object.freeze({

        width: 760,

        height: 520,

        x: 80,

        y: 60,

    }),

});


/* =========================================================
   EVENTOS
   ========================================================= */

const EVENTS = Object.freeze({

    OPEN_REQUESTED:
        'CIISMATRIA_OPEN_REQUESTED',

    OPENED:
        'CIISMATRIA_OPENED',

    CLOSED:
        'CIISMATRIA_CLOSED',

    READY:
        'CIISMATRIA_READY',

    ERROR:
        'CIISMATRIA_ERROR',

});


/* =========================================================
   APLICACIÓN CIISMATRÍA
   ========================================================= */

class CIISMATRIA {

    constructor() {

        this.initialized = false;

        this.windowId = null;

        this.unsubscribeOpenRequest = null;

    }


    /* =====================================================
       INICIALIZACIÓN
       ===================================================== */

    /**
     * Inicializa la aplicación.
     *
     * @returns {void}
     */
    initialize() {

        if (this.initialized) {
            return;
        }


        try {

            this.subscribeToKernel();

            this.initialized = true;


            Kernel.publish(
                EVENTS.READY,
                {
                    application:
                        CIISMATRIA_CONFIG.id,

                    version:
                        CIISMATRIA_CONFIG.version,

                    timestamp:
                        new Date().toISOString(),

                }
            );


            console.info(
                '[CIISMATRÍA] Aplicación inicializada.'
            );

        } catch (error) {

            this.handleError(error);

        }

    }


    /* =====================================================
       KERNEL
       ===================================================== */

    /**
     * Registra las suscripciones necesarias.
     *
     * @returns {void}
     */
    subscribeToKernel() {

        this.unsubscribeOpenRequest =
            Kernel.subscribe(
                'APPLICATION_REQUESTED',
                this.handleApplicationRequest.bind(this)
            );

    }


    /**
     * Atiende solicitudes de apertura de aplicaciones.
     *
     * @param {Object} payload
     * @returns {void}
     */
    handleApplicationRequest(payload) {

        if (!payload) {
            return;
        }


        if (
            payload.application !==
            CIISMATRIA_CONFIG.id
        ) {

            return;
        }


        this.open();

    }


    /* =====================================================
       RESPONSIVE WINDOW
       ===================================================== */

    /**
     * Calcula las dimensiones y posición de la ventana
     * según el tamaño disponible del navegador.
     *
     * En escritorio conserva la configuración original.
     *
     * En dispositivos pequeños adapta la ventana para
     * evitar que se salga de la pantalla.
     *
     * @returns {Object}
     */
    getResponsiveWindow() {

        const viewportWidth =
            Math.max(
                320,
                window.innerWidth || 320
            );


        const viewportHeight =
            Math.max(
                240,
                window.innerHeight || 240
            );


        const isMobile =
            viewportWidth <= 768;


        if (!isMobile) {

            return {

                width:
                    CIISMATRIA_CONFIG.window.width,

                height:
                    CIISMATRIA_CONFIG.window.height,

                x:
                    CIISMATRIA_CONFIG.window.x,

                y:
                    CIISMATRIA_CONFIG.window.y,

            };

        }


        const horizontalMargin = 12;

        const verticalMargin = 12;


        const availableWidth =
            Math.max(
                280,
                viewportWidth -
                (horizontalMargin * 2)
            );


        const availableHeight =
            Math.max(
                220,
                viewportHeight -
                80 -
                (verticalMargin * 2)
            );


        return {

            width:
                Math.min(
                    CIISMATRIA_CONFIG.window.width,
                    availableWidth
                ),

            height:
                Math.min(
                    CIISMATRIA_CONFIG.window.height,
                    availableHeight
                ),

            x:
                horizontalMargin,

            y:
                verticalMargin,

        };

    }


    /* =====================================================
       APERTURA
       ===================================================== */

    /**
     * Abre CIISMATRÍA.
     *
     * Si la ventana ya existe, simplemente la restaura
     * y coloca al frente.
     *
     * @returns {Object|null}
     */
    open() {

        try {

            if (!windowManager.initialized) {

                windowManager.initialize();

            }


            if (
                this.windowId &&
                windowManager.hasWindow(
                    this.windowId
                )
            ) {

                windowManager.restoreWindow(
                    this.windowId
                );


                windowManager.focusWindow(
                    this.windowId
                );


                Kernel.publish(
                    EVENTS.OPENED,
                    {
                        windowId:
                            this.windowId,

                        existing:
                            true,

                        timestamp:
                            new Date().toISOString(),
                    }
                );


                return windowManager.getWindow(
                    this.windowId
                );

            }


            const responsiveWindow =
                this.getResponsiveWindow();


            const windowState =
                windowManager.createWindow({

                    id:
                        'ciismatria-window',

                    title:
                        CIISMATRIA_CONFIG.name,

                    width:
                        responsiveWindow.width,

                    height:
                        responsiveWindow.height,

                    x:
                        responsiveWindow.x,

                    y:
                        responsiveWindow.y,

                    content:
                        this.buildInterface(),

                });


            this.windowId =
                windowState.id;


            this.bindWindowEvents(
                windowState.element
            );


            Kernel.publish(
                EVENTS.OPENED,
                {
                    windowId:
                        this.windowId,

                    existing:
                        false,

                    timestamp:
                        new Date().toISOString(),
                }
            );


            return windowState;

        } catch (error) {

            this.handleError(error);

            return null;

        }

    }


    /* =====================================================
       INTERFAZ
       ===================================================== */

    /**
     * Construye la interfaz principal de CIISMATRÍA.
     *
     * @returns {string}
     */
    buildInterface() {

        return `
            <div class="ciismatria-app"
                 style="
                    width:100%;
                    height:100%;
                    box-sizing:border-box;
                    padding:20px;
                    overflow:auto;
                    font-family:Arial, sans-serif;
                 ">

                <div style="
                    margin-bottom:20px;
                ">

                    <h2 style="
                        margin:0 0 8px 0;
                    ">
                        CIISMATRÍA
                    </h2>

                    <div style="
                        opacity:0.75;
                        font-size:13px;
                    ">
                        Motor de análisis matemático y
                        gemátrico del CIIS.
                    </div>

                </div>


                <div style="
                    margin-bottom:16px;
                ">

                    <label style="
                        display:block;
                        margin-bottom:6px;
                        font-weight:bold;
                    ">
                        Texto a analizar
                    </label>

                    <input
                        type="text"
                        data-ciismatria-input
                        placeholder="Introduzca el texto..."
                        style="
                            width:100%;
                            box-sizing:border-box;
                            padding:10px;
                            border-radius:6px;
                            border:1px solid rgba(255,255,255,0.25);
                            background:rgba(0,0,0,0.15);
                            color:inherit;
                            outline:none;
                        "
                    >

                </div>


                <div style="
                    display:flex;
                    gap:10px;
                    flex-wrap:wrap;
                    margin-bottom:20px;
                ">

                    <button
                        type="button"
                        data-ciismatria-analyze
                        style="
                            padding:10px 16px;
                            border:none;
                            border-radius:6px;
                            cursor:pointer;
                        "
                    >
                        Analizar
                    </button>

                    <button
                        type="button"
                        data-ciismatria-clear
                        style="
                            padding:10px 16px;
                            border:none;
                            border-radius:6px;
                            cursor:pointer;
                        "
                    >
                        Limpiar
                    </button>

                </div>


                <div
                    data-ciismatria-results
                    style="
                        min-height:120px;
                        padding:15px;
                        border-radius:8px;
                        background:rgba(0,0,0,0.12);
                        overflow:auto;
                        box-sizing:border-box;
                    "
                >

                    <div style="
                        opacity:0.65;
                    ">
                        Introduzca un texto y presione
                        "Analizar".
                    </div>

                </div>

            </div>
        `;

    }


    /* =====================================================
       EVENTOS DE VENTANA
       ===================================================== */

    /**
     * Vincula los controles internos de la aplicación.
     *
     * @param {HTMLElement} element
     * @returns {void}
     */
    bindWindowEvents(element) {

        if (!element) {
            return;
        }


        const input =
            element.querySelector(
                '[data-ciismatria-input]'
            );


        const analyzeButton =
            element.querySelector(
                '[data-ciismatria-analyze]'
            );


        const clearButton =
            element.querySelector(
                '[data-ciismatria-clear]'
            );


        if (analyzeButton) {

            analyzeButton.addEventListener(
                'click',
                () => {

                    this.executeAnalysis(
                        input,
                        element
                    );

                }
            );

        }


        if (clearButton) {

            clearButton.addEventListener(
                'click',
                () => {

                    if (input) {
                        input.value = '';
                    }


                    const results =
                        element.querySelector(
                            '[data-ciismatria-results]'
                        );


                    if (results) {

                        results.innerHTML = `
                            <div style="
                                opacity:0.65;
                            ">
                                Introduzca un texto y
                                presione "Analizar".
                            </div>
                        `;

                    }

                }
            );

        }


        if (input) {

            input.addEventListener(
                'keydown',
                (event) => {

                    if (
                        event.key === 'Enter'
                    ) {

                        this.executeAnalysis(
                            input,
                            element
                        );

                    }

                }
            );

        }

    }


    /* =====================================================
       ANÁLISIS
       ===================================================== */

    /**
     * Ejecuta el análisis básico de la interfaz.
     *
     * @param {HTMLInputElement|null} input
     * @param {HTMLElement} element
     * @returns {void}
     */
    executeAnalysis(input, element) {

        const results =
            element.querySelector(
                '[data-ciismatria-results]'
            );


        if (!results) {
            return;
        }


        const value =
            input
                ? input.value.trim()
                : '';


        if (!value) {

            results.innerHTML = `
                <div style="
                    opacity:0.65;
                ">
                    No se ha introducido ningún texto
                    para analizar.
                </div>
            `;

            return;

        }


        const characters =
            Array.from(value);


        const length =
            characters.length;


        results.innerHTML = `

            <div style="
                margin-bottom:10px;
                font-weight:bold;
            ">
                Resultado preliminar
            </div>

            <div style="
                line-height:1.7;
            ">

                <div>
                    <strong>Texto:</strong>
                    ${this.escapeHTML(value)}
                </div>

                <div>
                    <strong>Caracteres:</strong>
                    ${length}
                </div>

                <div style="
                    margin-top:10px;
                    opacity:0.7;
                    font-size:12px;
                ">
                    El motor matemático completo de
                    CIISMATRÍA será integrado en una
                    fase posterior.
                </div>

            </div>

        `;

    }


    /* =====================================================
       SEGURIDAD HTML
       ===================================================== */

    /**
     * Escapa caracteres HTML para evitar que el texto
     * introducido por el usuario sea interpretado como
     * código HTML.
     *
     * @param {string} value
     * @returns {string}
     */
    escapeHTML(value) {

        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

    }


    /* =====================================================
       CIERRE
       ===================================================== */

    /**
     * Cierra la ventana de CIISMATRÍA.
     *
     * @returns {void}
     */
    close() {

        if (!this.windowId) {
            return;
        }


        try {

            if (
                windowManager.hasWindow(
                    this.windowId
                )
            ) {

                windowManager.closeWindow(
                    this.windowId
                );

            }


            Kernel.publish(
                EVENTS.CLOSED,
                {
                    windowId:
                        this.windowId,

                    timestamp:
                        new Date().toISOString(),
                }
            );


            this.windowId = null;

        } catch (error) {

            this.handleError(error);

        }

    }


    /* =====================================================
       ERRORES
       ===================================================== */

    /**
     * Maneja errores de la aplicación.
     *
     * @param {Error} error
     * @returns {void}
     */
    handleError(error) {

        console.error(
            '[CIISMATRÍA] Error:',
            error
        );


        Kernel.publish(
            EVENTS.ERROR,
            {
                application:
                    CIISMATRIA_CONFIG.id,

                message:
                    error instanceof Error
                        ? error.message
                        : String(error),

                timestamp:
                    new Date().toISOString(),
            }
        );

    }


    /* =====================================================
       DESTRUCCIÓN
       ===================================================== */

    /**
     * Libera los recursos de la aplicación.
     *
     * @returns {void}
     */
    destroy() {

        if (
            typeof this.unsubscribeOpenRequest ===
            'function'
        ) {

            this.unsubscribeOpenRequest();

            this.unsubscribeOpenRequest =
                null;

        }


        this.close();


        this.initialized = false;

    }

}


/* =========================================================
   INSTANCIA
   ========================================================= */

const ciismatria =
    new CIISMATRIA();


/* =========================================================
   EXPORTACIONES
   ========================================================= */

export {
    CIISMATRIA,
    ciismatria,
    CIISMATRIA_CONFIG,
    EVENTS as CIISMATRIAEvents,
};
