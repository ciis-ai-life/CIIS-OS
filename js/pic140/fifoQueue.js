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
 *     - Sin procesamiento concurrente de eventos.
 *     - Promesas resueltas en el orden de inserción.
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

        this.listeners = new Map();

    }


    /* =====================================================
       SUSCRIPCIONES
       ===================================================== */

    /**
     * Suscribe un listener a un evento de la cola.
     *
     * @param {string} event
     * @param {Function} callback
     * @returns {Function}
     */
    subscribe(event, callback) {

        if (
            typeof event !== 'string' ||
            event.trim().length === 0
        ) {

            throw new TypeError(
                '[PIC-140 FIFO] El evento debe ser una cadena no vacía.'
            );

        }


        if (
            typeof callback !== 'function'
        ) {

            throw new TypeError(
                '[PIC-140 FIFO] El listener debe ser una función.'
            );

        }


        if (
            !this.listeners.has(event)
        ) {

            this.listeners.set(
                event,
                new Set()
            );

        }


        const callbacks =
            this.listeners.get(event);


        callbacks.add(
            callback
        );


        return () => {

            this.unsubscribe(
                event,
                callback
            );

        };

    }


    /**
     * Cancela una suscripción.
     *
     * @param {string} event
     * @param {Function} callback
     * @returns {boolean}
     */
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
            callbacks.delete(
                callback
            );


        if (
            callbacks.size === 0
        ) {

            this.listeners.delete(
                event
            );

        }


        return removed;

    }


    /**
     * Publica internamente un evento de la cola.
     *
     * @param {string} event
     * @param {*} payload
     * @returns {void}
     */
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
            Array.from(
                callbacks
            );


        for (
            const callback
            of snapshot
        ) {

            try {

                callback(
                    payload
                );

            } catch (error) {

                console.error(
                    `[PIC-140 FIFO] Error en listener "${event}".`,
                    error
                );

            }

        }

    }


    /* =====================================================
       INSERCIÓN
       ===================================================== */

    /**
     * Añade un elemento al final de la cola.
     *
     * @param {*} item
     * @param {Function} processor
     * @returns {Promise<*>}
     */
    enqueue(
        item,
        processor
    ) {

        if (
            typeof processor !== 'function'
        ) {

            return Promise.reject(
                new TypeError(
                    '[PIC-140 FIFO] processor debe ser una función.'
                )
            );

        }


        const sequence =
            this.sequence;


        this.sequence += 1;


        return new Promise(
            (resolve, reject) => {

                this.queue.push({

                    sequence,

                    item,

                    processor,

                    resolve,

                    reject,

                });


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


                this.processNext();

            }
        );

    }


    /* =====================================================
       PROCESAMIENTO
       ===================================================== */

    /**
     * Procesa el siguiente elemento disponible.
     *
     * IMPORTANTE:
     *
     * isProcessing actúa como bloqueo de ejecución.
     *
     * Aunque enqueue() sea llamado varias veces de forma
     * prácticamente simultánea, sólo un elemento puede
     * encontrarse en procesamiento activo.
     *
     * @returns {Promise<void>}
     */
    async processNext() {

        if (
            this.isProcessing
        ) {

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
                await entry.processor(
                    entry.item
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


            /**
             * Continuamos con el siguiente elemento
             * únicamente después de haber liberado el
             * bloqueo del elemento anterior.
             */
            this.processNext();

        }

    }


    /* =====================================================
       CONSULTAS
       ===================================================== */

    /**
     * Devuelve el número de elementos pendientes.
     *
     * @returns {number}
     */
    size() {

        return this.queue.length;

    }


    /**
     * Indica si la cola está vacía.
     *
     * @returns {boolean}
     */
    isEmpty() {

        return (
            this.queue.length === 0
        );

    }


    /**
     * Indica si existe procesamiento activo.
     *
     * @returns {boolean}
     */
    processing() {

        return this.isProcessing;

    }


    /**
     * Devuelve el número de secuencia que se asignará
     * al siguiente elemento.
     *
     * @returns {number}
     */
    getNextSequence() {

        return this.sequence;

    }


    /**
     * Devuelve una instantánea de los elementos pendientes.
     *
     * No devuelve referencias a las promesas internas.
     *
     * @returns {Array}
     */
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
     * Vacía los elementos que todavía no han comenzado
     * a procesarse.
     *
     * El elemento actualmente en procesamiento no puede
     * ser cancelado mediante este método.
     *
     * @returns {Array}
     */
    clear() {

        const removed =
            this.queue.splice(
                0,
                this.queue.length
            );


        return removed.map(
            entry => entry.item
        );

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

                const unsubscribe =
                    this.subscribe(
                        EVENTS.DRAINED,
                        () => {

                            if (
                                this.queue.length === 0 &&
                                !this.isProcessing
                            ) {

                                unsubscribe();

                                resolve();

                            }

                        }
                    );

            }
        );

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
