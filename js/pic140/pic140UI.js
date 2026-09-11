/**
 * CIIS OS
 * PIC-140 User Interface
 *
 * Archivo:
 *     js/pic140/pic140UI.js
 *
 * Responsabilidad:
 *     Proporcionar la interfaz visual del motor PIC-140
 *     dentro de CIIS OS.
 *
 * IMPORTANTE:
 *     Este módulo NO modifica la lógica interna del motor.
 *
 *     Motor:
 *         ./pic140.js
 *
 *     Interfaz:
 *         ./pic140UI.js
 */

import { Kernel } from '../kernel/eventBus.js';

import {
    windowManager
} from '../windows.js';

import {
    PIC140
} from './pic140.js';


/* =========================================================
   CONFIGURACIÓN
   ========================================================= */

const PIC140_UI_CONFIG = Object.freeze({

    id:
        'pic140',

    name:
        'Auditoría PIC-140',

    version:
        '1.0.0',

    window: Object.freeze({

        width:
            820,

        height:
            620,

        x:
            50,

        y:
            40

    })

});


/* =========================================================
   EVENTOS
   ========================================================= */

const PIC140_UI_EVENTS = Object.freeze({

    OPENED:
        'PIC140_UI_OPENED',

    CLOSED:
        'PIC140_UI_CLOSED',

    READY:
        'PIC140_UI_READY',

    ERROR:
        'PIC140_UI_ERROR',

    REFRESHED:
        'PIC140_UI_REFRESHED'

});


/* =========================================================
   CLASE DE INTERFAZ
   ========================================================= */

class PIC140UI {

    constructor() {

        this.initialized =
            false;

        this.windowId =
            null;

        this.engineInitPromise =
            null;

        this.unsubscribeApplication =
            null;

        this.unsubscribeWindowClosed =
            null;

        this.unsubscribeLogged =
            null;

        this.unsubscribeError =
            null;

    }


    /* =====================================================
       INICIALIZACIÓN DE LA INTERFAZ
       ===================================================== */

    initialize() {

        if (
            this.initialized
        ) {

            return;

        }


        this.subscribeToKernel();


        this.initialized =
            true;


        Kernel.publish(
            PIC140_UI_EVENTS.READY,
            {

                application:
                    PIC140_UI_CONFIG.id,

                version:
                    PIC140_UI_CONFIG.version,

                timestamp:
                    new Date().toISOString()

            }
        );


        console.info(
            '[CIIS OS] Interfaz PIC-140 inicializada.'
        );

    }


    /* =====================================================
       EVENTOS DEL KERNEL
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


        this.unsubscribeLogged =
            Kernel.subscribe(
                'PIC140_LOGGED',
                this.handleAuditChange.bind(this)
            );


        this.unsubscribeError =
            Kernel.subscribe(
                'PIC140_ERROR',
                this.handleAuditChange.bind(this)
            );

    }


    /* =====================================================
       SOLICITUD DE APERTURA
       ===================================================== */

    handleApplicationRequest(payload) {

        if (
            !payload
        ) {

            return;

        }


        if (
            payload.application !==
            PIC140_UI_CONFIG.id
        ) {

            return;

        }


        this.open();

    }


    /* =====================================================
       EVENTO DE CIERRE
       ===================================================== */

    handleWindowClosed(payload) {

        if (
            !payload
        ) {

            return;

        }


        /*
         * WindowManager publica actualmente:
         *
         *     { id: windowId }
         *
         * Se conserva windowId como fallback para
         * compatibilidad.
         */

        const closedWindowId =
            payload.id ??
            payload.windowId;


        if (
            closedWindowId !==
            this.windowId
        ) {

            return;

        }


        this.windowId =
            null;


        Kernel.publish(
            PIC140_UI_EVENTS.CLOSED,
            {

                timestamp:
                    new Date().toISOString()

            }
        );

    }


    /* =====================================================
       CAMBIO DEL MOTOR
       ===================================================== */

