import { canonicalize } from './canonicalizer.js';
import { calculateHash } from './hashEngine.js';

/**
 * Integrity Verifier (Actualizado)
 * Recalcula la cadena completa y verifica correlatividad de altura.
 */
export async function verifyChain(events) {
    let expectedPrevious = 'GENESIS';
    let expectedHeight = 0;
    let inconsistencies = [];

    for (let i = 0; i < events.length; i++) {
        const event = events[i];

        // 1. Verificar encadenamiento
        if (event.previous_hash !== expectedPrevious) {
            inconsistencies.push(`Ruptura de hash en evento ${event.event_id}. Esperado: ${expectedPrevious}, Encontrado: ${event.previous_hash}`);
        }

        // 2. Verificar altura de la cadena
        if (event.chain_height !== expectedHeight) {
            inconsistencies.push(`Ruptura de secuencia (chain_height) en evento ${event.event_id}. Esperado: ${expectedHeight}, Encontrado: ${event.chain_height}`);
        }

        // 3. Verificar hash interno
        const canonical = canonicalize(event);
        const calculatedHash = await calculateHash(canonical);

        if (calculatedHash !== event.event_hash) {
            inconsistencies.push(`Alteración de datos detectada en evento ${event.event_id}. Hash almacenado no coincide con los datos.`);
        }

        expectedPrevious = event.event_hash;
        expectedHeight = event.chain_height + 1;
    }

    return {
        isValid: inconsistencies.length === 0,
        inconsistencies
    };
}
