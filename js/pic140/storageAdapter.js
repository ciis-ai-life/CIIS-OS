/**
 * CIIS OS
 * PIC-140 — Storage Adapter
 *
 * Archivo:
 *     js/pic140/storageAdapter.js
 *
 * Responsabilidad:
 *     Persistencia append-only de eventos PIC-140
 *     mediante IndexedDB.
 *
 * Base de datos:
 *
 *     CIIS_AuditDB
 *
 * Object Store:
 *
 *     events
 *
 * Índice:
 *
 *     chain_height
 *
 * Restricciones contractuales:
 *
 *     - append-only
 *     - store.add(event)
 *     - NO store.put(event)
 *     - event_id como keyPath
 *     - chain_height UNIQUE
 *     - multiEntry=false
 *     - upgrades no destructivos
 *     - event_hash obligatorio al persistir
 *
 * IMPORTANTE:
 *
 *     Este módulo NO:
 *
 *     - construye eventos;
 *     - calcula hashes;
 *     - canonicaliza;
 *     - administra FIFO;
 *     - publica eventos en el Kernel.
 */


/* =========================================================
   CONSTANTES
   ========================================================= */

const DB_NAME =
    'CIIS_AuditDB';

const DB_VERSION =
    1;

const EVENTS_STORE =
    'events';

const CHAIN_HEIGHT_INDEX =
    'chain_height';

const EVENT_ID_REGEX =
    /^AUD-EVT-[0-9A-HJKMNP-TV-Z]{26}$/;

const HASH_REGEX =
    /^[0-9a-f]{64}$/i;


/* =========================================================
   STORAGE ADAPTER
   ========================================================= */

class StorageAdapter {

    constructor(options = {}) {

        this.dbName =
            options.dbName ??
            DB_NAME;

        this.dbVersion =
            options.dbVersion ??
            DB_VERSION;

        this.db =
            null;

        this.isInitialized =
            false;

        this.initializationPromise =
            null;

    }


    /* =====================================================
       INICIALIZACIÓN
       ===================================================== */

    /**
     * Inicializa el almacenamiento.
     *
     * Se utiliza una única promesa de inicialización para
     * evitar aperturas concurrentes de la misma base.
     *
     * @returns {Promise<IDBDatabase>}
     */
    async initialize() {

        if (
            this.isInitialized &&
            this.db
        ) {

            return this.db;

        }


        if (
            this.initializationPromise
        ) {

            return this.initializationPromise;

        }


        this.initializationPromise =
            this.initializeInternal();


        try {

            return await this.initializationPromise;

        } finally {

            this.initializationPromise =
                null;

        }

    }


    /**
     * Inicialización interna.
     *
     * @returns {Promise<IDBDatabase>}
     */
    async initializeInternal() {

        if (
            typeof indexedDB ===
            'undefined'
        ) {

            throw new Error(
                '[PIC-140 StorageAdapter] IndexedDB no está disponible.'
            );

        }


        const database =
            await this.openDatabase();


        try {

            this.db =
                database;


            await this.verifyStorage();


            this.isInitialized =
                true;


            return this.db;

        } catch (error) {

            try {

                database.close();

            } catch (
                closeError
            ) {

                error.closeError =
                    closeError;

            }


            this.db =
                null;

            this.isInitialized =
                false;


            throw error;

        }

    }