    handleAuditChange() {

        if (
            !this.windowId
        ) {

            return;

        }


        this.refresh();

    }


    /* =====================================================
       VENTANA RESPONSIVE
       ===================================================== */

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


        if (
            !isMobile
        ) {

            return {

                width:
                    PIC140_UI_CONFIG.window.width,

                height:
                    PIC140_UI_CONFIG.window.height,

                x:
                    PIC140_UI_CONFIG.window.x,

                y:
                    PIC140_UI_CONFIG.window.y

            };

        }


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
                    PIC140_UI_CONFIG.window.width,
                    availableWidth
                ),

            height:
                Math.min(
                    PIC140_UI_CONFIG.window.height,
                    availableHeight
                ),

            x:
                horizontalMargin,

            y:
                verticalMargin

        };

    }


    /* =====================================================
       INICIALIZACIÓN DEL MOTOR
       ===================================================== */

    async initializeEngine() {

        if (
            !PIC140
        ) {

            throw new Error(
                '[PIC-140 UI] Motor PIC-140 no disponible.'
            );

        }


        if (
            typeof PIC140.init !==
            'function'
        ) {

            throw new Error(
                '[PIC-140 UI] El motor PIC-140 no expone init().'
            );

        }


        /*
         * Evita inicializaciones concurrentes.
         */

        if (
            this.engineInitPromise
        ) {

            return this.engineInitPromise;

        }


        this.engineInitPromise =
            PIC140.init();


        try {

            await this.engineInitPromise;

            return true;

        } finally {

            this.engineInitPromise =
                null;

        }

    }


    /* =====================================================
       APERTURA
       ===================================================== */

    async open() {

        try {

            if (
                !PIC140
            ) {

                throw new Error(
                    '[PIC-140 UI] Motor PIC-140 no disponible.'
                );

            }


            /*
             * Si la ventana ya existe, se restaura
             * y se enfoca.
             */

            if (
                this.windowId &&
                typeof windowManager.getWindow ===
                'function' &&
                windowManager.getWindow(
                    this.windowId
                )
            ) {

                if (
                    typeof windowManager.restoreWindow ===
                    'function'
                ) {

                    windowManager.restoreWindow(
                        this.windowId
                    );

                }


                if (
                    typeof windowManager.focusWindow ===
                    'function'
                ) {

                    windowManager.focusWindow(
                        this.windowId
                    );

                }


                await this.initializeEngine();

                this.refresh();

                return;

            }


            /*
             * Calcular dimensiones responsive.
             */

            const responsiveWindow =
                this.getResponsiveWindow();


            /*
             * Crear la ventana ANTES de inicializar
             * el motor.
             *
             * Esto garantiza que la interfaz sea visible
             * aunque IndexedDB o alguna precondición del
             * motor produzca un error.
             */

            const windowState =
                windowManager.createWindow({

                    id:
                        'pic140-window',

                    title:
                        'Auditoría PIC-140',

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


            /*
             * La ventana ya existe visualmente.
             */

            Kernel.publish(
                PIC140_UI_EVENTS.OPENED,
                {

                    windowId:
                        this.windowId,

                    timestamp:
                        new Date().toISOString()

                }
            );


            /*
             * Inicialización real del motor.
             */

            try {

                await this.initializeEngine();

                this.refresh();

            } catch (engineError) {

                this.showEngineError(
                    engineError
                );

            }


            return windowState;

        } catch (error) {

            this.handleError(
                error
            );

        }

    }


    /* =====================================================
       INTERFAZ
       ===================================================== */

    buildInterface() {

        return `

            <div
                id="pic140-ui"
                style="
                    width:100%;
                    height:100%;
                    overflow:auto;
                    box-sizing:border-box;
                    background:#0f172a;
                    color:#e2e8f0;
                    font-family:system-ui,-apple-system,sans-serif;
                    padding:16px;
                "
            >

                <div
                    style="
                        border:1px solid #334155;
                        border-radius:10px;
                        background:#1e293b;
                        padding:16px;
                        margin-bottom:14px;
                    "
                >

                    <div
                        style="
                            display:flex;
                            justify-content:space-between;
                            align-items:center;
                            gap:10px;
                            flex-wrap:wrap;
                        "
                    >

                        <div>

                            <div
                                style="
                                    color:#f8b739;
                                    font-size:1.25rem;
                                    font-weight:700;
                                "
                            >
                                Auditoría PIC-140
                            </div>

                            <div
                                style="
                                    color:#94a3b8;
                                    font-size:0.8rem;
                                    margin-top:3px;
                                "
                            >
                                Motor de auditoría institucional
                            </div>

                        </div>


                        <div
                            id="pic140-status-badge"
                            style="
                                border-radius:999px;
                                padding:5px 10px;
                                font-size:0.75rem;
                                font-weight:700;
                                background:#334155;
                                color:#e2e8f0;
                            "
                        >
                            INICIALIZANDO
                        </div>

                    </div>

                </div>


                <div
                    style="
                        display:grid;
                        grid-template-columns:repeat(
                            auto-fit,
                            minmax(180px,1fr)
                        );
                        gap:10px;
                        margin-bottom:14px;
                    "
                >

                    <div
                        class="pic140-card"
                        style="
                            border:1px solid #334155;
                            border-radius:10px;
                            background:#1e293b;
                            padding:14px;
                        "
                    >

                        <div
                            style="
                                color:#94a3b8;
                                font-size:0.75rem;
                            "
                        >
                            Estado
                        </div>

                        <div
                            id="pic140-ready"
                            style="
                                margin-top:5px;
                                font-size:1.1rem;
                                font-weight:700;
                            "
                        >
                            —
                        </div>

                    </div>


                    <div
                        class="pic140-card"
                        style="
                            border:1px solid #334155;
                            border-radius:10px;
                            background:#1e293b;
                            padding:14px;
                        "
                    >

                        <div
                            style="
                                color:#94a3b8;
                                font-size:0.75rem;
                            "
                        >
                            Eventos en cola
                        </div>

                        <div
                            id="pic140-queue-size"
                            style="
                                margin-top:5px;
                                font-size:1.1rem;
                                font-weight:700;
                            "
                        >
                            —
                        </div>

                    </div>


                    <div
                        class="pic140-card"
                        style="
                            border:1px solid #334155;
                            border-radius:10px;
                            background:#1e293b;
                            padding:14px;
                        "
                    >

                        <div
                            style="
                                color:#94a3b8;
                                font-size:0.75rem;
                            "
                        >
                            Procesamiento
                        </div>

                        <div
                            id="pic140-processing"
                            style="
                                margin-top:5px;
                                font-size:1.1rem;
                                font-weight:700;
                            "
                        >
                            —
                        </div>

                    </div>


                    <div
                        class="pic140-card"
                        style="
                            border:1px solid #334155;
                            border-radius:10px;
                            background:#1e293b;
                            padding:14px;
                        "
                    >

                        <div
                            style="
                                color:#94a3b8;
                                font-size:0.75rem;
                            "
                        >
                            Próxima secuencia
                        </div>

                        <div
                            id="pic140-next-sequence"
                            style="
                                margin-top:5px;
                                font-size:1.1rem;
                                font-weight:700;
                            "
                        >
                            —
                        </div>

                    </div>

                </div>


                <div
                    style="
                        border:1px solid #334155;
                        border-radius:10px;
                        background:#1e293b;
                        padding:16px;
                        margin-bottom:14px;
                    "
                >

                    <div
                        style="
                            color:#38bdf8;
                            font-weight:700;
                            margin-bottom:10px;
                        "
                    >
                        Estado del motor
                    </div>


                    <div
                        id="pic140-detail"
                        style="
                            color:#cbd5e1;
                            font-size:0.9rem;
                            line-height:1.6;
                        "
                    >
                        Inicializando motor PIC-140...
                    </div>

                </div>


                <div
                    style="
                        display:flex;
                        gap:8px;
                        flex-wrap:wrap;
                        margin-bottom:14px;
                    "
                >

                    <button
                        id="pic140-refresh"
                        type="button"
                        style="
                            border:1px solid #334155;
                            border-radius:7px;
                            background:#1e293b;
                            color:#e2e8f0;
                            padding:9px 14px;
                            cursor:pointer;
                            font-family:inherit;
                        "
                    >
                        Actualizar
                    </button>


                    <button
                        id="pic140-drain"
                        type="button"
                        style="
                            border:1px solid #334155;
                            border-radius:7px;
                            background:#1e293b;
                            color:#e2e8f0;
                            padding:9px 14px;
                            cursor:pointer;
                            font-family:inherit;
                        "
                    >
                        Esperar FIFO
                    </button>

                </div>


                <div
                    style="
                        border-top:1px solid #334155;
                        padding-top:12px;
                        color:#64748b;
                        font-size:0.72rem;
                        line-height:1.5;
                    "
                >

                    <div>
                        Protocolo: PIC-140
                    </div>

                    <div>
                        Interfaz: ${PIC140_UI_CONFIG.version}
                    </div>

                    <div>
                        Estado consultado directamente del motor.
                    </div>

                </div>

            </div>

        `;

    }


    /* =====================================================
       REFRESCAR ESTADO
       ===================================================== */

    refresh() {

        if (
            !this.windowId
        ) {

            return;

        }


        if (
            !PIC140 ||
            typeof PIC140.getStatus !==
            'function'
        ) {

            this.showEngineError(
                new Error(
                    '[PIC-140 UI] getStatus() no está disponible.'
                )
            );

            return;

        }


        let status;

        try {

            status =
                PIC140.getStatus();

        } catch (error) {

            this.showEngineError(
                error
            );

            return;

        }


        const root =
            this.findWindowContent();


        if (
            !root
        ) {

            return;

        }


        const readyElement =
            root.querySelector(
                '#pic140-ready'
            );


        const queueElement =
            root.querySelector(
                '#pic140-queue-size'
            );


        const processingElement =
            root.querySelector(
                '#pic140-processing'
            );


        const sequenceElement =
            root.querySelector(
                '#pic140-next-sequence'
            );


        const detailElement =
            root.querySelector(
                '#pic140-detail'
            );


        const badgeElement =
            root.querySelector(
                '#pic140-status-badge'
            );


        if (
            readyElement
        ) {

            readyElement.textContent =
                status.ready
                    ? 'READY'
                    : 'NO READY';

        }


        if (
            queueElement
        ) {

            queueElement.textContent =
                String(
                    status.queueSize
                );

        }


        if (
            processingElement
        ) {

            processingElement.textContent =
                status.processing
                    ? 'ACTIVO'
                    : 'EN ESPERA';

        }


        if (
            sequenceElement
        ) {

            sequenceElement.textContent =
                String(
                    status.nextSequence
                );

        }


        if (
            badgeElement
        ) {

            badgeElement.textContent =
                status.ready
                    ? 'OPERATIVO'
                    : 'NO DISPONIBLE';

        }


        if (
            detailElement
        ) {

            detailElement.innerHTML = `

                <div>
                    <strong>Inicializado:</strong>
                    ${status.initialized ? 'Sí' : 'No'}
                </div>

                <div>
                    <strong>Listo:</strong>
                    ${status.ready ? 'Sí' : 'No'}
                </div>

                <div>
                    <strong>Cola FIFO:</strong>
                    ${status.queueSize} evento(s)
                </div>

                <div>
                    <strong>Procesamiento:</strong>
                    ${status.processing ? 'Activo' : 'Inactivo'}
                </div>

                <div>
                    <strong>Próxima secuencia:</strong>
                    ${status.nextSequence}
                </div>

            `;

        }


        this.attachControls(
            root
        );


        Kernel.publish(
            PIC140_UI_EVENTS.REFRESHED,
            {

                status,

                timestamp:
                    new Date().toISOString()

            }
        );

    }


    /* =====================================================
       MOSTRAR ERROR DEL MOTOR
       ===================================================== */

    showEngineError(error) {

        console.error(
            '[CIIS OS] Error del motor PIC-140.',
            error
        );


        const root =
            this.findWindowContent();


        if (
            !root
        ) {

            return;

        }


        const readyElement =
            root.querySelector(
                '#pic140-ready'
            );


        const badgeElement =
            root.querySelector(
                '#pic140-status-badge'
            );


        const detailElement =
            root.querySelector(
                '#pic140-detail'
            );


        if (
            readyElement
        ) {

            readyElement.textContent =
                'ERROR';

        }


        if (
            badgeElement
        ) {

            badgeElement.textContent =
                'ERROR';

        }


        if (
            detailElement
        ) {

            const message =
                error?.message ??
                'Error desconocido durante la inicialización.';


            detailElement.innerHTML = `

                <div>
                    <strong>Motor PIC-140:</strong>
                    No fue posible inicializarlo.
                </div>

                <div style="
                    margin-top:8px;
                    color:#fca5a5;
                ">
                    ${this.escapeHTML(message)}
                </div>

                <div style="
                    margin-top:10px;
                    color:#94a3b8;
                ">
                    La ventana de auditoría permanece abierta
                    para permitir una nueva consulta.
                </div>

            `;

        }


        Kernel.publish(
            PIC140_UI_EVENTS.ERROR,
            {

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
       CONTROLES
       ===================================================== */

    attachControls(root) {

        const refreshButton =
            root.querySelector(
                '#pic140-refresh'
            );


        const drainButton =
            root.querySelector(
                '#pic140-drain'
            );


        /* =================================================
           BOTÓN ACTUALIZAR
           ================================================= */

        if (
            refreshButton &&
            !refreshButton.dataset.bound
        ) {

            refreshButton.addEventListener(
                'click',
                () => {

                    console.info(
                        '[PIC-140 UI] Click recibido: Actualizar.'
                    );


                    const detailElement =
                        root.querySelector(
                            '#pic140-detail'
                        );


                    const originalText =
                        refreshButton.textContent;


                    refreshButton.disabled =
                        true;

                    refreshButton.textContent =
                        'Consultando...';


                    if (
                        detailElement
                    ) {

                        detailElement.innerHTML = `
                            <div>
                                <strong>PIC-140:</strong>
                                Actualizando estado del motor...
                            </div>
                        `;

                    }


                    try {

                        this.refresh();


                        const refreshedDetail =
                            root.querySelector(
                                '#pic140-detail'
                            );


                        const now =
                            new Date().toLocaleTimeString();


                        if (
                            refreshedDetail
                        ) {

                            refreshedDetail.innerHTML += `
                                <div style="
                                    margin-top:10px;
                                    color:#86efac;
                                    font-weight:700;
                                ">
                                    ✓ ESTADO ACTUALIZADO — ${now}
                                </div>
                            `;

                        }

                    } catch (error) {

                        console.error(
                            '[PIC-140 UI] Error al actualizar.',
                            error
                        );

                        this.showEngineError(
                            error
                        );

                    } finally {

                        refreshButton.disabled =
                            false;

                        refreshButton.textContent =
                            originalText;

                    }

                }
            );


            refreshButton.dataset.bound =
                'true';

        }


        /* =================================================
           BOTÓN ESPERAR FIFO
           ================================================= */

        if (
            drainButton &&
            !drainButton.dataset.bound
        ) {

            drainButton.addEventListener(
                'click',
                async () => {

                    console.info(
                        '[PIC-140 UI] Click recibido: Esperar FIFO.'
                    );


                    const detailElement =
                        root.querySelector(
                            '#pic140-detail'
                        );


                    drainButton.disabled =
                        true;

                    drainButton.textContent =
                        'Procesando FIFO...';


                    let queueBefore =
                        '—';


                    try {

                        const initialStatus =
                            typeof PIC140.getStatus ===
                            'function'
                                ? PIC140.getStatus()
                                : null;


                        if (
                            initialStatus
                        ) {

                            queueBefore =
                                String(
                                    initialStatus.queueSize
                                );

                        }


                        if (
                            detailElement
                        ) {

                            detailElement.innerHTML = `
                                <div>
                                    <strong>PIC-140:</strong>
                                    Procesando cola FIFO...
                                </div>

                                <div style="
                                    margin-top:6px;
                                    color:#94a3b8;
                                ">
                                    Eventos antes del drenaje:
                                    ${queueBefore}
                                </div>
                            `;

                        }


                        await this.initializeEngine();


                        if (
                            typeof PIC140.drain !==
                            'function'
                        ) {

                            throw new Error(
                                '[PIC-140 UI] El motor PIC-140 no expone drain().'
                            );

                        }


                        await PIC140.drain();


                        const finalStatus =
                            typeof PIC140.getStatus ===
                            'function'
                                ? PIC140.getStatus()
                                : null;


                        const queueAfter =
                            finalStatus
                                ? String(
                                    finalStatus.queueSize
                                )
                                : '—';


                        this.refresh();


                        const refreshedDetail =
                            root.querySelector(
                                '#pic140-detail'
                            );


                        const now =
                            new Date().toLocaleTimeString();


                        if (
                            refreshedDetail
                        ) {

                            refreshedDetail.innerHTML += `
                                <div style="
                                    margin-top:10px;
                                    color:#86efac;
                                    font-weight:700;
                                ">
                                    ✓ FIFO COMPLETADA — ${now}
                                </div>

                                <div style="
                                    margin-top:5px;
                                    color:#94a3b8;
                                ">
                                    Antes: ${queueBefore}
                                    · Después: ${queueAfter}
                                </div>
                            `;

                        }

                    } catch (error) {

                        console.error(
                            '[PIC-140 UI] Error al procesar FIFO.',
                            error
                        );


                        this.showEngineError(
                            error
                        );

                    } finally {

                        drainButton.disabled =
                            false;

                        drainButton.textContent =
                            'Esperar FIFO';

                    }

                }
            );


            drainButton.dataset.bound =
                'true';

        }

    }


    /* =====================================================
       OBTENER CONTENIDO DE LA VENTANA
       ===================================================== */

    findWindowContent() {

        if (
            !this.windowId
        ) {

            return null;

        }


        if (
            typeof windowManager.getWindow ===
            'function'
        ) {

            const state =
                windowManager.getWindow(
                    this.windowId
                );


            if (
                state?.element
            ) {

                return state.element;

            }

        }


        return document.getElementById(
            this.windowId
        );

    }


    /* =====================================================
       ESCAPE HTML
       ===================================================== */

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
       MANEJO DE ERROR
       ===================================================== */

    handleError(error) {

        console.error(
            '[CIIS OS] Error en interfaz PIC-140.',
            error
        );


        Kernel.publish(
            PIC140_UI_EVENTS.ERROR,
            {

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

        const subscriptions = [

            this.unsubscribeApplication,

            this.unsubscribeWindowClosed,

            this.unsubscribeLogged,

            this.unsubscribeError

        ];


        for (
            const unsubscribe of subscriptions
        ) {

            if (
                typeof unsubscribe ===
                'function'
            ) {

                unsubscribe();

            }

        }


        this.unsubscribeApplication =
            null;

        this.unsubscribeWindowClosed =
            null;

        this.unsubscribeLogged =
            null;

        this.unsubscribeError =
            null;


        this.windowId =
            null;

        this.engineInitPromise =
            null;

        this.initialized =
            false;

    }

}


/* =========================================================
   INSTANCIA ÚNICA
   ========================================================= */

const pic140UI =
    new PIC140UI();


/* =========================================================
   EXPORTACIONES
   ========================================================= */

export {

    PIC140UI,

    pic140UI,

    PIC140_UI_CONFIG,

    PIC140_UI_EVENTS

};