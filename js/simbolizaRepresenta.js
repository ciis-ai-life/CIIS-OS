/**
 * CIIS OS
 * Simboliza y Representa Application
 *
 * Archivo:
 *     js/simbolizaRepresenta.js
 *
 * Responsabilidad:
 *     Integrar CIIS-DOC-BASE-001 como una aplicación
 *     documental dentro de CIIS OS.
 *
 * IMPORTANTE:
 *     Este módulo NO modifica:
 *       - Desktop
 *       - WindowManager
 *       - Kernel
 *       - CIISMATRÍA
 *       - PIC-140
 *
 *     El documento fuente permanece en:
 *
 *         /docs/CIIS-DOC-BASE-001.html
 */

import { Kernel } from './kernel/eventBus.js';

import {
    windowManager
} from './windows.js';


/* =========================================================
   CONFIGURACIÓN
   ========================================================= */

const SIMBOLIZA_REPRESENTA_CONFIG = Object.freeze({

    id:
        'simboliza-representa',

    name:
        'Simboliza y Representa',

    version:
        '1.0.0',

    documentPath:
        './docs/CIIS-DOC-BASE-001.html',

    window: Object.freeze({

        width:
            820,

        height:
            620,

        x:
            60,

        y:
            40

    })

});


/* =========================================================
   EVENTOS
   ========================================================= */

const EVENTS = Object.freeze({

    OPENED:
        'SIMBOLIZA_REPRESENTA_OPENED',

    CLOSED:
        'SIMBOLIZA_REPRESENTA_CLOSED',

    READY:
        'SIMBOLIZA_REPRESENTA_READY',

    ERROR:
        'SIMBOLIZA_REPRESENTA_ERROR'

});


/* =========================================================
   CLASE PRINCIPAL
   ========================================================= */

class SimbolizaRepresenta {

    constructor() {

        this.initialized =
            false;

        this.windowId =
            null;

        this.unsubscribeApplication =
            null;

        this.unsubscribeWindowClosed =
            null;

    }


    /* =====================================================
       INICIALIZACIÓN
       ===================================================== */

    initialize() {

        if (
            this.initialized
        ) {

            return;

        }


        try {

            this.subscribeToKernel();

            this.initialized =
                true;


            Kernel.publish(
                EVENTS.READY,
                {

                    application:
                        SIMBOLIZA_REPRESENTA_CONFIG.id,

                    version:
                        SIMBOLIZA_REPRESENTA_CONFIG.version,

                    document:
                        SIMBOLIZA_REPRESENTA_CONFIG.documentPath,

                    timestamp:
                        new Date().toISOString()

                }
            );


            console.info(
                '[CIIS OS] Simboliza y Representa inicializado.'
            );

        } catch (error) {

            this.handleError(
                error
            );

            throw error;

        }

    }


    /* =====================================================
       SUSCRIPCIONES
       ===================================================== */

    subscribeToKernel() {

        this.unsubscribeApplication =
            Kernel.subscribe(
                'APPLICATION_REQUESTED',
                this.handleApplicationRequest.bind(this)
            );


        this.unsubscribeWindowClosed =
            Kernel.subscribe(
                'WINDOW_CLOSED',
                this.handleWindowClosed.bind(this)
            );

    }


    /* =====================================================
       SOLICITUD DE APLICACIÓN
       ===================================================== */

    handleApplicationRequest(payload) {

        if (
            !payload
        ) {

            return;

        }


        if (
            payload.application !==
            SIMBOLIZA_REPRESENTA_CONFIG.id
        ) {

            return;

        }


        this.open();

    }


    /* =====================================================
       CIERRE DE VENTANA
       ===================================================== */

    handleWindowClosed(payload) {

        if (
            !payload
        ) {

            return;

        }


        if (
            payload.windowId !==
            this.windowId
        ) {

            return;

        }


        this.windowId =
            null;


        Kernel.publish(
            EVENTS.CLOSED,
            {

                timestamp:
                    new Date().toISOString()

            }
        );

    }


    /* =====================================================
       DIMENSIONES RESPONSIVE
       ===================================================== */

    getResponsiveWindow() {

        /*
         * En pantallas pequeñas adaptamos la ventana
         * al espacio realmente disponible.
         *
         * En escritorio conservamos las dimensiones
         * originales de CIIS-DOC-BASE-001.
         */

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


        if (
            !isMobile
        ) {

            return {

                width:
                    SIMBOLIZA_REPRESENTA_CONFIG.window.width,

                height:
                    SIMBOLIZA_REPRESENTA_CONFIG.window.height,

                x:
                    SIMBOLIZA_REPRESENTA_CONFIG.window.x,

                y:
                    SIMBOLIZA_REPRESENTA_CONFIG.window.y

            };

        }


        /*
         * Android / pantalla pequeña:
         *
         * Dejamos pequeños márgenes para que la ventana
         * no quede pegada a los bordes del escritorio.
         */

        const horizontalMargin =
            12;

        const verticalMargin =
            12;


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
                    SIMBOLIZA_REPRESENTA_CONFIG.window.width,
                    availableWidth
                ),

