/**
 * Definiciones de tipos para el Motor PIC-140-001 (Actualizado)
 * @typedef {Object} AuditEvent
 * @property {string} schema_version - Versión del esquema ("1.0")
 * @property {string} event_id - Identificador único (ULID) con prefijo AUD-EVT-
 * @property {string} timestamp - Timestamp en formato ISO 8601 UTC
 * @property {string} correlation_id - ID para agrupar eventos relacionados
 * @property {string|null} causation_id - ID del evento que disparó esta acción
 * @property {string} topic - Categoría o tipo de evento original
 * @property {string} severity - Nivel de severidad (INFO, WARN, SEC, CRIT, etc.)
 * @property {Object} payload - Datos inmutables de la acción
 * @property {number} chain_height - Altura de la cadena (0 para el bloque génesis)
 * @property {string} previous_hash - Hash SHA-256 del evento anterior (Cadena criptográfica)
 * @property {string} [event_hash] - Hash SHA-256 del evento actual (Excluido en canonicalización)
 * @property {string|null} [signature] - Firma digital (Preparado para PKI/WebAuthn)
 */
