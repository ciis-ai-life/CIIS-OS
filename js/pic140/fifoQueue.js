/**
 * CIIS OS
 * PIC-140 — FIFO Queue
 *
 * Archivo:
 *     js/pic140/fifoQueue.js
 *
 * Responsabilidad:
 *     Proporcionar una cola FIFO determinista para serializar
 *     el procesamiento de eventos PIC-140.
 *
 * Principios:
 *
 *     - First In, First Out.
 *     - Un único procesamiento activo.
 *     - Procesador configurado una sola vez.
 *     - Promesas resueltas/rechazadas por elemento.
 *     - Errores aislados por elemento.
 *     - No depende del DOM.
 *     - No depende de IndexedDB.
 *
 * IMPORTANTE:
 *     La cola NO construye eventos, NO calcula hashes y NO
 *     persiste información.
 *
 *     Su única responsabilidad es garantizar la secuencia
 *     de ejecución.
 */


/* =========================================================
   EVENTOS
   ========================================================= */

const EVENTS = Object.freeze({

    ENQUEUED:
        'FIFO_ENQUEUED',

    PROCESSING_STARTED:
        'FIFO_PROCESSING_STARTED',

    PROCESSING_COMPLETED:
        'FIFO_PROCESSING_COMPLETED',

    PROCESSING_ERROR:
        'FIFO_PROCESSING_ERROR',

    DRAINED:
        'FIFO_DRAINED',

});


/* =========================================================
   FIFO QUEUE
   ========================================================= */

class FifoQueue {

    constructor() {

        this.queue = [];

        this.isProcessing = false;

        this.sequence = 0;

        this.processor = null;

        this.listeners = new Map();

        this.destroyed = false;

    }


    /* =====================================================
       SUSCRIPCIONES
       ===================================================== */

    subscribe(event, callback) {

        this.validateEvent(event);

        this.validateCallback(callback);

        if (!this.listeners.has(event)) {

            this.listeners.set(
                event,
                new Set()
            );

        }

        const callbacks =
            this.listeners.get(event);

        callbacks.add(callback);

        return () => {

            this.unsubscribe(
                event,
                callback
            );

        };

    }


    unsubscribe(
        event,
        callback
    ) {

        const callbacks =
            this.listeners.get(event);

        if (!callbacks) {

            return false;

        }

        const removed =
            callbacks.delete(callback);

        if (
            callbacks.size === 0
        ) {

            this.listeners.delete(event);

        }

        return removed;

    }


    emit(
        event,
        payload
    ) {

        const callbacks =
            this.listeners.get(event);

        if (
            !callbacks ||
            callbacks.size === 0
        ) {

            return;

        }

        const snapshot =
            Array.from(callbacks);

        for (
            const callback
            of snapshot
        ) {

            try {

                callback(payload);

            } catch (error) {

                console.error(
                    `[PIC-140 FIFO] Error en listener "${event}".`,
                    error
                );

            }

        }

    }


    /* =====================================================
       PROCESADOR
       ===================================================== */

    /**
     * Configura el procesador único de la cola.
     *
     * El procesador recibe:
     *
     *     processor(item, queueItem)
     *
     * donde queueItem contiene la información interna
     * de secuencia de la operación.
     *
     * @param {Function} processor
     * @returns {void}
     */
    setProcessor(processor) {

        if (
            typeof processor !== 'function'
        ) {

            throw new TypeError(
                '[PIC-140 FIFO] processor debe ser una función.'
            );

        }

        if (this.destroyed) {

            throw new Error(
                '[PIC-140 FIFO] La cola fue destruida.'
            );

        }

        if (
            this.processor !== null
        ) {

            throw new Error(
                '[PIC-140 FIFO] El procesador ya fue configurado.'
            );

        }

        this.processor =
            processor;

    }


    /**
     * Devuelve el procesador configurado.
     *
     * @returns {Function|null}
     */
    getProcessor() {

        return this.processor;

    }


    /* =====================================================
       INSERCIÓN
       ===================================================== */

    /**
     * Añade un elemento al final de la cola.
     *
     * El procesador se configura mediante setProcessor().
     *
     * @param {*} item
     * @returns {Promise<*>}
     */
    enqueue(item) {

        if (this.destroyed) {

            return Promise.reject(
                new Error(
                    '[PIC-140 FIFO] La cola fue destruida.'
                )
            );

        }

        if (
            typeof this.processor !== 'function'
        ) {

            return Promise.reject(
                new Error(
                    '[PIC-140 FIFO] No existe un processor configurado.'
                )
            );

        }

        const sequence =
            this.sequence;

        this.sequence += 1;

        return new Promise(
            (resolve, reject) => {

                const queueItem = {

                    sequence,

                    item,

                    resolve,

                    reject,

                };

                this.queue.push(
                    queueItem
                );

                this.emit(
                    EVENTS.ENQUEUED,
                    {

                        sequence,

                        queueSize:
                            this.queue.length,

                        timestamp:
                            new Date().toISOString(),

                    }
                );

                void this.processNext();

            }
        );

    }


