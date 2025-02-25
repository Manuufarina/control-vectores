const express = require('express');
const router = express.Router();
const { db } = require('../server');

router.get('/', async (req, res) => {
    const { fechaInicio, fechaFin } = req.query;
    // Verificamos que fechaInicio y fechaFin sean válidas para evitar errores de SQL
    const whereClause = fechaInicio && fechaFin ? 
        `WHERE horario_trabajo BETWEEN '${fechaInicio}' AND '${fechaFin}'` : '';
    
    const stats = {
        sinPago: 0,
        eximidos: 0,
        porTipoServicio: [],
        tecnicosActivos: []
    };
    
    try {
        // Primero verificamos si la columna abono existe
        let hasAbonoColumn = true;
        try {
            await db.execute('SELECT abono FROM ordenes LIMIT 1');
        } catch (err) {
            hasAbonoColumn = false;
            console.error('La columna abono no existe en la tabla ordenes');
        }

        if (hasAbonoColumn) {
            // Consulta para obtener órdenes sin pago (usando la columna abono)
            const { rows: sinPagoRows } = await db.execute(`
                SELECT COUNT(*) as sinPago 
                FROM ordenes 
                ${whereClause !== '' ? whereClause + ' AND' : 'WHERE'} abono = 'no' AND (dependencia_municipal IS NULL OR dependencia_municipal = '')
            `);
            stats.sinPago = sinPagoRows[0].sinPago || 0;

            // Consulta para obtener órdenes eximidas (usando la columna abono)
            const { rows: eximidosRows } = await db.execute(`
                SELECT COUNT(*) as eximidos 
                FROM ordenes 
                ${whereClause !== '' ? whereClause + ' AND' : 'WHERE'} abono = 'no' AND dependencia_municipal IS NOT NULL AND dependencia_municipal != ''
            `);
            stats.eximidos = eximidosRows[0].eximidos || 0;
        } else {
            // Consulta alternativa para obtener órdenes sin pago (sin usar la columna abono)
            const { rows: sinPagoRows } = await db.execute(`
                SELECT COUNT(*) as sinPago 
                FROM ordenes 
                ${whereClause !== '' ? whereClause + ' AND' : 'WHERE'} (numero_recibo IS NULL OR numero_recibo = '') AND (dependencia_municipal IS NULL OR dependencia_municipal = '')
            `);
            stats.sinPago = sinPagoRows[0].sinPago || 0;

            // Consulta alternativa para obtener órdenes eximidas (sin usar la columna abono)
            const { rows: eximidosRows } = await db.execute(`
                SELECT COUNT(*) as eximidos 
                FROM ordenes 
                ${whereClause !== '' ? whereClause + ' AND' : 'WHERE'} (numero_recibo IS NULL OR numero_recibo = '') AND dependencia_municipal IS NOT NULL AND dependencia_municipal != ''
            `);
            stats.eximidos = eximidosRows[0].eximidos || 0;
        }

        // Consulta para obtener estadísticas por tipo de servicio
        const { rows: porTipoServicio } = await db.execute(`
            SELECT tipo_servicio, COUNT(*) as cantidad 
            FROM ordenes 
            ${whereClause}
            GROUP BY tipo_servicio
        `);
        stats.porTipoServicio = porTipoServicio || [];

        // Consulta para obtener estadísticas por técnico
        const { rows: tecnicosActivos } = await db.execute(`
            SELECT tecnicos, COUNT(*) as cantidad 
            FROM ordenes 
            ${whereClause}
            GROUP BY tecnicos 
            ORDER BY cantidad DESC 
            LIMIT 5
        `);
        stats.tecnicosActivos = tecnicosActivos || [];

        res.json(stats);
    } catch (err) {
        console.error('Error en estadísticas:', err);
        res.status(500).json({ 
            error: 'Error al obtener estadísticas',
            message: err.message,
            stats: {
                sinPago: 0,
                eximidos: 0,
                porTipoServicio: [],
                tecnicosActivos: []
            }
        });
    }
});

module.exports = router;