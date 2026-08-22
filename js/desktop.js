/**
 * CIIS OS
 * Desktop Manager
 *
 * Archivo:
 *     js/desktop.js
 *
 * Responsabilidad:
 *     Administrar el escritorio principal de CIIS OS:
 *
 *     - Inicializar la interfaz del escritorio.
 *     - Administrar el menú principal.
 *     - Administrar el reloj del sistema.
 *     - Administrar el indicador de estado.
 *     - Emitir solicitudes de apertura de aplicaciones.
 *
 * Arquitectura:
 *     - ES Modules nativos.
 *     - Exportaciones nombradas.
 *     - Sin dependencias externas.
 *     - Comunicación mediante Kernel/EventBus.
 *
 * IMPORTANTE:
 *     Este módulo administra el escritorio.
 *     No contiene lógica de ventanas.
 *     No contiene lógica de aplicaciones.
 *     No contiene lógica matemática de CIISMATRÍA.
 */

import { Kernel } from './kernel/eventBus.js';


/* =========================================================
   EVENTOS
   ========================================================= */

const EVENTS = Object.freeze({

    APPLICATION_REQUESTED:
        'APPLICATION_REQUESTED',

    DESKTOP_READY:
        'DESKTOP_READY',

    DESKTOP_ERROR:
        'DESKTOP_ERROR',

});


/* =========================================================
   CONFIGURACIÓN
   ========================================================= */

const DESKTOP_CONFIG = Object.freeze({

    clockInterval: 1000,

    locale: 'es-MX',

});


/* =========================================================
   DESKTOP MANAGER
   ========================================================= */

class Desktop {

    constructor() {

        this.initialized = false;

        this.clockTimer = null;

        this.boundHandlers = {

            startButtonClick:
                this.handleStartButtonClick.bind(this),

            applicationClick:
                this.handleApplicationClick.bind(this),

            documentPointerDown:
                this.handleDocumentPointerDown.bind(this),

        };


        this.dom = {

            desktop:
                null,

            startButton:
                null,

            startMenu:
                null,

            applicationMenu:
                null,

            systemStatus:
                null,

            systemStatusIndicator:
                null,

            systemStatusText:
                null,

            clock:
                null,

            desktopArea:
                null,

        };

    }


    /* =====================================================
       INICIALIZACIÓN
       ===================================================== */

    /**
     * Inicializa el Desktop Manager.
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

            this.updateClock();

            this.startClock();

            this.setSystemStatus(
                'ready',
                'SISTEMA LISTO'
            );


            this.initialized = true;


            Kernel.publish(
                EVENTS.DESKTOP_READY,
                {

                    timestamp:
                        new Date().toISOString(),

                }
            );


            console.info(
                '[CIIS Desktop] Inicializado correctamente.'
            );

        } catch (error) {

            this.handleError(error);

        }

    }


    /* =====================================================
       DOM
       ===================================================== */

    /**
     * Resuelve las referencias del DOM.
     *
     * @returns {void}
     */
    resolveDOM() {

        this.dom.desktop =
            document.getElementById(
                'desktop'
            );


        this.dom.startButton =
            document.getElementById(
                'start-button'
            );


        this.dom.startMenu =
            document.getElementById(
                'start-menu'
            );


        this.dom.applicationMenu =
            document.getElementById(
                'application-menu'
            );


        this.dom.systemStatus =
            document.getElementById(
                'system-status'
            );


        this.dom.systemStatusIndicator =
            document.getElementById(
                'system-status-indicator'
            );


        this.dom.systemStatusText =
            document.getElementById(
                'system-status-text'
            );


        this.dom.clock =
            document.getElementById(
                'clock'
            );


        this.dom.desktopArea =
            document.getElementById(
                'desktop-area'
            );

    }


