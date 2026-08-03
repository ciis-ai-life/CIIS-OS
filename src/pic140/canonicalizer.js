/**
 * Canonical JSON - RFC 8785 (JCS) Aproximación
 * Garantiza que el hash sea determinista independientemente del orden de las propiedades.
 */
export function canonicalize(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return JSON.stringify(obj);
    }

    if (Array.isArray(obj)) {
        return '[' + obj.map(canonicalize).join(',') + ']';
    }

    // Se excluyen los campos criptográficos que se generan a posteriori
    const excludedKeys = ['event_hash', 'signature'];

    const sortedKeys = Object.keys(obj)
        .filter(key => !excludedKeys.includes(key))
        .sort();

    return '{' + sortedKeys.map(key => {
        return `"${key}":${canonicalize(obj[key])}`;
    }).join(',') + '}';
}
