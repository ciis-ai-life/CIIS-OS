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

        /*
         * Registra las operaciones drain() pendientes.
         *
         * Cada entrada contiene:
         *
         *     resolve
         *     reject
         *     unsubscribe
         *
         * Esto permite finalizar correctamente cualquier
         * drain() pendiente cuando la cola sea destruida.
         */
        this.pendingDrains = new Set();

    }


    /* =====================================================
       SUSCRIPCIONES
       ===================================================== */

    subscribe(event, callback) {

        this.validateEvent(event);

        this.validateCallback(callback);

        if (this.destroyed) {

            throw new Error(
                '[PIC-140 FIFO] La cola fue destruida.'
            );

        }

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

        if (this.destroyed) {

            return;

        }

        if (this.isProcessing) {

            return;

        }

        const entry =
            this.queue.shift();

        if (!entry) {

            this.notifyDrained();

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

            /*
             * Si destroy() ocurrió mientras el processor
             * estaba activo, la operación actual puede haber
             * terminado correctamente. Su Promise individual
             * debe conservar su resultado.
             */
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

            /*
             * Si la cola fue destruida durante el
             * procesamiento, no deben iniciarse nuevos
             * elementos.
             */
            if (
                !this.destroyed
            ) {

                void this.processNext();

            } else {

                this.notifyDrained();

            }

        }

    }


    /* =====================================================
       NOTIFICACIÓN DE COLA VACÍA
       ===================================================== */

    /**
     * Notifica que la cola se encuentra completamente
     * drenada.
     *
     * La condición requiere:
     *
     *     queue.length === 0
     *     &&
     *     isProcessing === false
     *
     * @returns {void}
     */
    notifyDrained() {

        if (
            this.queue.length !== 0 ||
            this.isProcessing
        ) {

            return;

        }

        this.emit(
            EVENTS.DRAINED,
            {

                timestamp:
                    new Date().toISOString(),

            }
        );

        if (
            this.pendingDrains.size === 0
        ) {

            return;

        }

        const pending =
            Array.from(
                this.pendingDrains
            );

        for (
            const drain
            of pending
        ) {

            this.pendingDrains.delete(
                drain
            );

            if (
                typeof drain.unsubscribe ===
                'function'
            ) {

                drain.unsubscribe();

            }

            drain.resolve();

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

        this.notifyDrained();

        return items;

    }


    /**
     * Espera hasta que la cola quede completamente vacía.
     *
     * Si la cola ya está vacía y no existe procesamiento
     * activo, la Promise se resuelve inmediatamente.
     *
     * Si la cola es destruida mientras drain() está pendiente,
     * la Promise se rechaza explícitamente.
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

        if (this.destroyed) {

            throw new Error(
                '[PIC-140 FIFO] La cola fue destruida antes de completar drain().'
            );

        }

        await new Promise(
            (resolve, reject) => {

                const drainState = {

                    resolve,

                    reject,

                    unsubscribe:
                        null,

                };


                const unsubscribe =
                    this.subscribe(
                        EVENTS.DRAINED,
                        () => {

                            if (
                                this.queue.length === 0 &&
                                !this.isProcessing
                            ) {

                                if (
                                    this.pendingDrains.has(
                                        drainState
                                    )
                                ) {

                                    this.pendingDrains.delete(
                                        drainState
                                    );

                                }

                                unsubscribe();

                                resolve();

                            }

                        }
                    );


                drainState.unsubscribe =
                    unsubscribe;


                this.pendingDrains.add(
                    drainState
                );


                /*
                 * Se vuelve a comprobar la condición después
                 * de registrar el listener para evitar una
                 * condición de carrera entre la comprobación
                 * inicial y la suscripción.
                 */
                this.notifyDrained();

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
     * Los drain() pendientes se rechazan explícitamente para
     * evitar Promises indefinidamente pendientes.
     *
     * @returns {void}
     */
    destroy() {

        if (
            this.destroyed
        ) {

            return;

        }


        /*
         * Primero se marca la cola como destruida para impedir
         * que una operación asíncrona pueda iniciar el siguiente
         * elemento.
         */
        this.destroyed =
            true;


        /*
         * Las operaciones pendientes dejan de formar parte
         * del procesamiento y sus Promises son rechazadas.
         */
        this.clear();


        /*
         * Finaliza explícitamente cualquier drain() pendiente.
         */
        const destructionError =
            new Error(
                '[PIC-140 FIFO] La cola fue destruida antes de completar drain().'
            );


        const pending =
            Array.from(
                this.pendingDrains
            );


        this.pendingDrains.clear();


        for (
            const drain
            of pending
        ) {

            if (
                typeof drain.unsubscribe ===
                'function'
            ) {

                drain.unsubscribe();

            }

            drain.reject(
                destructionError
            );

        }


        /*
         * El procesamiento actualmente activo no se cancela.
         * Solamente se impide que continúe con elementos
         * posteriores.
         */
        this.listeners.clear();

        this.processor =
            null;

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