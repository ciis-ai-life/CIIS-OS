/**
 * CIIS OS
 * PIC-140 — Audit Engine
 *
 * Archivo:
 *     js/pic140/pic140.js
 *
 * Responsabilidad:
 *     Orquestar el pipeline completo de auditoría PIC-140.
 *
 * Pipeline canónico:
 *
 *     KERNEL EVENT
 *          ↓
 *     FIFO
 *          ↓
 *     getLastEvent()
 *          ↓
 *     buildEvent()
 *          ↓
 *     PRE-HASH VALIDATION
 *          ↓
 *     canonicalize()
 *          ↓
 *     calculateHash()
 *          ↓
 *     POST-HASH VALIDATION
 *          ↓
 *     saveEvent()
 *          ↓
 *     PIC140_LOGGED
 *
 * Este módulo NO implementa directamente:
 *
 *     - canonicalización
 *     - SHA-256
 *     - IndexedDB
 *     - generación de ULID
 *     - validación de esquema
 *     - algoritmo FIFO
 *     - verificación criptográfica
 *
 * Esos trabajos pertenecen a sus módulos respectivos.
 */

import {
    FifoQueue,
} from './fifoQueue.js';

import {
    buildEvent,
} from './eventBuilder.js';

import {
    validate,
} from './schemaValidator.js';

import {
    canonicalize,
} from './canonicalizer.js';

import {
    calculateHash,
} from './hashEngine.js';

import {
    StorageAdapter,
} from './storageAdapter.js';

import {
    IntegrityVerifier,
} from './integrityVerifier.js';


/* =========================================================
   EVENTOS PIC-140
   ========================================================= */

const PIC140_EVENTS = Object.freeze({

    LOGGED:
        'PIC140_LOGGED',

    ERROR:
        'PIC140_ERROR',

    INITIALIZED:
        'PIC140_INITIALIZED',

    INTEGRITY_VERIFIED:
        'PIC140_INTEGRITY_VERIFIED',

});


/* =========================================================
   ESTADOS
   ========================================================= */

const PIC140_STATUS = Object.freeze({

    CREATED:
        'CREATED',

    READY:
        'READY',

    SUSPENDED:
        'SUSPENDED',

    ERROR:
        'ERROR',

    DESTROYED:
        'DESTROYED',

});


/* =========================================================
   AUDIT ENGINE
   ========================================================= */

class AuditEngine {

    constructor(options = {}) {

        this.status =
            PIC140_STATUS.CREATED;


        this.storage =
            options.storageAdapter ??
            new StorageAdapter();


        this.integrityVerifier =
            new IntegrityVerifier(
                this.storage
            );


        this.queue =
            new FifoQueue();


        this.publish =
            typeof options.publish === 'function'
                ? options.publish
                : null;


        this.initialized =
            false;


        this.processingCount =
            0;

    }


    /* =====================================================
       INICIALIZACIÓN
       ===================================================== */

    /**
     * Inicializa el AuditEngine.
     *
     * @returns {Promise<Object>}
     */
    async initialize() {

        if (
            this.status ===
            PIC140_STATUS.DESTROYED
        ) {

            throw new Error(
                '[PIC-140] El AuditEngine ya fue destruido.'
            );

        }


        if (
            this.initialized
        ) {

            return {

                status:
                    this.status,

                initialized:
                    true,

            };

        }


        try {

            /* ---------------------------------------------
               PRECONDICIONES CRIPTOGRÁFICAS
               --------------------------------------------- */

            this.verifyRuntimePreconditions();


            /* ---------------------------------------------
               STORAGE
               --------------------------------------------- */

            await this.storage.initialize();

            await this.storage.verifyStorage();


            /* ---------------------------------------------
               FIFO
               --------------------------------------------- */

            this.queue.setProcessor(
                async (
                    request,
                    queueItem
                ) => {

                    return this.processAuditRequest(
                        request,
                        queueItem
                    );

                }
            );


            this.initialized =
                true;


            this.status =
                PIC140_STATUS.READY;


            this.emit(
                PIC140_EVENTS.INITIALIZED,
                {
                    status:
                        this.status,
                }
            );


            console.info(
                '[PIC-140] AuditEngine inicializado correctamente.'
            );


            return {

                status:
                    this.status,

                initialized:
                    true,

            };

        } catch (error) {

            this.status =
                PIC140_STATUS.SUSPENDED;


            this.emitError(
                error
            );


            throw error;

        }

    }


    /* =====================================================
       PRECONDICIONES DE RUNTIME
       ===================================================== */

