/**
 * CIIS OS
 * Kernel / EventBus
 *
 * Archivo:
 *     js/kernel/eventBus.js
 *
 * Responsabilidad:
 *     Proporcionar un bus de eventos central para la comunicación
 *     desacoplada entre los módulos de CIIS OS.
 *
 * Arquitectura:
 *     - ES Modules nativos.
 *     - Exportación nombrada.
 *     - Sin dependencias externas.
 *     - Sin acceso directo al DOM.
 *
 * Principios:
 *     - Un único Kernel/EventBus compartido por la aplicación.
 *     - Suscripciones explícitas.
 *     - Publicación síncrona y determinista.
 *     - Errores de listeners aislados para no detener el Kernel.
 */

class EventBus {

    constructor() {

        /**
         * Mapa interno de suscripciones.
         *
         * Estructura:
         *
         * Map<
         *     topic,
         *     Set<callback>
         * >
         */
        this.listeners = new Map();

    }


    /**
     * Suscribe una función a un tópico.
     *
     * @param {string} topic
     * @param {Function} callback
     * @returns {Function} función para cancelar la suscripción
     */
    subscribe(topic, callback) {

        this.#validateTopic(topic);
        this.#validateCallback(callback);

        if (!this.listeners.has(topic)) {
            this.listeners.set(topic, new Set());
        }

        const callbacks = this.listeners.get(topic);

        callbacks.add(callback);

        /**
         * La función devuelta permite cancelar exactamente
         * esta suscripción sin afectar a otras.
         */
        return () => {

            const currentCallbacks = this.listeners.get(topic);

            if (!currentCallbacks) {
                return;
            }

            currentCallbacks.delete(callback);

            if (currentCallbacks.size === 0) {
                this.listeners.delete(topic);
            }

        };

    }


    /**
     * Publica un evento en un tópico.
     *
     * @param {string} topic
     * @param {*} payload
     */
    publish(topic, payload = undefined) {

        this.#validateTopic(topic);

        const callbacks = this.listeners.get(topic);

        if (!callbacks || callbacks.size === 0) {
            return;
        }

        /**
         * Se crea una copia antes de iterar.
         *
         * Esto permite que un listener pueda cancelar su propia
         * suscripción sin modificar la colección que está siendo
         * recorrida.
         */
        const snapshot = Array.from(callbacks);

        for (const callback of snapshot) {

            try {

                callback(payload);

            } catch (error) {

                /**
                 * Un listener defectuoso no debe detener la
                 * ejecución de los demás listeners.
                 *
                 * El error se informa al entorno de ejecución,
                 * pero no se relanza desde aquí.
                 */
                console.error(
                    `[CIIS Kernel] Error en listener del tópico "${topic}".`,
                    error
                );

            }

        }

    }


    /**
     * Elimina una suscripción concreta.
     *
     * @param {string} topic
     * @param {Function} callback
     * @returns {boolean}
     */
    unsubscribe(topic, callback) {

        this.#validateTopic(topic);
        this.#validateCallback(callback);

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
     * Elimina todas las suscripciones de un tópico.
     *
     * @param {string} topic
     * @returns {boolean}
     */
    clear(topic) {

        this.#validateTopic(topic);

        return this.listeners.delete(topic);

    }


    /**
     * Elimina todas las suscripciones del EventBus.
     *
     * @returns {void}
     */
    clearAll() {

        this.listeners.clear();

    }


    /**
     * Indica si existe al menos una suscripción para un tópico.
     *
     * @param {string} topic
     * @returns {boolean}
     */
    hasSubscribers(topic) {

        this.#validateTopic(topic);

        const callbacks = this.listeners.get(topic);

        return Boolean(callbacks && callbacks.size > 0);

    }


    /**
     * Devuelve el número de listeners registrados para un tópico.
     *
     * @param {string} topic
     * @returns {number}
     */
    listenerCount(topic) {

        this.#validateTopic(topic);

        const callbacks = this.listeners.get(topic);

        return callbacks ? callbacks.size : 0;

    }


    /**
     * Valida un tópico.
     *
     * @param {string} topic
     * @private
     */
    #validateTopic(topic) {

        if (
            typeof topic !== 'string' ||
            topic.trim().length === 0
        ) {

            throw new TypeError(
                '[CIIS Kernel] El tópico debe ser una cadena no vacía.'
            );

        }

    }


    /**
     * Valida un callback.
     *
     * @param {Function} callback
     * @private
     */
    #validateCallback(callback) {

        if (typeof callback !== 'function') {

            throw new TypeError(
                '[CIIS Kernel] El listener debe ser una función.'
            );

        }

    }

}


/**
 * Instancia única del EventBus.
 *
 * Todos los módulos que importen "Kernel" recibirán
 * exactamente la misma instancia.
 */
const Kernel = new EventBus();


/**
 * Exportaciones nombradas.
 *
 * IMPORTANTE:
 * No utilizar export default.
 */
export {
    EventBus,
    Kernel
};