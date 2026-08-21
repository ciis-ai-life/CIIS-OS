/**
 * CIIS OS
 * PIC-140 — Integrity Verifier
 *
 * Archivo:
 *     js/pic140/integrityVerifier.js
 *
 * Responsabilidad:
 *     Verificar la integridad criptográfica y secuencial
 *     de los eventos PIC-140 almacenados en IndexedDB.
 *
 * IMPORTANTE:
 *
 *     Este módulo es estrictamente de lectura.
 *
 *     NO:
 *     - modifica eventos;
 *     - recalcula y guarda hashes;
 *     - elimina eventos;
 *     - corrige la cadena;
 *     - altera IndexedDB;
 *     - publica eventos en Kernel.
 */

import {
    canonicalize,
} from './canonicalizer.js';

import {
    calculateHash,
} from './hashEngine.js';


/* =========================================================
   CONSTANTES
   ========================================================= */

const VERIFICATION_STATUS = Object.freeze({

    VALID:
        'VALID',

    INVALID:
        'INVALID',

    EMPTY:
        'EMPTY',

    ERROR:
        'ERROR',

});


const EVENT_ID_REGEX =
    /^AUD-EVT-[0-9A-HJKMNP-TV-Z]{26}$/;

const HASH_REGEX =
    /^[0-9a-f]{64}$/i;


/* =========================================================
   INTEGRITY VERIFIER
   ========================================================= */

class IntegrityVerifier {

    /**
     * @param {Object} storageAdapter
     */
    constructor(
        storageAdapter
    ) {

        if (
            !storageAdapter ||
            typeof storageAdapter.getAllEventsOrdered !==
            'function'
        ) {

            throw new TypeError(
                '[PIC-140 IntegrityVerifier] StorageAdapter inválido.'
            );

        }


        this.storage =
            storageAdapter;

    }


    /* =====================================================
       VERIFICACIÓN COMPLETA
       ===================================================== */

    /**
     * Verifica toda la cadena almacenada.
     *
     * @returns {Promise<Object>}
     */
    async verifyChain() {

        const startedAt =
            new Date().toISOString();


        let events;


        try {

            events =
                await this.storage.getAllEventsOrdered();

        } catch (error) {

            return buildResult({

                status:
                    VERIFICATION_STATUS.ERROR,

                valid:
                    false,

                eventCount:
                    0,

                verifiedCount:
                    0,

                errors: [

                    createVerificationError(
                        'STORAGE_ERROR',
                        null,
                        error?.message ??
                            'No fue posible recuperar los eventos.'
                    ),

                ],

                startedAt,

            });

        }


        if (
            !Array.isArray(events)
        ) {

            return buildResult({

                status:
                    VERIFICATION_STATUS.ERROR,

                valid:
                    false,

                eventCount:
                    0,

                verifiedCount:
                    0,

                errors: [

                    createVerificationError(
                        'INVALID_STORAGE_RESULT',
                        null,
                        'StorageAdapter no devolvió un arreglo.'
                    ),

                ],

                startedAt,

            });

        }


        if (
            events.length === 0
        ) {

            return buildResult({

                status:
                    VERIFICATION_STATUS.EMPTY,

                valid:
                    true,

                eventCount:
                    0,

                verifiedCount:
                    0,

                errors: [],

                startedAt,

            });

        }


        const errors =
            [];

        let verifiedCount =
            0;


        for (
            let index = 0;
            index < events.length;
            index += 1
        ) {

            const event =
                events[index];


            /* ---------------------------------------------
               IDENTIDAD
               --------------------------------------------- */

            const identityResult =
                verifyEventIdentity(
                    event
                );


            if (
                !identityResult.valid
            ) {

                errors.push(
                    identityResult.error
                );

            }


            /* ---------------------------------------------
               SECUENCIA
               --------------------------------------------- */

            const sequenceResult =
                verifyChainHeight(
                    event,
                    index
                );


            if (
                !sequenceResult.valid
            ) {

                errors.push(
                    sequenceResult.error
                );

            }


            /* ---------------------------------------------
               HASH
               --------------------------------------------- */

            const hashResult =
                await verifyEventHash(
                    event
                );


            if (
                !hashResult.valid
            ) {

                errors.push(
                    hashResult.error
                );

            } else {

                verifiedCount +=
                    1;

            }

        }


        const valid =
            errors.length === 0;


        return buildResult({

            status:
                valid
                    ? VERIFICATION_STATUS.VALID
                    : VERIFICATION_STATUS.INVALID,

            valid,

            eventCount:
                events.length,

            verifiedCount,

            errors,

            startedAt,

        });

    }