    /**
     * Valida las referencias DOM necesarias.
     *
     * @returns {void}
     */
    validateDOM() {

        const required = [

            [
                'desktop',
                this.dom.desktop,
            ],

            [
                'start-button',
                this.dom.startButton,
            ],

            [
                'start-menu',
                this.dom.startMenu,
            ],

            [
                'application-menu',
                this.dom.applicationMenu,
            ],

            [
                'system-status',
                this.dom.systemStatus,
            ],

            [
                'system-status-indicator',
                this.dom.systemStatusIndicator,
            ],

            [
                'system-status-text',
                this.dom.systemStatusText,
            ],

            [
                'clock',
                this.dom.clock,
            ],

            [
                'desktop-area',
                this.dom.desktopArea,
            ],

        ];


        const missing =
            required
                .filter(
                    ([, element]) => !element
                )
                .map(
                    ([id]) => id
                );


        if (missing.length > 0) {

            throw new Error(
                `[CIIS Desktop] Elementos DOM ausentes: ${missing.join(', ')}`
            );

        }

    }


    /* =====================================================
       EVENTOS DOM
       ===================================================== */

    /**
     * Registra los eventos del escritorio.
     *
     * @returns {void}
     */
    bindEvents() {

        this.dom.startButton.addEventListener(
            'click',
            this.boundHandlers.startButtonClick
        );


        this.dom.applicationMenu.addEventListener(
            'click',
            this.boundHandlers.applicationClick
        );


        document.addEventListener(
            'pointerdown',
            this.boundHandlers.documentPointerDown
        );

    }


    /**
     * Elimina los eventos del escritorio.
     *
     * @returns {void}
     */
    unbindEvents() {

        if (this.dom.startButton) {

            this.dom.startButton.removeEventListener(
                'click',
                this.boundHandlers.startButtonClick
            );

        }


        if (this.dom.applicationMenu) {

            this.dom.applicationMenu.removeEventListener(
                'click',
                this.boundHandlers.applicationClick
            );

        }


        document.removeEventListener(
            'pointerdown',
            this.boundHandlers.documentPointerDown
        );

    }


    /* =====================================================
       MENÚ PRINCIPAL
       ===================================================== */

    /**
     * Maneja el botón CIIS.
     *
     * @returns {void}
     */
    handleStartButtonClick() {

        this.toggleStartMenu();

    }


    /**
     * Alterna la visibilidad del menú principal.
     *
     * @returns {void}
     */
    toggleStartMenu() {

        if (!this.dom.startMenu) {
            return;
        }


        const willOpen =
            this.dom.startMenu.hidden;


        this.dom.startMenu.hidden =
            !willOpen;


        this.dom.startButton.setAttribute(
            'aria-expanded',
            String(willOpen)
        );

    }


    /**
     * Abre el menú principal.
     *
     * @returns {void}
     */
    openStartMenu() {

        if (!this.dom.startMenu) {
            return;
        }


        this.dom.startMenu.hidden =
            false;


        if (this.dom.startButton) {

            this.dom.startButton.setAttribute(
                'aria-expanded',
                'true'
            );

        }

    }


    /**
     * Cierra el menú principal.
     *
     * @returns {void}
     */
    closeStartMenu() {

        if (!this.dom.startMenu) {
            return;
        }


        this.dom.startMenu.hidden =
            true;


        if (this.dom.startButton) {

            this.dom.startButton.setAttribute(
                'aria-expanded',
                'false'
            );

        }

    }


    /**
     * Procesa clics fuera del menú.
     *
     * @param {PointerEvent} event
     * @returns {void}
     */
    handleDocumentPointerDown(event) {

        if (
            !this.dom.startMenu ||
            this.dom.startMenu.hidden
        ) {

            return;

        }


        if (
            this.dom.startMenu.contains(
                event.target
            )
        ) {

            return;

        }


        if (
            this.dom.startButton &&
            this.dom.startButton.contains(
                event.target
            )
        ) {

            return;

        }


        this.closeStartMenu();

    }


    /* =====================================================
       APLICACIONES
       ===================================================== */

