/**
 * CIIS OS
 * PIC-140 — Schema Validator
 *
 * Archivo:
 *     js/pic140/schemaValidator.js
 *
 * Responsabilidad:
 *     Validar eventos PIC-140 antes de su canonicalización,
 *     cálculo criptográfico y persistencia.
 *
 * Flujo:
 *
 *     buildEvent()
 *          │
 *          ▼
 *     validate()
 *          │
 *          ├── válido ───────► canonicalizer
 *          │
 *          └── inválido ─────► rechazo
 *
 * IMPORTANTE:
 *     Este módulo NO:
 *
 *     - calcula hashes;
 *     - modifica eventos;
 *     - persiste datos;
 *     - consulta IndexedDB;
 *     - publica eventos en el Kernel.
 *
 *     La validación debe ser determinista y no destructiva.
 */


/* =========================================================
   CONSTANTES DEL CONTRATO
   ========================================================= */

const SCHEMA_VERSION = '1.0';

const EVENT_ID_PREFIX = 'AUD-EVT-';

const EVENT_ID_REGEX =
    /^AUD-EVT-[0-9A-HJKMNP-TV-Z]{26}$/;

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


/* =========================================================
   CAMPOS REQUERIDOS
   ========================================================= */

const REQUIRED_FIELDS = Object.freeze([

    'schema_version',

    'event_id',

    'event_category',

    'event_type',

    'timestamp',

    'severity',

    'status',

    'correlation_id',

    'module',

    'operation',

    'actor',

    'target',

    'security_context',

]);


/* =========================================================
   ENUMERACIONES
   ========================================================= */

/**
 * Severidades permitidas.
 *
 * El contrato puede ampliarse posteriormente mediante
 * una nueva versión de schema.
 */
const VALID_SEVERITIES = Object.freeze([

    'DEBUG',

    'INFO',

    'NOTICE',

    'WARNING',

    'ERROR',

    'CRITICAL',

]);


/**
 * Estados permitidos.
 */
const VALID_STATUSES = Object.freeze([

    'SUCCESS',

    'FAILURE',

    'REJECTED',

    'PENDING',

    'ERROR',

]);


/* =========================================================
   API PRINCIPAL
   ========================================================= */

/**
 * Valida un evento PIC-140.
 *
 * @param {unknown} event
 * @returns {true}
 *
 * @throws {TypeError}
 * @throws {Error}
 */
function validate(event) {

    const errors =
        collectValidationErrors(
            event
        );


    if (errors.length > 0) {

        const error =
            new Error(
                `[PIC-140 SchemaValidator] Evento inválido: ${errors.join('; ')}`
            );


        error.name =
            'PIC140SchemaValidationError';


        error.validationErrors =
            errors;


        throw error;

    }


    return true;

}


/* =========================================================
   COLECCIÓN DE ERRORES
   ========================================================= */

/**
 * Recopila todos los errores posibles sin modificar
 * el evento recibido.
 *
 * @param {unknown} event
 * @returns {string[]}
 */