    /**
     * Abre la base de datos IndexedDB.
     *
     * @returns {Promise<IDBDatabase>}
     */
    openDatabase() {

        return new Promise(
            (resolve, reject) => {

                let settled =
                    false;


                let database =
                    null;


                let request;


                try {

                    request =
                        indexedDB.open(
                            this.dbName,
                            this.dbVersion
                        );

                } catch (error) {

                    settled =
                        true;

                    reject(
                        createStorageError(
                            'No fue posible iniciar la apertura de CIIS_AuditDB.',
                            error
                        )
                    );

                    return;

                }


                /* -----------------------------------------
                   ACTUALIZACIÓN DE ESQUEMA
                   ----------------------------------------- */

                request.onupgradeneeded =
                    event => {

                        try {

                            this.handleUpgrade(
                                event
                            );

                        } catch (error) {

                            try {

                                const transaction =
                                    event.target.transaction;


                                if (
                                    transaction
                                ) {

                                    transaction.abort();

                                }

                            } catch (
                                abortError
                            ) {

                                error.abortError =
                                    abortError;

                            }


                            if (
                                !settled
                            ) {

                                settled =
                                    true;

                                reject(
                                    createStorageError(
                                        'La actualización de CIIS_AuditDB fue rechazada.',
                                        error
                                    )
                                );

                            }

                        }

                    };


                /* -----------------------------------------
                   APERTURA EXITOSA
                   ----------------------------------------- */

                request.onsuccess =
                    () => {

                        database =
                            request.result;


                        if (
                            settled
                        ) {

                            database.close();

                            return;

                        }


                        database.onversionchange =
                            () => {

                                database.close();

                                if (
                                    this.db ===
                                    database
                                ) {

                                    this.db =
                                        null;

                                    this.isInitialized =
                                        false;

                                }

                            };


                        settled =
                            true;


                        resolve(
                            database
                        );

                    };


                /* -----------------------------------------
                   ERROR
                   ----------------------------------------- */

                request.onerror =
                    () => {

                        if (
                            settled
                        ) {

                            return;

                        }


                        settled =
                            true;


                        reject(
                            createStorageError(
                                'No fue posible abrir CIIS_AuditDB.',
                                request.error
                            )
                        );

                    };


                /* -----------------------------------------
                   APERTURA BLOQUEADA
                   ----------------------------------------- */

                request.onblocked =
                    () => {

                        /*
                         * No se rechaza inmediatamente aquí.
                         *
                         * onblocked significa que existen otras
                         * conexiones que deben cerrarse antes de
                         * completar la operación.
                         *
                         * El resultado definitivo lo proporcionará
                         * onsuccess u onerror.
                         */

                    };

            }
        );

    }


    /* =====================================================
       DATABASE UPGRADE
       ===================================================== */

    /**
     * Maneja la creación o actualización del esquema.
     *
     * PRINCIPIO CRÍTICO:
     *
     *     Nunca se elimina ni reconstruye el object store
     *     events durante una actualización.
     *
     * @param {IDBVersionChangeEvent} event
     * @returns {void}
     */
    handleUpgrade(event) {

        const database =
            event.target.result;


        const transaction =
            event.target.transaction;


        if (
            !database ||
            !transaction
        ) {

            throw createStorageError(
                'La actualización IndexedDB no dispone de contexto válido.',
                null
            );

        }


        let store;


        /* -------------------------------------------------
           CREACIÓN INICIAL
           ------------------------------------------------- */

        if (
            !database.objectStoreNames.contains(
                EVENTS_STORE
            )
        ) {

            store =
                database.createObjectStore(
                    EVENTS_STORE,
                    {
                        keyPath:
                            'event_id',

                        autoIncrement:
                            false,

                    }
                );

        } else {

            /* ---------------------------------------------
               EXISTENTE: NO DESTRUIR
               --------------------------------------------- */

            store =
                transaction.objectStore(
                    EVENTS_STORE
                );

        }


        /* -------------------------------------------------
           KEY PATH
           ------------------------------------------------- */

        if (
            store.keyPath !==
            'event_id'
        ) {

            throw createStorageError(
                'El object store events tiene un keyPath incompatible con PIC-140.',
                null
            );

        }


        /* -------------------------------------------------
           ÍNDICE chain_height
           ------------------------------------------------- */

        if (
            !store.indexNames.contains(
                CHAIN_HEIGHT_INDEX
            )
        ) {

            try {

                store.createIndex(
                    CHAIN_HEIGHT_INDEX,
                    CHAIN_HEIGHT_INDEX,
                    {
                        unique:
                            true,

                        multiEntry:
                            false,

                    }
                );

            } catch (error) {

                throw createStorageError(
                    'No fue posible crear el índice único chain_height.',
                    error
                );

            }

        } else {

            const index =
                store.index(
                    CHAIN_HEIGHT_INDEX
                );


            if (
                index.keyPath !==
                CHAIN_HEIGHT_INDEX
            ) {

                throw createStorageError(
                    'El índice chain_height tiene un keyPath incompatible.',
                    null
                );

            }


            if (
                index.unique !==
                true
            ) {

                throw createStorageError(
                    'El índice chain_height existente no es UNIQUE.',
                    null
                );

            }


            if (
                index.multiEntry !==
                false
            ) {

                throw createStorageError(
                    'El índice chain_height existente debe tener multiEntry=false.',
                    null
                );

            }

        }

    }


