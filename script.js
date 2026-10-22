/**
 * ============================================================================
 * ESTIMADOR DE COSTOS - DIVISIÓN EQUITATIVA Y EQUIVALENTE
 * ============================================================================
 * 
 * Este módulo gestiona la estimación y distribución de costos grupales según
 * las siguientes especificaciones:
 * 
 * 1. Estructura de Persona:
 *    - nombre: Identificador de la persona (String).
 *    - aportado: Dinero entregado de antemano como fondo/adelanto (Number).
 *    - gastado: Dinero que pagó de su propio bolsillo para el grupo (Number).
 *    - consumido: Lista de ítems consumidos individualmente [{ nombre, precio }] (Array).
 * 
 * 2. Tipos de Operación:
 *    - EQUITATIVO: El gasto total se divide en partes iguales entre todos los miembros.
 *    - EQUIVALENTE: Cada persona responde por el total de sus consumos particulares,
 *      compensando con lo que aportó o gastó.
 * 
 * 3. Balances y Porcentajes:
 *    - Se determina el gasto total grupal (considerado el 100%).
 *    - Se calcula el porcentaje aportado/gastado por cada participante.
 *    - Se calcula el saldo a favor o deuda de cada integrante.
 * 
 * 4. Devoluciones / Transferencias:
 *    - Resuelve quién debe pagarle a quién y qué monto exacto para saldar todas las cuentas.
 * ============================================================================
 */

// Tipos de operaciones disponibles
const TIPO_OPERACION = Object.freeze({
    EQUITATIVO: 'EQUITATIVO',
    EQUIVALENTE: 'EQUIVALENTE'
});

/**
 * Redondea un número a 2 decimales para evitar problemas de precisión en coma flotante.
 * @param {number} numero - El número a redondear.
 * @returns {number} Número redondeado a 2 decimales.
 */
function redondear(numero) {
    return Math.round((Number(numero || 0) + Number.EPSILON) * 100) / 100;
}

/**
 * ============================================================================
 * 1. MODELADO DE DATOS Y GESTIÓN DE PERSONAS Y CONSUMOS
 * ============================================================================
 */

/**
 * Crea un objeto persona con sus propiedades fundamentales.
 * 
 * @param {string} nombre - Nombre o identificador de la persona.
 * @param {number} [aportado=0] - Dinero aportado al fondo/adelantos.
 * @param {number} [gastado=0] - Dinero pagado directamente de su bolsillo.
 * @param {Array<{nombre: string, precio: number}>} [consumido=[]] - Lista de consumos particulares.
 * @returns {Object} Objeto persona normalizado.
 */
function crearPersona(nombre, aportado = 0, gastado = 0, consumido = []) {
    return {
        nombre: String(nombre || 'Anónimo').trim(),
        aportado: redondear(aportado),
        gastado: redondear(gastado),
        consumido: Array.isArray(consumido) ? [...consumido] : []
    };
}

/**
 * Genera una lista inicial de N personas con valores predeterminados para facilitar
 * la creación de un nuevo cálculo desde cero según la cantidad indicada.
 * 
 * @param {number} cantidad - Cantidad de personas a crear.
 * @returns {Array<Object>} Lista de personas inicializadas.
 */
function generarGrupoVacio(cantidad) {
    const total = Math.max(1, parseInt(cantidad, 10) || 1);
    const grupo = [];
    for (let i = 1; i <= total; i++) {
        grupo.push(crearPersona(`Persona ${i}`, 0, 0, []));
    }
    return grupo;
}

/**
 * Agrega un nuevo ítem de consumo particular a una persona.
 * 
 * @param {Object} persona - La persona a quien se le adjudica el consumo.
 * @param {string} nombreItem - Descripción del producto o servicio.
 * @param {number} precio - Costo del producto consumido.
 * @returns {Object} El ítem agregado.
 */
function agregarConsumo(persona, nombreItem, precio) {
    if (!persona || typeof persona !== 'object') {
        throw new Error('Debe proporcionar un objeto persona válido.');
    }
    if (!Array.isArray(persona.consumido)) {
        persona.consumido = [];
    }
    const item = {
        nombre: String(nombreItem || 'Ítem sin descripción').trim(),
        precio: redondear(precio)
    };
    persona.consumido.push(item);
    return item;
}

