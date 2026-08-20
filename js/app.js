/**
 * CIIS OS
 * Application Bootstrap
 *
 * Archivo:
 *     js/app.js
 *
 * Responsabilidad:
 *     Punto único de entrada de CIIS OS.
 *
 * Arquitectura:
 *     index.html
 *          │
 *          ▼
 *       app.js
 *          │
 *          └── Kernel / EventBus
 *
 * Los demás módulos serán incorporados progresivamente
 * conforme sean construidos y validados.
 */

import { Kernel } from './kernel/eventBus.js';


/* =========================================================
   CONFIGURACIÓN DEL SISTEMA
   ========================================================= */

const APP_CONFIG = Object.freeze({

    name: 'CIIS OS',

    version: '1.0.0',

    environment: 'production',

    kernel: 'EventBus',

});


/* =========================================================
   ESTADO DEL SISTEMA
   ========================================================= */

const AppState = Object.freeze({

    BOOTING: 'BOOTING',

    READY: 'READY',

    ERROR: 'ERROR',

});


let currentState = AppState.BOOTING;


/* =========================================================
   REFERENCIAS AL DOM
   ========================================================= */

const DOM = {

    root: null,

    desktop: null,

    systemBar: null,

    startButton: null,

    startMenu: null,

    systemStatus: null,

    systemStatusIndicator: null,

    systemStatusText: null,

    clock: null,

    applicationMenu: null,

    desktopArea: null,

    windowManager: null,

};


/* =========================================================
   INICIALIZACIÓN
   ========================================================= */

/**
 * Inicia CIIS OS.
 *
 * Este método constituye el arranque principal de la
 * aplicación después de que el documento HTML haya sido
 * cargado.
 *
 * @returns {Promise<void>}
 */
async function bootstrap() {

    try {

        currentState = AppState.BOOTING;

        resolveDOM();

        validateDOM();

        configureInitialUI();

        registerKernelEvents();

        currentState = AppState.READY;

        Kernel.publish('SYSTEM_READY', {

            application: APP_CONFIG.name,

            version: APP_CONFIG.version,

            state: currentState,

            timestamp: new Date().toISOString(),

        });

        console.info(
            `[CIIS OS] ${APP_CONFIG.name} ${APP_CONFIG.version} iniciado correctamente.`
        );

    } catch (error) {

        currentState = AppState.ERROR;

        handleBootError(error);

    }

}


/* =========================================================
   RESOLUCIÓN DEL DOM
   ========================================================= */

/**
 * Obtiene las referencias de los elementos definidos
 * por index.html.
 *
 * @returns {void}
 */
function resolveDOM() {

    DOM.root =
        document.getElementById('ciis-os');

    DOM.desktop =
        document.getElementById('desktop');

    DOM.systemBar =
        document.getElementById('system-bar');

    DOM.startButton =
        document.getElementById('start-button');

    DOM.startMenu =
        document.getElementById('start-menu');

    DOM.systemStatus =
        document.getElementById('system-status');

    DOM.systemStatusIndicator =
        document.getElementById(
            'system-status-indicator'
        );

    DOM.systemStatusText =
        document.getElementById(
            'system-status-text'
        );

    DOM.clock =
        document.getElementById('clock');

    DOM.applicationMenu =
        document.getElementById(
            'application-menu'
        );

    DOM.desktopArea =
        document.getElementById(
            'desktop-area'
        );

    DOM.windowManager =
        document.getElementById(
            'window-manager'
        );

}


/* =========================================================
   VALIDACIÓN DEL DOM
   ========================================================= */

/**
 * Comprueba que todos los elementos estructurales
 * necesarios estén presentes.
 *
 * @returns {void}
 */
function validateDOM() {

    const requiredElements = {

        'ciis-os': DOM.root,

        'desktop': DOM.desktop,

        'system-bar': DOM.systemBar,

        'start-button': DOM.startButton,

        'start-menu': DOM.startMenu,

        'system-status': DOM.systemStatus,

        'system-status-indicator':
            DOM.systemStatusIndicator,

        'system-status-text':
            DOM.systemStatusText,

        'clock': DOM.clock,

        'application-menu':
            DOM.applicationMenu,

        'desktop-area':
            DOM.desktopArea,

        'window-manager':
            DOM.windowManager,

    };


    const missingElements = Object.entries(
        requiredElements
    )
        .filter(([, element]) => !element)
        .map(([id]) => id);


    if (missingElements.length > 0) {

        throw new Error(
            `[CIIS OS] Elementos DOM requeridos ausentes: ${missingElements.join(', ')}`
        );

    }

}


