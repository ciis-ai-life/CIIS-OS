/**
 * CIIS OS
 * PIC-140 — Audit Runtime Engine
 *
 * Archivo:
 *     js/pic140/pic140.js
 *
 * Responsabilidad:
 *     Orquestar el pipeline completo de auditoría PIC-140.
 *
 * Flujo contractual:
 *
 *     KERNEL EVENT
 *          │
 *          ▼
 *        FIFO
 *          │
 *          ▼
 *     getLastEvent()
 *          │
 *          ▼
 *      buildEvent()
 *          │
 *          ▼
 *    PRE-HASH VALIDATION
 *          │
 *          ▼
 *      canonicalize()
 *          │
 *          ▼
 *     calculateHash()
 *          │
 *          ▼
 *     event_hash
 *          │
 *          ▼
 *   POST-HASH VALIDATION
 *          │
 *          ▼
 *     saveEvent()
 *          │
 *          ▼
 *     PIC140_LOGGED
 *
 * En caso de error:
 *
 *          └──────────────► PIC140_ERROR
 *
 * Principios:
 *
 *     - Procesamiento serializado mediante FIFO.
 *     - Un único processor.
 *     - Append-only.
 *     - Hash calculado exclusivamente sobre representación
 *       canónica.
 *     - Validación antes y después del hash.
 *     - No modificación del evento original recibido del Kernel.
 *     - Errores aislados por evento.
 */


/* =========================================================
   DEPENDENCIAS
   ========================================================= */

import {
    Kernel,
} from '../kernel/eventBus.js';

import {
    buildEvent,
} from './eventBuilder.js';

import {
    canonicalize,
} from './canonicalizer.js';

import {
    calculateHash,
} from './hashEngine.js';

import {
    validate,
} from './schemaValidator.js';

import {
    StorageAdapter,
} from './storageAdapter.js';

import {
    FifoQueue,
    FifoQueueEvents,
} from './fifoQueue.js';


/* =========================================================
   CONSTANTES
   ========================================================= */

const PIC140_EVENTS = Object.freeze({

    LOGGED:
        'PIC140_LOGGED',

    ERROR:
        'PIC140_ERROR',

});


const GENESIS_HASH =
    'GENESIS';


/* =========================================================
   AUDIT ENGINE
   ========================================================= */

class AuditEngine {

    /**
     * Crea una instancia del motor PIC-140.
     *
     * @param {Object} options
     */
    constructor(options = {}) {

        this.storage =
            options.storage ??
            new StorageAdapter();

        this.queue =
            options.queue ??
            new FifoQueue();

        this.isReady =
            false;

        this.isInitialized =
            false;

        this.kernelUnsubscribe =
            null;

        this.queueProcessorConfigured =
            false;

    }


    /* =====================================================
       INICIALIZACIÓN
       ===================================================== */

    /**
     * Inicializa el motor PIC-140.
     *
     * Las precondiciones de persistencia se verifican antes
     * de declarar el motor como listo.
     *
     * @returns {Promise<boolean>}
     */
    async init() {

        if (
            this.isReady
        ) {

            return true;

        }


        if (
            this.isInitialized
        ) {

            return this.isReady;

        }


        this.isInitialized =
            true;


        try {

            /* ---------------------------------------------
               PRECONDICIONES CRIPTOGRÁFICAS
               --------------------------------------------- */

            this.verifyCryptoEnvironment();


            /* ---------------------------------------------
               STORAGE
               --------------------------------------------- */

            await this.storage.initialize();


            /* ---------------------------------------------
               FIFO
               --------------------------------------------- */

            this.configureQueue();


            /* ---------------------------------------------
               KERNEL
               --------------------------------------------- */

            this.subscribeToKernel();


            this.isReady =
                true;


            return true;

        } catch (error) {

            this.isReady =
                false;

            this.isInitialized =
                false;

            this.publishError(
                error,
                null,
                null
            );

            throw error;

        }

    }


    /* =====================================================
       ENTORNO CRIPTOGRÁFICO
       ===================================================== */