/**
 * Elimina un consumo particular de una persona por su índice o por su nombre.
 * 
 * @param {Object} persona - La persona de la cual remover el consumo.
 * @param {number|string} identificador - Índice numérico o nombre del ítem.
 * @returns {Object|null} El ítem eliminado o null si no se encontró.
 */
function quitarConsumo(persona, identificador) {
    if (!persona || !Array.isArray(persona.consumido)) return null;

    if (typeof identificador === 'number') {
        if (identificador >= 0 && identificador < persona.consumido.length) {
            return persona.consumido.splice(identificador, 1)[0];
        }
        return null;
    }

    const busqueda = String(identificador).toLowerCase().trim();
    const indice = persona.consumido.findIndex(item => item.nombre.toLowerCase().trim() === busqueda);
    if (indice !== -1) {
        return persona.consumido.splice(indice, 1)[0];
    }
    return null;
}

/**
 * Calcula la suma total de los ítems consumidos individualmente por una persona.
 * 
 * @param {Object} persona - Objeto persona.
 * @returns {number} Total del consumo individual.
 */
function calcularTotalConsumido(persona) {
    if (!persona || !Array.isArray(persona.consumido)) return 0;
    const total = persona.consumido.reduce((acumulado, item) => acumulado + (Number(item.precio) || 0), 0);
    return redondear(total);
}

/**
 * Calcula el monto total que una persona puso de su bolsillo (aportado + gastado).
 * 
 * @param {Object} persona - Objeto persona.
 * @returns {number} Total de dinero provisto por la persona.
 */
function calcularTotalPuesto(persona) {
    if (!persona) return 0;
    return redondear((Number(persona.aportado) || 0) + (Number(persona.gastado) || 0));
}

/**
 * ============================================================================
 * 2. CÁLCULO DE TOTALES GLOBALES Y PORCENTAJES
 * ============================================================================
 */

/**
 * Suma todo el dinero puesto por el grupo para cubrir el evento (gastado + aportado).
 * Este monto unificado representa el "Gasto Total" (el 100%).
 * 
 * @param {Array<Object>} personas - Lista de personas.
 * @returns {number} Gasto total del grupo (representa el 100%).
 */
function calcularGastoTotal(personas) {
    if (!Array.isArray(personas)) return 0;
    const total = personas.reduce((acumulado, persona) => acumulado + calcularTotalPuesto(persona), 0);
    return redondear(total);
}

/**
 * Suma los gastos directos pagados en compras por los integrantes.
 * 
 * @param {Array<Object>} personas - Lista de personas.
 * @returns {number} Total pagado en compras.
 */
function calcularTotalGastadoDirecto(personas) {
    if (!Array.isArray(personas)) return 0;
    const total = personas.reduce((acumulado, persona) => acumulado + (Number(persona.gastado) || 0), 0);
    return redondear(total);
}

/**
 * Suma todos los aportes previos realizados al fondo/pozo común.
 * 
 * @param {Array<Object>} personas - Lista de personas.
 * @returns {number} Total aportado previamente.
 */
function calcularAporteTotal(personas) {
    if (!Array.isArray(personas)) return 0;
    const total = personas.reduce((acumulado, persona) => acumulado + (Number(persona.aportado) || 0), 0);
    return redondear(total);
}

/**
 * Calcula la suma de todos los consumos particulares registrados en el grupo.
 * 
 * @param {Array<Object>} personas - Lista de personas.
 * @returns {number} Consumo total de los participantes.
 */
function calcularConsumoTotal(personas) {
    if (!Array.isArray(personas)) return 0;
    const total = personas.reduce((acumulado, persona) => acumulado + calcularTotalConsumido(persona), 0);
    return redondear(total);
}

/**
 * Calcula el porcentaje que representa un valor particular sobre un total de referencia.
 * 
 * @param {number} valor - Valor individual.
 * @param {number} total - Total de referencia (100%).
 * @returns {number} Porcentaje calculado (ej. 25.50 para 25.5%).
 */
function calcularPorcentaje(valor, total) {
    if (!total || total === 0) return 0;
    return redondear(((Number(valor) || 0) / total) * 100);
}

/**
 * ============================================================================
 * 3. CÁLCULO DE BALANCES SEGÚN TIPO DE OPERACIÓN
 * ============================================================================
 */

