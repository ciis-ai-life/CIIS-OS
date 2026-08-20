/**
 * CIIS OS
 * PIC-140 — Canonicalizer
 *
 * Archivo:
 *     js/pic140/canonicalizer.js
 *
 * Responsabilidad:
 *     Generar una representación determinista y estable
 *     de un evento PIC-140 antes del cálculo criptográfico.
 *
 * Reglas canónicas:
 *
 *     1. El objeto original NO se modifica.
 *     2. event_hash se excluye de la representación.
 *     3. Las claves se ordenan lexicográficamente.
 *     4. Los objetos anidados también se ordenan.
 *     5. Los arrays conservan su orden original.
 *     6. JSON.stringify() produce la representación final.
 *
 * IMPORTANTE:
 *     Este módulo NO:
 *
 *     - calcula SHA-256;
 *     - genera event_hash;
 *     - persiste eventos;
 *     - modifica el evento original.
 */


/* =========================================================
   CONSTANTES
   ========================================================= */

const HASH_FIELD = 'event_hash';


/* =========================================================
   API PRINCIPAL
   ========================================================= */

/**
 * Canonicaliza un evento PIC-140.
 *
 * @param {Object} event
 * @returns {string}
 */
function canonicalize(event) {

    validateInput(event);


    const canonicalObject =
        canonicalizeValue(
            event,
            true
        );


    return JSON.stringify(
        canonicalObject
    );

}


/* =========================================================
   CANONICALIZACIÓN RECURSIVA
   ========================================================= */

/**
 * Canonicaliza cualquier valor JSON compatible.
 *
 * @param {*} value
 * @param {boolean} isRoot
 * @returns {*}
 */
function canonicalizeValue(
    value,
    isRoot = false
) {

    /* -----------------------------------------------------
       NULL
       ----------------------------------------------------- */

    if (value === null) {

        return null;

    }


    /* -----------------------------------------------------
       PRIMITIVOS
       ----------------------------------------------------- */

    if (
        typeof value !== 'object'
    ) {

        return value;

    }


    /* -----------------------------------------------------
       ARRAYS
       ----------------------------------------------------- */

    if (
        Array.isArray(value)
    ) {

        return value.map(
            item =>
                canonicalizeValue(
                    item,
                    false
                )
        );

    }


    /* -----------------------------------------------------
       OBJETOS
       ----------------------------------------------------- */

    const result = {};


    const keys =
        Object.keys(value)
            .filter(
                key =>
                    !(
                        isRoot &&
                        key === HASH_FIELD
                    )
            )
            .sort();


    for (
        const key
        of keys
    ) {

        result[key] =
            canonicalizeValue(
                value[key],
                false
            );

    }


    return result;

}


/* =========================================================
   VALIDACIÓN
   ========================================================= */

/**
 * Valida la entrada al canonicalizer.
 *
 * @param {*} event
 * @returns {void}
 */
function validateInput(event) {

    if (
        event === null ||
        typeof event !== 'object' ||
        Array.isArray(event)
    ) {

        throw new TypeError(
            '[PIC-140 Canonicalizer] El evento debe ser un objeto.'
        );

    }

}


/* =========================================================
   UTILIDADES DE INSPECCIÓN
   ========================================================= */

/**
 * Devuelve el objeto canónico sin convertirlo todavía
 * a JSON.
 *
 * Esta función es útil para pruebas unitarias.
 *
 * @param {Object} event
 * @returns {Object}
 */
function canonicalizeObject(event) {

    validateInput(event);


    return canonicalizeValue(
        event,
        true
    );

}


/**
 * Comprueba si dos eventos producen exactamente la misma
 * representación canónica.
 *
 * @param {Object} first
 * @param {Object} second
 * @returns {boolean}
 */
function areCanonicallyEqual(
    first,
    second
) {

    return (
        canonicalize(first) ===
        canonicalize(second)
    );

}


/* =========================================================
   EXPORTACIONES
   ========================================================= */

export {

    canonicalize,

    canonicalizeObject,

    areCanonicallyEqual,

    HASH_FIELD,

};