    /* =====================================================
       VERIFICACIÓN INDIVIDUAL
       ===================================================== */

    /**
     * Verifica un evento individual.
     *
     * @param {Object} event
     * @returns {Promise<Object>}
     */
    async verifyEvent(
        event
    ) {

        const identityResult =
            verifyEventIdentity(
                event
            );


        const hashResult =
            await verifyEventHash(
                event
            );


        const errors =
            [];


        if (
            !identityResult.valid
        ) {

            errors.push(
                identityResult.error
            );

        }


        if (
            !hashResult.valid
        ) {

            errors.push(
                hashResult.error
            );

        }


        return {

            valid:
                errors.length === 0,

            eventId:
                typeof event?.event_id === 'string'
                    ? event.event_id
                    : null,

            errors,

        };

    }


    /* =====================================================
       VERIFICACIÓN DE SECUENCIA
       ===================================================== */

    /**
     * Verifica únicamente la secuencia de chain_height.
     *
     * @returns {Promise<Object>}
     */
    async verifySequence() {

        let events;


        try {

            events =
                await this.storage.getAllEventsOrdered();

        } catch (error) {

            return {

                valid:
                    false,

                eventCount:
                    0,

                errors: [

                    createVerificationError(
                        'STORAGE_ERROR',
                        null,
                        error?.message ??
                            'No fue posible recuperar los eventos.'
                    ),

                ],

            };

        }


        if (
            !Array.isArray(events)
        ) {

            return {

                valid:
                    false,

                eventCount:
                    0,

                errors: [

                    createVerificationError(
                        'INVALID_STORAGE_RESULT',
                        null,
                        'StorageAdapter no devolvió un arreglo.'
                    ),

                ],

            };

        }


        if (
            events.length === 0
        ) {

            return {

                valid:
                    true,

                eventCount:
                    0,

                errors: [],

            };

        }


        const errors =
            [];


        for (
            let index = 0;
            index < events.length;
            index += 1
        ) {

            const result =
                verifyChainHeight(
                    events[index],
                    index
                );


            if (
                !result.valid
            ) {

                errors.push(
                    result.error
                );

            }

        }


        return {

            valid:
                errors.length === 0,

            eventCount:
                events.length,

            errors,

        };

    }

}


/* =========================================================
   IDENTIDAD DEL EVENTO
   ========================================================= */

/**
 * Verifica la identidad mínima de un evento.
 *
 * @param {*} event
 * @returns {Object}
 */
function verifyEventIdentity(
    event
) {

    if (
        event === null ||
        typeof event !== 'object' ||
        Array.isArray(event)
    ) {

        return {

            valid:
                false,

            error:
                createVerificationError(
                    'INVALID_EVENT',
                    null,
                    'El evento no es un objeto válido.'
                ),

        };

    }


    if (
        typeof event.event_id !== 'string'
    ) {

        return {

            valid:
                false,

            error:
                createVerificationError(
                    'MISSING_EVENT_ID',
                    event,
                    'El evento no contiene event_id.'
                ),

        };

    }


    if (
        !EVENT_ID_REGEX.test(
            event.event_id
        )
    ) {

        return {

            valid:
                false,

            error:
                createVerificationError(
                    'INVALID_EVENT_ID',
                    event,
                    'event_id no cumple el formato AUD-EVT-<ULID>.'
                ),

        };

    }


    return {

        valid:
            true,

        eventId:
            event.event_id,

    };

}


/* =========================================================
   VERIFICACIÓN DE HASH
   ========================================================= */

/**
 * Recalcula y compara el hash de un evento.
 *
 * IMPORTANTE:
 *
 * canonicalize() excluye event_hash del nivel raíz.
 *
 * Por tanto, el cálculo reproduce exactamente la entrada
 * utilizada durante la generación original del hash.
 *
 * @param {*} event
 * @returns {Promise<Object>}
 */
