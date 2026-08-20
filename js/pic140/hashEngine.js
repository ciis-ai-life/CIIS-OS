/**
 * CIIS OS
 * PIC-140 — Hash Engine
 *
 * Archivo:
 *     js/pic140/hashEngine.js
 *
 * Responsabilidad:
 *     Calcular el hash criptográfico SHA-256 de la
 *     representación canónica de un evento PIC-140.
 *
 * Flujo:
 *
 *     validated event
 *          │
 *          ▼
 *     canonicalize()
 *          │
 *          ▼
 *     calculateHash()
 *          │
 *          ▼
 *     SHA-256
 *          │
 *          ▼
 *     hexadecimal de 64 caracteres
 *
 * Principios:
 *
 *     - SHA-256 mediante Web Crypto API.
 *     - Entrada exclusivamente canónica.
 *     - Resultado determinista.
 *     - Conversión binaria → hexadecimal sin pérdida.
 *     - Preservación obligatoria de ceros iniciales.
 *
 * IMPORTANTE:
 *     Este módulo NO:
 *
 *     - modifica eventos;
 *     - persiste datos;
 *     - consulta IndexedDB;
 *     - publica eventos en Kernel;
 *     - añade event_hash automáticamente al evento.
 */


/* =========================================================
   CONSTANTES
   ========================================================= */

const HASH_ALGORITHM = 'SHA-256';

const HASH_HEX_LENGTH = 64;


/* =========================================================
   API PRINCIPAL
   ========================================================= */

/**
 * Calcula SHA-256 sobre una cadena canónica.
 *
 * @param {string} canonicalData
 * @returns {Promise<string>}
 */
async function calculateHash(
    canonicalData
) {

    validateInput(
        canonicalData
    );


    if (
        typeof crypto === 'undefined' ||
        !crypto.subtle ||
        typeof crypto.subtle.digest !== 'function'
    ) {

        throw new Error(
            '[PIC-140 HashEngine] Web Crypto API no disponible.'
        );

    }


    const encoder =
        new TextEncoder();


    const encodedData =
        encoder.encode(
            canonicalData
        );


    const digest =
        await crypto.subtle.digest(
            HASH_ALGORITHM,
            encodedData
        );


    const hash =
        bufferToHex(
            digest
        );


    if (
        hash.length !== HASH_HEX_LENGTH
    ) {

        throw new Error(
            '[PIC-140 HashEngine] SHA-256 produjo una longitud hexadecimal inválida.'
        );

    }


    if (
        !/^[0-9a-f]{64}$/.test(hash)
    ) {

        throw new Error(
            '[PIC-140 HashEngine] El resultado SHA-256 no es hexadecimal válido.'
        );

    }


    return hash;

}


/* =========================================================
   VALIDACIÓN DE ENTRADA
   ========================================================= */

/**
 * Valida la representación canónica recibida.
 *
 * @param {*} value
 * @returns {void}
 */
function validateInput(value) {

    if (
        typeof value !== 'string'
    ) {

        throw new TypeError(
            '[PIC-140 HashEngine] La entrada debe ser una cadena canónica.'
        );

    }

}


/* =========================================================
   CONVERSIÓN BINARIA → HEXADECIMAL
   ========================================================= */

/**
 * Convierte un ArrayBuffer en una cadena hexadecimal.
 *
 * IMPORTANTE:
 *
 * Cada byte debe ocupar exactamente dos caracteres.
 *
 * Ejemplo:
 *
 *     byte = 0
 *     hexadecimal = "00"
 *
 * No:
 *
 *     "0"
 *
 * El uso de padStart(2, '0') garantiza que los ceros
 * iniciales no se pierdan.
 *
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function bufferToHex(
    buffer
) {

    const bytes =
        new Uint8Array(
            buffer
        );


    let result =
        '';


    for (
        const byte
        of bytes
    ) {

        result +=
            byte
                .toString(16)
                .padStart(2, '0');

    }


    return result;

}


/* =========================================================
   VERIFICACIÓN DE HASH
   ========================================================= */

/**
 * Comprueba si una cadena tiene el formato exacto
 * de un SHA-256 hexadecimal.
 *
 * @param {*} hash
 * @returns {boolean}
 */
function isValidHash(
    hash
) {

    return (
        typeof hash === 'string' &&
        hash.length === HASH_HEX_LENGTH &&
        /^[0-9a-f]{64}$/i.test(hash)
    );

}


/**
 * Calcula nuevamente el hash y compara el resultado
 * con un hash esperado.
 *
 * @param {string} canonicalData
 * @param {string} expectedHash
 * @returns {Promise<boolean>}
 */
async function verifyHash(
    canonicalData,
    expectedHash
) {

    if (
        !isValidHash(
            expectedHash
        )
    ) {

        return false;

    }


    const calculatedHash =
        await calculateHash(
            canonicalData
        );


    return (
        calculatedHash.toLowerCase() ===
        expectedHash.toLowerCase()
    );

}


/* =========================================================
   INFORMACIÓN DEL MOTOR
   ========================================================= */

/**
 * Devuelve información inmutable sobre el motor.
 *
 * @returns {Object}
 */
function getHashEngineInfo() {

    return Object.freeze({

        algorithm:
            HASH_ALGORITHM,

        outputFormat:
            'lowercase hexadecimal',

        outputLength:
            HASH_HEX_LENGTH,

        webCrypto:
            true,

    });

}


/* =========================================================
   EXPORTACIONES
   ========================================================= */

export {

    calculateHash,

    verifyHash,

    isValidHash,

    getHashEngineInfo,

    HASH_ALGORITHM,

    HASH_HEX_LENGTH,

};
