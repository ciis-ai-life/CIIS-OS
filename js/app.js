/**
 * CIIS OS
 * Application Bootstrap
 *
 * Archivo:
 *     js/app.js
 *
 * Responsabilidad:
 *     Punto único de entrada y orquestación de CIIS OS.
 *
 * Arquitectura:
 *
 *     index.html
 *          │
 *          ▼
 *        app.js
 *          │
 *          ├── Kernel / EventBus
 *          ├── Desktop
 *          ├── WindowManager
 *          └── CIISMATRÍA
 *
 * IMPORTANTE:
 *     app.js coordina el arranque.
 *     No contiene lógica de ventanas.
 *     No contiene lógica de escritorio.
 *     No contiene lógica matemática de CIISMATRÍA.
 *     No contiene lógica PIC-140.
 */

import { Kernel } from './kernel/eventBus.js';

import {
    desktop
} from './desktop.js';

import {
    windowManager
} from './windows.js';

import {
    ciismatria
} from './ciismatria.js';


/* =========================================================
   CONFIGURACIÓN
   ========================================================= */

const APP_CONFIG = Object.freeze({

    name: 'CIIS OS',

    version: '1.0.0',

    environment: 'production',

    kernel: 'EventBus',

});


/* =========================================================
   ESTADOS
   ========================================================= */

const AppState = Object.freeze({

    BOOTING: 'BOOTING',

    READY: 'READY',

    ERROR: 'ERROR',

});


let currentState = AppState.BOOTING;


/* =========================================================
   CONTROL DE ARRANQUE
   ========================================================= */

let bootstrapPromise = null;


/* =========================================================
   INICIALIZACIÓN
   ========================================================= */

/**
 * Inicia CIIS OS.
 *
 * El arranque se ejecuta una sola vez.
 *
 * Orden:
 *
 *     1. Resolver DOM.
 *     2. Inicializar Desktop.
 *     3. Inicializar WindowManager.
 *     4. Inicializar CIISMATRÍA.
 *     5. Publicar SYSTEM_READY.
 *
 * @returns {Promise<void>}
 */
async function bootstrap() {

    if (bootstrapPromise) {

        return bootstrapPromise;

    }


    bootstrapPromise =
        performBootstrap();


    return bootstrapPromise;

}


/**
 * Ejecuta físicamente el proceso de arranque.
 *
 * @returns {Promise<void>}
 */
async function performBootstrap() {

    currentState =
        AppState.BOOTING;


    try {

        validateRuntime();

        validateDOM();

        registerKernelEvents();

        initializeDesktop();

        initializeWindowManager();

        initializeCIISMATRIA();


        currentState =
            AppState.READY;


        Kernel.publish(
            'SYSTEM_READY',
            {

                application:
                    APP_CONFIG.name,

                version:
                    APP_CONFIG.version,

                state:
                    currentState,

                timestamp:
                    new Date().toISOString(),

            }
        );


        console.info(
            `[CIIS OS] ${APP_CONFIG.name} ${APP_CONFIG.version} iniciado correctamente.`
        );

    } catch (error) {

        currentState =
            AppState.ERROR;


        handleBootError(
            error
        );


        throw error;

    }

}


/* =========================================================
   VALIDACIÓN DEL ENTORNO
   ========================================================= */

/**
 * Comprueba las capacidades mínimas del entorno.
 *
 * @returns {void}
 */
function validateRuntime() {

    if (
        typeof document === 'undefined'
    ) {

        throw new Error(
            '[CIIS OS] El entorno DOM no está disponible.'
        );

    }


    if (
        typeof window === 'undefined'
    ) {

        throw new Error(
            '[CIIS OS] El objeto Window no está disponible.'
        );

    }


    if (
        typeof Kernel?.publish !== 'function' ||
        typeof Kernel?.subscribe !== 'function'
    ) {

        throw new Error(
            '[CIIS OS] Kernel/EventBus no está disponible.'
        );

    }

}


/* =========================================================
   VALIDACIÓN DEL DOM
   ========================================================= */

/**
 * Comprueba que index.html contenga los elementos
 * estructurales requeridos por CIIS OS.
 *
 * @returns {void}
 */
function validateDOM() {

    const requiredElements = [

        'ciis-os',

        'desktop',

        'system-bar',

        'start-button',

        'start-menu',

        'system-status',

        'system-status-indicator',

        'system-status-text',

        'clock',

        'application-menu',

        'desktop-area',

        'window-manager',

    ];


    const missingElements =
        requiredElements.filter(
            id =>
                !document.getElementById(id)
        );


    if (
        missingElements.length > 0
    ) {

        throw new Error(
            `[CIIS OS] Elementos DOM requeridos ausentes: ${missingElements.join(', ')}`
        );

    }

}


/* =========================================================
   EVENTOS DEL KERNEL
   ========================================================= */

/**
 * Registra los listeners globales de la aplicación.
 *
 * @returns {void}
 */
function registerKernelEvents() {

    Kernel.subscribe(
        'SYSTEM_ERROR',
        handleSystemError
    );


    Kernel.subscribe(
        'DESKTOP_ERROR',
        handleDesktopError
    );


    Kernel.subscribe(
        'WINDOW_MANAGER_ERROR',
        handleWindowManagerError
    );


    Kernel.subscribe(
        'CIISMATRIA_ERROR',
        handleCIISMATRIAError
    );

}


