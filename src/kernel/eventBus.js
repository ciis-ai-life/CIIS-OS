/**
 * CIIS OS Kernel - Event Bus
 * Patrón Pub/Sub para la distribución de eventos entre módulos.
 */
export class EventBus {
    constructor() {
        this.subscribers = new Map();
    }

    subscribe(topic, callback) {
        if (!this.subscribers.has(topic)) {
            this.subscribers.set(topic, []);
        }
        this.subscribers.get(topic).push(callback);

        return () => this.unsubscribe(topic, callback);
    }

    unsubscribe(topic, callback) {
        const callbacks = this.subscribers.get(topic) || [];
        this.subscribers.set(topic, callbacks.filter(cb => cb !== callback));
    }

    publish(topic, payload, metadata = {}) {
        const eventInfo = {
            topic,
            payload,
            timestamp: new Date().toISOString(),
            ...metadata // Aquí pueden venir correlation_id, causation_id, severity
        };

        // Intercepción global para el Motor de Auditoría
        if (this.subscribers.has('*')) {
            this.subscribers.get('*').forEach(cb => cb(topic, eventInfo));
        }

        // Suscriptores específicos
        if (this.subscribers.has(topic)) {
            this.subscribers.get(topic).forEach(cb => cb(eventInfo));
        }
    }
}

export const Kernel = new EventBus();
