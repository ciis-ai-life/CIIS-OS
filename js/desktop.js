/**
 * CIIS OS
 * Desktop Manager
 *
 * Archivo:
 *     js/desktop.js
 *
 * Responsabilidad:
 *     Administrar la interfaz funcional del escritorio:
 *
 *     - Menú principal.
 *     - Botón CIIS.
 *     - Reloj del sistema.
 *     - Estado visual del sistema.
 *     - Eventos básicos del escritorio.
 *
 * Arquitectura:
 *     - ES Modules nativos.
 *     - Exportaciones nombradas.
 *     - Comunicación mediante Kernel/EventBus.
 *     - Sin dependencias externas.
 *
 * IMPORTANTE:
 *     Este módulo NO administra ventanas.
 *     Esa responsabilidad corresponde a windows.js.
 */

import { Kernel } from './kernel/eventBus.js';


/* =========================================================
   CONSTANTES
   ========================================================= */

const CLOCK_UPDATE_INTERVAL = 1000;

const EVENTS = Object.freeze({

    SYSTEM_READY: 'SYSTEM_READY',

    SYSTEM_ERROR: 'SYSTEM_ERROR',

    DESKTOP_READY: 'DESKTOP_READY',

    DESKTOP_ERROR: 'DESKTOP_ERROR',

    MENU_OPENED: 'MENU_OPENED',

    MENU_CLOSED: 'MENU_CLOSED',

    APPLICATION_REQUESTED: 'APPLICATION_REQUESTED',

});


/* =========================================================
   DESKTOP MANAGER
   ========================================================= */

class Desktop {

    constructor() {

        this.initialized = false;

        this.clockTimer = null;

        this.menuOpen = false;

        this.dom = {

            desktop: null,

            startButton: null,

            startMenu: null,

            clock: null,

            systemStatusText: null,

            systemStatusIndicator: null,

            applicationMenu: null,

            desktopArea: null,

        };

        this.boundHandlers = {

            startButtonClick:
                this.handleStartButtonClick.bind(this),

            documentClick:
                this.handleDocumentClick.bind(this),

            applicationClick:
                this.handleApplicationClick.bind(this),

        };

    }


    /* =====================================================
       INICIALIZACIÓN
       ===================================================== */

    /**
     * Inicializa el escritorio.
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

            this.startClock();

            this.updateClock();

            this.setSystemStatus(
                'SISTEMA LISTO',
                'ready'
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
                '[CIIS Desktop] Escritorio inicializado correctamente.'
            );

        } catch (error) {

            this.handleError(error);

        }

    }


    /* =====================================================
       DOM
       ===================================================== */

    /**
     * Resuelve las referencias DOM.
     *
     * @returns {void}
     */
    resolveDOM() {

        this.dom.desktop =
            document.getElementById('desktop');

        this.dom.startButton =
            document.getElementById('start-button');

        this.dom.startMenu =
            document.getElementById('start-menu');

        this.dom.clock =
            document.getElementById('clock');

        this.dom.systemStatusText =
            document.getElementById(
                'system-status-text'
            );

        this.dom.systemStatusIndicator =
            document.getElementById(
                'system-status-indicator'
            );

        this.dom.applicationMenu =
            document.getElementById(
                'application-menu'
            );

        this.dom.desktopArea =
            document.getElementById(
                'desktop-area'
            );

    }


    /**
     * Valida los elementos necesarios.
     *
     * @returns {void}
     */
    validateDOM() {

        const required = {

            desktop: this.dom.desktop,

            startButton: this.dom.startButton,

            startMenu: this.dom.startMenu,

            clock: this.dom.clock,

            systemStatusText:
                this.dom.systemStatusText,

            systemStatusIndicator:
                this.dom.systemStatusIndicator,

            applicationMenu:
                this.dom.applicationMenu,

            desktopArea:
                this.dom.desktopArea,

        };


        const missing = Object.entries(required)
            .filter(([, element]) => !element)
            .map(([name]) => name);


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


        document.addEventListener(
            'click',
            this.boundHandlers.documentClick
        );


        this.dom.applicationMenu.addEventListener(
            'click',
            this.boundHandlers.applicationClick
        );

    }