    /* =====================================================
       PROCESAMIENTO
       ===================================================== */

    /**
     * Procesa el siguiente elemento disponible.
     *
     * Garantiza que solamente exista una ejecución activa.
     *
     * @returns {Promise<void>}
     */
    async processNext() {

        if (this.isProcessing) {

            return;

        }

        const entry =
            this.queue.shift();

        if (!entry) {

            this.emit(
                EVENTS.DRAINED,
                {

                    timestamp:
                        new Date().toISOString(),

                }
            );

            return;

        }

        this.isProcessing =
            true;

        this.emit(
            EVENTS.PROCESSING_STARTED,
            {

                sequence:
                    entry.sequence,

                queueSize:
                    this.queue.length,

                timestamp:
                    new Date().toISOString(),

            }
        );

        try {

            const result =
                await this.processor(
                    entry.item,
                    entry
                );

            entry.resolve(
                result
            );

            this.emit(
                EVENTS.PROCESSING_COMPLETED,
                {

                    sequence:
                        entry.sequence,

                    queueSize:
                        this.queue.length,

                    timestamp:
                        new Date().toISOString(),

                }
            );

        } catch (error) {

            entry.reject(
                error
            );

            this.emit(
                EVENTS.PROCESSING_ERROR,
                {

                    sequence:
                        entry.sequence,

                    queueSize:
                        this.queue.length,

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

        } finally {

            this.isProcessing =
                false;

            void this.processNext();

        }

    }


    /* =====================================================
       CONSULTAS
       ===================================================== */

    size() {

        return this.queue.length;

    }


    isEmpty() {

        return (
            this.queue.length === 0
        );

    }


    processing() {

        return this.isProcessing;

    }


    getNextSequence() {

        return this.sequence;

    }


    snapshot() {

        return this.queue.map(
            entry => ({

                sequence:
                    entry.sequence,

                item:
                    entry.item,

            })
        );

    }


    /* =====================================================
       CONTROL
       ===================================================== */

    /**
     * Vacía los elementos pendientes.
     *
     * Las promesas de los elementos cancelados son rechazadas
     * explícitamente para evitar promesas pendientes indefinidas.
     *
     * El elemento actualmente en procesamiento no se cancela.
     *
     * @returns {Array}
     */
    clear() {

        const removed =
            this.queue.splice(
                0,
                this.queue.length
            );

        const items = [];

        for (
            const entry
            of removed
        ) {

            items.push(
                entry.item
            );

            entry.reject(
                new Error(
                    '[PIC-140 FIFO] Elemento eliminado antes de su procesamiento.'
                )
            );

        }

        return items;

    }


    /**
     * Espera hasta que la cola quede completamente vacía.
     *
     * @returns {Promise<void>}
     */
    async drain() {

        if (
            this.queue.length === 0 &&
            !this.isProcessing
        ) {

            return;

        }

        await new Promise(
            resolve => {

                let settled =
                    false;

                const unsubscribe =
                    this.subscribe(
                        EVENTS.DRAINED,
                        () => {

                            if (
                                settled
                            ) {

                                return;

                            }

                            if (
                                this.queue.length === 0 &&
                                !this.isProcessing
                            ) {

                                settled =
                                    true;

                                unsubscribe();

                                resolve();

                            }

                        }
                    );

            }
        );

    }


    /* =====================================================
       VALIDACIÓN INTERNA
       ===================================================== */

    validateEvent(event) {

        if (
            typeof event !== 'string' ||
            event.trim().length === 0
        ) {

            throw new TypeError(
                '[PIC-140 FIFO] El evento debe ser una cadena no vacía.'
            );

        }

    }


    validateCallback(callback) {

        if (
            typeof callback !== 'function'
        ) {

            throw new TypeError(
                '[PIC-140 FIFO] El listener debe ser una función.'
            );

        }

    }


    /* =====================================================
       DESTRUCCIÓN
       ===================================================== */

    /**
     * Libera los listeners y vacía la cola pendiente.
     *
     * El procesamiento actualmente activo continúa hasta
     * finalizar; no se interrumpe una operación en curso.
     *
     * @returns {void}
     */
    destroy() {

        this.clear();

        this.listeners.clear();

        this.processor =
            null;

        this.destroyed =
            true;

    }

}


/* =========================================================
   INSTANCIA ÚNICA
   ========================================================= */

const fifoQueue =
    new FifoQueue();


/* =========================================================
   EXPORTACIONES
   ========================================================= */

export {

    FifoQueue,

    fifoQueue,

    EVENTS as FifoQueueEvents,

};