/**
 * Evalúa los balances individuales de cada persona comparando lo que puso vs lo que debe pagar.
 * 
 * - Si es EQUITATIVO:
 *   La cuota individual = Gasto Total / Cantidad de Personas.
 * 
 * - Si es EQUIVALENTE:
 *   La cuota individual = Suma de sus ítems particulares en 'consumido'.
 * 
 * Balance = Total Puesto (aportado + gastado) - Debe Pagar.
 *   - Si Balance > 0: Tiene saldo a favor (le deben dinero / se le devuelve).
 *   - Si Balance < 0: Es deudor (le falta abonar para cubrir su cuota).
 *   - Si Balance = 0: Está al día.
 * 
 * @param {Array<Object>} personas - Lista de participantes.
 * @param {string} [tipoOperacion=TIPO_OPERACION.EQUITATIVO] - Modalidad de cálculo.
 * @returns {Array<Object>} Lista de participantes con balances detallados.
 */
function calcularBalances(personas, tipoOperacion = TIPO_OPERACION.EQUITATIVO) {
    if (!Array.isArray(personas) || personas.length === 0) {
        throw new Error('La lista de personas debe contener al menos un participante.');
    }

    const op = String(tipoOperacion).toUpperCase();
    const gastoTotal = calcularGastoTotal(personas);
    const cantidadPersonas = personas.length;
    const cuotaEquitativa = cantidadPersonas > 0 ? redondear(gastoTotal / cantidadPersonas) : 0;

    return personas.map(persona => {
        const totalPuesto = calcularTotalPuesto(persona);
        const totalConsumido = calcularTotalConsumido(persona);

        let debePagar = 0;

        // Selección de operación mediante condición
        if (op === TIPO_OPERACION.EQUITATIVO) {
            debePagar = cuotaEquitativa;
        } else if (op === TIPO_OPERACION.EQUIVALENTE) {
            debePagar = totalConsumido;
        } else {
            throw new Error(`Tipo de operación '${tipoOperacion}' no válido. Use 'EQUITATIVO' o 'EQUIVALENTE'.`);
        }

        const balance = redondear(totalPuesto - debePagar);
        const porcentajeAporte = calcularPorcentaje(totalPuesto, gastoTotal);

        let estado = 'AL DIA';
        if (balance > 0.01) {
            estado = 'A FAVOR';
        } else if (balance < -0.01) {
            estado = 'DEBE';
        }

        return {
            nombre: persona.nombre,
            aportado: persona.aportado,
            gastado: persona.gastado,
            totalPuesto: totalPuesto,
            totalConsumido: totalConsumido,
            debePagar: debePagar,
            balance: balance,
            estado: estado,
            porcentajeAporte: porcentajeAporte,
            consumido: persona.consumido
        };
    });
}

/**
 * ============================================================================
 * 4. RESOLUCIÓN DE TRANSFERENCIAS (QUIÉN LE PAGA A QUIÉN)
 * ============================================================================
 */

/**
 * Algoritmo de compensación para saldar cuentas entre deudores y acreedores.
 * Empareja a quienes deben dinero con quienes tienen saldo a favor, minimizando
 * el número de transacciones necesarias.
 * 
 * @param {Array<Object>} balances - Balances calculados con calcularBalances().
 * @returns {Array<{de: string, para: string, monto: number, mensaje: string}>}
 */
function calcularTransferencias(balances) {
    // 1. Separamos y ordenamos deudores y acreedores de mayor a menor monto
    const deudores = balances
        .filter(b => b.balance < -0.01)
        .map(b => ({ nombre: b.nombre, montoFaltante: redondear(-b.balance) }))
        .sort((a, b) => b.montoFaltante - a.montoFaltante);

    const acreedores = balances
        .filter(b => b.balance > 0.01)
        .map(b => ({ nombre: b.nombre, montoSobrante: redondear(b.balance) }))
        .sort((a, b) => b.montoSobrante - a.montoSobrante);

    const transferencias = [];

    let i = 0; // Puntero de deudor
    let j = 0; // Puntero de acreedor

    // 2. Liquidamos balances deudores contra acreedores
    while (i < deudores.length && j < acreedores.length) {
        const deudor = deudores[i];
        const acreedor = acreedores[j];

        const monto = redondear(Math.min(deudor.montoFaltante, acreedor.montoSobrante));

        if (monto > 0.009) {
            transferencias.push({
                de: deudor.nombre,
                para: acreedor.nombre,
                monto: monto,
                mensaje: `${deudor.nombre} debe darle $${monto.toFixed(2)} a ${acreedor.nombre}`
            });

            deudor.montoFaltante = redondear(deudor.montoFaltante - monto);
            acreedor.montoSobrante = redondear(acreedor.montoSobrante - monto);
        }

        if (deudor.montoFaltante <= 0.01) i++;
        if (acreedor.montoSobrante <= 0.01) j++;
    }

    return transferencias;
}

