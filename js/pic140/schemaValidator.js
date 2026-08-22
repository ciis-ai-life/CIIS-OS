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
 * Principios:
 *
 *     - Validación determinista.
 *     - No mutación del evento.
 *     - Validación estructural estricta.
 *     - Compatibilidad con PRE-HASH y POST-HASH.
 *     - Validación de chain_height.
 *     - Validación de tipos JSON compatibles.
 *
 * IMPORTANTE:
 *
 *     Este módulo NO:
 *
 *     - calcula hashes;
 *     - canonicaliza;
 *     - modifica eventos;
 *     - persiste datos;
 *     - consulta IndexedDB;
 *     - publica eventos en Kernel.
 */


/* =========================================================
   CONSTANTES DEL CONTRATO
   ========================================================= */

const SCHEMA_VERSION =
    '1.0';

const EVENT_ID_PREFIX =
    'AUD-EVT-';

const EVENT_ID_REGEX =
    /^AUD-EVT-[0-9A-HJKMNP-TV-Z]{26}$/;

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const HASH_REGEX =
    /^[0-9a-f]{64}$/i;


/* =========================================================
   CAMPOS REQUERIDOS
   ========================================================= */

/**
 * Campos estructurales obligatorios del evento PIC-140.
 *
 * event_hash NO se incluye porque durante PRE-HASH todavía
 * no existe.
 */
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

    'chain_height',

]);


/* =========================================================
   ENUMERACIONES
   ========================================================= */

const VALID_SEVERITIES = Object.freeze([

    'DEBUG',

    'INFO',

    'NOTICE',

    'WARNING',

    'ERROR',

    'CRITICAL',

]);


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
 * @throws {Error}
 */
function validate(event) {

    const errors =
        collectValidationErrors(
            event
        );


    if (
        errors.length > 0
    ) {

        const error =
            new Error(
                `[PIC-140 SchemaValidator] Evento inválido: ${errors.join('; ')}`
            );


        error.name =
            'PIC140SchemaValidationError';


        error.validationErrors =
            Object.freeze(
                [...errors]
            );


        throw error;

    }


    return true;

}


/* =========================================================
   COLECCIÓN DE ERRORES
   ========================================================= */

/**
 * Recopila todos los errores de validación.
 *
 * No modifica el evento recibido.
 *
 * @param {unknown} event
 * @returns {string[]}
 */
function collectValidationErrors(
    event
) {

    const errors =
        [];


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
            'timestamp debe ser un ISO-8601 UTC válido con milisegundos'
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
     * event_hash es opcional durante PRE-HASH.
     *
     * Si existe, debe tener exactamente 64 caracteres
     * hexadecimales correspondientes a SHA-256.
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
            !HASH_REGEX.test(
                event.event_hash
            )
        ) {

            errors.push(
                'event_hash debe contener exactamente 64 caracteres hexadecimales'
            );

        }

    }


    /* -----------------------------------------------------
       VALIDACIÓN DE VALORES JSON
       ----------------------------------------------------- */

    validateJsonCompatibleValue(
        event,
        'evento',
        errors,
        new Set()
    );


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
 * Valida que los valores contenidos en el evento sean
 * compatibles con JSON y, por tanto, con canonicalize().
 *
 * Se rechazan explícitamente:
 *
 *     - undefined
 *     - functions
 *     - symbols
 *     - bigint
 *     - NaN
 *     - Infinity
 *     - objetos cíclicos
 *
 * @param {*} value
 * @param {string} path
 * @param {string[]} errors
 * @param {Set<Object>} ancestors
 * @returns {void}
 */
function validateJsonCompatibleValue(
    value,
    path,
    errors,
    ancestors
) {

    if (
        value === null
    ) {

        return;

    }


    const type =
        typeof value;


    if (
        type === 'string' ||
        type === 'boolean'
    ) {

        return;

    }


    if (
        type === 'number'
    ) {

        if (
            !Number.isFinite(value)
        ) {

            errors.push(
                `${path} contiene un número no finito`
            );

        }


        return;

    }


    if (
        type === 'undefined'
    ) {

        errors.push(
            `${path} contiene undefined`
        );


        return;

    }


    if (
        type === 'function'
    ) {

        errors.push(
            `${path} contiene una función`
        );


        return;

    }


    if (
        type === 'symbol'
    ) {

        errors.push(
            `${path} contiene un Symbol`
        );


        return;

    }


    if (
        type === 'bigint'
    ) {

        errors.push(
            `${path} contiene un BigInt`
        );


        return;

    }


    if (
        type !== 'object'
    ) {

        errors.push(
            `${path} contiene un tipo no soportado: ${type}`
        );


        return;

    }


    if (
        ancestors.has(value)
    ) {

        errors.push(
            `${path} contiene una referencia circular`
        );


        return;

    }


    ancestors.add(
        value
    );


    if (
        Array.isArray(value)
    ) {

        for (
            let index = 0;
            index < value.length;
            index += 1
        ) {

            validateJsonCompatibleValue(
                value[index],
                `${path}[${index}]`,
                errors,
                ancestors
            );

        }

    } else {

        for (
            const key
            of Object.keys(value)
        ) {

            validateJsonCompatibleValue(
                value[key],
                `${path}.${key}`,
                errors,
                ancestors
            );

        }

    }


    ancestors.delete(
        value
    );

}


/**
 * Valida una fecha ISO-8601 en la representación canónica
 * utilizada por PIC-140.
 *
 * Formato:
 *
 *     YYYY-MM-DDTHH:mm:ss.sssZ
 *
 * @param {string} value
 * @returns {boolean}
 */
function isValidISO8601(
    value
) {

    if (
        typeof value !== 'string'
    ) {

        return false;

    }


    if (
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(
            value
        )
    ) {

        return false;

    }


    const parsed =
        Date.parse(
            value
        );


    if (
        Number.isNaN(parsed)
    ) {

        return false;

    }


    /*
     * Se vuelve a serializar para impedir que Date.parse()
     * acepte fechas que el motor normalice silenciosamente.
     */
    return (
        new Date(parsed).toISOString() ===
        value
    );

}


/* =========================================================
   VALIDACIÓN NO DESTRUCTIVA
   ========================================================= */

/**
 * Devuelve un resultado estructurado sin lanzar excepción.
 *
 * @param {unknown} event
 * @returns {{
 *     valid: boolean,
 *     errors: string[]
 * }}
 */
function validateResult(
    event
) {

    const errors =
        collectValidationErrors(
            event
        );


    return {

        valid:
            errors.length === 0,

        errors:
            [...errors],

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