    /**
     * Verifica las APIs Web Crypto requeridas por PIC-140.
     *
     * @returns {void}
     */
    verifyCryptoEnvironment() {

        if (
            typeof crypto === 'undefined'
        ) {

            throw new Error(
                '[PIC-140] Web Crypto API no disponible.'
            );

        }


        if (
            !crypto.subtle ||
            typeof crypto.subtle.digest !== 'function'
        ) {

            throw new Error(
                '[PIC-140] crypto.subtle.digest no está disponible.'
            );

        }


        if (
            typeof crypto.getRandomValues !== 'function'
        ) {

            throw new Error(
                '[PIC-140] crypto.getRandomValues no está disponible.'
            );

        }


        if (
            typeof crypto.randomUUID !== 'function'
        ) {

            throw new Error(
                '[PIC-140] crypto.randomUUID no está disponible.'
            );

        }


        if (
            typeof TextEncoder !== 'function'
        ) {

            throw new Error(
                '[PIC-140] TextEncoder no está disponible.'
            );

        }

    }


    /* =====================================================
       CONFIGURACIÓN FIFO
       ===================================================== */

    /**
     * Configura el único processor permitido para la cola.
     *
     * @returns {void}
     */
    configureQueue() {

        if (
            this.queueProcessorConfigured
        ) {

            return;

        }


        this.queue.setProcessor(
            async (
                queueItem,
                queueEntry
            ) => {

                return this.processQueuedEvent(
                    queueItem,
                    queueEntry
                );

            }
        );


        this.queueProcessorConfigured =
            true;

    }


    /* =====================================================
       KERNEL
       ===================================================== */

    /**
     * Suscribe el motor a los eventos del Kernel.
     *
     * Se ignoran los eventos generados por el propio PIC-140
     * para evitar recursión.
     *
     * @returns {void}
     */
    subscribeToKernel() {

        if (
            this.kernelUnsubscribe
        ) {

            return;

        }


        const unsubscribe =
            Kernel.subscribe(
                '*',
                async (
                    topic,
                    eventInfo
                ) => {

                    if (
                        typeof topic !== 'string'
                    ) {

                        return;

                    }


                    if (
                        topic.startsWith('PIC140_')
                    ) {

                        return;

                    }


                    try {

                        await this.enqueueEvent(
                            topic,
                            eventInfo
                        );

                    } catch (error) {

                        this.publishError(
                            error,
                            topic,
                            eventInfo
                        );

                    }

                }
            );


        if (
            typeof unsubscribe === 'function'
        ) {

            this.kernelUnsubscribe =
                unsubscribe;

        }

    }


    /* =====================================================
       ENCOLAMIENTO
       ===================================================== */

    /**
     * Coloca un evento del Kernel en la FIFO.
     *
     * IMPORTANTE:
     *
     * Aquí NO se construye el evento PIC-140.
     *
     * Aquí NO se consulta IndexedDB.
     *
     * Aquí NO se calcula el hash.
     *
     * La FIFO es la única puerta de entrada al pipeline.
     *
     * @param {string} topic
     * @param {*} eventInfo
     * @returns {Promise<Object>}
     */
    async enqueueEvent(
        topic,
        eventInfo
    ) {

        if (
            !this.isReady
        ) {

            throw new Error(
                '[PIC-140] El motor no está inicializado.'
            );

        }


        const queuePayload = {

            topic,

            eventInfo,

        };


        return this.queue.enqueue(
            queuePayload
        );

    }


    /* =====================================================
       PROCESAMIENTO FIFO
       ===================================================== */

    /**
     * Procesa un elemento extraído de la FIFO.
     *
     * El elemento permanece completamente aislado de los
     * demás elementos mientras se ejecuta este pipeline.
     *
     * @param {Object} queueItem
     * @param {Object} queueEntry
     * @returns {Promise<Object>}
     */
    async processQueuedEvent(
        queueItem,
        queueEntry
    ) {

        const topic =
            queueItem?.topic;

        const eventInfo =
            queueItem?.eventInfo;


        try {

            return await this.processEvent(
                topic,
                eventInfo,
                queueEntry
            );

        } catch (error) {

            this.publishError(
                error,
                topic,
                eventInfo
            );

            throw error;

        }

    }