    /* =====================================================
       GUARDAR EVENTO
       ===================================================== */

    /**
     * Guarda un evento de forma estrictamente append-only.
     *
     * Se utiliza deliberadamente:
     *
     *     store.add(event)
     *
     * y NUNCA:
     *
     *     store.put(event)
     *
     * @param {Object} event
     * @returns {Promise<Object>}
     */
    async saveEvent(event) {

        await this.ensureInitialized();


        validateEventForStorage(
            event
        );


        const eventToStore =
            cloneEvent(
                event
            );


        return new Promise(
            (resolve, reject) => {

                let settled =
                    false;


                let request;


                let transaction;


                try {

                    transaction =
                        this.db.transaction(
                            EVENTS_STORE,
                            'readwrite'
                        );


                    const store =
                        transaction.objectStore(
                            EVENTS_STORE
                        );


                    /*
                     * APPEND-ONLY.
                     *
                     * add() rechaza una clave primaria
                     * existente y nunca sobrescribe.
                     */

                    request =
                        store.add(
                            eventToStore
                        );

                } catch (error) {

                    settled =
                        true;

                    reject(
                        createStorageError(
                            'No fue posible agregar el evento a IndexedDB.',
                            error
                        )
                    );

                    return;

                }


                request.onerror =
                    () => {

                        /*
                         * La transacción puede abortarse
                         * como consecuencia de este error.
                         *
                         * El error se reporta una sola vez.
                         */

                        if (
                            settled
                        ) {

                            return;

                        }


                        settled =
                            true;


                        reject(
                            createStorageError(
                                'IndexedDB rechazó la inserción del evento.',
                                request.error
                            )
                        );

                    };


                transaction.oncomplete =
                    () => {

                        if (
                            settled
                        ) {

                            return;

                        }


                        settled =
                            true;


                        resolve(
                            cloneEvent(
                                event
                            )
                        );

                    };


                transaction.onerror =
                    () => {

                        if (
                            settled
                        ) {

                            return;

                        }


                        settled =
                            true;


                        reject(
                            createStorageError(
                                'La transacción de persistencia falló.',
                                transaction.error
                            )
                        );

                    };


                transaction.onabort =
                    () => {

                        if (
                            settled
                        ) {

                            return;

                        }


                        settled =
                            true;


                        reject(
                            createStorageError(
                                'La transacción de persistencia fue abortada.',
                                transaction.error
                            )
                        );

                    };

            }
        );

    }


    /* =====================================================
       ÚLTIMO EVENTO
       ===================================================== */

