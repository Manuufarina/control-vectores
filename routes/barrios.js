const express = require('express');
const router = express.Router();
const { db } = require('../server');

// GET /api/barrios - Obtener todos los barrios/localidades
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.execute('SELECT * FROM barrios ORDER BY nombre');
    
    // Formatear la respuesta para que sea similar a la estructura de MongoDB
    const barrios = rows.map(barrio => ({
      ...barrio,
      _id: barrio.id
    }));
    
    res.json(barrios);
  } catch (error) {
    console.error('Error al obtener barrios:', error);
    res.status(500).json({ message: 'Error al obtener barrios' });
  }
});

// GET /api/barrios/:id - Obtener un barrio/localidad por ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const { rows } = await db.execute('SELECT * FROM barrios WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Barrio no encontrado' });
    }
    
    // Formatear la respuesta
    const barrio = {
      ...rows[0],
      _id: rows[0].id
    };
    
    res.json(barrio);
  } catch (error) {
    console.error(`Error al obtener barrio ${id}:`, error);
    res.status(500).json({ message: 'Error al obtener barrio' });
  }
});

// POST /api/barrios - Crear un nuevo barrio/localidad
router.post('/', async (req, res) => {
  const { nombre, tipo = 'localidad' } = req.body;
  
  if (!nombre || nombre.trim() === '') {
    return res.status(400).json({ message: 'El nombre del barrio es obligatorio' });
  }
  
  try {
    // Verificar si ya existe un barrio con el mismo nombre
    const { rows: existingRows } = await db.execute(
      'SELECT id FROM barrios WHERE nombre = ?',
      [nombre.trim()]
    );
    
    if (existingRows.length > 0) {
      // Si ya existe, devolver ese barrio
      const { rows: barrioExistente } = await db.execute(
        'SELECT * FROM barrios WHERE id = ?',
        [existingRows[0].id]
      );
      
      return res.status(200).json({ 
        message: 'El barrio ya existe',
        barrio: {
          ...barrioExistente[0],
          _id: barrioExistente[0].id
        }
      });
    }
    
    // Insertar el nuevo barrio
    await db.execute(
      'INSERT INTO barrios (nombre, tipo) VALUES (?, ?)',
      [nombre.trim(), tipo]
    );
    
    // Obtener el ID del barrio recién creado
    const { rows: insertedRows } = await db.execute(
      'SELECT * FROM barrios WHERE nombre = ?',
      [nombre.trim()]
    );
    
    // Formatear la respuesta
    const barrioCreado = {
      ...insertedRows[0],
      _id: insertedRows[0].id
    };
    
    res.status(201).json(barrioCreado);
  } catch (error) {
    console.error('Error al crear barrio:', error);
    res.status(500).json({ message: 'Error al crear barrio' });
  }
});

// PUT /api/barrios/:id - Actualizar un barrio/localidad
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, tipo } = req.body;
  
  if (!nombre || nombre.trim() === '') {
    return res.status(400).json({ message: 'El nombre del barrio es obligatorio' });
  }
  
  try {
    // Verificar si el barrio existe
    const { rows: existingRows } = await db.execute(
      'SELECT id FROM barrios WHERE id = ?',
      [id]
    );
    
    if (existingRows.length === 0) {
      return res.status(404).json({ message: 'Barrio no encontrado' });
    }
    
    // Verificar si ya existe otro barrio con el mismo nombre
    const { rows: nameRows } = await db.execute(
      'SELECT id FROM barrios WHERE nombre = ? AND id != ?',
      [nombre.trim(), id]
    );
    
    if (nameRows.length > 0) {
      return res.status(400).json({ message: 'Ya existe otro barrio con el mismo nombre' });
    }
    
    // Actualizar el barrio
    await db.execute(
      'UPDATE barrios SET nombre = ?, tipo = ? WHERE id = ?',
      [nombre.trim(), tipo || 'localidad', id]
    );
    
    // Obtener el barrio actualizado
    const { rows: updatedRows } = await db.execute(
      'SELECT * FROM barrios WHERE id = ?',
      [id]
    );
    
    // Formatear la respuesta
    const barrioActualizado = {
      ...updatedRows[0],
      _id: updatedRows[0].id
    };
    
    res.json(barrioActualizado);
  } catch (error) {
    console.error(`Error al actualizar barrio ${id}:`, error);
    res.status(500).json({ message: 'Error al actualizar barrio' });
  }
});

// DELETE /api/barrios/:id - Eliminar un barrio/localidad
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Verificar si el barrio existe
    const { rows: existingRows } = await db.execute(
      'SELECT id FROM barrios WHERE id = ?',
      [id]
    );
    
    if (existingRows.length === 0) {
      return res.status(404).json({ message: 'Barrio no encontrado' });
    }
    
    // Verificar si hay clientes asociados a este barrio
    const { rows: clientesRows } = await db.execute(
      'SELECT COUNT(*) as count FROM clientes WHERE id_barrio = ?',
      [id]
    );
    
    if (clientesRows[0].count > 0) {
      return res.status(400).json({ 
        message: `No se puede eliminar el barrio porque tiene ${clientesRows[0].count} clientes asociados` 
      });
    }
    
    // Eliminar el barrio
    await db.execute('DELETE FROM barrios WHERE id = ?', [id]);
    
    res.json({ message: 'Barrio eliminado' });
  } catch (error) {
    console.error(`Error al eliminar barrio ${id}:`, error);
    res.status(500).json({ message: 'Error al eliminar barrio' });
  }
});

module.exports = router;