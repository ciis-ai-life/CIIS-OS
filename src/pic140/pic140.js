import { Kernel } from '../kernel/eventBus.js';
import { buildEvent } from './eventBuilder.js';
import { canonicalize } from './canonicalizer.js';
import { calculateHash } from './hashEngine.js';
import { validate } from './schemaValidator.js';
import { StorageAdapter } from './storageAdapter.js';

/**
 * PIC-140-001 Runtime Engine[cite: 11]
 * Orquestador del Motor de Auditoría Transversal[cite: 11]
 */
class AuditEngine {
    constructor() {
        this.storage = new StorageAdapter();
        this.isReady = false;
    }

    async init() {
        await this.storage.init();
        this.isReady = true;

        Kernel.subscribe('*', async (topic, eventInfo) => {
            if (topic.startsWith('PIC140_')) return;
            await this.processEvent(topic, eventInfo);
        });

        console.log("🟢 Motor PIC-140-001 Inicializado con Schema v1.0");
    }

    async processEvent(topic, eventInfo) {
        try {
            // 1. Obtener último evento para mantener cadena y altura[cite: 11]
            const previousEvent = await this.storage.getLastEvent();
            const prevHash = previousEvent ? previousEvent.event_hash : 'GENESIS';
            const chainHeight = previousEvent ? previousEvent.chain_height + 1 : 0;

            // 2. Construir el evento[cite: 11]
            const auditEvent = buildEvent(topic, eventInfo.payload, prevHash, chainHeight, {
                correlation_id: eventInfo.correlation_id,
                causation_id: eventInfo.causation_id,
                severity: eventInfo.severity
            });

            // 3. Validar contra el Schema[cite: 11]
            const isValid = await validate(auditEvent);
            if (!isValid) throw new Error("Evento descartado por validación de esquema.");

            // 4. Canonicalizar y calcular Hash[cite: 11]
            const canonicalStr = canonicalize(auditEvent);
            auditEvent.event_hash = await calculateHash(canonicalStr);

            // 5. Persistir de forma segura[cite: 11]
            await this.storage.saveEvent(auditEvent);

            // 6. Notificar éxito al ecosistema[cite: 11]
            Kernel.publish('PIC140_LOGGED', { id: auditEvent.event_id, hash: auditEvent.event_hash, height: auditEvent.chain_height });

        } catch (error) {
            console.error("🔴 Error Crítico en PIC-140:", error);
            Kernel.publish('PIC140_ERROR', { error: error.message, originalTopic: topic });
        }
    }
}

export const PIC140 = new AuditEngine();