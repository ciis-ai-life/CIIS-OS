/**
 * CIIS OS - Motor de Cálculo CIISMATRÍA v1.0 (Auditado)
 */
import { Kernel } from '../src/kernel/eventBus.js';

// Tablas de valores de Gematría Pitagórica Standard (A=1 ... Z=26 / Reducida 1-9)
const GEMATRIA_TABLE = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9,
  J: 1, K: 2, L: 3, M: 4, N: 5, O: 6, P: 7, Q: 8, R: 9,
  S: 1, T: 2, U: 3, V: 4, W: 5, X: 6, Y: 7, Z: 8
};

// Función para obtener la plantilla HTML del módulo
export function getCiismatriaHTML() {
    return `
    <div class="ciismatria-container">
        <!-- Formulario de Entrada -->
        <div class="ciis-card">
            <h3>🔢 Parámetros de Investigación</h3>
            <form id="ciismatria-form" onsubmit="event.preventDefault();">
                <div class="form-row">
                    <div class="form-group">
                        <label>Nombre(s)</label>
                        <input type="text" id="ciis-nombre" placeholder="Ej. Sergio Javier" required>
                    </div>
                    <div class="form-group">
                        <label>Apellidos</label>
                        <input type="text" id="ciis-apellidos" placeholder="Ej. Parra Murguía" required>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Fecha de Evento / Nacimiento</label>
                        <input type="date" id="ciis-fecha">
                    </div>
                    <div class="form-group">
                        <label>Hora Exacta</label>
                        <input type="time" id="ciis-hora">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Lugar / Coordenadas</label>
                        <input type="text" id="ciis-lugar" placeholder="Ej. Morelia, Mich.">
                    </div>
                    <div class="form-group">
                        <label>Tipo de Investigación</label>
                        <select id="ciis-tipo">
                            <option value="identidad">Identidad Soberana</option>
                            <option value="cronologia">Línea de Tiempo / Evento</option>
                            <option value="patron">Análisis de Patrón</option>
                        </select>
                    </div>
                </div>

                <button type="button" id="btn-calcular-ciis" class="btn-primary">⚡ Ejecutar Cálculo CIISMATRÍA</button>
            </form>
        </div>

        <!-- Panel de Resultados -->
        <div class="ciis-card results-card">
            <h3>📊 Matriz de Resultados</h3>
            <div id="ciismatria-results" class="results-placeholder">
                <p class="text-muted">Ingrese los datos y ejecute el cálculo para desplegar el análisis de gematría y reducción teosófica.</p>
            </div>
        </div>
    </div>
    `;
}

// Inicializar eventos dentro de la ventana una vez abierta
export function initCiismatriaEvents(windowElement) {
    const btn = windowElement.querySelector('#btn-calcular-ciis');
    if (!btn) return;

    btn.addEventListener('click', () => {
        const nombre = windowElement.querySelector('#ciis-nombre').value.trim();
        const apellidos = windowElement.querySelector('#ciis-apellidos').value.trim();
        const fecha = windowElement.querySelector('#ciis-fecha').value;
        const resultsContainer = windowElement.querySelector('#ciismatria-results');

        if (!nombre) {
            alert('Por favor ingrese al menos un nombre para calcular.');
            return;
        }

        const cadenaCompleta = `${nombre} ${apellidos}`.toUpperCase();
        
        // 1. Cálculo Gematría Pitagórica
        let sumaPitagorica = 0;
        let desglose = [];

        for (let char of cadenaCompleta) {
            if (GEMATRIA_TABLE[char]) {
                const val = GEMATRIA_TABLE[char];
                sumaPitagorica += val;
                desglose.push(`${char}=${val}`);
            }
        }

        // 2. Reducción Teosófica (Raíz Numérica)
        const reduccion = calcularRaizNumerica(sumaPitagorica);

        // 3. Cálculo de Fecha (si existe)
        let reduccionFecha = '-';
        if (fecha) {
            const digitosFecha = fecha.replace(/-/g, '');
            const sumaFecha = digitosFecha.split('').reduce((a, b) => a + parseInt(b), 0);
            reduccionFecha = calcularRaizNumerica(sumaFecha);
        }

        // 🛡️ Registrar el cálculo analítico en el Motor de Auditoría Transversal PIC-140
        Kernel.publish('MATH_CALCULATION_PERFORMED', {
            target_name: cadenaCompleta,
            pythagorean_sum: sumaPitagorica,
            theosophical_root: reduccion,
            date_frequency: reduccionFecha
        }, { severity: 'INFO' });

        // Renderizar Resultados
        resultsContainer.innerHTML = `
            <div class="metrics-grid">
                <div class="metric-box">
                    <span class="metric-label">Valor Pitagórico Total</span>
                    <span class="metric-value">${sumaPitagorica}</span>
                </div>
                <div class="metric-box Highlight">
                    <span class="metric-label">Raíz Teosófica (Soberana)</span>
                    <span class="metric-value">${reduccion}</span>
                </div>
                <div class="metric-box">
                    <span class="metric-label">Frecuencia de Fecha</span>
                    <span class="metric-value">${reduccionFecha}</span>
                </div>
            </div>

            <div class="breakdown-box">
                <h4>Desglose de Caracteres:</h4>
                <p class="code-text">${desglose.join(' | ')}</p>
            </div>

            <div class="action-bar">
                <span class="status-ok">✓ Verificado y Registrado por Kernel CIIS</span>
            </div>
        `;
    });
}

function calcularRaizNumerica(num) {
    while (num > 9 && num !== 11 && num !== 22 && num !== 33) { // Conserva Números Maestros
        num = num.toString().split('').reduce((a, b) => a + parseInt(b), 0);
    }
    return num;
}