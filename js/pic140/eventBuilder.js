/**
 * CIIS OS
 * PIC-140 — Event Builder
 *
 * Archivo:
 *     js/pic140/eventBuilder.js
 *
 * Responsabilidad:
 *     Construir eventos de auditoría PIC-140 a partir de
 *     información suministrada por el Kernel.
 *
 * Flujo:
 *
 *     Kernel Event
 *          │
 *          ▼
 *     buildEvent()
 *          │
 *          ▼
 *     PRE-HASH VALIDATION
 *          │
 *          ▼
 *     canonicalize()
 *          │
 *          ▼
 *     calculateHash()
 *
 * IMPORTANTE:
 *     Este módulo:
 *
 *     - NO calcula hashes.
 *     - NO canonicaliza eventos.
 *     - NO persiste eventos.
 *     - NO modifica IndexedDB.
 *     - NO publica eventos en Kernel.
 *
 *     Su única responsabilidad es construir un nuevo
 *     evento PIC-140 estructuralmente válido.
 */


/* =========================================================
   CONSTANTES
   ========================================================= */

const SCHEMA_VERSION =
    '1.0';

const EVENT_ID_PREFIX =
    'AUD-EVT-';

const ULID_LENGTH =
    26;

const ULID_RANDOM_LENGTH =
    16;

const CORRELATION_ID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


/* =========================================================
   CROCKFORD BASE32
   ========================================================= */

/**
 * Alfabeto Crockford Base32.
 *
 * Se excluyen I, L, O y U.
 */
const CROCKFORD_BASE32 =
    '0123456789ABCDEFGHJKMNPQRSTVWXYZ';


/* =========================================================
   EVENT BUILDER
   ========================================================= */

/**
 * Construye un nuevo evento PIC-140.
 *
 * El evento devuelto no contiene event_hash.
 *
 * event_hash será generado posteriormente por el pipeline
 * PIC-140 después de la validación PRE-HASH y la
 * canonicalización.
 *
 * @param {Object} input
 * @returns {Object}
 */
function buildEvent(input = {}) {

    validateInput(
        input
    );


    const {

        eventCategory,

        eventType,

        severity,

        status,

        module,

        operation,

        actor,

        target,

        securityContext,

        correlationId,

        previousEvent,

        metadata,

    } = input;


    const event = {

        schema_version:
            SCHEMA_VERSION,

        event_id:
            generateEventId(),

        event_category:
            eventCategory.trim(),

        event_type:
            eventType.trim(),

        timestamp:
            new Date().toISOString(),

        severity:
            severity ??
            'INFO',

        status:
            status ??
            'SUCCESS',

        correlation_id:
            correlationId ??
            generateCorrelationId(),

        module:
            module.trim(),

        operation:
            operation.trim(),

        actor:
            actor === undefined
                ? null
                : cloneValue(actor),

        target:
            target === undefined
                ? null
                : cloneValue(target),

        security_context:
            securityContext === undefined
                ? null
                : cloneValue(securityContext),

        chain_height:
            calculateChainHeight(
                previousEvent
            ),

    };


    /* -----------------------------------------------------
       METADATA OPCIONAL
       ----------------------------------------------------- */

    if (
        metadata !== undefined &&
        metadata !== null
    ) {

        event.metadata =
            cloneValue(
                metadata
            );

    }


    return event;

}


/* =========================================================
   VALIDACIÓN DE ENTRADA
   ========================================================= */

/**
 * Valida los datos de entrada necesarios para construir
 * un evento.
 *
 * @param {unknown} input
 * @returns {void}
 */