    /* =====================================================
       PIPELINE PRINCIPAL
       ===================================================== */

    /**
     * Ejecuta el pipeline contractual PIC-140.
     *
     * @param {string} topic
     * @param {Object} eventInfo
     * @param {Object|null} queueEntry
     * @returns {Promise<Object>}
     */
    async processEvent(
        topic,
        eventInfo,
        queueEntry = null
    ) {

        /* -------------------------------------------------
           VALIDACIÓN DE ENTRADA
           ------------------------------------------------- */

        if (
            typeof topic !== 'string' ||
            topic.trim().length === 0
        ) {

            throw new TypeError(
                '[PIC-140] topic debe ser una cadena no vacía.'
            );

        }


        if (
            eventInfo === null ||
            typeof eventInfo !== 'object'
        ) {

            throw new TypeError(
                '[PIC-140] eventInfo debe ser un objeto.'
            );

        }


        /* -------------------------------------------------
           OBTENER ÚLTIMO EVENTO
           ------------------------------------------------- */

        const previousEvent =
            await this.storage.getLastEvent();


        let previousHash =
            GENESIS_HASH;

        let chainHeight =
            0;


        if (
            previousEvent !== null
        ) {

            if (
                typeof previousEvent.event_hash !==
                'string'
            ) {

                throw new Error(
                    '[PIC-140] El último evento almacenado no contiene event_hash válido.'
                );

            }


            if (
                !Number.isSafeInteger(
                    previousEvent.chain_height
                ) ||
                previousEvent.chain_height < 0
            ) {

                throw new Error(
                    '[PIC-140] El último evento almacenado contiene chain_height inválido.'
                );

            }


            previousHash =
                previousEvent.event_hash;


            chainHeight =
                previousEvent.chain_height + 1;


            if (
                !Number.isSafeInteger(
                    chainHeight
                )
            ) {

                throw new Error(
                    '[PIC-140] El siguiente chain_height excede el entero seguro permitido.'
                );

            }

        }


        /* -------------------------------------------------
           CONSTRUCCIÓN
           ------------------------------------------------- */

        const auditEvent =
            buildAuditEvent(
                topic,
                eventInfo,
                previousHash,
                chainHeight
            );


        /* -------------------------------------------------
           PRE-HASH VALIDATION
           ------------------------------------------------- */

        validate(
            auditEvent
        );


        /* -------------------------------------------------
           CANONICALIZACIÓN
           ------------------------------------------------- */

        const canonicalData =
            canonicalize(
                auditEvent
            );


        /* -------------------------------------------------
           HASH
           ------------------------------------------------- */

        const eventHash =
            await calculateHash(
                canonicalData
            );


        if (
            typeof eventHash !== 'string' ||
            !/^[0-9a-f]{64}$/.test(
                eventHash
            )
        ) {

            throw new Error(
                '[PIC-140] calculateHash() produjo un hash inválido.'
            );

        }


        /* -------------------------------------------------
           INCORPORAR HASH
           ------------------------------------------------- */

        /**
         * Se crea un nuevo objeto.
         *
         * No se modifica el evento que produjo buildEvent().
         */
        const finalEvent = {

            ...auditEvent,

            event_hash:
                eventHash,

        };


        /* -------------------------------------------------
           POST-HASH VALIDATION
           ------------------------------------------------- */

        validate(
            finalEvent
        );


        /* -------------------------------------------------
           PERSISTENCIA APPEND-ONLY
           ------------------------------------------------- */

        await this.storage.saveEvent(
            finalEvent
        );


        /* -------------------------------------------------
           NOTIFICACIÓN DE ÉXITO
           ------------------------------------------------- */

        this.publishLogged(
            finalEvent,
            queueEntry
        );


        return {

            event:
                finalEvent,

            event_id:
                finalEvent.event_id,

            event_hash:
                finalEvent.event_hash,

            chain_height:
                finalEvent.chain_height,

        };

    }


    /* =====================================================
       BUILD EVENT
       ===================================================== */

