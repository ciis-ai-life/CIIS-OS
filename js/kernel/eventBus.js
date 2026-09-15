/**
 * CIIS OS — Kernel Event Bus
 * Archivo: js/kernel/eventBus.js
 *
 * Responsabilidad:
 * - Publicar eventos del Kernel.
 * - Suscribir listeners por tópico.
 * - Soportar suscripción wildcard "*".
 *
 * Compatibilidad:
 * - Listeners normales reciben: callback(payload)
 * - Listeners wildcard "*" reciben: callback(topic, payload)
 *
 * Esto permite que módulos institucionales como PIC-140
 * puedan auditar todos los eventos del Kernel sin alterar
 * el comportamiento de los módulos existentes.
 */

class EventBus {

    constructor() {
        this.listeners = new Map();
    }

    /**
     * Suscribe un callback a un tópico.
     *
     * Tópico normal:
     *   Kernel.subscribe('WINDOW_OPEN', callback)
     *
     * Wildcard:
     *   Kernel.subscribe('*', (topic, payload) => {})
     *
     * @param {string} topic
     * @param {Function} callback
     * @returns {Function} función para cancelar la suscripción
     */
    subscribe(topic, callback) {

        this.#validateTopic(topic);

        if (typeof callback !== 'function') {
            throw new TypeError(
                '[CIIS Kernel] El callback de subscribe debe ser una función.'
            );
        }

        if (!this.listeners.has(topic)) {
            this.listeners.set(topic, new Set());
        }

        const callbacks = this.listeners.get(topic);

        callbacks.add(callback);

        return () => {
            this.unsubscribe(topic, callback);
        };
    }

    /**
     * Publica un evento.
     *
     * Listeners normales:
     *   callback(payload)
     *
     * Listeners wildcard:
     *   callback(topic, payload)
     *
     * @param {string} topic
     * @param {*} payload
     */
    publish(topic, payload = undefined) {

        this.#validateTopic(topic);

        const exactCallbacks = this.listeners.get(topic);
        const wildcardCallbacks = this.listeners.get('*');

        const hasExact =
            exactCallbacks &&
            exactCallbacks.size > 0;

        const hasWildcard =
            wildcardCallbacks &&
            wildcardCallbacks.size > 0;

        if (!hasExact && !hasWildcard) {
            return;
        }

        /*
         * Tomamos snapshots para evitar problemas si un listener
         * se suscribe o cancela durante el procesamiento.
         */
        const exactSnapshot = hasExact
            ? Array.from(exactCallbacks)
            : [];

        const wildcardSnapshot = hasWildcard
            ? Array.from(wildcardCallbacks)
            : [];

        /*
         * ---------------------------------------------------------
         * 1. Listeners específicos del tópico
         * ---------------------------------------------------------
         *
         * Se conserva exactamente el contrato anterior:
         *
         * callback(payload)
         */
        for (const callback of exactSnapshot) {

            try {

                callback(payload);

            } catch (error) {

                console.error(
                    `[CIIS Kernel] Error en listener del tópico "${topic}".`,
                    error
                );
            }
        }

        /*
         * ---------------------------------------------------------
         * 2. Listeners wildcard
         * ---------------------------------------------------------
         *
         * El wildcard recibe:
         *
         * callback(topic, payload)
         *
         * Esto es necesario para PIC-140 porque el auditor
         * necesita conocer tanto el nombre del evento como
         * su información asociada.
         */
        for (const callback of wildcardSnapshot) {

            try {

                callback(topic, payload);

            } catch (error) {

                console.error(
                    `[CIIS Kernel] Error en listener wildcard "*".`,
                    error
                );
            }
        }
    }

    /**
     * Cancela una suscripción.
     *
     * @param {string} topic
     * @param {Function} callback
     * @returns {boolean}
     */
    unsubscribe(topic, callback) {

        this.#validateTopic(topic);

        const callbacks = this.listeners.get(topic);

        if (!callbacks) {
            return false;
        }

        const removed = callbacks.delete(callback);

        if (callbacks.size === 0) {
            this.listeners.delete(topic);
        }

        return removed;
    }

    /**
     * Elimina todos los listeners de un tópico.
     *
     * @param {string} topic
     */
    clear(topic) {

        this.#validateTopic(topic);

        this.listeners.delete(topic);
    }

    /**
     * Elimina todas las suscripciones.
     */
    clearAll() {

        this.listeners.clear();
    }

    /**
     * Indica si un tópico tiene listeners.
     *
     * Nota:
     * Esta función conserva su semántica original:
     * comprueba el tópico solicitado directamente.
     *
     * @param {string} topic
     * @returns {boolean}
     */
    hasSubscribers(topic) {

        this.#validateTopic(topic);

        const callbacks = this.listeners.get(topic);

        return Boolean(
            callbacks &&
            callbacks.size > 0
        );
    }

    /**
     * Devuelve el número de listeners registrados para
     * un tópico concreto.
     *
     * @param {string} topic
     * @returns {number}
     */
    listenerCount(topic) {

        this.#validateTopic(topic);

        const callbacks = this.listeners.get(topic);

        return callbacks
            ? callbacks.size
            : 0;
    }

    /**
     * Validación interna de tópicos.
     *
     * @param {string} topic
     */
    #validateTopic(topic) {

        if (
            typeof topic !== 'string' ||
            topic.trim() === ''
        ) {
            throw new TypeError(
                '[CIIS Kernel] El tópico del evento debe ser una cadena no vacía.'
            );
        }
    }
}


/**
 * Instancia única del EventBus.
 *
 * Todo CIIS OS utiliza este Kernel para comunicación
 * entre módulos.
 */
const Kernel = new EventBus();


export {
    EventBus,
    Kernel
};