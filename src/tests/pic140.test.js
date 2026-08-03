import { Kernel } from '../kernel/eventBus.js';
import { PIC140 } from '../pic140/pic140.js';
import { verifyChain } from '../pic140/integrityVerifier.js';

async function runIntegrationTest() {
    console.log("Iniciando pruebas de integración PIC-140 con el Kernel CIIS OS...");

    await PIC140.init();

    Kernel.subscribe('PIC140_LOGGED', (info) => {
        console.log(`✅ Evento asegurado en PIC-140 [Altura: ${info.payload.height}]: ${info.payload.id}`);
    });

    // 1. Simular acción desde la interfaz de Expedientes con metadatos completos
    console.log("Enviando evento: EXP_RECORD_OPEN");
    Kernel.publish('EXP_RECORD_OPEN', {
        user: "Xavier Gaffer",
        action: "READ",
        target_id: "EXP-2026-0042",
    }, { severity: 'INFO' }); // Pasando metadatos requeridos por el nuevo esquema

    await new Promise(resolve => setTimeout(resolve, 100));

    // 2. Simular acción desde CIISMATRÍA
    console.log("Enviando evento: MATH_ANALYSIS_START");
    Kernel.publish('MATH_ANALYSIS_START', {
        user: "Xavier Gaffer",
        algorithm: "Pythagorean Reduction",
        dataset_size: 144
    }, { severity: 'INFO' });

    await new Promise(resolve => setTimeout(resolve, 500));

    // 3. Verificación de Integridad
    const allEvents = await PIC140.storage.getAllEvents();
    console.log(`\nTotal de eventos en cadena local: ${allEvents.length}`);

    const verification = await verifyChain(allEvents);
    if (verification.isValid) {
        console.log("🛡️ Cadena criptográfica VÁLIDA. Hash y Secuencias de Altura sin alteraciones.");
    } else {
        console.error("⚠️ Inconsistencias en la cadena:", verification.inconsistencies);
    }
}

// Ejecutar si estuviéramos en el navegador
// runIntegrationTest();
