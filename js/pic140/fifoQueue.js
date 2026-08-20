/**
 * CIIS OS
 * PIC-140 — FIFO Queue
 *
 * Archivo:
 *     js/pic140/fifoQueue.js
 *
 * Responsabilidad:
 *     Garantizar el procesamiento secuencial y FIFO de
 *     las solicitudes de auditoría PIC-140.
 *
 * Características:
 *
 *     - First In, First Out.
 *     - Un procesador activo a la vez.
 *     - Soporte para operaciones asíncronas.
 *     - No descarta silenciosamente errores.
 *     - No calcula hashes.
 *     - No accede a IndexedDB.
 *     - No construye eventos.
 *
 * Flujo:
 *
 *     solicitud 1 ─┐
 *     solicitud 2 ─┼──► FIFO ──► procesador
 *     solicitud 3 ─┘               │
 *                                  ▼
 *                              resultado
 *
 * IMPORTANTE:
 *     La cola garantiza orden.
 *     La orquestación del pipeline corresponde a pic140.js.
 */


/* =========================================================
   EVENTOS
   ========================================================= */

const EVENTS = Object.freeze({

    ENQUEUED:
        'PIC140_QUEUE_ENQUEUED',

    PROCESSING_STARTED:
        'PIC140_QUEUE_PROCESSING_STARTED',

    PROCESSING_COMPLETED:
        'PIC140_QUEUE_PROCESSING_COMPLETED',

    PROCESSING_FAILED:
        'PIC140_QUEUE_PROCESSING_FAILED',

    EMPTY:
        'PIC140_QUEUE_EMPTY',

});


/* =========================================================
   FIFO QUEUE
   ========================================================= */

class FifoQueue {

    constructor(options = {}) {

        this.queue = [];

        this.isProcessing = false;

        this.sequence = 0;

        this.processor =
            typeof options.processor === 'function'
                ? options.processor
                : null;

        this.onEnqueue =
            typeof options.onEnqueue === 'function'
                ? options.onEnqueue
                : null;

        this.onProcessingStart =
            typeof options.onProcessingStart === 'function'
                ? options.onProcessingStart
                : null;

        this.onProcessingComplete =
            typeof options.onProcessingComplete === 'function'
                ? options.onProcessingComplete
                : null;

        this.onProcessingError =
            typeof options.onProcessingError === 'function'
                ? options.onProcessingError
                : null;

    }


    /* =====================================================
       CONFIGURACIÓN
       ===================================================== */

    /**
     * Define el procesador de la cola.
     *
     * @param {Function} processor
     * @returns {void}
     */
    setProcessor(processor) {

        if (
            typeof processor !== 'function'
        ) {

            throw new TypeError(
                '[PIC-140 FIFO] El processor debe ser una función.'
            );

        }


        this.processor =
            processor;

    }


    /* =====================================================
       INSERCIÓN
       ===================================================== */

    /**
     * Agrega una tarea al final de la cola.
     *
     * @param {*} payload
     * @returns {Promise<*>}
     */
    enqueue(payload) {

        return new Promise(
            (resolve, reject) => {

                const item = {

                    id:
                        this.generateItemId(),

                    sequence:
                        this.sequence,

                    payload,

                    resolve,

                    reject,

                    enqueuedAt:
                        new Date().toISOString(),

                };


                this.sequence += 1;


                this.queue.push(
                    item
                );


                this.notifyEnqueue(
                    item
                );


                this.processNext();

            }
        );

    }


    /* =====================================================
       PROCESAMIENTO
       ===================================================== */

    /**
     * Procesa la siguiente tarea.
     *
     * El bloqueo isProcessing evita que múltiples
     * procesadores trabajen simultáneamente.
     *
     * @returns {Promise<void>}
     */
    async processNext() {

        if (
            this.isProcessing
        ) {

            return;

        }


        if (
            this.queue.length === 0
        ) {

            this.notifyEmpty();

            return;

        }


        if (
            typeof this.processor !== 'function'
        ) {

            const error =
                new Error(
                    '[PIC-140 FIFO] No existe un processor configurado.'
                );


            this.rejectAll(
                error
            );


            return;

        }


        this.isProcessing =
            true;


        const item =
            this.queue.shift();


        this.notifyProcessingStart(
            item
        );


        try {

            const result =
                await this.processor(
                    item.payload,
                    item
                );


            item.resolve(
                result
            );


            this.notifyProcessingComplete(
                item,
                result
            );

        } catch (error) {

            item.reject(
                error
            );


            this.notifyProcessingError(
                item,
                error
            );

        } finally {

            this.isProcessing =
                false;


            /**
             * Se procesa exactamente una tarea más
             * después de liberar el bloqueo.
             */
            if (
                this.queue.length > 0
            ) {

                await this.processNext();

            } else {

                this.notifyEmpty();

            }

        }

    }


