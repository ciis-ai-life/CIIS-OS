/**
 * CIIS OS
 * PIC-140 — Hash Engine
 *
 * Archivo:
 *     js/pic140/hashEngine.js
 *
 * Responsabilidad:
 *     Calcular SHA-256 sobre una representación canónica
 *     previamente generada por canonicalizer.js.
 *
 * Flujo:
 *
 *     event
 *        │
 *        ▼
 *     canonicalize()
 *        │
 *        ▼
 *     canonical string
 *        │
 *        ▼
 *     calculateHash()
 *        │
 *        ▼
 *     SHA-256
 *        │
 *        ▼
 *     64 hexadecimal characters
 *
 * IMPORTANTE:
 *     Este módulo NO:
 *
 *     - canonicaliza eventos;
 *     - modifica eventos;
 *     - persiste eventos;
 *     - genera event_id;
 *     - administra la cola FIFO;
 *     - escribe directamente en IndexedDB.
 *
 * La entrada criptográfica debe ser exactamente la salida
 * de canonicalize().
 */


/* =========================================================
   CONSTANTES
   ========================================================= */

const HASH_ALGORITHM = 'SHA-256';

const HASH_BYTE_LENGTH = 32;

const HASH_HEX_LENGTH = 64;


/* =========================================================
   API PRINCIPAL
   ========================================================= */

/**
 * Calcula SHA-256 de una cadena canónica.
 *
 * @param {string} canonicalData
 * @returns {Promise<string>}
 */
async function calculateHash(
    canonicalData
) {

    validateCanonicalData(
        canonicalData
    );


    ensureWebCrypto();


    const encoder =
        new TextEncoder();


    const data =
        encoder.encode(
            canonicalData
        );


    const digest =
        await crypto.subtle.digest(
            HASH_ALGORITHM,
            data
        );


    const hash =
        bytesToHex(
            new Uint8Array(
                digest
            )
        );


    validateHashOutput(
        hash
    );


    return hash;

}


/* =========================================================
   VALIDACIÓN DE ENTRADA
   ========================================================= */

/**
 * Verifica que la entrada sea una cadena.
 *
 * @param {*} value
 * @returns {void}
 */
function validateCanonicalData(
    value
) {

    if (
        typeof value !== 'string'
    ) {

        throw new TypeError(
            '[PIC-140 HashEngine] La entrada debe ser una cadena canónica.'
        );

    }

}


/* =========================================================
   WEB CRYPTO
   ========================================================= */

/**
 * Verifica la disponibilidad de Web Crypto.
 *
 * @returns {void}
 */
function ensureWebCrypto() {

    if (
        typeof crypto === 'undefined'
    ) {

        throw new Error(
            '[PIC-140 HashEngine] Web Crypto API no está disponible.'
        );

    }


    if (
        typeof crypto.subtle ===
        'undefined'
    ) {

        throw new Error(
            '[PIC-140 HashEngine] crypto.subtle no está disponible.'
        );

    }


    if (
        typeof crypto.subtle.digest !==
        'function'
    ) {

        throw new Error(
            '[PIC-140 HashEngine] crypto.subtle.digest() no está disponible.'
        );

    }

}


/* =========================================================
   BYTE → HEX
   ========================================================= */

/**
 * Convierte bytes a hexadecimal.
 *
 * Cada byte genera exactamente dos caracteres.
 *
 * Ejemplo:
 *
 *     0  → "00"
 *     1  → "01"
 *     15 → "0f"
 *     255 → "ff"
 *
 * Esto garantiza que SHA-256 produzca exactamente
 * 64 caracteres hexadecimales.
 *
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bytesToHex(
    bytes
) {

    if (
        !(bytes instanceof Uint8Array)
    ) {

        throw new TypeError(
            '[PIC-140 HashEngine] bytesToHex requiere Uint8Array.'
        );

    }


    let hex =
        '';


    for (
        const byte
        of bytes
    ) {

        hex +=
            byte
                .toString(16)
                .padStart(2, '0');

    }


    return hex;

}


/* =========================================================
   VALIDACIÓN DE SALIDA
   ========================================================= */

/**
 * Verifica que el hash generado tenga exactamente
 * el formato SHA-256 esperado.
 *
 * @param {string} hash
 * @returns {void}
 */
function validateHashOutput(
    hash
) {

    if (
        typeof hash !== 'string'
    ) {

        throw new TypeError(
            '[PIC-140 HashEngine] El hash generado no es una cadena.'
        );

    }


    if (
        hash.length !== HASH_HEX_LENGTH
    ) {

        throw new Error(
            `[PIC-140 HashEngine] Longitud SHA-256 inválida: ${hash.length}.`
        );

    }


    if (
        !/^[0-9a-f]{64}$/.test(
            hash
        )
    ) {

        throw new Error(
            '[PIC-140 HashEngine] El hash contiene caracteres no hexadecimales.'
        );

    }

}


/* =========================================================
   FUNCIÓN DE PRUEBA
   ========================================================= */

/**
 * Calcula directamente el hash SHA-256 de una cadena.
 *
 * Esta función es un alias explícito para pruebas y
 * diagnósticos.
 *
 * @param {string} value
 * @returns {Promise<string>}
 */
async function sha256(
    value
) {

    return calculateHash(
        value
    );

}


/* =========================================================
   EXPORTACIONES
   ========================================================= */

export {

    calculateHash,

    sha256,

    bytesToHex,

    validateHashOutput,

    HASH_ALGORITHM,

    HASH_BYTE_LENGTH,

    HASH_HEX_LENGTH,

};
