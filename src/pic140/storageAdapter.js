/**
 * Storage Adapter - IndexedDB (Actualizado para corregir índice de cadena)
 */
export class StorageAdapter {
    constructor(dbName = 'CIIS_OS_Audit', version = 3) { // Versión incrementada a 3 para forzar la actualización del esquema
        this.dbName = dbName;
        this.version = version;
        this.storeName = 'events';
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                
                // Si el almacén ya existe con la estructura anterior, lo eliminamos para aplicar los nuevos índices sin conflictos
                if (db.objectStoreNames.contains(this.storeName)) {
                    db.deleteObjectStore(this.storeName);
                }

                // Creamos el almacén limpio con el índice corregido (unique: false)
                const store = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
                store.createIndex('event_id', 'event_id', { unique: true });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('chain_height', 'chain_height', { unique: false });
            };

            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(true);
            };

            request.onerror = () => reject(request.error);
        });
    }

    async saveEvent(event) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.add(event);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async getLastEvent() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.openCursor(null, 'prev');

            request.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    resolve(cursor.value);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getAllEvents() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = () => reject(request.error);
        });
    }
}