    /* =====================================================
       ESTADO
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
     * Indica si existen elementos pendientes.
     *
     * @returns {boolean}
     */
    isEmpty() {

        return (
            this.queue.length === 0
        );

    }


    /**
     * Indica si la cola está procesando.
     *
     * @returns {boolean}
     */
    get processing() {

        return this.isProcessing;

    }


    /**
     * Devuelve una instantánea de la cola.
     *
     * @returns {Array}
     */
    snapshot() {

        return this.queue.map(
            item => ({

                id:
                    item.id,

                sequence:
                    item.sequence,

                enqueuedAt:
                    item.enqueuedAt,

            })
        );

    }


    /* =====================================================
       CANCELACIÓN
       ===================================================== */

    /**
     * Vacía las tareas pendientes.
     *
     * La tarea actualmente en ejecución NO se cancela.
     *
     * @param {Error|null} error
     * @returns {number}
     */
    clear(error = null) {

        const cancellationError =
            error ??
            new Error(
                '[PIC-140 FIFO] Tarea cancelada.'
            );


        const pending =
            this.queue.splice(
                0,
                this.queue.length
            );


        for (
            const item
            of pending
        ) {

            item.reject(
                cancellationError
            );

        }


        return pending.length;

    }


    /**
     * Rechaza todas las tareas pendientes.
     *
     * @param {Error} error
     * @returns {number}
     */
    rejectAll(error) {

        return this.clear(
            error
        );

    }


    /* =====================================================
       CALLBACKS
       ===================================================== */

    /**
     * Notifica inserción.
     *
     * @param {Object} item
     * @returns {void}
     */
    notifyEnqueue(item) {

        if (
            typeof this.onEnqueue !==
            'function'
        ) {

            return;

        }


        try {

            this.onEnqueue(
                item
            );

        } catch (error) {

            console.error(
                '[PIC-140 FIFO] Error en onEnqueue.',
                error
            );

        }

    }


    /**
     * Notifica inicio.
     *
     * @param {Object} item
     * @returns {void}
     */
    notifyProcessingStart(item) {

        if (
            typeof this.onProcessingStart !==
            'function'
        ) {

            return;

        }


        try {

            this.onProcessingStart(
                item
            );

        } catch (error) {

            console.error(
                '[PIC-140 FIFO] Error en onProcessingStart.',
                error
            );

        }

    }


    /**
     * Notifica finalización.
     *
     * @param {Object} item
     * @param {*} result
     * @returns {void}
     */
    notifyProcessingComplete(
        item,
        result
    ) {

        if (
            typeof this.onProcessingComplete !==
            'function'
        ) {

            return;

        }


        try {

            this.onProcessingComplete(
                item,
                result
            );

        } catch (error) {

            console.error(
                '[PIC-140 FIFO] Error en onProcessingComplete.',
                error
            );

        }

    }


    /**
     * Notifica error.
     *
     * @param {Object} item
     * @param {Error} error
     * @returns {void}
     */
    notifyProcessingError(
        item,
        error
    ) {

        if (
            typeof this.onProcessingError !==
            'function'
        ) {

            return;

        }


        try {

            this.onProcessingError(
                item,
                error
            );

        } catch (callbackError) {

            console.error(
                '[PIC-140 FIFO] Error en onProcessingError.',
                callbackError
            );

        }

    }


    /**
     * Notifica cola vacía.
     *
     * @returns {void}
     */
    notifyEmpty() {

        /**
         * No se utiliza un callback permanente aquí.
         * pic140.js puede observar el estado mediante size()
         * y los resultados de enqueue().
         */

    }


    /* =====================================================
       IDENTIFICADORES
       ===================================================== */

    /**
     * Genera identificador interno de tarea.
     *
     * @returns {string}
     */
    generateItemId() {

        if (
            typeof crypto !== 'undefined' &&
            typeof crypto.randomUUID === 'function'
        ) {

            return `queue-${crypto.randomUUID()}`;

        }


        return (
            `queue-${Date.now()}-` +
            `${Math.random().toString(36).slice(2)}`
        );

    }


    /* =====================================================
       DESTRUCCIÓN
       ===================================================== */

    /**
     * Limpia las tareas pendientes.
     *
     * La tarea en ejecución continuará hasta terminar.
     *
     * @returns {void}
     */
    destroy() {

        this.clear();

        this.processor =
            null;

        this.onEnqueue =
            null;

        this.onProcessingStart =
            null;

        this.onProcessingComplete =
            null;

        this.onProcessingError =
            null;

    }

}


/* =========================================================
   EXPORTACIONES
   ========================================================= */

export {

    FifoQueue,

    EVENTS as FifoQueueEvents,

};