/* =========================================================
   INICIALIZACIÓN DE COMPONENTES
   ========================================================= */

/**
 * Inicializa el Desktop Manager.
 *
 * @returns {void}
 */
function initializeDesktop() {

    if (
        !desktop ||
        typeof desktop.initialize !== 'function'
    ) {

        throw new Error(
            '[CIIS OS] Desktop Manager no está disponible.'
        );

    }


    desktop.initialize();


    if (
        !desktop.initialized
    ) {

        throw new Error(
            '[CIIS OS] Desktop Manager no pudo inicializarse.'
        );

    }

}


/**
 * Inicializa el Window Manager.
 *
 * @returns {void}
 */
function initializeWindowManager() {

    if (
        !windowManager ||
        typeof windowManager.initialize !== 'function'
    ) {

        throw new Error(
            '[CIIS OS] WindowManager no está disponible.'
        );

    }


    windowManager.initialize();


    if (
        !windowManager.initialized
    ) {

        throw new Error(
            '[CIIS OS] WindowManager no pudo inicializarse.'
        );

    }

}


/**
 * Inicializa CIISMATRÍA.
 *
 * @returns {void}
 */
function initializeCIISMATRIA() {

    if (
        !ciismatria ||
        typeof ciismatria.initialize !== 'function'
    ) {

        throw new Error(
            '[CIIS OS] CIISMATRÍA no está disponible.'
        );

    }


    ciismatria.initialize();


    if (
        !ciismatria.initialized
    ) {

        throw new Error(
            '[CIIS OS] CIISMATRÍA no pudo inicializarse.'
        );

    }

}


/* =========================================================
   MANEJO DE EVENTOS DEL SISTEMA
   ========================================================= */

/**
 * Maneja errores globales del sistema.
 *
 * @param {Object} payload
 * @returns {void}
 */
function handleSystemError(payload) {

    console.error(
        '[CIIS OS] SYSTEM_ERROR',
        payload
    );

}


/**
 * Maneja errores del Desktop Manager.
 *
 * @param {Object} payload
 * @returns {void}
 */
function handleDesktopError(payload) {

    console.error(
        '[CIIS OS] DESKTOP_ERROR',
        payload
    );

}


/**
 * Maneja errores del WindowManager.
 *
 * @param {Object} payload
 * @returns {void}
 */
function handleWindowManagerError(payload) {

    console.error(
        '[CIIS OS] WINDOW_MANAGER_ERROR',
        payload
    );

}


/**
 * Maneja errores de CIISMATRÍA.
 *
 * @param {Object} payload
 * @returns {void}
 */
function handleCIISMATRIAError(payload) {

    console.error(
        '[CIIS OS] CIISMATRIA_ERROR',
        payload
    );

}


/* =========================================================
   ERROR DE ARRANQUE
   ========================================================= */

/**
 * Maneja un error crítico durante el arranque.
 *
 * @param {Error} error
 * @returns {void}
 */
function handleBootError(error) {

    console.error(
        '[CIIS OS] Error crítico durante el arranque.',
        error
    );


    const statusText =
        document.getElementById(
            'system-status-text'
        );


    const statusIndicator =
        document.getElementById(
            'system-status-indicator'
        );


    const startButton =
        document.getElementById(
            'start-button'
        );


    const startMenu =
        document.getElementById(
            'start-menu'
        );


    if (statusText) {

        statusText.textContent =
            'ERROR DEL SISTEMA';

    }


    if (statusIndicator) {

        statusIndicator.dataset.status =
            'error';

    }


    if (startButton) {

        startButton.disabled =
            true;

    }


    if (startMenu) {

        startMenu.hidden =
            true;

    }


    try {

        Kernel.publish(
            'SYSTEM_ERROR',
            {

                application:
                    APP_CONFIG.name,

                version:
                    APP_CONFIG.version,

                state:
                    currentState,

                error: {

                    name:
                        error?.name ??
                        'Error',

                    message:
                        error?.message ??
                        'Error desconocido durante el arranque.',

                },

                timestamp:
                    new Date().toISOString(),

            }
        );

    } catch (publishError) {

        console.error(
            '[CIIS OS] No fue posible publicar SYSTEM_ERROR.',
            publishError
        );

    }

}


/* =========================================================
   ESTADO Y CONFIGURACIÓN
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
 * Devuelve la configuración inmutable de CIIS OS.
 *
 * @returns {Object}
 */
function getAppConfig() {

    return APP_CONFIG;

}


/* =========================================================
   ARRANQUE AUTOMÁTICO
   ========================================================= */

/**
 * app.js es cargado como ES Module desde index.html.
 *
 * El arranque espera explícitamente a que el DOM esté
 * disponible antes de inicializar los componentes.
 */
if (
    document.readyState === 'loading'
) {

    document.addEventListener(
        'DOMContentLoaded',
        () => {

            bootstrap().catch(
                () => {
                    /*
                     * El error ya fue tratado por
                     * handleBootError().
                     */
                }
            );

        },
        {
            once: true,
        }
    );

} else {

    bootstrap().catch(
        () => {
            /*
             * El error ya fue tratado por
             * handleBootError().
             */
        }
    );

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