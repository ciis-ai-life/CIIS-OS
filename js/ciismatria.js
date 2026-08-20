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


            const windowState =
                windowManager.createWindow({

                    id:
                        'ciismatria-window',

                    title:
                        CIISMATRIA_CONFIG.name,

                    width:
                        CIISMATRIA_CONFIG.window.width,

                    height:
                        CIISMATRIA_CONFIG.window.height,

                    x:
                        CIISMATRIA_CONFIG.window.x,

                    y:
                        CIISMATRIA_CONFIG.window.y,

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
     * Construye la interfaz inicial de CIISMATRÍA.
     *
     * @returns {string}
     */
    buildInterface() {

        return `

            <div class="ciismatria">

                <header class="ciismatria-header">

                    <div class="ciismatria-title">

                        <h1>
                            CIISMATRÍA
                        </h1>

                        <p>
                            Motor de análisis de identidad
                        </p>

                    </div>

                    <div class="ciismatria-status">

                        <span
                            class="ciismatria-status-indicator"
                            data-status="ready"
                            aria-hidden="true"
                        ></span>

                        <span>
                            SISTEMA LISTO
                        </span>

                    </div>

                </header>


                <section
                    class="ciismatria-workspace"
                    aria-label="Área de análisis CIISMATRÍA"
                >

                    <div
                        class="ciismatria-panel"
                    >

                        <h2>
                            Entrada de análisis
                        </h2>

                        <label
                            for="ciismatria-input"
                        >
                            Identidad
                        </label>

                        <input
                            id="ciismatria-input"
                            class="ciismatria-input"
                            type="text"
                            autocomplete="off"
                            placeholder="Introducir identidad..."
                        >

                        <button
                            id="ciismatria-analyze"
                            class="ciismatria-button"
                            type="button"
                        >
                            Analizar
                        </button>

                    </div>


                    <div
                        class="ciismatria-panel"
                    >

                        <h2>
                            Resultado
                        </h2>

                        <output
                            id="ciismatria-result"
                            class="ciismatria-result"
                            aria-live="polite"
                        >
                            Esperando análisis.
                        </output>

                    </div>

                </section>


                <footer
                    class="ciismatria-footer"
                >

                    <span>
                        CIISMATRÍA v${CIISMATRIA_CONFIG.version}
                    </span>

                    <span>
                        Protocolo PIC-200-001
                    </span>

                </footer>

            </div>

        `;

    }


    /* =====================================================
       EVENTOS DE LA VENTANA
       ===================================================== */

    /**
     * Registra eventos específicos de la ventana.
     *
     * @param {HTMLElement} windowElement
     * @returns {void}
     */
    bindWindowEvents(windowElement) {

        if (!windowElement) {
            return;
        }


        const analyzeButton =
            windowElement.querySelector(
                '#ciismatria-analyze'
            );


        const input =
            windowElement.querySelector(
                '#ciismatria-input'
            );


        const result =
            windowElement.querySelector(
                '#ciismatria-result'
            );


        if (
            !analyzeButton ||
            !input ||
            !result
        ) {

            throw new Error(
                '[CIISMATRÍA] Interfaz de análisis incompleta.'
            );

        }


        analyzeButton.addEventListener(
            'click',
            () => {

                this.executeAnalysis(
                    input.value,
                    result
                );

            }
        );


        input.addEventListener(
            'keydown',
            event => {

                if (
                    event.key === 'Enter'
                ) {

                    this.executeAnalysis(
                        input.value,
                        result
                    );

                }

            }
        );

    }


    /* =====================================================
       ANÁLISIS
       ===================================================== */

    /**
     * Ejecuta temporalmente el flujo de análisis.
     *
     * IMPORTANTE:
     *     Esta función NO representa todavía el motor
     *     CIISMATRÍA definitivo.
     *
     *     El motor determinista será incorporado en una
     *     etapa posterior sin modificar el contrato de
     *     la interfaz.
     *
     * @param {string} value
     * @param {HTMLElement} resultElement
     * @returns {void}
     */
    executeAnalysis(
        value,
        resultElement
    ) {

        const normalized =
            String(value ?? '').trim();


        if (!normalized) {

            resultElement.textContent =
                'Introduzca una identidad para iniciar el análisis.';

            return;

        }


        /**
         * Resultado provisional.
         *
         * No se presenta como resultado matemático definitivo.
         */
        resultElement.textContent =
            `Entrada recibida: ${normalized}`;


        Kernel.publish(
            'CIISMATRIA_ANALYSIS_REQUESTED',
            {
                input:
                    normalized,

                timestamp:
                    new Date().toISOString(),
            }
        );

    }


    /* =====================================================
       CIERRE
       ===================================================== */

    /**
     * Registra el cierre de la aplicación.
     *
     * La eliminación física de la ventana corresponde
     * a WindowManager.
     *
     * @returns {void}
     */
    close() {

        if (!this.windowId) {
            return;
        }


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

    }


    /* =====================================================
       ERROR
       ===================================================== */

    /**
     * Maneja errores de CIISMATRÍA.
     *
     * @param {Error} error
     * @returns {void}
     */
    handleError(error) {

        console.error(
            '[CIISMATRÍA] Error.',
            error
        );


        Kernel.publish(
            EVENTS.ERROR,
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
     * Libera las suscripciones de la aplicación.
     *
     * @returns {void}
     */
    destroy() {

        if (
            typeof this.unsubscribeOpenRequest ===
            'function'
        ) {

            this.unsubscribeOpenRequest();

            this.unsubscribeOpenRequest = null;

        }


        if (this.windowId) {

            if (
                windowManager.hasWindow(
                    this.windowId
                )
            ) {

                windowManager.closeWindow(
                    this.windowId
                );

            }

        }


        this.windowId = null;

        this.initialized = false;

    }

}


/* =========================================================
   INSTANCIA ÚNICA
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