/**
 * ============================================================================
 * 5. FUNCIÓN PRINCIPAL INTEGRADORA (ORQUESTADORA)
 * ============================================================================
 */

/**
 * Ejecuta el proceso completo de estimación de costos:
 * 1. Calcula totales generales (gastado, aportado, consumido).
 * 2. Determina los balances según la modalidad elegida ('EQUITATIVO' o 'EQUIVALENTE').
 * 3. Calcula las transferencias de devolución.
 * 
 * @param {Array<Object>} personas - Lista de personas con sus datos.
 * @param {string} [tipoOperacion=TIPO_OPERACION.EQUITATIVO] - 'EQUITATIVO' o 'EQUIVALENTE'.
 * @returns {Object} Informe detallado con resumen, balances y transferencias.
 */
function estimarCostos(personas, tipoOperacion = TIPO_OPERACION.EQUITATIVO) {
    if (!Array.isArray(personas) || personas.length === 0) {
        throw new Error('Debe proporcionar al menos una persona para estimar costos.');
    }

    const operacionElegida = String(tipoOperacion).toUpperCase();
    const gastoTotal = calcularGastoTotal(personas);
    const totalGastadoDirecto = calcularTotalGastadoDirecto(personas);
    const aporteTotal = calcularAporteTotal(personas);
    const consumoTotal = calcularConsumoTotal(personas);

    const balances = calcularBalances(personas, operacionElegida);
    const transferencias = calcularTransferencias(balances);

    return {
        tipoOperacion: operacionElegida,
        resumen: {
            cantidadPersonas: personas.length,
            gastoTotal: gastoTotal,
            totalGastadoDirecto: totalGastadoDirecto,
            aporteTotal: aporteTotal,
            consumoTotal: consumoTotal,
            cuotaEquitativa: redondear(gastoTotal / personas.length)
        },
        balances: balances,
        transferencias: transferencias
    };
}

/**
 * ============================================================================
 * 6. FORMATEO Y VISUALIZACIÓN DE RESULTADOS EN CONSOLA
 * ============================================================================
 */

/**
 * Imprime un informe claro y formateado en la consola.
 * @param {Object} resultado - Resultado generado por estimarCostos().
 */
function imprimirReporte(resultado) {
    const separador = '═'.repeat(60);
    const subseparador = '─'.repeat(60);

    console.log('\n' + separador);
    console.log(` REPORTE DE COSTOS - MODALIDAD: ${resultado.tipoOperacion}`);
    console.log(separador);
    console.log(`Participantes:             ${resultado.resumen.cantidadPersonas}`);
    console.log(`Gasto Total Grupo (100%):  $${resultado.resumen.gastoTotal.toFixed(2)}`);
    console.log(`Compras Directas:          $${resultado.resumen.totalGastadoDirecto.toFixed(2)}`);
    console.log(`Aportes Previos (Fondo):   $${resultado.resumen.aporteTotal.toFixed(2)}`);
    if (resultado.tipoOperacion === TIPO_OPERACION.EQUIVALENTE) {
        console.log(`Consumo Total de Ítems:    $${resultado.resumen.consumoTotal.toFixed(2)}`);
    } else {
        console.log(`Cuota por persona:         $${resultado.resumen.cuotaEquitativa.toFixed(2)}`);
    }

    console.log('\n' + subseparador);
    console.log(' BALANCES INDIVIDUALES:');
    console.log(subseparador);

    resultado.balances.forEach(b => {
        let detalleBalance = '';
        if (b.estado === 'A FAVOR') {
            detalleBalance = `Tiene a favor: +$${b.balance.toFixed(2)}`;
        } else if (b.estado === 'DEBE') {
            detalleBalance = `Falta aportar:  -$${Math.abs(b.balance).toFixed(2)}`;
        } else {
            detalleBalance = `Al día ($0.00)`;
        }

        console.log(`• ${b.nombre.padEnd(12)} | Puso: $${b.totalPuesto.toFixed(2).padStart(8)} [${b.porcentajeAporte}% del total] | Le tocaba: $${b.debePagar.toFixed(2).padStart(8)} | ${detalleBalance}`);
    });

    console.log('\n' + subseparador);
    console.log(' DEVOLUCIONES / TRANSFERENCIAS NECESARIAS:');
    console.log(subseparador);

    if (resultado.transferencias.length === 0) {
        console.log('✓ No se requieren transferencias. Todas las cuentas están saldadas.');
    } else {
        resultado.transferencias.forEach((t, index) => {
            console.log(`  ${index + 1}. ${t.mensaje}`);
        });
    }

    console.log(separador + '\n');
}

