/**
 * Event Builder - PIC-140-001 (Actualizado con v1.json)
 */

// Generador de ULID adaptado para Vanilla JS
function generateULID() {
    const chars = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    let timestamp = Date.now();
    let ulid = '';

    for (let i = 0; i < 10; i++) {
        ulid = chars[timestamp % 32] + ulid;
        timestamp = Math.floor(timestamp / 32);
    }
    for (let i = 0; i < 16; i++) {
        ulid += chars[Math.floor(Math.random() * 32)];
    }
    return 'AUD-EVT-' + ulid;
}

export function buildEvent(topic, payload, previousHash, chainHeight, options = {}) {
    return {
        schema_version: "1.0",
        event_id: generateULID(),
        timestamp: new Date().toISOString(),
        correlation_id: options.correlation_id || generateULID().replace('AUD-EVT-', 'COR-'),
        causation_id: options.causation_id || null,
        topic: topic,
        severity: options.severity || 'INFO',
        payload: payload,
        chain_height: chainHeight,
        previous_hash: previousHash || 'GENESIS',
        signature: null // Opcional / preparado para futuras fases
    };
}