    /**
     * Obtiene el evento con mayor chain_height.
     *
     * El índice UNIQUE garantiza que solamente exista
     * un evento por altura.
     *
     * @returns {Promise<Object|null>}
     */
    async getLastEvent() {

        await this.ensureInitialized();


        return new Promise(
            (resolve, reject) => {

                let transaction;


                try {

                    transaction =
                        this.db.transaction(
                            EVENTS_STORE,
                            'readonly'
                        );

                } catch (error) {

                    reject(
                        createStorageError(
                            'No fue posible abrir la transacción para obtener el último evento.',
                            error
                        )
                    );

                    return;

                }


                const store =
                    transaction.objectStore(
                        EVENTS_STORE
                    );


                let index;


                try {

                    index =
                        store.index(
                            CHAIN_HEIGHT_INDEX
                        );

                } catch (error) {

                    reject(
                        createStorageError(
                            'El índice chain_height no está disponible.',
                            error
                        )
                    );

                    return;

                }


                const request =
                    index.openCursor(
                        null,
                        'prev'
                    );


                request.onsuccess =
                    () => {

                        const cursor =
                            request.result;


                        if (
                            cursor
                        ) {

                            resolve(
                                cloneEvent(
                                    cursor.value
                                )
                            );

                        } else {

                            resolve(
                                null
                            );

                        }

                    };


                request.onerror =
                    () => {

                        reject(
                            createStorageError(
                                'No fue posible obtener el último evento.',
                                request.error
                            )
                        );

                    };

            }
        );

    }


    /* =====================================================
       OBTENER EVENTOS ORDENADOS
       ===================================================== */

    /**
     * Obtiene todos los eventos en orden ascendente
     * de chain_height.
     *
     * @returns {Promise<Object[]>}
     */
    async getAllEventsOrdered() {

        await this.ensureInitialized();


        return new Promise(
            (resolve, reject) => {

                let transaction;


                try {

                    transaction =
                        this.db.transaction(
                            EVENTS_STORE,
                            'readonly'
                        );

                } catch (error) {

                    reject(
                        createStorageError(
                            'No fue posible abrir la transacción para recuperar los eventos.',
                            error
                        )
                    );

                    return;

                }


                const store =
                    transaction.objectStore(
                        EVENTS_STORE
                    );


                let index;


                try {

                    index =
                        store.index(
                            CHAIN_HEIGHT_INDEX
                        );

                } catch (error) {

                    reject(
                        createStorageError(
                            'El índice chain_height no está disponible.',
                            error
                        )
                    );

                    return;

                }


                /*
                 * getAll() sobre un índice devuelve los registros
                 * ordenados por la clave del índice.
                 *
                 * Por tanto:
                 *
                 *     chain_height 0
                 *     chain_height 1
                 *     chain_height 2
                 *     ...
                 */

                const request =
                    index.getAll();


                request.onsuccess =
                    () => {

                        const events =
                            request.result.map(
                                event =>
                                    cloneEvent(
                                        event
                                    )
                            );


                        resolve(
                            events
                        );

                    };


                request.onerror =
                    () => {

                        reject(
                            createStorageError(
                                'No fue posible recuperar los eventos.',
                                request.error
                            )
                        );

                    };

            }
        );

    }


    /* =====================================================
       OBTENER EVENTO POR ID
       ===================================================== */

    /**
     * Obtiene un evento por event_id.
     *
     * @param {string} eventId
     * @returns {Promise<Object|null>}
     */
    async getEventById(
        eventId
    ) {

        await this.ensureInitialized();


        if (
            typeof eventId !== 'string' ||
            !EVENT_ID_REGEX.test(
                eventId
            )
        ) {

            throw new TypeError(
                '[PIC-140 StorageAdapter] eventId no cumple el formato AUD-EVT-<ULID>.'
            );

        }


        return new Promise(
            (resolve, reject) => {

                let transaction;


                try {

                    transaction =
                        this.db.transaction(
                            EVENTS_STORE,
                            'readonly'
                        );

                } catch (error) {

                    reject(
                        createStorageError(
                            'No fue posible abrir la transacción para recuperar el evento.',
                            error
                        )
                    );

                    return;

                }


                const store =
                    transaction.objectStore(
                        EVENTS_STORE
                    );


                const request =
                    store.get(
                        eventId
                    );


                request.onsuccess =
                    () => {

                        if (
                            request.result ===
                            undefined
                        ) {

                            resolve(
                                null
                            );

                            return;

                        }


                        resolve(
                            cloneEvent(
                                request.result
                            )
                        );

                    };


                request.onerror =
                    () => {

                        reject(
                            createStorageError(
                                'No fue posible recuperar el evento solicitado.',
                                request.error
                            )
                        );

                    };

            }
        );

    }