    /**
     * Adapta la información proveniente del Kernel al
     * contrato del eventBuilder.
     *
     * La lógica de construcción permanece delegada
     * exclusivamente a buildEvent().
     *
     * @param {string} topic
     * @param {Object} eventInfo
     * @param {string} previousHash
     * @param {number} chainHeight
     * @returns {Object}
     */
    buildAuditEvent(
        topic,
        eventInfo,
        previousHash,
        chainHeight
    ) {

        return buildEvent(
            topic,
            eventInfo?.payload ?? null,
            previousHash,
            chainHeight,
            {

                correlation_id:
                    eventInfo?.correlation_id,

                causation_id:
                    eventInfo?.causation_id,

                severity:
                    eventInfo?.severity,

            }
        );

    }


    /* =====================================================
       PUBLICACIÓN PIC140_LOGGED
       ===================================================== */

    /**
     * Publica la confirmación de persistencia.
     *
     * @param {Object} event
     * @param {Object|null} queueEntry
     * @returns {void}
     */
    publishLogged(
        event,
        queueEntry
    ) {

        Kernel.publish(
            PIC140_EVENTS.LOGGED,
            {

                id:
                    event.event_id,

                event_id:
                    event.event_id,

                hash:
                    event.event_hash,

                event_hash:
                    event.event_hash,

                height:
                    event.chain_height,

                chain_height:
                    event.chain_height,

                sequence:
                    queueEntry?.sequence ?? null,

            }
        );

    }


    /* =====================================================
       PUBLICACIÓN PIC140_ERROR
       ===================================================== */

    /**
     * Publica un error aislado del pipeline.
     *
     * @param {*} error
     * @param {string|null} topic
     * @param {*} eventInfo
     * @returns {void}
     */
    publishError(
        error,
        topic = null,
        eventInfo = null
    ) {

        const errorName =
            error?.name ??
            'Error';

        const errorMessage =
            error?.message ??
            'Error desconocido en PIC-140.';


        try {

            Kernel.publish(
                PIC140_EVENTS.ERROR,
                {

                    error: {

                        name:
                            errorName,

                        message:
                            errorMessage,

                    },

                    originalTopic:
                        topic,

                    correlation_id:
                        eventInfo?.correlation_id ??
                        null,

                }
            );

        } catch (
            publishError
        ) {

            console.error(
                '[PIC-140] No fue posible publicar PIC140_ERROR.',
                publishError
            );

        }

    }


    /* =====================================================
       ESTADO
       ===================================================== */

    /**
     * Indica si el motor está listo.
     *
     * @returns {boolean}
     */
    ready() {

        return this.isReady;

    }


    /**
     * Devuelve información de estado.
     *
     * @returns {Object}
     */
    getStatus() {

        return {

            ready:
                this.isReady,

            initialized:
                this.isInitialized,

            queueSize:
                this.queue.size(),

            processing:
                this.queue.processing(),

            nextSequence:
                this.queue.getNextSequence(),

        };

    }


    /* =====================================================
       DRENAJE
       ===================================================== */

    /**
     * Espera hasta que todos los eventos pendientes
     * hayan terminado de procesarse.
     *
     * @returns {Promise<void>}
     */
    async drain() {

        await this.queue.drain();

    }


    /* =====================================================
       CIERRE
       ===================================================== */

    /**
     * Desconecta el motor.
     *
     * No interrumpe un evento que ya esté en procesamiento.
     *
     * @returns {Promise<void>}
     */
    async shutdown() {

        if (
            !this.isInitialized
        ) {

            return;

        }


        try {

            await this.queue.drain();

        } finally {

            if (
                typeof this.kernelUnsubscribe ===
                'function'
            ) {

                this.kernelUnsubscribe();

            }


            this.kernelUnsubscribe =
                null;


            this.storage.close();


            this.isReady =
                false;

            this.isInitialized =
                false;

            this.queueProcessorConfigured =
                false;

        }

    }

}


/* =========================================================
   INSTANCIA INSTITUCIONAL
   ========================================================= */

const PIC140 =
    new AuditEngine();


/* =========================================================
   EXPORTACIONES
   ========================================================= */

export {

    AuditEngine,

    PIC140,

    PIC140_EVENTS,

    GENESIS_HASH,

};