    /**
     * Verifica las APIs requeridas por PIC-140.
     *
     * @returns {void}
     */
    verifyRuntimePreconditions() {

        if (
            typeof crypto ===
            'undefined'
        ) {

            throw new Error(
                '[PIC-140] Web Crypto API no está disponible.'
            );

        }


        if (
            typeof crypto.subtle ===
            'undefined'
        ) {

            throw new Error(
                '[PIC-140] crypto.subtle no está disponible.'
            );

        }


        if (
            typeof crypto.getRandomValues !==
            'function'
        ) {

            throw new Error(
                '[PIC-140] crypto.getRandomValues() no está disponible.'
            );

        }


        if (
            typeof crypto.randomUUID !==
            'function'
        ) {

            throw new Error(
                '[PIC-140] crypto.randomUUID() no está disponible.'
            );

        }

    }


    /* =====================================================
       RECEPCIÓN DE EVENTOS
       ===================================================== */

    /**
     * Encola una solicitud de auditoría.
     *
     * @param {Object} request
     * @returns {Promise<Object>}
     */
    async enqueue(request) {

        if (
            !this.initialized
        ) {

            throw new Error(
                '[PIC-140] AuditEngine no está inicializado.'
            );

        }


        if (
            this.status !==
            PIC140_STATUS.READY
        ) {

            throw new Error(
                `[PIC-140] El AuditEngine no está disponible. Estado: ${this.status}`
            );

        }


        if (
            request === null ||
            typeof request !== 'object' ||
            Array.isArray(request)
        ) {

            throw new TypeError(
                '[PIC-140] La solicitud de auditoría debe ser un objeto.'
            );

        }


        return this.queue.enqueue(
            request
        );

    }


    /* =====================================================
       PIPELINE PRINCIPAL
       ===================================================== */

    /**
     * Ejecuta el pipeline completo de auditoría.
     *
     * @param {Object} request
     * @param {Object} queueItem
     * @returns {Promise<Object>}
     */
    async processAuditRequest(
        request,
        queueItem
    ) {

        this.processingCount +=
            1;


        try {

            /* =============================================
               1. OBTENER ÚLTIMO EVENTO
               ============================================= */

            const previousEvent =
                await this.storage.getLastEvent();


            /* =============================================
               2. CONSTRUIR EVENTO
               ============================================= */

            const event =
                this.buildAuditEvent(
                    request,
                    previousEvent
                );


            /* =============================================
               3. PRE-HASH VALIDATION
               ============================================= */

            validate(
                event
            );


            /* =============================================
               4. CANONICALIZE
               ============================================= */

            const canonicalData =
                canonicalize(
                    event
                );


            /* =============================================
               5. CALCULATE HASH
               ============================================= */

            const eventHash =
                await calculateHash(
                    canonicalData
                );


            /* =============================================
               6. ASIGNAR HASH
               ============================================= */

            event.event_hash =
                eventHash;


            /* =============================================
               7. POST-HASH VALIDATION
               ============================================= */

            validate(
                event
            );


            /* =============================================
               8. PERSISTENCIA
               ============================================= */

            const savedEvent =
                await this.storage.saveEvent(
                    event
                );


            /* =============================================
               9. PUBLICACIÓN
               ============================================= */

            this.emit(
                PIC140_EVENTS.LOGGED,
                {

                    event:
                        savedEvent,

                    queueItem:
                        queueItem ?? null,

                }
            );


            return savedEvent;

        } catch (error) {

            this.emitError(
                error,
                {
                    queueItem:
                        queueItem ?? null,
                }
            );


            throw error;

        } finally {

            this.processingCount -=
                1;

        }

    }


    /* =====================================================
       CONSTRUCCIÓN DEL EVENTO
       ===================================================== */

