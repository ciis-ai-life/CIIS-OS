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

        this.isInitializing =
            false;

        this.isShuttingDown =
            false;

        this.kernelUnsubscribe =
            null;

        this.queueProcessorConfigured =
            false;

        this.initPromise =
            null;

    }


    /* =====================================================
       INICIALIZACIÓN
       ===================================================== */

    async init() {

        if (
            this.isReady
        ) {

            return true;

        }


        if (
            this.initPromise
        ) {

            return this.initPromise;

        }


        if (
            this.isShuttingDown
        ) {

            throw new Error(
                '[PIC-140] El motor está en proceso de cierre.'
            );

        }


        this.isInitializing =
            true;


        this.initPromise =
            this.initializeInternal();


        try {

            return await this.initPromise;

        } finally {

            this.initPromise =
                null;

            this.isInitializing =
                false;

        }

    }


    async initializeInternal() {

        if (
            this.isReady
        ) {

            return true;

        }


        try {

            /* ---------------------------------------------
               CRYPTO
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


            this.isInitialized =
                true;

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

    configureQueue() {

        if (
            this.queueProcessorConfigured
        ) {

            return;

        }


        if (
            !this.queue ||
            typeof this.queue.setProcessor !==
            'function'
        ) {

            throw new Error(
                '[PIC-140] FIFO no disponible o sin setProcessor().'
            );

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
       SUSCRIPCIÓN AL KERNEL
       ===================================================== */

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


                    /*
                     * PIC-140 no debe auditar sus propios
                     * eventos de control porque eso produciría
                     * recursión.
                     */
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


        if (
            this.isShuttingDown
        ) {

            throw new Error(
                '[PIC-140] El motor está en proceso de cierre.'
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

    async processEvent(
        topic,
        eventInfo,
        queueEntry = null
    ) {

        /* -------------------------------------------------
           VALIDACIÓN DEL TOPIC
           ------------------------------------------------- */

        if (
            typeof topic !== 'string' ||
            topic.trim().length === 0
        ) {

            throw new TypeError(
                '[PIC-140] topic debe ser una cadena no vacía.'
            );

        }


        /* -------------------------------------------------
           VALIDACIÓN DEL PAYLOAD DEL KERNEL
           ------------------------------------------------- */

        if (
            eventInfo === null ||
            eventInfo === undefined
        ) {

            eventInfo = {};

        }


        if (
            typeof eventInfo !== 'object' ||
            Array.isArray(eventInfo)
        ) {

            throw new TypeError(
                '[PIC-140] eventInfo debe ser un objeto.'
            );

        }


        /* -------------------------------------------------
           OBTENER ÚLTIMO EVENTO
           ------------------------------------------------- */

        const previousEvent =
            await this.getLastEvent();


        let previousHash =
            GENESIS_HASH;

        let chainHeight =
            0;


        if (
            previousEvent !== null
        ) {

            if (
                typeof previousEvent.event_hash !==
                'string' ||
                !/^[0-9a-f]{64}$/i.test(
                    previousEvent.event_hash
                )
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
           CONSTRUCCIÓN DEL EVENTO
           ------------------------------------------------- */

        const auditEvent =
            this.buildAuditEvent(
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
                '[PIC-140] calculateHash() produjo un hash