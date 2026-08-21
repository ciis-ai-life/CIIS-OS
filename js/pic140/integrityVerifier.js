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
 * Verificaciones:
 *
 *     1. Existencia de eventos.
 *     2. Validación estructural del esquema.
 *     3. Orden de chain_height.
 *     4. Continuidad de chain_height.
 *     5. Existencia de event_hash.
 *     6. Canonicalización determinista.
 *     7. Recalculación SHA-256.
 *     8. Comparación contra event_hash almacenado.
 *
 * IMPORTANTE:
 *
 *     Este módulo NO:
 *
 *     - modifica eventos;
 *     - recalcula y guarda hashes;
 *     - elimina eventos;
 *     - corrige automáticamente la cadena;
 *     - altera IndexedDB.
 *
 * Una discrepancia se reporta como fallo de integridad.
 */

import {
    canonicalize,
} from './canonicalizer.js';

import {
    calculateHash,
} from './hashEngine.js';

import {
    validate,
} from './schemaValidator.js';


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

            return {

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
                        String(error)
                    ),

                ],

                startedAt,

                completedAt:
                    new Date().toISOString(),

            };

        }


        if (
            !Array.isArray(events)
        ) {

            return {

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

                completedAt:
                    new Date().toISOString(),

            };

        }


        if (
            events.length === 0
        ) {

            return {

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

                completedAt:
                    new Date().toISOString(),

            };

        }


        const errors =
            [];

        let verifiedCount =
            0;


        /* -------------------------------------------------
           VERIFICACIÓN EVENTO POR EVENTO
           ------------------------------------------------- */

        for (
            let index = 0;
            index < events.length;
            index += 1
        ) {

            const event =
                events[index];


            const expectedHeight =
                index;


            /* ---------------------------------------------
               VALIDACIÓN ESTRUCTURAL
               --------------------------------------------- */

            const schemaResult =
                verifyEventSchema(
                    event
                );


            if (
                !schemaResult.valid
            ) {

                errors.push(
                    schemaResult.error
                );

            }


            /* ---------------------------------------------
               VALIDACIÓN DE SECUENCIA
               --------------------------------------------- */

            const heightResult =
                verifyChainHeight(
                    event,
                    expectedHeight
                );


            if (
                !heightResult.valid
            ) {

                errors.push(
                    heightResult.error
                );

            }


            /* ---------------------------------------------
               VALIDACIÓN CRIPTOGRÁFICA
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

            }


            /*
             * Un evento solamente se considera
             * completamente verificado cuando:
             *
             *     schema     = válido
             *     chain      = válido
             *     hash       = válido
             */
            if (
                schemaResult.valid &&
                heightResult.valid &&
                hashResult.valid
            ) {

                verifiedCount +=
                    1;

            }

        }


        const valid =
            errors.length === 0;


        return {

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

            completedAt:
                new Date().toISOString(),

        };

    }


    /* =====================================================
       VERIFICACIÓN DE EVENTO INDIVIDUAL
       ===================================================== */

    /**
     * Verifica un evento individual.
     *
     * La verificación incluye:
     *
     *     - esquema;
     *     - event_hash;
     *     - canonicalización;
     *     - SHA-256.
     *
     * @param {Object} event
     * @returns {Promise<Object>}
     */
    async verifyEvent(
        event
    ) {

        const schemaResult =
            verifyEventSchema(
                event
            );


        const hashResult =
            await verifyEventHash(
                event
            );


        if (
            !schemaResult.valid
        ) {

            return {

                valid:
                    false,

                eventId:
                    getEventId(
                        event
                    ),

                errors: [

                    schemaResult.error,

                    ...(hashResult.valid
                        ? []
                        : [hashResult.error]),

                ],

            };

        }


        if (
            !hashResult.valid
        ) {

            return {

                valid:
                    false,

                eventId:
                    getEventId(
                        event
                    ),

                errors: [

                    hashResult.error,

                ],

            };

        }


        return {

            valid:
                true,

            eventId:
                event.event_id,

            hash:
                hashResult.hash,

            errors: [],

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
                        String(error)
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
   VALIDACIÓN DE ESQUEMA
   ========================================================= */

/**
 * Valida estructuralmente un evento utilizando el mismo
 * schemaValidator.js utilizado por AuditEngine.
 *
 * IMPORTANTE:
 *
 *     validate() no modifica el evento.
 *
 * @param {Object} event
 * @returns {Object}
 */
function verifyEventSchema(
    event
) {

    try {

        validate(
            event
        );


        return {

            valid:
                true,

        };

    } catch (error) {

        return {

            valid:
                false,

            error:
                createVerificationError(
                    'SCHEMA_INVALID',
                    event,
                    error?.message ??
                    String(error),
                    {
                        validationErrors:
                            Array.isArray(
                                error?.validationErrors
                            )
                                ? error.validationErrors
                                : null,
                    }
                ),

        };

    }

}


/* =========================================================
   VERIFICACIÓN DE HASH
   ========================================================= */

/**
 * Recalcula y compara el hash de un evento.
 *
 * @param {Object} event
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
        !/^[0-9a-f]{64}$/i.test(
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

        /**
         * canonicalize() elimina event_hash del nivel raíz.
         *
         * Por tanto, el hash se recalcula sobre exactamente
         * la misma representación utilizada durante la
         * generación original.
         */
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
                    String(error)
                ),

        };

    }

}


/* =========================================================
   VERIFICACIÓN DE CHAIN HEIGHT
   ========================================================= */

/**
 * Verifica que chain_height coincida con la posición
 * esperada dentro de la cadena.
 *
 * @param {Object} event
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
                    'chain_height no es un entero seguro >= 0.'
                ),

        };

    }


    if (
        !Number.isSafeInteger(
            expectedHeight
        ) ||
        expectedHeight < 0
    ) {

        return {

            valid:
                false,

            error:
                createVerificationError(
                    'INVALID_EXPECTED_HEIGHT',
                    event,
                    'La altura esperada no es válida.'
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
   UTILIDADES
   ========================================================= */

/**
 * Obtiene event_id de forma segura.
 *
 * @param {*} event
 * @returns {string|null}
 */
function getEventId(
    event
) {

    if (
        event &&
        typeof event.event_id === 'string'
    ) {

        return event.event_id;

    }


    return null;

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
        details
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

    VERIFICATION_STATUS,

};