    /**
     * Construye el evento utilizando eventBuilder.js.
     *
     * IMPORTANTE:
     *
     * eventBuilder.js recibe un único objeto de entrada.
     * El previousEvent debe formar parte de ese objeto.
     *
     * Esto corrige la incompatibilidad existente en la
     * implementación anterior, donde previousEvent se
     * enviaba como segundo argumento y era ignorado.
     *
     * @param {Object} request
     * @param {Object|null|undefined} previousEvent
     * @returns {Object}
     */
    buildAuditEvent(
        request,
        previousEvent
    ) {

        if (
            previousEvent !== null &&
            previousEvent !== undefined
        ) {

            if (
                typeof previousEvent !== 'object' ||
                Array.isArray(previousEvent)
            ) {

                throw createPipelineError(
                    'INVALID_PREVIOUS_EVENT',
                    'El último evento persistido no es un objeto válido.'
                );

            }


            if (
                !Number.isSafeInteger(
                    previousEvent.chain_height
                ) ||
                previousEvent.chain_height < 0
            ) {

                throw createPipelineError(
                    'INVALID_PREVIOUS_HEIGHT',
                    'El último evento contiene un chain_height inválido.'
                );

            }


            if (
                previousEvent.chain_height >=
                Number.MAX_SAFE_INTEGER
            ) {

                throw createPipelineError(
                    'CHAIN_HEIGHT_OVERFLOW',
                    'No es posible incrementar chain_height de forma segura.'
                );

            }

        }


        /*
         * eventBuilder.js calcula chain_height a partir de
         * previousEvent.
         *
         * Por ello NO calculamos ni inyectamos manualmente
         * chain_height aquí.
         */
        const eventInput = {

            ...request,

            previousEvent:
                previousEvent ?? null,

        };


        const event =
            buildEvent(
                eventInput
            );


        if (
            event === null ||
            typeof event !== 'object' ||
            Array.isArray(event)
        ) {

            throw createPipelineError(
                'EVENT_BUILDER_INVALID_RESULT',
                'eventBuilder.js no produjo un evento válido.'
            );

        }


        /*
         * Defensa adicional de la secuencia.
         */
        const expectedHeight =
            previousEvent === null ||
            previousEvent === undefined
                ? 0
                : previousEvent.chain_height + 1;


        if (
            event.chain_height !==
            expectedHeight
        ) {

            throw createPipelineError(
                'CHAIN_HEIGHT_CONFLICT',
                'El chain_height producido por eventBuilder.js no coincide con la posición esperada.',
                {

                    expected:
                        expectedHeight,

                    received:
                        event.chain_height,

                }
            );

        }


        return event;

    }


    /* =====================================================
       VERIFICACIÓN DE INTEGRIDAD
       ===================================================== */

    /**
     * Verifica toda la cadena persistida.
     *
     * @returns {Promise<Object>}
     */
    async verifyIntegrity() {

        if (
            !this.initialized
        ) {

            throw new Error(
                '[PIC-140] AuditEngine no está inicializado.'
            );

        }


        const result =
            await this.integrityVerifier.verifyChain();


        this.emit(
            PIC140_EVENTS.INTEGRITY_VERIFIED,
            result
        );


        return result;

    }


    /* =====================================================
       OBTENER ESTADO
       ===================================================== */

    /**
     * Devuelve el estado actual del motor.
     *
     * @returns {Object}
     */
    getStatus() {

        return {

            status:
                this.status,

            initialized:
                this.initialized,

            queueSize:
                this.queue.size(),

            processing:
                this.queue.isProcessing,

            processingCount:
                this.processingCount,

        };

    }


    /* =====================================================
       PUBLICACIÓN
       ===================================================== */

    /**
     * Publica un evento mediante el callback configurado.
     *
     * @param {string} topic
     * @param {Object} payload
     * @returns {void}
     */
    emit(
        topic,
        payload
    ) {

        if (
            typeof this.publish !==
            'function'
        ) {

            return;

        }


        try {

            this.publish(
                topic,
                payload
            );

        } catch (error) {

            console.error(
                '[PIC-140] Error al publicar evento.',
                error
            );

        }

    }


    /**
     * Publica un error PIC-140.
     *
     * @param {Error} error
     * @param {Object|null} context
     * @returns {void}
     */
    emitError(
        error,
        context = null
    ) {

        /*
         * Un error de pipeline debe suspender la generación
         * de nuevos eventos hasta que el sistema sea
         * recuperado explícitamente.
         */
        if (
            this.status !==
            PIC140_STATUS.DESTROYED
        ) {

            this.status =
                PIC140_STATUS.SUSPENDED;

        }


        this.emit(
            PIC140_EVENTS.ERROR,
            {

                error: {

                    name:
                        error?.name ??
                        'Error',

                    message:
                        error?.message ??
                        String(error),

                    code:
                        error?.code ??
                        null,

                },

                context,

            }
        );

    }


    /* =====================================================
       DESTRUCCIÓN
       ===================================================== */

    /**
     * Libera los recursos del AuditEngine.
     *
     * @returns {void}
     */
    destroy() {

        if (
            this.queue
        ) {

            this.queue.destroy();

        }


        if (
            this.storage
        ) {

            this.storage.close();

        }


        this.initialized =
            false;


        this.status =
            PIC140_STATUS.DESTROYED;


        this.processingCount =
            0;

    }

}


/* =========================================================
   ERRORES DEL PIPELINE
   ========================================================= */

/**
 * Crea un error estructurado del pipeline.
 *
 * @param {string} code
 * @param {string} message
 * @param {*} details
 * @returns {Error}
 */
function createPipelineError(
    code,
    message,
    details = null
) {

    const error =
        new Error(
            message
        );


    error.name =
        'PIC140PipelineError';


    error.code =
        code;


    if (
        details !== null
    ) {

        error.details =
            details;

    }


    return error;

}


/* =========================================================
   EXPORTACIONES
   ========================================================= */

export {

    AuditEngine,

    PIC140_EVENTS,

    PIC140_STATUS,

};