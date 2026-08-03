/**
 * Schema Validator - Validación alineada con schemas/audit/v1.json (Actualizada)
 */
export async function validate(eventData) {
    const required = [
        'schema_version', 'event_id', 'timestamp', 'topic', 
        'payload', 'chain_height', 'previous_hash'
    ];

    for (const field of required) {
        if (!(field in eventData)) {
            console.error(`Validación fallida: Falta el campo requerido '${field}'`);
            return false;
        }
    }

    if (eventData.schema_version !== "1.0") {
        console.error("Validación fallida: schema_version incorrecto");
        return false;
    }

    if (!eventData.event_id.startsWith('AUD-EVT-')) {
        console.error("Validación fallida: event_id no cumple con el prefijo institucional ULID");
        return false;
    }

    if (typeof eventData.chain_height !== 'number' || eventData.chain_height < 0) {
        console.error("Validación fallida: chain_height debe ser un entero positivo");
        return false;
    }

    return true;
}