/* =========================================================
   CONFIGURACIÓN INICIAL DE LA INTERFAZ
   ========================================================= */

/**
 * Establece el estado inicial de la interfaz.
 *
 * @returns {void}
 */
function configureInitialUI() {

    updateSystemStatus(
        'SISTEMA LISTO',
        true
    );


    DOM.startMenu.hidden = true;

    DOM.startButton.setAttribute(
        'aria-expanded',
        'false'
    );


    if (DOM.clock.textContent.trim() === '') {

        DOM.clock.textContent = '--:--:--';

    }

}


/* =========================================================
   EVENTOS DEL KERNEL
   ========================================================= */

/**
 * Registra eventos fundamentales del sistema.
 *
 * @returns {void}
 */
function registerKernelEvents() {

    Kernel.subscribe(
        'SYSTEM_READY',
        handleSystemReady
    );


    Kernel.subscribe(
        'SYSTEM_ERROR',
        handleSystemError
    );

}


/**
 * Respuesta al evento SYSTEM_READY.
 *
 * @param {Object} payload
 * @returns {void}
 */
function handleSystemReady(payload) {

    console.info(
        '[CIIS Kernel] SYSTEM_READY',
        payload
    );

}


/**
 * Respuesta al evento SYSTEM_ERROR.
 *
 * @param {Object} payload
 * @returns {void}
 */
function handleSystemError(payload) {

    console.error(
        '[CIIS Kernel] SYSTEM_ERROR',
        payload
    );

}


/* =========================================================
   ESTADO VISUAL DEL SISTEMA
   ========================================================= */

/**
 * Actualiza el indicador visual del estado del sistema.
 *
 * @param {string} text
 * @param {boolean} ready
 * @returns {void}
 */
function updateSystemStatus(text, ready) {

    DOM.systemStatusText.textContent = text;

    DOM.systemStatusIndicator.dataset.status =
        ready ? 'ready' : 'error';

}


/* =========================================================
   MANEJO DE ERRORES DE ARRANQUE
   ========================================================= */

/**
 * Maneja un error ocurrido durante el arranque.
 *
 * @param {Error} error
 * @returns {void}
 */
function handleBootError(error) {

    console.error(
        '[CIIS OS] Error crítico durante el arranque.',
        error
    );


    if (DOM.systemStatusText) {

        DOM.systemStatusText.textContent =
            'ERROR DEL SISTEMA';

    }


    if (DOM.systemStatusIndicator) {

        DOM.systemStatusIndicator.dataset.status =
            'error';

    }


    if (DOM.startMenu) {

        DOM.startMenu.hidden = true;

    }


    if (DOM.startButton) {

        DOM.startButton.disabled = true;

    }


    Kernel.publish('SYSTEM_ERROR', {

        application: APP_CONFIG.name,

        version: APP_CONFIG.version,

        state: currentState,

        error: {

            name: error?.name ?? 'Error',

            message:
                error?.message ??
                'Error desconocido durante el arranque.',

        },

        timestamp: new Date().toISOString(),

    });

}


/* =========================================================
   API PÚBLICA DE APP
   ========================================================= */

/**
 * Devuelve el estado actual de la aplicación.
 *
 * @returns {string}
 */
function getAppState() {

    return currentState;

}


/**
 * Devuelve una copia de la configuración de aplicación.
 *
 * @returns {Object}
 */
function getAppConfig() {

    return APP_CONFIG;

}


/* =========================================================
   ARRANQUE
   ========================================================= */

/**
 * Esperamos a que el DOM esté completamente disponible.
 *
 * index.html carga app.js como ES Module, por lo que el DOM
 * ya estará disponible en condiciones normales; aun así,
 * este mecanismo hace explícita la dependencia del documento.
 */
if (document.readyState === 'loading') {

    document.addEventListener(
        'DOMContentLoaded',
        bootstrap,
        { once: true }
    );

} else {

    bootstrap();

}


/* =========================================================
   EXPORTACIONES
   ========================================================= */

export {

    bootstrap,

    getAppState,

    getAppConfig,

    AppState,

};