    /* =====================================================
       CONTAR EVENTOS
       ===================================================== */

    /**
     * Devuelve el número total de eventos.
     *
     * @returns {Promise<number>}
     */
    async countEvents() {

        await this.ensureInitialized();


        return new Promise(
            (resolve, reject) => {

                let transaction;


                try {

                    transaction =
                        this.db.transaction(
                            EVENTS_STORE,
                            'readonly'
                        );

                } catch (error) {

                    reject(
                        createStorageError(
                            'No fue posible abrir la transacción para contar eventos.',
                            error
                        )
                    );

                    return;

                }


                const store =
                    transaction.objectStore(
                        EVENTS_STORE
                    );


                const request =
                    store.count();


                request.onsuccess =
                    () => {

                        resolve(
                            request.result
                        );

                    };


                request.onerror =
                    () => {

                        reject(
                            createStorageError(
                                'No fue posible contar los eventos.',
                                request.error
                            )
                        );

                    };

            }
        );

    }


    /* =====================================================
       VERIFICACIÓN DE DISPONIBILIDAD
       ===================================================== */

    /**
     * Verifica que la estructura contractual de IndexedDB
     * esté disponible.
     *
     * Esta función NO modifica el almacenamiento.
     *
     * @returns {Promise<boolean>}
     */
    async verifyStorage() {

        if (
            !this.db
        ) {

            throw new Error(
                '[PIC-140 StorageAdapter] No existe una conexión activa con CIIS_AuditDB.'
            );

        }


        if (
            !this.db.objectStoreNames.contains(
                EVENTS_STORE
            )
        ) {

            throw new Error(
                '[PIC-140 StorageAdapter] El object store events no existe.'
            );

        }


        let transaction;


        try {

            transaction =
                this.db.transaction(
                    EVENTS_STORE,
                    'readonly'
                );

        } catch (error) {

            throw createStorageError(
                'No fue posible abrir una transacción de verificación sobre events.',
                error
            );

        }


        const store =
            transaction.objectStore(
                EVENTS_STORE
            );


        /* -------------------------------------------------
           KEY PATH
           ------------------------------------------------- */

        if (
            store.keyPath !==
            'event_id'
        ) {

            throw new Error(
                '[PIC-140 StorageAdapter] events no utiliza event_id como keyPath.'
            );

        }


        /* -------------------------------------------------
           ÍNDICE
           ------------------------------------------------- */

        if (
            !store.indexNames.contains(
                CHAIN_HEIGHT_INDEX
            )
        ) {

            throw new Error(
                '[PIC-140 StorageAdapter] El índice chain_height no existe.'
            );

        }


        const index =
            store.index(
                CHAIN_HEIGHT_INDEX
            );


        if (
            index.keyPath !==
            CHAIN_HEIGHT_INDEX
        ) {

            throw new Error(
                '[PIC-140 StorageAdapter] El índice chain_height tiene un keyPath inválido.'
            );

        }


        if (
            index.unique !==
            true
        ) {

            throw new Error(
                '[PIC-140 StorageAdapter] El índice chain_height debe ser UNIQUE.'
            );

        }


        if (
            index.multiEntry !==
            false
        ) {

            throw new Error(
                '[PIC-140 StorageAdapter] El índice chain_height debe tener multiEntry=false.'
            );

        }


        return true;

    }


    /* =====================================================
       PRECONDICIONES
       ===================================================== */