    /**
     * Elimina los eventos registrados.
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


        document.removeEventListener(
            'click',
            this.boundHandlers.documentClick
        );


        if (this.dom.applicationMenu) {

            this.dom.applicationMenu.removeEventListener(
                'click',
                this.boundHandlers.applicationClick
            );

        }

    }


    /* =====================================================
       MENÚ PRINCIPAL
       ===================================================== */

    /**
     * Maneja el botón CIIS.
     *
     * @param {MouseEvent} event
     * @returns {void}
     */
    handleStartButtonClick(event) {

        event.stopPropagation();

        if (this.menuOpen) {

            this.closeStartMenu();

        } else {

            this.openStartMenu();

        }

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


        this.dom.startMenu.hidden = false;

        this.dom.startButton.setAttribute(
            'aria-expanded',
            'true'
        );


        this.menuOpen = true;


        Kernel.publish(
            EVENTS.MENU_OPENED,
            {
                timestamp:
                    new Date().toISOString(),
            }
        );

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


        this.dom.startMenu.hidden = true;

        this.dom.startButton.setAttribute(
            'aria-expanded',
            'false'
        );


        this.menuOpen = false;


        Kernel.publish(
            EVENTS.MENU_CLOSED,
            {
                timestamp:
                    new Date().toISOString(),
            }
        );

    }


    /**
     * Maneja clics fuera del menú.
     *
     * @param {MouseEvent} event
     * @returns {void}
     */
    handleDocumentClick(event) {

        if (!this.menuOpen) {
            return;
        }


        const clickedInsideMenu =
            this.dom.startMenu.contains(event.target);

        const clickedStartButton =
            this.dom.startButton.contains(event.target);


        if (
            !clickedInsideMenu &&
            !clickedStartButton
        ) {

            this.closeStartMenu();

        }

    }


    /* =====================================================
       APLICACIONES
       ===================================================== */

    /**
     * Maneja la selección de una aplicación.
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


        const application =
            button.dataset.application;


        if (!application) {
            return;
        }


        this.closeStartMenu();


        Kernel.publish(
            EVENTS.APPLICATION_REQUESTED,
            {
                application,
                timestamp:
                    new Date().toISOString(),
            }
        );

    }


    /* =====================================================
       RELOJ
       ===================================================== */

    /**
     * Inicia el reloj del sistema.
     *
     * @returns {void}
     */
    startClock() {

        this.stopClock();

        this.clockTimer =
            window.setInterval(
                () => this.updateClock(),
                CLOCK_UPDATE_INTERVAL
            );

    }


    /**
     * Detiene el reloj.
     *
     * @returns {void}
     */
    stopClock() {

        if (this.clockTimer !== null) {

            window.clearInterval(
                this.clockTimer
            );

            this.clockTimer = null;

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


        const now = new Date();


        const hours =
            String(now.getHours())
                .padStart(2, '0');


        const minutes =
            String(now.getMinutes())
                .padStart(2, '0');


        const seconds =
            String(now.getSeconds())
                .padStart(2, '0');


        this.dom.clock.textContent =
            `${hours}:${minutes}:${seconds}`;


        this.dom.clock.dateTime =
            now.toISOString();

    }


    /* =====================================================
       ESTADO DEL SISTEMA
       ===================================================== */

    /**
     * Actualiza el estado visual del sistema.
     *
     * @param {string} text
     * @param {string} status
     * @returns {void}
     */
    setSystemStatus(text, status) {

        if (this.dom.systemStatusText) {

            this.dom.systemStatusText.textContent =
                text;

        }


        if (this.dom.systemStatusIndicator) {

            this.dom.systemStatusIndicator.dataset.status =
                status;

        }

    }


    /* =====================================================
       ERROR
       ===================================================== */

    /**
     * Maneja un error del escritorio.
     *
     * @param {Error} error
     * @returns {void}
     */
    handleError(error) {

        console.error(
            '[CIIS Desktop] Error de inicialización.',
            error
        );


        this.setSystemStatus(
            'ERROR DEL ESCRITORIO',
            'error'
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
     * Libera los recursos del escritorio.
     *
     * @returns {void}
     */
    destroy() {

        this.stopClock();

        this.unbindEvents();

        this.initialized = false;

        this.menuOpen = false;

    }

}


/* =========================================================
   INSTANCIA ÚNICA
   ========================================================= */

const desktop = new Desktop();


/* =========================================================
   EXPORTACIONES
   ========================================================= */

export {
    Desktop,
    desktop,
    EVENTS as DesktopEvents,
};