async function verifyEventHash(
    event
) {

    if (
        event === null ||
        typeof event !== 'object' ||
        Array.isArray(event)
    ) {

        return {

            valid:
                false,

            error:
                createVerificationError(
                    'INVALID_EVENT',
                    null,
                    'El evento no es un objeto válido.'
                ),

        };

    }


    if (
        typeof event.event_id !== 'string'
    ) {

        return {

            valid:
                false,

            error:
                createVerificationError(
                    'MISSING_EVENT_ID',
                    event,
                    'El evento no contiene event_id válido.'
                ),

        };

    }


    if (
        typeof event.event_hash !== 'string'
    ) {

        return {

            valid:
                false,

            error:
                createVerificationError(
                    'MISSING_EVENT_HASH',
                    event,
                    'El evento no contiene event_hash.'
                ),

        };

    }


    if (
        !HASH_REGEX.test(
            event.event_hash
        )
    ) {

        return {

            valid:
                false,

            error:
                createVerificationError(
                    'INVALID_EVENT_HASH',
                    event,
                    'event_hash no tiene formato SHA-256 hexadecimal válido.'
                ),

        };

    }


    try {

        const canonicalData =
            canonicalize(
                event
            );


        const calculatedHash =
            await calculateHash(
                canonicalData
            );


        const storedHash =
            event.event_hash.toLowerCase();


        if (
            calculatedHash !==
            storedHash
        ) {

            return {

                valid:
                    false,

                error:
                    createVerificationError(
                        'HASH_MISMATCH',
                        event,
                        'El hash almacenado no coincide con el hash recalculado.',
                        {

                            storedHash,

                            calculatedHash,

                        }
                    ),

            };

        }


        return {

            valid:
                true,

            eventId:
                event.event_id,

            hash:
                calculatedHash,

        };

    } catch (error) {

        return {

            valid:
                false,

            error:
                createVerificationError(
                    'HASH_VERIFICATION_ERROR',
                    event,
                    error?.message ??
                        'Error desconocido durante la verificación criptográfica.'
                ),

        };

    }

}


/* =========================================================
   VERIFICACIÓN DE CHAIN HEIGHT
   ========================================================= */

/**
 * Verifica que chain_height coincida exactamente con
 * la posición esperada dentro de la cadena.
 *
 * Primer evento:
 *
 *     0
 *
 * Segundo:
 *
 *     1
 *
 * etc.
 *
 * @param {*} event
 * @param {number} expectedHeight
 * @returns {Object}
 */
function verifyChainHeight(
    event,
    expectedHeight
) {

    if (
        event === null ||
        typeof event !== 'object' ||
        Array.isArray(event)
    ) {

        return {

            valid:
                false,

            error:
                createVerificationError(
                    'INVALID_EVENT',
                    null,
                    'Evento inválido durante la verificación secuencial.'
                ),

        };

    }


    if (
        !Number.isSafeInteger(
            event.chain_height
        ) ||
        event.chain_height < 0
    ) {

        return {

            valid:
                false,

            error:
                createVerificationError(
                    'INVALID_CHAIN_HEIGHT',
                    event,
                    'chain_height debe ser un entero seguro >= 0.'
                ),

        };

    }


    if (
        event.chain_height !==
        expectedHeight
    ) {

        return {

            valid:
                false,

            error:
                createVerificationError(
                    'CHAIN_HEIGHT_MISMATCH',
                    event,
                    `Se esperaba chain_height=${expectedHeight}, pero se encontró ${event.chain_height}.`
                ),

        };

    }


    return {

        valid:
            true,

    };

}


/* =========================================================
   RESULTADO
   ========================================================= */

/**
 * Construye un resultado normalizado.
 *
 * @param {Object} options
 * @returns {Object}
 */
function buildResult(options) {

    return {

        status:
            options.status,

        valid:
            options.valid,

        eventCount:
            options.eventCount,

        verifiedCount:
            options.verifiedCount,

        errors:
            options.errors,

        startedAt:
            options.startedAt,

        completedAt:
            new Date().toISOString(),

    };

}


/* =========================================================
   ERROR NORMALIZADO
   ========================================================= */

/**
 * Construye un error estructurado de verificación.
 *
 * @param {string} code
 * @param {Object|null} event
 * @param {string} message
 * @param {Object|null} details
 * @returns {Object}
 */
function createVerificationError(
    code,
    event,
    message,
    details = null
) {

    const result = {

        code,

        message,

    };


    if (
        event &&
        typeof event.event_id === 'string'
    ) {

        result.event_id =
            event.event_id;

    }


    if (
        event &&
        Number.isSafeInteger(
            event.chain_height
        )
    ) {

        result.chain_height =
            event.chain_height;

    }


    if (
        details !== null
    ) {

        result.details =
            details;

    }


    return result;

}


/* =========================================================
   EXPORTACIONES
   ========================================================= */

export {

    IntegrityVerifier,

    verifyEventHash,

    verifyChainHeight,

    verifyEventIdentity,

    VERIFICATION_STATUS,

};