const express = require('express');
const PDFDocument = require('pdfkit');
const router = express.Router();
const { db } = require('../server');

// Método POST para crear órdenes
router.post('/', async (req, res) => {
    const { id_cliente, tipo_servicio, abono, numero_recibo, dependencia_municipal, horario_trabajo, tecnicos, estado } = req.body;
    
    // Validación de datos
    if (!id_cliente) {
        return res.status(400).json({ error: 'El ID del cliente es obligatorio' });
    }
    
    if (abono === 'sí' && (!numero_recibo || numero_recibo.trim() === '')) {
        return res.status(400).json({ error: 'El número de recibo es obligatorio si se abona' });
    }
    
    try {
        // Verificar que el cliente existe
        const { rows: clienteRows } = await db.execute('SELECT id FROM clientes WHERE id = ?', [id_cliente]);
        if (clienteRows.length === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }
        
        // Insertar la orden
        await db.execute(
            'INSERT INTO ordenes (id_cliente, tipo_servicio, abono, numero_recibo, dependencia_municipal, horario_trabajo, tecnicos, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id_cliente, tipo_servicio, abono, numero_recibo || '', dependencia_municipal || '', horario_trabajo, tecnicos || '', estado || 'Pendiente']
        );
        
        const { rows } = await db.execute('SELECT last_insert_rowid() as id');
        res.status(201).json({ message: 'Orden creada exitosamente', id: rows[0].id });
    } catch (err) {
        console.error('Error al crear orden:', err);
        res.status(500).json({ error: 'Error al crear orden: ' + err.message });
    }
});

router.get('/cliente/:id_cliente', async (req, res) => {
    const { id_cliente } = req.params;
    try {
        const { rows } = await db.execute('SELECT * FROM ordenes WHERE id_cliente = ?', [id_cliente]);
        res.json(rows);
    } catch (err) {
        console.error('Error al obtener órdenes del cliente:', err);
        res.status(500).json({ error: 'Error al obtener órdenes' });
    }
});

// Método PUT para actualizar órdenes
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { tipo_servicio, abono, numero_recibo, dependencia_municipal, horario_trabajo, tecnicos, estado } = req.body;
    
    // Validación de datos
    if (abono === 'sí' && (!numero_recibo || numero_recibo.trim() === '')) {
        return res.status(400).json({ error: 'El número de recibo es obligatorio si se abona' });
    }
    
    try {
        // Verificar que la orden existe
        const { rows: ordenRows } = await db.execute('SELECT id FROM ordenes WHERE id = ?', [id]);
        if (ordenRows.length === 0) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }
        
        // Actualizar la orden
        await db.execute(
            'UPDATE ordenes SET tipo_servicio = ?, abono = ?, numero_recibo = ?, dependencia_municipal = ?, horario_trabajo = ?, tecnicos = ?, estado = ? WHERE id = ?',
            [tipo_servicio, abono, numero_recibo || '', dependencia_municipal || '', horario_trabajo, tecnicos || '', estado, id]
        );
        
        res.json({ message: 'Orden actualizada exitosamente' });
    } catch (err) {
        console.error('Error al editar orden:', err);
        res.status(500).json({ error: 'Error al editar orden: ' + err.message });
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Verificar que la orden existe
        const { rows: ordenRows } = await db.execute('SELECT id FROM ordenes WHERE id = ?', [id]);
        if (ordenRows.length === 0) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }
        
        // Eliminar visitas asociadas y luego la orden
        await db.execute('DELETE FROM visitas WHERE id_orden = ?', [id]);
        await db.execute('DELETE FROM ordenes WHERE id = ?', [id]);
        res.json({ message: 'Orden eliminada exitosamente' });
    } catch (err) {
        console.error('Error al eliminar orden:', err);
        res.status(500).json({ error: 'Error al eliminar orden: ' + err.message });
    }
});

router.get('/:id/pdf', async (req, res) => {
    const { id } = req.params;
    try {
        const { rows: ordenRows } = await db.execute('SELECT * FROM ordenes WHERE id = ?', [id]);
        if (!ordenRows.length) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }
        const orden = ordenRows[0];
        const { rows: clienteRows } = await db.execute('SELECT c.*, b.nombre as barrio FROM clientes c LEFT JOIN barrios b ON c.id_barrio = b.id WHERE c.id = ?', [orden.id_cliente]);
        if (!clienteRows.length) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }
        const cliente = clienteRows[0];
        const { rows: visitas } = await db.execute('SELECT * FROM visitas WHERE id_orden = ?', [id]);

        const doc = new PDFDocument();
        let filename = `orden_${id}.pdf`;
        filename = encodeURIComponent(filename);
        res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-type', 'application/pdf');

        doc.fontSize(16).text('Orden de Trabajo', { align: 'center' });
        doc.moveDown();

        doc.fontSize(12).text('Datos del Cliente', { underline: true });
        doc.text(`Código: ${cliente.codigo || 'No disponible'}`);
        doc.text(`Nombre: ${cliente.nombre || 'No disponible'}`);
        doc.text(`Dirección: ${cliente.direccion || 'No disponible'}`);
        doc.text(`Barrio/Localidad: ${cliente.barrio || 'No especificado'}`);
        doc.text(`Teléfono: ${cliente.telefono || 'No disponible'}`);
        doc.text(`Mail: ${cliente.mail || 'No disponible'}`);
        doc.text(`DNI: ${cliente.dni || 'No disponible'}`);
        doc.text(`Metros Cuadrados: ${cliente.m2 ? cliente.m2 + ' m²' : 'No especificado'}`);
        doc.moveDown();

        doc.fontSize(12).text('Detalles de la Orden', { underline: true });
        doc.text(`Tipo de Servicio: ${orden.tipo_servicio}`);
        doc.text(`Abonó: ${orden.abono}`);
        if (orden.abono === 'sí') {
            doc.text(`Número de Recibo: ${orden.numero_recibo || 'No especificado'}`);
        } else if (orden.dependencia_municipal) {
            doc.text(`Dependencia Municipal: ${orden.dependencia_municipal}`);
        }
        doc.text(`Horario de Trabajo: ${orden.horario_trabajo}`);
        doc.text(`Técnicos Asignados: ${orden.tecnicos}`);
        doc.text(`Estado: ${orden.estado}`);
        doc.moveDown();

        if (visitas.length > 0) {
            doc.fontSize(12).text('Visitas Realizadas', { underline: true });
            visitas.forEach((visita, index) => {
                doc.text(`Visita ${index + 1}: ${visita.fecha_visita}`);
                doc.text(`Observaciones: ${visita.observaciones || 'Sin observaciones'}`);
                doc.moveDown(0.5);
            });
        } else {
            doc.text('No hay visitas registradas.');
        }

        doc.pipe(res);
        doc.end();
    } catch (err) {
        console.error('Error al generar PDF:', err);
        res.status(500).json({ error: 'Error al generar PDF: ' + err.message });
    }
});

module.exports = router;