            height:
                Math.min(
                    SIMBOLIZA_REPRESENTA_CONFIG.window.height,
                    availableHeight
                ),

            x:
                horizontalMargin,

            y:
                verticalMargin

        };

    }


    /* =====================================================
       APERTURA
       ===================================================== */

    open() {

        try {

            /*
             * Si la ventana ya existe, no creamos otra.
             * Simplemente la restauramos y enfocamos.
             */

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
                            new Date().toISOString()

                    }
                );


                return windowManager.getWindow(
                    this.windowId
                );

            }


            /*
             * Determinar las dimensiones adecuadas
             * para el dispositivo actual.
             */

            const responsiveWindow =
                this.getResponsiveWindow();


            /*
             * Crear una nueva ventana.
             */

            const windowState =
                windowManager.createWindow({

                    id:
                        'simboliza-representa-window',

                    title:
                        'Simboliza y Representa',

                    width:
                        responsiveWindow.width,

                    height:
                        responsiveWindow.height,

                    x:
                        responsiveWindow.x,

                    y:
                        responsiveWindow.y,

                    content:
                        this.buildInterface()

                });


            this.windowId =
                windowState.id;


            Kernel.publish(
                EVENTS.OPENED,
                {

                    windowId:
                        this.windowId,

                    existing:
                        false,

                    document:
                        SIMBOLIZA_REPRESENTA_CONFIG.documentPath,

                    timestamp:
                        new Date().toISOString()

                }
            );


            return windowState;

        } catch (error) {

            this.handleError(
                error
            );

            return null;

        }

    }


    /* =====================================================
       INTERFAZ DOCUMENTAL
       ===================================================== */

    buildInterface() {

        return `

            <div
                class="ciis-document-viewer"
                style="
                    width: 100%;
                    height: 100%;
                    min-width: 0;
                    min-height: 0;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    background: #0f172a;
                "
            >

                <div
                    style="
                        flex: 0 0 auto;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 1rem;
                        padding: 0.65rem 0.9rem;
                        border-bottom: 1px solid #334155;
                        background: #1e293b;
                        color: #e2e8f0;
                        font-family: system-ui, -apple-system, sans-serif;
                        font-size: 0.85rem;
                    "
                >

                    <span>
                        Documento Base · CIIS-DOC-BASE-001
                    </span>

                    <span
                        style="
                            color: #4ade80;
                            font-size: 0.75rem;
                        "
                    >
                        PÚBLICO · v1.1
                    </span>

                </div>


                <iframe
                    src="./docs/CIIS-DOC-BASE-001.html"
                    title="CIIS-DOC-BASE-001 — Simboliza y Representa"
                    style="
                        flex: 1 1 auto;
                        width: 100%;
                        height: 100%;
                        min-width: 0;
                        min-height: 0;
                        border: 0;
                        background: #0f172a;
                    "
                    loading="eager"
                ></iframe>

            </div>

        `;

    }


    /* =====================================================
       MANEJO DE ERRORES
       ===================================================== */

    handleError(error) {

        console.error(
            '[CIIS OS] Error en Simboliza y Representa.',
            error
        );


        Kernel.publish(
            EVENTS.ERROR,
            {

                application:
                    SIMBOLIZA_REPRESENTA_CONFIG.id,

                error: {

                    name:
                        error?.name ??
                        'Error',

                    message:
                        error?.message ??
                        'Error desconocido.'

                },

                timestamp:
                    new Date().toISOString()

            }
        );

    }


    /* =====================================================
       DESTRUCCIÓN
       ===================================================== */

    destroy() {

        if (
            typeof this.unsubscribeApplication ===
            'function'
        ) {

            this.unsubscribeApplication();

            this.unsubscribeApplication =
                null;

        }


        if (
            typeof this.unsubscribeWindowClosed ===
            'function'
        ) {

            this.unsubscribeWindowClosed();

            this.unsubscribeWindowClosed =
                null;

        }


        this.windowId =
            null;

        this.initialized =
            false;

    }

}


/* =========================================================
   INSTANCIA ÚNICA
   ========================================================= */

const simbolizaRepresenta =
    new SimbolizaRepresenta();


/* =========================================================
   EXPORTACIONES
   ========================================================= */

export {

    SimbolizaRepresenta,

    simbolizaRepresenta,

    SIMBOLIZA_REPRESENTA_CONFIG,

    EVENTS as SimbolizaRepresentaEvents

};