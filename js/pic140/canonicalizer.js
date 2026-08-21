/**
 * CIIS OS
 * PIC-140 — Canonicalizer
 *
 * Archivo:
 *     js/pic140/canonicalizer.js
 *
 * Responsabilidad:
 *     Generar una representación canónica, determinista y
 *     reproducible de un evento PIC-140 antes del cálculo
 *     criptográfico.
 *
 * Flujo:
 *
 *     validated event
 *          │
 *          ▼
 *     canonicalize()
 *          │
 *          ▼
 *     UTF-8 canonical JSON
 *          │
 *          ▼
 *     hashEngine
 *
 * Principios:
 *
 *     - Determinismo.
 *     - Ordenamiento lexicográfico de claves.
 *     - No mutación del evento original.
 *     - Exclusión de event_hash únicamente en la raíz.
 *     - Recursividad para objetos y arrays.
 *     - JSON válido y reproducible.
 *     - Tratamiento seguro de claves especiales.
 *
 * IMPORTANTE:
 *     Este módulo NO:
 *
 *     - calcula hashes;
 *     - persiste datos;
 *     - consulta IndexedDB;
 *     - modifica el evento original;
 *     - publica eventos en el Kernel.
 */


/* =========================================================
   CAMPOS EXCLUIDOS DEL HASH
   ========================================================= */

/**
 * Campos que no forman parte de la representación
 * canónica utilizada para calcular event_hash.
 *
 * event_hash debe excluirse porque su propio valor depende
 * del contenido que se está utilizando para calcularlo.
 *
 * IMPORTANTE:
 *     La exclusión se aplica únicamente al objeto raíz.
 *
 *     Un campo llamado "event_hash" dentro de metadata,
 *     actor, target, security_context u otro objeto anidado
 *     forma parte de los datos y NO debe eliminarse.
 */
const EXCLUDED_FIELDS = Object.freeze([

    'event_hash',

]);


/* =========================================================
   API PRINCIPAL
   ========================================================= */

/**
 * Genera la representación canónica de un evento.
 *
 * @param {unknown} event
 * @returns {string}
 */
function canonicalize(event) {

    if (
        event === null ||
        typeof event !== 'object' ||
        Array.isArray(event)
    ) {

        throw new TypeError(
            '[PIC-140 Canonicalizer] El evento debe ser un objeto.'
        );

    }


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
 * Canonicaliza cualquier valor JSON-compatible.
 *
 * Los objetos se ordenan lexicográficamente por clave.
 *
 * Los arrays conservan estrictamente su orden original,
 * ya que el orden de un array forma parte de su significado.
 *
 * La exclusión de event_hash se aplica únicamente cuando
 * isRoot === true.
 *
 * Los objetos resultantes utilizan un prototipo nulo para
 * evitar comportamientos especiales de claves como
 * "__proto__".
 *
 * @param {*} value
 * @param {boolean} isRoot
 * @returns {*}
 */
function canonicalizeValue(
    value,
    isRoot = false
) {

    if (
        value === null
    ) {

        return null;

    }


    if (
        typeof value === 'string' ||
        typeof value === 'boolean'
    ) {

        return value;

    }


    if (
        typeof value === 'number'
    ) {

        if (
            !Number.isFinite(value)
        ) {

            throw new TypeError(
                '[PIC-140 Canonicalizer] Los números deben ser finitos.'
            );

        }


        return value;

    }


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


    if (
        typeof value === 'object'
    ) {

        /*
         * Object.create(null) evita que claves especiales
         * como "__proto__" sean interpretadas como mutaciones
         * del prototipo.
         *
         * Esto permite conservar las claves literalmente y
         * mantener una representación determinista.
         */
        const result =
            Object.create(null);


        const keys =
            Object.keys(value)
                .filter(
                    key =>
                        !(
                            isRoot &&
                            EXCLUDED_FIELDS.includes(key)
                        )
                )
                .sort(
                    compareKeys
                );


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


    throw new TypeError(
        `[PIC-140 Canonicalizer] Tipo de valor no soportado: ${typeof value}`
    );

}


/* =========================================================
   ORDENAMIENTO DE CLAVES
   ========================================================= */

/**
 * Comparador lexicográfico determinista.
 *
 * Se utiliza el orden Unicode/UTF-16 natural de JavaScript.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function compareKeys(
    a,
    b
) {

    if (
        a < b
    ) {

        return -1;

    }


    if (
        a > b
    ) {

        return 1;

    }


    return 0;

}


/* =========================================================
   VERIFICACIÓN DE CANONICIDAD
   ========================================================= */

/**
 * Comprueba si dos objetos producen exactamente la misma
 * representación canónica.
 *
 * Esta función es útil para pruebas deterministas.
 *
 * @param {unknown} first
 * @param {unknown} second
 * @returns {boolean}
 */
function isCanonicalEquivalent(
    first,
    second
) {

    return (
        canonicalize(first) ===
        canonicalize(second)
    );

}


/* =========================================================
   CLON CANÓNICO
   ========================================================= */

/**
 * Devuelve el objeto canónico antes de serializarlo.
 *
 * Esta función es útil para pruebas y diagnósticos.
 *
 * El resultado es un nuevo objeto y nunca modifica
 * el objeto original.
 *
 * @param {unknown} event
 * @returns {Object}
 */
function getCanonicalObject(
    event
) {

    if (
        event === null ||
        typeof event !== 'object' ||
        Array.isArray(event)
    ) {

        throw new TypeError(
            '[PIC-140 Canonicalizer] El evento debe ser un objeto.'
        );

    }


    return canonicalizeValue(
        event,
        true
    );

}


/* =========================================================
   VERIFICACIÓN DE EVENT_HASH
   ========================================================= */

/**
 * Indica si event_hash está presente en el objeto raíz.
 *
 * @param {Object} event
 * @returns {boolean}
 */
function hasEventHash(
    event
) {

    if (
        event === null ||
        typeof event !== 'object' ||
        Array.isArray(event)
    ) {

        return false;

    }


    return Object.prototype.hasOwnProperty.call(
        event,
        'event_hash'
    );

}


/* =========================================================
   EXPORTACIONES
   ========================================================= */

export {

    canonicalize,

    getCanonicalObject,

    isCanonicalEquivalent,

    hasEventHash,

    EXCLUDED_FIELDS,

};