    /**
     * Garantiza que el adapter esté inicializado.
     *
     * @returns {Promise<void>}
     */
    async ensureInitialized() {

        if (
            this.isInitialized &&
            this.db
        ) {

            return;

        }


        await this.initialize();

    }


    /* =====================================================
       CIERRE
       ===================================================== */

    /**
     * Cierra la conexión.
     *
     * @returns {void}
     */
    close() {

        if (
            this.db
        ) {

            try {

                this.db.close();

            } catch (
                error
            ) {

                console.error(
                    '[PIC-140 StorageAdapter] Error al cerrar IndexedDB.',
                    error
                );

            }

        }


        this.db =
            null;

        this.isInitialized =
            false;

    }


    /**
     * Destruye la instancia.
     *
     * @returns {void}
     */
    destroy() {

        this.close();

    }

}


/* =========================================================
   VALIDACIÓN DE EVENTO
   ========================================================= */

/**
 * Valida los requisitos mínimos inmediatamente antes
 * de persistir un evento.
 *
 * El StorageAdapter NO valida el esquema completo:
 * esa responsabilidad corresponde a schemaValidator.js.
 *
 * Aquí se comprueban únicamente las invariantes críticas
 * de persistencia.
 *
 * @param {Object} event
 * @returns {void}
 */
function validateEventForStorage(
    event
) {

    if (
        event === null ||
        typeof event !== 'object' ||
        Array.isArray(event)
    ) {

        throw new TypeError(
            '[PIC-140 StorageAdapter] El evento debe ser un objeto.'
        );

    }


    /* -----------------------------------------------------
       EVENT ID
       ----------------------------------------------------- */

    if (
        typeof event.event_id !== 'string' ||
        !EVENT_ID_REGEX.test(
            event.event_id
        )
    ) {

        throw new TypeError(
            '[PIC-140 StorageAdapter] event_id no cumple el formato AUD-EVT-<ULID>.'
        );

    }


    /* -----------------------------------------------------
       CHAIN HEIGHT
       ----------------------------------------------------- */

    if (
        !Number.isSafeInteger(
            event.chain_height
        ) ||
        event.chain_height < 0
    ) {

        throw new TypeError(
            '[PIC-140 StorageAdapter] chain_height debe ser un entero seguro >= 0.'
        );

    }


    /* -----------------------------------------------------
       EVENT HASH
       ----------------------------------------------------- */

    /*
     * En la fase de persistencia el hash debe existir.
     *
     * StorageAdapter NO calcula ni modifica event_hash.
     */

    if (
        typeof event.event_hash !== 'string' ||
        !HASH_REGEX.test(
            event.event_hash
        )
    ) {

        throw new TypeError(
            '[PIC-140 StorageAdapter] event_hash debe contener exactamente 64 caracteres hexadecimales.'
        );

    }

}


/* =========================================================
   COPIA SEGURA
   ========================================================= */

/**
 * Clona un evento para evitar que IndexedDB reciba
 * accidentalmente una referencia mutable perteneciente
 * al pipeline.
 *
 * @param {Object} event
 * @returns {Object}
 */
function cloneEvent(
    event
) {

    if (
        typeof structuredClone ===
        'function'
    ) {

        return structuredClone(
            event
        );

    }


    return JSON.parse(
        JSON.stringify(
            event
        )
    );

}


/* =========================================================
   ERRORES
   ========================================================= */

/**
 * Crea un error normalizado de almacenamiento.
 *
 * @param {string} message
 * @param {*} cause
 * @returns {Error}
 */
function createStorageError(
    message,
    cause
) {

    const error =
        new Error(
            message
        );


    error.name =
        'PIC140StorageError';


    if (
        cause !== null &&
        cause !== undefined
    ) {

        error.cause =
            cause;

    }


    return error;

}


/* =========================================================
   EXPORTACIONES
   ========================================================= */

export {

    StorageAdapter,

    DB_NAME,

    DB_VERSION,

    EVENTS_STORE,

    CHAIN_HEIGHT_INDEX,

};