/**
 * ============================================================================
 * 7. EJEMPLO PRÁCTICO DEMOSTRATIVO
 * ============================================================================
 */

function ejecutarDemostracion() {
    console.log('Iniciando Demostración del Estimador de Costos...');

    // Ejemplo: Asado / Salida entre 4 amigos
    // Gasto total del evento: $14.000
    // - Juan pagó compras por $9.000 de su bolsillo
    // - Sofía pagó compras por $2.000 de su bolsillo
    // - María aportó $3.000 de seña / adelanto
    // - Lucas no aportó ni gastó nada aún
    // Total puesto entre todos: $9.000 + $2.000 + $3.000 = $14.000 (100% de gastos)

    const p1 = crearPersona('Juan', 0, 9000);
    const p2 = crearPersona('María', 3000, 0);
    const p3 = crearPersona('Lucas', 0, 0);
    const p4 = crearPersona('Sofía', 0, 2000);

    // Detalle de consumos individuales (para la modalidad Equivalente)
    // Juan: Asado ($4000) y Gaseosa ($1000) -> Total: $5000
    agregarConsumo(p1, 'Asado/Carne', 4000);
    agregarConsumo(p1, 'Gaseosa', 1000);

    // María: Ensalada ($2000) y Postre ($1500) -> Total: $3500
    agregarConsumo(p2, 'Ensalada', 2000);
    agregarConsumo(p2, 'Postre', 1500);

    // Lucas: Asado ($3500) -> Total: $3500
    agregarConsumo(p3, 'Asado/Carne', 3500);

    // Sofía: Postre ($1000) y Gaseosa ($1000) -> Total: $2000
    agregarConsumo(p4, 'Postre', 1000);
    agregarConsumo(p4, 'Gaseosa', 1000);

    const grupo = [p1, p2, p3, p4];

    // 1. Ejecución en Modo EQUITATIVO (partes iguales: $14000 / 4 = $3500 por persona)
    const resultadoEquitativo = estimarCostos(grupo, TIPO_OPERACION.EQUITATIVO);
    imprimirReporte(resultadoEquitativo);

    // 2. Ejecución en Modo EQUIVALENTE (según consumo particular de cada uno)
    const resultadoEquivalente = estimarCostos(grupo, TIPO_OPERACION.EQUIVALENTE);
    imprimirReporte(resultadoEquivalente);
}

// Ejecución automática en entorno Node.js
if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    ejecutarDemostracion();
}

// Exportación modular para Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        TIPO_OPERACION,
        crearPersona,
        generarGrupoVacio,
        agregarConsumo,
        quitarConsumo,
        calcularTotalConsumido,
        calcularTotalPuesto,
        calcularGastoTotal,
        calcularTotalGastadoDirecto,
        calcularAporteTotal,
        calcularConsumoTotal,
        calcularPorcentaje,
        calcularBalances,
        calcularTransferencias,
        estimarCostos,
        imprimirReporte,
        ejecutarDemostracion
    };
}

// Exportación global para entorno navegador
if (typeof window !== 'undefined') {
    window.EstimadorDeCostos = {
        TIPO_OPERACION,
        crearPersona,
        generarGrupoVacio,
        agregarConsumo,
        quitarConsumo,
        calcularTotalConsumido,
        calcularTotalPuesto,
        calcularGastoTotal,
        calcularTotalGastadoDirecto,
        calcularAporteTotal,
        calcularConsumoTotal,
        calcularPorcentaje,
        calcularBalances,
        calcularTransferencias,
        estimarCostos,
        imprimirReporte,
        ejecutarDemostracion
    };
}