    /**
     * Atiende la selección de una aplicación.
     *
     * @param {MouseEvent} event
     * @returns {void}
     */
    handleApplicationClick(event) {

        const button =
            event.target.closest(
                '[data-application]'
            );


        if (!button) {
            return;
        }


        if (
            !this.dom.applicationMenu.contains(
                button
            )
        ) {

            return;

        }


        const application =
            button.dataset.application;


        if (!application) {
            return;
        }


        this.requestApplication(
            application
        );


        this.closeStartMenu();

    }


    /**
     * Solicita la apertura de una aplicación.
     *
     * @param {string} application
     * @returns {void}
     */
    requestApplication(application) {

        const normalized =
            String(application ?? '').trim();


        if (!normalized) {
            return;
        }


        Kernel.publish(
            EVENTS.APPLICATION_REQUESTED,
            {

                application:
                    normalized,

                source:
                    'desktop',

                timestamp:
                    new Date().toISOString(),

            }
        );

    }


    /* =====================================================
       RELOJ
       ===================================================== */

    /**
     * Inicia el reloj.
     *
     * @returns {void}
     */
    startClock() {

        this.stopClock();


        this.clockTimer =
            window.setInterval(
                () => {

                    this.updateClock();

                },
                DESKTOP_CONFIG.clockInterval
            );

    }


    /**
     * Detiene el reloj.
     *
     * @returns {void}
     */
    stopClock() {

        if (
            this.clockTimer !== null
        ) {

            window.clearInterval(
                this.clockTimer
            );


            this.clockTimer =
                null;

        }

    }


    /**
     * Actualiza la hora mostrada.
     *
     * @returns {void}
     */
    updateClock() {

        if (!this.dom.clock) {
            return;
        }


        const now =
            new Date();


        this.dom.clock.textContent =
            now.toLocaleTimeString(
                DESKTOP_CONFIG.locale,
                {

                    hour:
                        '2-digit',

                    minute:
                        '2-digit',

                    second:
                        '2-digit',

                    hour12:
                        false,

                }
            );

    }


    /* =====================================================
       ESTADO DEL SISTEMA
       ===================================================== */

    /**
     * Actualiza el estado visual del sistema.
     *
     * @param {string} status
     * @param {string} text
     * @returns {void}
     */
    setSystemStatus(
        status,
        text
    ) {

        if (
            this.dom.systemStatusIndicator
        ) {

            this.dom.systemStatusIndicator.dataset.status =
                status;

        }


        if (
            this.dom.systemStatusText
        ) {

            this.dom.systemStatusText.textContent =
                text;

        }

    }


    /**
     * Devuelve el estado visual actual.
     *
     * @returns {string}
     */
    getSystemStatus() {

        if (
            !this.dom.systemStatusIndicator
        ) {

            return 'unknown';

        }


        return (
            this.dom.systemStatusIndicator
                .dataset
                .status ??
            'unknown'
        );

    }


    /* =====================================================
       CONSULTAS
       ===================================================== */

    /**
     * Comprueba si el escritorio está inicializado.
     *
     * @returns {boolean}
     */
    isReady() {

        return this.initialized;

    }


    /**
     * Devuelve referencias DOM del escritorio.
     *
     * @returns {Object}
     */
    getDOM() {

        return this.dom;

    }


    /* =====================================================
       ERROR
       ===================================================== */

    /**
     * Maneja errores del Desktop Manager.
     *
     * @param {Error} error
     * @returns {void}
     */
    handleError(error) {

        console.error(
            '[CIIS Desktop] Error.',
            error
        );


        this.setSystemStatus(
            'error',
            'ERROR DEL SISTEMA'
        );


        Kernel.publish(
            EVENTS.DESKTOP_ERROR,
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
     * Libera recursos del Desktop Manager.
     *
     * @returns {void}
     */
    destroy() {

        this.stopClock();

        this.unbindEvents();


        this.closeStartMenu();


        this.initialized =
            false;

    }

}


/* =========================================================
   INSTANCIA ÚNICA
   ========================================================= */

const desktop =
    new Desktop();


/* =========================================================
   EXPORTACIONES
   ========================================================= */

export {

    Desktop,

    desktop,

    DESKTOP_CONFIG,

    EVENTS as DesktopEvents,

};