function collectValidationErrors(event) {

    const errors = [];


    /* -----------------------------------------------------
       OBJETO RAÍZ
       ----------------------------------------------------- */

    if (
        event === null ||
        typeof event !== 'object' ||
        Array.isArray(event)
    ) {

        errors.push(
            'el evento debe ser un objeto'
        );


        return errors;

    }


    /* -----------------------------------------------------
       CAMPOS REQUERIDOS
       ----------------------------------------------------- */

    for (
        const field
        of REQUIRED_FIELDS
    ) {

        if (
            !Object.prototype.hasOwnProperty.call(
                event,
                field
            )
        ) {

            errors.push(
                `falta el campo requerido "${field}"`
            );

        }

    }


    /* -----------------------------------------------------
       SCHEMA VERSION
       ----------------------------------------------------- */

    if (
        event.schema_version !==
        SCHEMA_VERSION
    ) {

        errors.push(
            `schema_version debe ser "${SCHEMA_VERSION}"`
        );

    }


    /* -----------------------------------------------------
       EVENT ID
       ----------------------------------------------------- */

    if (
        typeof event.event_id !== 'string'
    ) {

        errors.push(
            'event_id debe ser una cadena'
        );

    } else if (
        !EVENT_ID_REGEX.test(
            event.event_id
        )
    ) {

        errors.push(
            'event_id no cumple el formato AUD-EVT-<ULID>'
        );

    }


    /* -----------------------------------------------------
       EVENT CATEGORY
       ----------------------------------------------------- */

    validateNonEmptyString(
        event,
        'event_category',
        errors
    );


    /* -----------------------------------------------------
       EVENT TYPE
       ----------------------------------------------------- */

    validateNonEmptyString(
        event,
        'event_type',
        errors
    );


    /* -----------------------------------------------------
       TIMESTAMP
       ----------------------------------------------------- */

    if (
        typeof event.timestamp !== 'string'
    ) {

        errors.push(
            'timestamp debe ser una cadena'
        );

    } else if (
        !isValidISO8601(
            event.timestamp
        )
    ) {

        errors.push(
            'timestamp no es un ISO-8601 válido'
        );

    }


    /* -----------------------------------------------------
       SEVERITY
       ----------------------------------------------------- */

    if (
        typeof event.severity !== 'string'
    ) {

        errors.push(
            'severity debe ser una cadena'
        );

    } else if (
        !VALID_SEVERITIES.includes(
            event.severity
        )
    ) {

        errors.push(
            `severity inválido: ${event.severity}`
        );

    }


    /* -----------------------------------------------------
       STATUS
       ----------------------------------------------------- */

    if (
        typeof event.status !== 'string'
    ) {

        errors.push(
            'status debe ser una cadena'
        );

    } else if (
        !VALID_STATUSES.includes(
            event.status
        )
    ) {

        errors.push(
            `status inválido: ${event.status}`
        );

    }


    /* -----------------------------------------------------
       CORRELATION ID
       ----------------------------------------------------- */

    if (
        typeof event.correlation_id !== 'string'
    ) {

        errors.push(
            'correlation_id debe ser una cadena'
        );

    } else if (
        !UUID_REGEX.test(
            event.correlation_id
        )
    ) {

        errors.push(
            'correlation_id no cumple formato UUID'
        );

    }


    /* -----------------------------------------------------
       MODULE
       ----------------------------------------------------- */

    validateNonEmptyString(
        event,
        'module',
        errors
    );


    /* -----------------------------------------------------
       OPERATION
       ----------------------------------------------------- */

    validateNonEmptyString(
        event,
        'operation',
        errors
    );


    /* -----------------------------------------------------
       ACTOR
       ----------------------------------------------------- */

    validateNullableObject(
        event,
        'actor',
        errors
    );


    /* -----------------------------------------------------
       TARGET
       ----------------------------------------------------- */

    validateNullableObject(
        event,
        'target',
        errors
    );


    /* -----------------------------------------------------
       SECURITY CONTEXT
       ----------------------------------------------------- */

    validateNullableObject(
        event,
        'security_context',
        errors
    );


    /* -----------------------------------------------------
       CHAIN HEIGHT
       ----------------------------------------------------- */

    if (
        !Number.isSafeInteger(
            event.chain_height
        ) ||
        event.chain_height < 0
    ) {

        errors.push(
            'chain_height debe ser un entero seguro >= 0'
        );

    }


    /* -----------------------------------------------------
       EVENT HASH
       ----------------------------------------------------- */

    /**
     * Si event_hash está presente, debe ser una cadena
     * hexadecimal SHA-256 de exactamente 64 caracteres.
     *
     * Esto permite validar eventos ya calculados sin exigir
     * que el hash exista durante la fase PRE-HASH.
     */
    if (
        Object.prototype.hasOwnProperty.call(
            event,
            'event_hash'
        )
    ) {

        if (
            typeof event.event_hash !== 'string'
        ) {

            errors.push(
                'event_hash debe ser una cadena'
            );

        } else if (
            !/^[0-9a-f]{64}$/i.test(
                event.event_hash
            )
        ) {

            errors.push(
                'event_hash debe contener exactamente 64 caracteres hexadecimales'
            );

        }

    }


    return errors;

}


/* =========================================================
   VALIDADORES AUXILIARES
   ========================================================= */

/**
 * Valida una cadena no vacía.
 *
 * @param {Object} object
 * @param {string} field
 * @param {string[]} errors
 * @returns {void}
 */
function validateNonEmptyString(
    object,
    field,
    errors
) {

    if (
        typeof object[field] !== 'string'
    ) {

        errors.push(
            `${field} debe ser una cadena`
        );


        return;

    }


    if (
        object[field].trim().length === 0
    ) {

        errors.push(
            `${field} no puede estar vacío`
        );

    }

}


/**
 * Valida un campo que puede ser objeto o null.
 *
 * @param {Object} object
 * @param {string} field
 * @param {string[]} errors
 * @returns {void}
 */
function validateNullableObject(
    object,
    field,
    errors
) {

    const value =
        object[field];


    if (
        value === null
    ) {

        return;

    }


    if (
        typeof value !== 'object' ||
        Array.isArray(value)
    ) {

        errors.push(
            `${field} debe ser un objeto o null`
        );

    }

}


/**
 * Valida una fecha ISO-8601.
 *
 * @param {string} value
 * @returns {boolean}
 */
function isValidISO8601(value) {

    if (
        typeof value !== 'string'
    ) {

        return false;

    }


    const parsed =
        Date.parse(value);


    if (
        Number.isNaN(parsed)
    ) {

        return false;

    }


    /**
     * PIC-140 requiere una representación temporal
     * inequívoca con zona UTC.
     *
     * Ejemplo:
     *
     * 2026-08-20T10:30:00.000Z
     */
    return (
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
            .test(value)
    );

}


/* =========================================================
   VALIDACIÓN NO DESTRUCTIVA
   ========================================================= */

/**
 * Devuelve un resultado estructurado sin lanzar excepción.
 *
 * Útil para pruebas y diagnósticos.
 *
 * @param {unknown} event
 * @returns {{
 *     valid: boolean,
 *     errors: string[]
 * }}
 */
function validateResult(event) {

    const errors =
        collectValidationErrors(
            event
        );


    return {

        valid:
            errors.length === 0,

        errors,

    };

}


/* =========================================================
   EXPORTACIONES
   ========================================================= */

export {

    validate,

    validateResult,

    collectValidationErrors,

    REQUIRED_FIELDS,

    VALID_SEVERITIES,

    VALID_STATUSES,

    SCHEMA_VERSION,

    EVENT_ID_PREFIX,

    EVENT_ID_REGEX,

};