function validateInput(input) {

    if (
        input === null ||
        typeof input !== 'object' ||
        Array.isArray(input)
    ) {

        throw new TypeError(
            '[PIC-140 EventBuilder] La entrada debe ser un objeto.'
        );

    }


    const requiredFields = [

        'eventCategory',

        'eventType',

        'module',

        'operation',

    ];


    for (
        const field
        of requiredFields
    ) {

        if (
            typeof input[field] !== 'string' ||
            input[field].trim().length === 0
        ) {

            throw new TypeError(
                `[PIC-140 EventBuilder] Campo requerido inválido: ${field}`
            );

        }

    }


    /* -----------------------------------------------------
       ENUMERACIONES OPCIONALES
       ----------------------------------------------------- */

    if (
        input.severity !== undefined &&
        (
            typeof input.severity !== 'string' ||
            input.severity.trim().length === 0
        )
    ) {

        throw new TypeError(
            '[PIC-140 EventBuilder] severity debe ser una cadena no vacía.'
        );

    }


    if (
        input.status !== undefined &&
        (
            typeof input.status !== 'string' ||
            input.status.trim().length === 0
        )
    ) {

        throw new TypeError(
            '[PIC-140 EventBuilder] status debe ser una cadena no vacía.'
        );

    }


    /* -----------------------------------------------------
       CORRELATION ID
       ----------------------------------------------------- */

    if (
        input.correlationId !== undefined
    ) {

        if (
            typeof input.correlationId !== 'string'
        ) {

            throw new TypeError(
                '[PIC-140 EventBuilder] correlationId debe ser una cadena.'
            );

        }


        if (
            !CORRELATION_ID_REGEX.test(
                input.correlationId
            )
        ) {

            throw new TypeError(
                '[PIC-140 EventBuilder] correlationId no cumple formato UUID.'
            );

        }

    }


    /* -----------------------------------------------------
       PREVIOUS EVENT
       ----------------------------------------------------- */

    if (
        input.previousEvent !== undefined &&
        input.previousEvent !== null
    ) {

        if (
            typeof input.previousEvent !== 'object' ||
            Array.isArray(input.previousEvent)
        ) {

            throw new TypeError(
                '[PIC-140 EventBuilder] previousEvent debe ser un objeto o null.'
            );

        }


        if (
            !Object.prototype.hasOwnProperty.call(
                input.previousEvent,
                'chain_height'
            )
        ) {

            throw new TypeError(
                '[PIC-140 EventBuilder] previousEvent debe contener chain_height.'
            );

        }

    }


    /* -----------------------------------------------------
       ACTOR
       ----------------------------------------------------- */

    validateNullableObjectInput(
        input.actor,
        'actor'
    );


    /* -----------------------------------------------------
       TARGET
       ----------------------------------------------------- */

    validateNullableObjectInput(
        input.target,
        'target'
    );


    /* -----------------------------------------------------
       SECURITY CONTEXT
       ----------------------------------------------------- */

    validateNullableObjectInput(
        input.securityContext,
        'securityContext'
    );

}


/* =========================================================
   VALIDACIÓN DE OBJETOS OPCIONALES
   ========================================================= */

/**
 * Valida valores que deben ser objetos o null.
 *
 * @param {*} value
 * @param {string} field
 * @returns {void}
 */
function validateNullableObjectInput(
    value,
    field
) {

    if (
        value === undefined ||
        value === null
    ) {

        return;

    }


    if (
        typeof value !== 'object' ||
        Array.isArray(value)
    ) {

        throw new TypeError(
            `[PIC-140 EventBuilder] ${field} debe ser un objeto o null.`
        );

    }

}


/* =========================================================
   EVENT ID
   ========================================================= */

/**
 * Genera un identificador PIC-140.
 *
 * Formato:
 *
 *     AUD-EVT-<26 caracteres Crockford Base32>
 *
 * @returns {string}
 */
function generateEventId() {

    return (
        EVENT_ID_PREFIX +
        generateULID()
    );

}


/**
 * Genera un ULID de 26 caracteres.
 *
 * Estructura:
 *
 *     10 caracteres = timestamp de 48 bits
 *     16 caracteres = aleatoriedad de 80 bits
 *
 * @returns {string}
 */
function generateULID() {

    const timestamp =
        Date.now();


    const timestampPart =
        encodeTimestamp(
            timestamp
        );


    const randomPart =
        encodeRandomness();


    const ulid =
        timestampPart +
        randomPart;


    if (
        ulid.length !== ULID_LENGTH
    ) {

        throw new Error(
            '[PIC-140 EventBuilder] ULID generado con longitud inválida.'
        );

    }


    return ulid;

}


/* =========================================================
   TIMESTAMP ULID
   ========================================================= */

/**
 * Codifica el timestamp Unix en 10 caracteres Crockford
 * Base32.
 *
 * @param {number} timestamp
 * @returns {string}
 */
function encodeTimestamp(timestamp) {

    if (
        !Number.isSafeInteger(timestamp) ||
        timestamp < 0
    ) {

        throw new TypeError(
            '[PIC-140 EventBuilder] Timestamp inválido para ULID.'
        );

    }


    let value =
        timestamp;


    let result =
        '';


    for (
        let index = 0;
        index < 10;
        index += 1
    ) {

        const remainder =
            value % 32;


        result =
            CROCKFORD_BASE32[
                remainder
            ] +
            result;


        value =
            Math.floor(
                value / 32
            );

    }


    return result;

}


/* =========================================================
   ALEATORIEDAD ULID
   ========================================================= */

/**
 * Genera los 80 bits aleatorios del ULID.
 *
 * 10 bytes = 80 bits = 16 caracteres Base32.
 *
 * @returns {string}
 */
