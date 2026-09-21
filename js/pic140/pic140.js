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

            this.verifyCryptoEnvironment();

            await this.storage.initialize();

            this.configureQueue();

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
            typeof crypto.subtle.digest !==
            'function'
        ) {

            throw new Error(
                '[PIC-140] crypto.subtle.digest no está disponible.'
            );

        }


        if (
            typeof crypto.getRandomValues !==
            'function'
        ) {

            throw new Error(
                '[PIC-140] crypto.getRandomValues no está disponible.'
            );

        }


        if (
            typeof crypto.randomUUID !==
            'function'
        ) {

            throw new Error(
                '[PIC-140] crypto.randomUUID no está disponible.'
            );

        }


        if (
            typeof TextEncoder !==
            'function'
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
                     * Los eventos internos de PIC-140 no
                     * deben volver a entrar al auditor.
                     *
                     * De lo contrario:
                     *
                     *     PIC140_LOGGED
                     *          ↓
                     *       PIC-140
                     *          ↓
                     *     PIC140_LOGGED
                     *          ↓
                     *       PIC-140
                     *
                     * produciría recursión.
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


        if (
            typeof topic !== 'string' ||
            topic.trim().length === 0
        ) {

            throw new TypeError(
                '[PIC-140] topic debe ser una cadena no vacía.'
            );

        }


        const queuePayload = {

            topic,

            eventInfo:
                eventInfo === undefined
                    ? {}
                    : eventInfo,

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

            /*
             * El error ya pertenece al elemento FIFO concreto.
             * Se informa al canal PIC140_ERROR sin detener la
             * cadena completa.
             */
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
           VALIDACIÓN DEL PAYLOAD
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
                chainHeight,
                queueEntry
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


        if (
            typeof canonicalData !== 'string'
        ) {

            throw new Error(
                '[PIC-140] canonicalize() no produjo una cadena.'
            );

        }


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
                '[PIC-140] calculateHash() produjo un hash SHA-256 inválido.'
            );

        }


        /* -------------------------------------------------
           ASIGNACIÓN DEL HASH
           ------------------------------------------------- */

        /*
         * Se crea una copia nueva.
         *
         * El evento construido anteriormente no se modifica
         * después de la validación PRE-HASH.
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

        const savedEvent =
            await this.saveEvent(
                finalEvent
            );


        /* -------------------------------------------------
           CONFIRMACIÓN
           ------------------------------------------------- */

        this.publishLogged(
            savedEvent,
            topic,
            queueEntry
        );


        return savedEvent;

    }


    /* =====================================================
       CONSTRUCCIÓN DEL EVENTO
       ===================================================== */

    buildAuditEvent(
        topic,
        eventInfo,
        previousHash,
        chainHeight,
        queueEntry = null
    ) {

        const payload =
            eventInfo &&
            typeof eventInfo === 'object'
                ? eventInfo
                : {};


        const eventCategory =
            this.extractEventCategory(
                topic
            );


        const eventType =
            topic.trim();


        const module =
            this.extractModule(
                topic
            );


        const operation =
            this.extractOperation(
                topic
            );


        const severity =
            this.normalizeSeverity(
                payload.severity ??
                payload.level ??
                payload.audit_severity
            );


        const status =
            this.normalizeStatus(
                payload.status ??
                payload.result ??
                payload.audit_status
            );


        const actor =
            this.extractObject(
                payload.actor
            );


        const target =
            this.extractObject(
                payload.target
            );


        const securityContext =
            this.extractObject(
                payload.security_context ??
                payload.securityContext
            );


        const correlationId =
            this.extractCorrelationId(
                payload
            );


        /*
         * EventBuilder espera previousEvent como objeto
         * que contenga chain_height.
         *
         * No se introduce previous_hash como campo raíz
         * porque el contrato activo no lo contempla.
         */
        const previousEvent =
            chainHeight > 0
                ? {
                    chain_height:
                        chainHeight - 1
                }
                : null;


        const metadata = {

            previous_hash:
                previousHash,

            source:
                'Kernel',

            queue_sequence:
                queueEntry?.sequence ??
                null,

            payload:
                this.cloneSafe(
                    payload
                ),

        };


        return buildEvent({

            eventCategory,

            eventType,

            severity,

            status,

            module,

            operation,

            actor,

            target,

            securityContext,

            correlationId,

            previousEvent,

            metadata,

        });

    }


    /* =====================================================
       CATEGORIZACIÓN
       ===================================================== */

    extractEventCategory(
        topic
    ) {

        if (
            typeof topic !== 'string'
        ) {

            return 'KERNEL';

        }


        const normalized =
            topic.trim();


        if (
            normalized.length === 0
        ) {

            return 'KERNEL';

        }


        const separatorIndex =
            normalized.indexOf('_');


        if (
            separatorIndex <= 0
        ) {

            return 'KERNEL';

        }


        return (
            normalized
                .slice(
                    0,
                    separatorIndex
                )
                .trim()
                .toUpperCase() ||
            'KERNEL'
        );

    }


    /* =====================================================
       MÓDULO
       ===================================================== */

    extractModule(
        topic
    ) {

        if (
            typeof topic !== 'string'
        ) {

            return 'KERNEL';

        }


        const normalized =
            topic.trim();


        if (
            normalized.length === 0
        ) {

            return 'KERNEL';

        }


        const separatorIndex =
            normalized.indexOf('_');


        if (
            separatorIndex <= 0
        ) {

            return normalized;

        }


        return (
            normalized
                .slice(
                    0,
                    separatorIndex
                )
                .trim() ||
            'KERNEL'
        );

    }


    /* =====================================================
       OPERACIÓN
       ===================================================== */

    extractOperation(
        topic
    ) {

        if (
            typeof topic !== 'string'
        ) {

            return 'UNKNOWN';

        }


        const normalized =
            topic.trim();


        return (
            normalized ||
            'UNKNOWN'
        );

    }


    /* =====================================================
       SEVERIDAD
       ===================================================== */

    normalizeSeverity(
        value
    ) {

        if (
            typeof value !== 'string'
        ) {

            return 'INFO';

        }


        const normalized =
            value.trim().toUpperCase();


        const allowed = [

            'DEBUG',
            'INFO',
            'NOTICE',
            'WARNING',
            'ERROR',
            'CRITICAL',

        ];


        if (
            allowed.includes(
                normalized
            )
        ) {

            return normalized;

        }


        /*
         * Valores desconocidos se normalizan a INFO
         * para evitar generar eventos incompatibles
         * con el contrato PIC-140.
         */
        return 'INFO';

    }


    /* =====================================================
       STATUS
       ===================================================== */

    normalizeStatus(
        value
    ) {

        if (
            typeof value !== 'string'
        ) {

            return 'SUCCESS';

        }


        const normalized =
            value.trim().toUpperCase();


        const allowed = [

            'SUCCESS',
            'FAILURE',
            'REJECTED',
            'PENDING',
            'ERROR',

        ];


        if (
            allowed.includes(
                normalized
            )
        ) {

            return normalized;

        }


        return 'SUCCESS';

    }


    /* =====================================================
       CORRELATION ID
       ===================================================== */

    extractCorrelationId(
        payload
    ) {

        if (
            payload &&
            typeof payload.correlation_id ===
            'string'
        ) {

            return payload.correlation_id;

        }


        if (
            payload &&
            typeof payload.correlationId ===
            'string'
        ) {

            return payload.correlationId;

        }


        /*
         * Si no existe correlation_id en el evento original,
         * EventBuilder generará uno mediante crypto.randomUUID().
         */
        return undefined;

    }


    /* =====================================================
       OBJETOS
       ===================================================== */

    extractObject(
        value
    ) {

        if (
            value === null ||
            value === undefined
        ) {

            return null;

        }


        if (
            typeof value !== 'object' ||
            Array.isArray(value)
        ) {

            return null;

        }


        return this.cloneSafe(
            value
        );

    }


    /* =====================================================
       CLON SEGURO
       ===================================================== */

    cloneSafe(
        value
    ) {

        if (
            value === undefined
        ) {

            return null;

        }


        try {

            if (
                typeof structuredClone ===
                'function'
            ) {

                return structuredClone(
                    value
                );

            }

        } catch (
            structuredCloneError
        ) {

            /*
             * Se continúa con el fallback JSON.
             */

        }


        try {

            return JSON.parse(
                JSON.stringify(
                    value
                )
            );

        } catch (
            jsonError
        ) {

            throw new Error(
                '[PIC-140] El payload contiene valores que no pueden clonarse de forma segura.'
            );

        }

    }


    /* =====================================================
       PERSISTENCIA
       ===================================================== */

    async saveEvent(
        event
    ) {

        if (
            !this.storage ||
            typeof this.storage.saveEvent !==
            'function'
        ) {

            throw new Error(
                '[PIC-140] StorageAdapter no expone saveEvent().'
            );

        }


        return this.storage.saveEvent(
            event
        );

    }


    /* =====================================================
       ÚLTIMO EVENTO
       ===================================================== */

    async getLastEvent() {

        if (
            !this.storage ||
            typeof this.storage.getLastEvent !==
            'function'
        ) {

            throw new Error(
                '[PIC-140] StorageAdapter no expone getLastEvent().'
            );

        }


        return this.storage.getLastEvent();

    }


    /* =====================================================
       PUBLICAR EVENTO REGISTRADO
       ===================================================== */

    publishLogged(
        event,
        sourceTopic,
        queueEntry
    ) {

        try {

            Kernel.publish(
                PIC140_EVENTS.LOGGED,
                {

                    event,

                    source_topic:
                        sourceTopic,

                    queue_sequence:
                        queueEntry?.sequence ??
                        null,

                    timestamp:
                        new Date().toISOString(),

                }
            );

        } catch (error) {

            /*
             * La persistencia ya ocurrió correctamente.
             *
             * Un fallo de publicación del evento de control
             * no debe invalidar el evento almacenado.
             */
            console.error(
                '[PIC-140] Error publicando PIC140_LOGGED.',
                error
            );

        }

    }


    /* =====================================================
       PUBLICAR ERROR
       ===================================================== */

    publishError(
        error,
        topic = null,
        eventInfo = null
    ) {

        const errorPayload = {

            name:
                error?.name ??
                'Error',

            message:
                error?.message ??
                'Error desconocido.',

            topic:
                typeof topic === 'string'
                    ? topic
                    : null,

            timestamp:
                new Date().toISOString(),

        };


        /*
         * No se incluye el objeto Error completo porque puede
         * contener propiedades no serializables.
         */

        try {

            Kernel.publish(
                PIC140_EVENTS.ERROR,
                errorPayload
            );

        } catch (publishError) {

            console.error(
                '[PIC-140] Error publicando PIC140_ERROR.',
                publishError
            );

        }

    }


    /* =====================================================
       DRAIN
       ===================================================== */

    async drain() {

        if (
            !this.queue ||
            typeof this.queue.drain !==
            'function'
        ) {

            throw new Error(
                '[PIC-140] FIFO no expone drain().'
            );

        }


        return this.queue.drain();

    }


    /* =====================================================
       ESTADO
       ===================================================== */

    getStatus() {

        const queueSize =
            this.queue &&
            typeof this.queue.size ===
            'function'
                ? this.queue.size()
                : 0;


        const processing =
            this.queue &&
            typeof this.queue.processing ===
            'function'
                ? this.queue.processing()
                : false;


        const nextSequence =
            this.queue &&
            typeof this.queue.getNextSequence ===
            'function'
                ? this.queue.getNextSequence()
                : 0;


        return {

            initialized:
                this.isInitialized,

            initializing:
                this.isInitializing,

            ready:
                this.isReady,

            shuttingDown:
                this.isShuttingDown,

            queueSize,

            processing,

            nextSequence,

        };

    }


    /* =====================================================
       CIERRE
       ===================================================== */

    async shutdown() {

        if (
            this.isShuttingDown
        ) {

            return;

        }


        this.isShuttingDown =
            true;


        this.isReady =
            false;


        /*
         * Primero se desconecta el Kernel para impedir que
         * entren nuevos eventos mientras se cierra el motor.
         */
        if (
            typeof this.kernelUnsubscribe ===
            'function'
        ) {

            try {

                this.kernelUnsubscribe();

            } catch (
                unsubscribeError
            ) {

                console.error(
                    '[PIC-140] Error desconectando Kernel.',
                    unsubscribeError
                );

            }

            this.kernelUnsubscribe =
                null;

        }


        /*
         * Se espera a que termine el elemento que ya esté
         * siendo procesado y se vacíe la FIFO.
         */
        try {

            await this.drain();

        } catch (
            drainError
        ) {

            console.error(
                '[PIC-140] Error durante drain() de cierre.',
                drainError
            );

        }


        /*
         * Destruir la FIFO evita que nuevos elementos sean
         * procesados después del cierre.
         */
        if (
            this.queue &&
            typeof this.queue.destroy ===
            'function'
        ) {

            try {

                this.queue.destroy();

            } catch (
                queueError
            ) {

                console.error(
                    '[PIC-140] Error destruyendo FIFO.',
                    queueError
                );

            }

        }


        if (
            this.storage &&
            typeof this.storage.close ===
            'function'
        ) {

            try {

                await this.storage.close();

            } catch (
                storageError
            ) {

                console.error(
                    '[PIC-140] Error cerrando almacenamiento.',
                    storageError
                );

            }

        }


        this.isInitialized =
            false;

        this.queueProcessorConfigured =
            false;

    }

}


/* =========================================================
   INSTANCIA SINGLETON
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