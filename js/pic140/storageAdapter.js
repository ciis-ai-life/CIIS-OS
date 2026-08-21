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
 * Restricciones:
 *
 *     - append-only
 *     - store.add(event)
 *     - NO store.put(event)
 *     - chain_height único
 *     - upgrades no destructivos
 *
 * IMPORTANTE:
 *
 *     Este módulo NO:
 *
 *     - construye eventos;
 *     - calcula hashes;
 *     - canonicaliza;
 *     - administra FIFO;
 *     - publica eventos en EventBus.
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

    }


    /* =====================================================
       INICIALIZACIÓN
       ===================================================== */

    /**
     * Abre o crea la base de datos.
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
            typeof indexedDB ===
            'undefined'
        ) {

            throw new Error(
                '[PIC-140 StorageAdapter] IndexedDB no está disponible.'
            );

        }


        this.db =
            await this.openDatabase();


        try {

            await this.verifyStorage();

        } catch (error) {

            this.close();

            throw error;

        }


        this.isInitialized =
            true;


        return this.db;

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


                const request =
                    indexedDB.open(
                        this.dbName,
                        this.dbVersion
                    );


                request.onupgradeneeded =
                    event => {

                        try {

                            this.handleUpgrade(
                                event
                            );

                        } catch (error) {

                            const transaction =
                                event.target.transaction;


                            try {

                                if (
                                    transaction &&
                                    transaction.readyState ===
                                    'active'
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
                                        'La actualización de CIIS_AuditDB fue abortada.',
                                        error
                                    )
                                );

                            }

                        }

                    };


                request.onsuccess =
                    () => {

                        if (
                            settled
                        ) {

                            request.result.close();

                            return;

                        }


                        const database =
                            request.result;


                        database.onversionchange =
                            () => {

                                database.close();

                                this.db =
                                    null;

                                this.isInitialized =
                                    false;

                            };


                        settled =
                            true;


                        resolve(
                            database
                        );

                    };


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


                request.onblocked =
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
                                'La apertura de CIIS_AuditDB está bloqueada por otra conexión.',
                                null
                            )
                        );

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
     *     Nunca se elimina el object store "events"
     *     durante una actualización.
     *
     * @param {IDBVersionChangeEvent} event
     * @returns {void}
     */
    handleUpgrade(event) {

        const database =
            event.target.result;


        const transaction =
            event.target.transaction;


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
                        keyPath: 'event_id',
                        autoIncrement: false,
                    }
                );

        } else {

            /* ---------------------------------------------
               EXISTENTE: NO DESTRUIR
               --------------------------------------------- */

            if (
                !transaction
            ) {

                throw createStorageError(
                    'No existe una transacción válida para actualizar events.',
                    null
                );

            }


            store =
                transaction.objectStore(
                    EVENTS_STORE
                );

        }


        /* -------------------------------------------------
           VALIDACIÓN DEL KEY PATH
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
                        unique: true,
                        multiEntry: false,
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
                    'El índice chain_height existente no es único.',
                    null
                );

            }


            if (
                index.multiEntry !==
                false
            ) {

                throw createStorageError(
                    'El índice chain_height existente no cumple multiEntry=false.',
                    null
                );

            }

        }

    }


    /* =====================================================
       GUARDAR EVENTO
       ===================================================== */

    /**
     * Guarda un evento de forma append-only.
     *
     * Se utiliza deliberadamente:
     *
     *     store.add(event)
     *
     * y NO:
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


        return new Promise(
            (resolve, reject) => {

                const transaction =
                    this.db.transaction(
                        EVENTS_STORE,
                        'readwrite'
                    );


                const store =
                    transaction.objectStore(
                        EVENTS_STORE
                    );


                let request;


                try {

                    /**
                     * APPEND-ONLY:
                     *
                     * add() falla si event_id ya existe.
                     *
                     * Esto evita sobrescribir eventos.
                     */
                    request =
                        store.add(
                            cloneEvent(
                                event
                            )
                        );

                } catch (error) {

                    reject(
                        createStorageError(
                            'No fue posible agregar el evento a IndexedDB.',
                            error
                        )
                    );


                    return;

                }


                let result;


                request.onsuccess =
                    () => {

                        result =
                            event;

                    };


                request.onerror =
                    () => {

                        reject(
                            createStorageError(
                                'IndexedDB rechazó la inserción del evento.',
                                request.error
                            )
                        );

                    };


                transaction.oncomplete =
                    () => {

                        resolve(
                            result ??
                            event
                        );

                    };


                transaction.onerror =
                    () => {

                        reject(
                            createStorageError(
                                'La transacción de persistencia falló.',
                                transaction.error
                            )
                        );

                    };


                transaction.onabort =
                    () => {

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
     * Se utiliza el índice chain_height en orden descendente.
     *
     * @returns {Promise<Object|null>}
     */
    async getLastEvent() {

        await this.ensureInitialized();


        return new Promise(
            (resolve, reject) => {

                const transaction =
                    this.db.transaction(
                        EVENTS_STORE,
                        'readonly'
                    );


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
     * Obtiene todos los eventos ordenados por chain_height
     * ascendente.
     *
     * @returns {Promise<Object[]>}
     */
    async getAllEventsOrdered() {

        await this.ensureInitialized();


        return new Promise(
            (resolve, reject) => {

                const transaction =
                    this.db.transaction(
                        EVENTS_STORE,
                        'readonly'
                    );


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
                    index.getAll();


                request.onsuccess =
                    () => {

                        const events =
                            request.result
                                .map(
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
            eventId.length === 0
        ) {

            throw new TypeError(
                '[PIC-140 StorageAdapter] eventId inválido.'
            );

        }


        return new Promise(
            (resolve, reject) => {

                const transaction =
                    this.db.transaction(
                        EVENTS_STORE,
                        'readonly'
                    );


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

                const transaction =
                    this.db.transaction(
                        EVENTS_STORE,
                        'readonly'
                    );


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


        if (
            store.keyPath !==
            'event_id'
        ) {

            throw new Error(
                '[PIC-140 StorageAdapter] events no utiliza event_id como keyPath.'
            );

        }


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
            !this.isInitialized ||
            !this.db
        ) {

            await this.initialize();

        }

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

            this.db.close();

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
   VALIDACIÓN
   ========================================================= */

/**
 * Valida los requisitos mínimos de almacenamiento.
 *
 * Esta validación actúa como última barrera defensiva
 * inmediatamente antes de persistir un evento.
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
        !/^AUD-EVT-[0-9A-HJKMNP-TV-Z]{26}$/.test(
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

    /**
     * event_hash debe existir en el evento que llega a
     * persistencia.
     *
     * El StorageAdapter no calcula el hash; solamente
     * verifica su estructura antes de almacenar.
     */
    if (
        typeof event.event_hash !== 'string' ||
        !/^[0-9a-f]{64}$/i.test(
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
 * Clona un evento antes de devolverlo o persistirlo.
 *
 * @param {Object} event
 * @returns {Object}
 */
function cloneEvent(event) {

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
        cause
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