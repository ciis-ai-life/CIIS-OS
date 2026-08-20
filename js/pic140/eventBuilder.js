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
 *     Este módulo NO calcula hashes.
 *     Este módulo NO persiste eventos.
 *     Este módulo NO modifica IndexedDB.
 */

const SCHEMA_VERSION = '1.0';

const EVENT_ID_PREFIX = 'AUD-EVT-';

const ULID_LENGTH = 26;


/* =========================================================
   CROCKFORD BASE32
   ========================================================= */

/**
 * Alfabeto Crockford Base32.
 *
 * Se excluyen I, L, O y U para evitar ambigüedades.
 */
const CROCKFORD_BASE32 =
    '0123456789ABCDEFGHJKMNPQRSTVWXYZ';


/* =========================================================
   EVENT BUILDER
   ========================================================= */

/**
 * Construye un evento de auditoría PIC-140.
 *
 * @param {Object} input
 * @returns {Object}
 */
function buildEvent(input = {}) {

    validateInput(input);


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


    const timestamp =
        new Date().toISOString();


    const event = {

        schema_version:
            SCHEMA_VERSION,

        event_id:
            generateEventId(),

        event_category:
            eventCategory,

        event_type:
            eventType,

        timestamp,

        severity:
            severity ?? 'INFO',

        status:
            status ?? 'SUCCESS',

        correlation_id:
            correlationId ??
            generateCorrelationId(),

        module,

        operation,

        actor:
            actor ?? null,

        target:
            target ?? null,

        security_context:
            securityContext ?? null,

        chain_height:
            calculateChainHeight(
                previousEvent
            ),

    };


    /**
     * Metadata adicional puede ser incorporada sin tocar
     * los campos canónicos del evento.
     */
    if (
        metadata !== undefined &&
        metadata !== null
    ) {

        event.metadata =
            cloneValue(metadata);

    }


    return event;

}


/* =========================================================
   VALIDACIÓN DE ENTRADA
   ========================================================= */

/**
 * Valida los datos mínimos necesarios para construir
 * un evento.
 *
 * @param {Object} input
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


    if (
        input.correlationId !== undefined &&
        typeof input.correlationId !== 'string'
    ) {

        throw new TypeError(
            '[PIC-140 EventBuilder] correlationId debe ser una cadena.'
        );

    }


    if (
        input.previousEvent !== undefined &&
        input.previousEvent !== null &&
        (
            typeof input.previousEvent !== 'object' ||
            Array.isArray(input.previousEvent)
        )
    ) {

        throw new TypeError(
            '[PIC-140 EventBuilder] previousEvent debe ser un objeto o null.'
        );

    }

}


/* =========================================================
   EVENT ID
   ========================================================= */

/**
 * Genera un identificador de evento PIC-140.
 *
 * Formato:
 *
 *     AUD-EVT-XXXXXXXXXXXXXXXXXXXXXXXXXX
 *
 * donde X representa 26 caracteres Crockford Base32.
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
 * Genera un ULID compatible con el formato institucional.
 *
 * Se utilizan:
 *
 *     - 48 bits de timestamp.
 *     - 80 bits de aleatoriedad.
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


/**
 * Codifica el timestamp en 10 caracteres Crockford Base32.
 *
 * @param {number} timestamp
 * @returns {string}
 */
function encodeTimestamp(timestamp) {

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


/**
 * Genera la parte aleatoria de 80 bits.
 *
 * 80 bits = 16 caracteres Base32.
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


    /**
     * Convertimos los 80 bits a 16 grupos de 5 bits.
     */
    let result =
        '';


    let accumulator =
        0;

    let bitsAvailable =
        0;


    for (
        const byte
        of bytes
    ) {

        accumulator =
            (
                accumulator << 8
            ) |
            byte;


        bitsAvailable += 8;


        while (
            bitsAvailable >= 5
        ) {

            bitsAvailable -= 5;


            const index =
                (
                    accumulator >>
                    bitsAvailable
                ) &
                31;


            result +=
                CROCKFORD_BASE32[
                    index
                ];

        }

    }


    return result;

}


/* =========================================================
   CORRELATION ID
   ========================================================= */

/**
 * Genera un correlation_id mediante Web Crypto.
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


    return crypto.randomUUID();

}


/* =========================================================
   CHAIN HEIGHT
   ========================================================= */

/**
 * Calcula la altura del evento dentro de la cadena.
 *
 * Primer evento:
 *
 *     chain_height = 0
 *
 * Evento posterior:
 *
 *     previous.chain_height + 1
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
        typeof previousEvent.chain_height !==
        'number' ||
        !Number.isSafeInteger(
            previousEvent.chain_height
        ) ||
        previousEvent.chain_height < 0
    ) {

        throw new TypeError(
            '[PIC-140 EventBuilder] previousEvent.chain_height inválido.'
        );

    }


    return (
        previousEvent.chain_height +
        1
    );

}


/* =========================================================
   UTILIDADES
   ========================================================= */

/**
 * Realiza una copia segura de valores de metadata.
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
        JSON.stringify(value)
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
