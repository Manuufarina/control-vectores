const express = require('express');
const router = express.Router();
const { db } = require('../server');

// GET /api/tecnicos - Obtener todos los técnicos
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.execute('SELECT * FROM tecnicos ORDER BY nombre');
    
    // Formatear la respuesta para que sea similar a la estructura de MongoDB
    const tecnicos = rows.map(tecnico => ({
      ...tecnico,
      _id: tecnico.id,
      activo: !!tecnico.activo
    }));
    
    res.json(tecnicos);
  } catch (error) {
    console.error('Error al obtener técnicos:', error);
    res.status(500).json({ message: 'Error al obtener técnicos' });
  }
});

// GET /api/tecnicos/:id - Obtener un técnico por ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const { rows } = await db.execute('SELECT * FROM tecnicos WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Técnico no encontrado' });
    }
    
    // Formatear la respuesta
    const tecnico = {
      ...rows[0],
      _id: rows[0].id,
      activo: !!rows[0].activo
    };
    
    res.json(tecnico);
  } catch (error) {
    console.error(`Error al obtener técnico ${id}:`, error);
    res.status(500).json({ message: 'Error al obtener técnico' });
  }
});

// POST /api/tecnicos - Crear un nuevo técnico
router.post('/', async (req, res) => {
  const { nombre, especialidad, activo = true } = req.body;
  
  if (!nombre || nombre.trim() === '') {
    return res.status(400).json({ message: 'El nombre del técnico es obligatorio' });
  }
  
  try {
    // Verificar si ya existe un técnico con el mismo nombre
    const { rows: existingRows } = await db.execute(
      'SELECT id FROM tecnicos WHERE nombre = ?',
      [nombre.trim()]
    );
    
    if (existingRows.length > 0) {
      return res.status(400).json({ message: 'Ya existe un técnico con el mismo nombre' });
    }
    
    // Insertar el nuevo técnico
    await db.execute(
      'INSERT INTO tecnicos (nombre, especialidad, activo) VALUES (?, ?, ?)',
      [nombre.trim(), especialidad || null, activo ? 1 : 0]
    );
    
    // Obtener el ID del técnico recién creado
    const { rows: insertedRows } = await db.execute(
      'SELECT * FROM tecnicos WHERE nombre = ?',
      [nombre.trim()]
    );
    
    // Formatear la respuesta
    const tecnicoCreado = {
      ...insertedRows[0],
      _id: insertedRows[0].id,
      activo: !!insertedRows[0].activo
    };
    
    res.status(201).json(tecnicoCreado);
  } catch (error) {
    console.error('Error al crear técnico:', error);
    res.status(500).json({ message: 'Error al crear técnico' });
  }
});

// PUT /api/tecnicos/:id - Actualizar un técnico
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, especialidad, activo } = req.body;
  
  if (nombre !== undefined && (nombre === null || nombre.trim() === '')) {
    return res.status(400).json({ message: 'El nombre del técnico es obligatorio' });
  }
  
  try {
    // Verificar si el técnico existe
    const { rows: existingRows } = await db.execute(
      'SELECT id FROM tecnicos WHERE id = ?',
      [id]
    );
    
    if (existingRows.length === 0) {
      return res.status(404).json({ message: 'Técnico no encontrado' });
    }
    
    // Si se va a cambiar el nombre, verificar que no haya otro técnico con ese nombre
    if (nombre) {
      const { rows: nameRows } = await db.execute(
        'SELECT id FROM tecnicos WHERE nombre = ? AND id != ?',
        [nombre.trim(), id]
      );
      
      if (nameRows.length > 0) {
        return res.status(400).json({ message: 'Ya existe otro técnico con el mismo nombre' });
      }
    }
    
    // Obtener los datos actuales del técnico para los campos que no se actualizan
    const { rows: currentData } = await db.execute('SELECT * FROM tecnicos WHERE id = ?', [id]);
    
    // Actualizar el técnico
    await db.execute(
      'UPDATE tecnicos SET nombre = ?, especialidad = ?, activo = ? WHERE id = ?',
      [
        nombre !== undefined ? nombre.trim() : currentData[0].nombre,
        especialidad !== undefined ? especialidad : currentData[0].especialidad,
        activo !== undefined ? (activo ? 1 : 0) : currentData[0].activo,
        id
      ]
    );
    
    // Obtener el técnico actualizado
    const { rows: updatedRows } = await db.execute(
      'SELECT * FROM tecnicos WHERE id = ?',
      [id]
    );
    
    // Formatear la respuesta
    const tecnicoActualizado = {
      ...updatedRows[0],
      _id: updatedRows[0].id,
      activo: !!updatedRows[0].activo
    };
    
    res.json(tecnicoActualizado);
  } catch (error) {
    console.error(`Error al actualizar técnico ${id}:`, error);
    res.status(500).json({ message: 'Error al actualizar técnico' });
  }
});

// DELETE /api/tecnicos/:id - Eliminar un técnico
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Verificar si el técnico existe
    const { rows: existingRows } = await db.execute(
      'SELECT id FROM tecnicos WHERE id = ?',
      [id]
    );
    
    if (existingRows.length === 0) {
      return res.status(404).json({ message: 'Técnico no encontrado' });
    }
    
    // Verificar si está asociado a órdenes o visitas
    const { rows: ordenesRows } = await db.execute(
      'SELECT COUNT(*) as count FROM orden_tecnicos WHERE id_tecnico = ?',
      [id]
    );
    
    const { rows: visitasRows } = await db.execute(
      'SELECT COUNT(*) as count FROM visita_tecnicos WHERE id_tecnico = ?',
      [id]
    );
    
    const totalAsociaciones = ordenesRows[0].count + visitasRows[0].count;
    
    if (totalAsociaciones > 0) {
      return res.status(400).json({ 
        message: `No se puede eliminar el técnico porque está asociado a ${totalAsociaciones} órdenes o visitas` 
      });
    }
    
    // Eliminar el técnico
    await db.execute('DELETE FROM tecnicos WHERE id = ?', [id]);
    
    res.json({ message: 'Técnico eliminado' });
  } catch (error) {
    console.error(`Error al eliminar técnico ${id}:`, error);
    res.status(500).json({ message: 'Error al eliminar técnico' });
  }
});

module.exports = router;