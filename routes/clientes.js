const express = require('express');
const router = express.Router();
const { db } = require('../server');

function generarCodigoUnico() {
    const prefix = 'CL';
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}-${randomNum}`;
}

router.get('/barrios', async (req, res) => {
    try {
        const { rows } = await db.execute('SELECT * FROM barrios ORDER BY nombre');
        res.json(rows);
    } catch (err) {
        console.error('Error en GET /barrios:', err);
        res.status(500).json({ error: 'Error al obtener barrios' });
    }
});

router.post('/barrios', async (req, res) => {
    const { nombre } = req.body;
    if (!nombre || nombre.trim() === '') {
        return res.status(400).json({ error: 'El nombre del barrio es obligatorio' });
    }
    try {
        await db.execute('INSERT OR IGNORE INTO barrios (nombre) VALUES (?)', [nombre.trim()]);
        const { rows } = await db.execute('SELECT id FROM barrios WHERE nombre = ?', [nombre.trim()]);
        res.status(201).json({ message: 'Barrio creado o ya existe', id: rows[0].id });
    } catch (err) {
        console.error('Error en POST /barrios:', err);
        res.status(500).json({ error: 'Error al crear barrio' });
    }
});

router.post('/', async (req, res) => {
    const { nombre, direccion, telefono, mail, dni, m2, id_barrio } = req.body;
    
    // Validación de DNI
    if (!dni || dni.trim() === '') {
        return res.status(400).json({ error: 'El DNI es obligatorio' });
    }
    
    // Verificar si el DNI ya existe
    try {
        const { rows: existingDni } = await db.execute('SELECT id, dni FROM clientes WHERE dni = ?', [dni.trim()]);
        if (existingDni.length > 0) {
            return res.status(400).json({ error: 'El DNI ya está registrado en el sistema', existingId: existingDni[0].id });
        }
    } catch (err) {
        console.error('Error al verificar DNI:', err);
        return res.status(500).json({ error: 'Error al verificar DNI' });
    }
    
    let codigo;
    const checkUniqueness = async () => {
        codigo = generarCodigoUnico();
        const { rows } = await db.execute('SELECT COUNT(*) as count FROM clientes WHERE codigo = ?', [codigo]);
        if (rows[0].count > 0) {
            await checkUniqueness();
        } else {
            try {
                await db.execute(
                    'INSERT INTO clientes (nombre, direccion, telefono, mail, dni, codigo, m2, id_barrio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [nombre, direccion, telefono, mail, dni, codigo, m2 || null, id_barrio || null]
                );
                const { rows } = await db.execute('SELECT last_insert_rowid() as id');
                res.status(201).json({ message: 'Cliente creado', id: rows[0].id, codigo });
            } catch (err) {
                // Manejo específico para error de DNI duplicado
                if (err.message && err.message.includes('UNIQUE constraint failed: clientes.dni')) {
                    res.status(400).json({ error: 'El DNI ya está registrado en el sistema' });
                } else {
                    console.error('Error al crear cliente:', err);
                    res.status(500).json({ error: 'Error al crear cliente: ' + err.message });
                }
            }
        }
    };
    try {
        await checkUniqueness();
    } catch (err) {
        // Este bloque maneja errores generales del proceso
        console.error('Error general al crear cliente:', err);
        res.status(500).json({ error: 'Error al crear cliente' });
    }
});

router.get('/buscar', async (req, res) => {
    const { q } = req.query;
    try {
        const { rows } = await db.execute(`
            SELECT c.*, b.nombre as barrio 
            FROM clientes c 
            LEFT JOIN barrios b ON c.id_barrio = b.id
            WHERE c.nombre LIKE ? OR c.dni LIKE ? OR c.direccion LIKE ? OR c.mail LIKE ? OR c.codigo LIKE ? OR b.nombre LIKE ?
        `, [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al buscar clientes' });
    }
});

router.get('/:id/historial', async (req, res) => {
    const { id } = req.params;
    try {
        const { rows: clienteRows } = await db.execute('SELECT c.*, b.nombre as barrio FROM clientes c LEFT JOIN barrios b ON c.id_barrio = b.id WHERE c.id = ?', [id]);
        if (!clienteRows.length) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }
        const cliente = clienteRows[0];
        const { rows: ordenesRows } = await db.execute('SELECT * FROM ordenes WHERE id_cliente = ?', [id]);
        const historial = { cliente, ordenes: [] };
        for (const orden of ordenesRows) {
            const { rows: visitasRows } = await db.execute('SELECT * FROM visitas WHERE id_orden = ?', [orden.id]);
            historial.ordenes.push({ ...orden, visitas: visitasRows });
        }
        res.json(historial);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener historial' });
    }
});

// Nuevo endpoint para verificar si un DNI ya existe
router.get('/verificar-dni/:dni', async (req, res) => {
    const { dni } = req.params;
    try {
        const { rows } = await db.execute('SELECT id FROM clientes WHERE dni = ?', [dni]);
        if (rows.length > 0) {
            res.json({ exists: true, clienteId: rows[0].id });
        } else {
            res.json({ exists: false });
        }
    } catch (err) {
        console.error('Error al verificar DNI:', err);
        res.status(500).json({ error: 'Error al verificar DNI' });
    }
});

module.exports = router;