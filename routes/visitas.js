const express = require('express');
const router = express.Router();
const { db } = require('../server');

router.post('/', async (req, res) => {
    const { id_orden, fecha_visita, observaciones } = req.body;
    try {
        await db.execute(
            'INSERT INTO visitas (id_orden, fecha_visita, observaciones) VALUES (?, ?, ?)',
            [id_orden, fecha_visita, observaciones]
        );
        const { rows } = await db.execute('SELECT last_insert_rowid() as id');
        res.status(201).json({ message: 'Visita creada', id: rows[0].id });
    } catch (err) {
        res.status(500).json({ error: 'Error al crear visita' });
    }
});

router.get('/orden/:id_orden', async (req, res) => {
    const { id_orden } = req.params;
    try {
        const { rows } = await db.execute('SELECT * FROM visitas WHERE id_orden = ?', [id_orden]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener visitas' });
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { fecha_visita, observaciones } = req.body;
    try {
        await db.execute(
            'UPDATE visitas SET fecha_visita = ?, observaciones = ? WHERE id = ?',
            [fecha_visita, observaciones, id]
        );
        res.json({ message: 'Visita actualizada' });
    } catch (err) {
        res.status(500).json({ error: 'Error al editar visita' });
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute('DELETE FROM visitas WHERE id = ?', [id]);
        res.json({ message: 'Visita eliminada' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar visita' });
    }
});

module.exports = router;