function encodeRandomness() {

    if (
        typeof crypto === 'undefined' ||
        typeof crypto.getRandomValues !== 'function'
    ) {

        throw new Error(
            '[PIC-140 EventBuilder] crypto.getRandomValues() no está disponible.'
        );

    }


    const bytes =
        new Uint8Array(10);


    crypto.getRandomValues(
        bytes
    );


    const result = [

        CROCKFORD_BASE32[
            bytes[0] >> 3
        ],

        CROCKFORD_BASE32[
            (
                (bytes[0] & 0x07) << 2
            ) |
            (bytes[1] >> 6)
        ],

        CROCKFORD_BASE32[
            (bytes[1] >> 1) & 0x1F
        ],

        CROCKFORD_BASE32[
            (
                (bytes[1] & 0x01) << 4
            ) |
            (bytes[2] >> 4)
        ],

        CROCKFORD_BASE32[
            (
                (bytes[2] & 0x0F) << 1
            ) |
            (bytes[3] >> 7)
        ],

        CROCKFORD_BASE32[
            (bytes[3] >> 2) & 0x1F
        ],

        CROCKFORD_BASE32[
            (
                (bytes[3] & 0x03) << 3
            ) |
            (bytes[4] >> 5)
        ],

        CROCKFORD_BASE32[
            bytes[4] & 0x1F
        ],

        CROCKFORD_BASE32[
            bytes[5] >> 3
        ],

        CROCKFORD_BASE32[
            (
                (bytes[5] & 0x07) << 2
            ) |
            (bytes[6] >> 6)
        ],

        CROCKFORD_BASE32[
            (bytes[6] >> 1) & 0x1F
        ],

        CROCKFORD_BASE32[
            (
                (bytes[6] & 0x01) << 4
            ) |
            (bytes[7] >> 4)
        ],

        CROCKFORD_BASE32[
            (
                (bytes[7] & 0x0F) << 1
            ) |
            (bytes[8] >> 7)
        ],

        CROCKFORD_BASE32[
            (bytes[8] >> 2) & 0x1F
        ],

        CROCKFORD_BASE32[
            (
                (bytes[8] & 0x03) << 3
            ) |
            (bytes[9] >> 5)
        ],

        CROCKFORD_BASE32[
            bytes[9] & 0x1F
        ],

    ].join('');


    if (
        result.length !== ULID_RANDOM_LENGTH
    ) {

        throw new Error(
            '[PIC-140 EventBuilder] Parte aleatoria ULID con longitud inválida.'
        );

    }


    return result;

}


/* =========================================================
   CORRELATION ID
   ========================================================= */

/**
 * Genera un UUID mediante Web Crypto.
 *
 * @returns {string}
 */
function generateCorrelationId() {

    if (
        typeof crypto === 'undefined' ||
        typeof crypto.randomUUID !== 'function'
    ) {

        throw new Error(
            '[PIC-140 EventBuilder] crypto.randomUUID() no está disponible.'
        );

    }


    const correlationId =
        crypto.randomUUID();


    if (
        !CORRELATION_ID_REGEX.test(
            correlationId
        )
    ) {

        throw new Error(
            '[PIC-140 EventBuilder] crypto.randomUUID() produjo un UUID inválido.'
        );

    }


    return correlationId;

}


/* =========================================================
   CHAIN HEIGHT
   ========================================================= */

/**
 * Calcula la posición del evento dentro de la cadena.
 *
 * Primer evento:
 *
 *     0
 *
 * Evento posterior:
 *
 *     previousEvent.chain_height + 1
 *
 * @param {Object|null|undefined} previousEvent
 * @returns {number}
 */
function calculateChainHeight(
    previousEvent
) {

    if (
        previousEvent === undefined ||
        previousEvent === null
    ) {

        return 0;

    }


    if (
        typeof previousEvent.chain_height !== 'number' ||
        !Number.isSafeInteger(
            previousEvent.chain_height
        ) ||
        previousEvent.chain_height < 0
    ) {

        throw new TypeError(
            '[PIC-140 EventBuilder] previousEvent.chain_height inválido.'
        );

    }


    if (
        previousEvent.chain_height ===
        Number.MAX_SAFE_INTEGER
    ) {

        throw new RangeError(
            '[PIC-140 EventBuilder] No es posible incrementar chain_height de forma segura.'
        );

    }


    return (
        previousEvent.chain_height +
        1
    );

}


/* =========================================================
   COPIA SEGURA
   ========================================================= */

/**
 * Clona un valor sin modificar la entrada original.
 *
 * @param {*} value
 * @returns {*}
 */
function cloneValue(value) {

    if (
        value === null ||
        typeof value !== 'object'
    ) {

        return value;

    }


    if (
        typeof structuredClone ===
        'function'
    ) {

        return structuredClone(
            value
        );

    }


    return JSON.parse(
        JSON.stringify(
            value
        )
    );

}


/* =========================================================
   EXPORTACIONES
   ========================================================= */

export {

    buildEvent,

    generateEventId,

    generateULID,

    generateCorrelationId,

    calculateChainHeight,

    SCHEMA_VERSION,

    EVENT_ID_PREFIX,

};