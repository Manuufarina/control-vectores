const express = require('express');
const { createClient } = require('@libsql/client');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Crear una conexión a la base de datos
const db = createClient({
  url: 'libsql://vectoresdb-manuufarina.turso.io', // Reemplazá con tu URL exacta
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NDAzOTkzMjMsImlkIjoiMDIwZWI1M2UtNGY4ZS00MjRhLWI2YzMtMzMyZWQ0NGM4ZjE3In0.huefkMphDCXd9vQHEPTKVHS7WxjKC2JEkZYjNhgaU_hbwlOoJx-Wh2L_LKqpC_N8d_WMes4zG1_lQay72fRhAw' // Reemplazá con tu token exacto
});

// Exportar la base de datos antes de cualquier otra cosa
exports.db = db;

// Configuración de Express para servir archivos estáticos y procesar JSON
app.use(express.json());

// Configuración específica para servir archivos estáticos
app.use(express.static(path.join(__dirname)));

// Asegurarnos de que los archivos CSS se sirvan con el tipo MIME correcto
app.get('*.css', (req, res, next) => {
  res.type('text/css');
  next();
});

// Asegurarnos de que los archivos JavaScript se sirvan con el tipo MIME correcto
app.get('*.js', (req, res, next) => {
  res.type('application/javascript');
  next();
});

(async () => {
  try {
    // Verificar si necesitamos actualizar la tabla clientes para DNI único
    let needsClientUpdate = false;
    try {
      // Intentar verificar si hay DNIs duplicados
      const { rows: duplicateDnis } = await db.execute(`
        SELECT dni, COUNT(*) as count 
        FROM clientes 
        GROUP BY dni 
        HAVING COUNT(*) > 1
      `);
      
      if (duplicateDnis.length > 0) {
        console.log('Se encontraron DNIs duplicados. Es necesario actualizar la tabla clientes.');
        needsClientUpdate = true;
      } else {
        // Verificar si ya existe la restricción UNIQUE en la columna dni
        const { rows: tableInfo } = await db.execute(`PRAGMA index_list('clientes')`);
        const hasUniqueIndex = tableInfo.some(index => index.name === 'sqlite_autoindex_clientes_1' || index.name === 'idx_dni_unique');
        
        if (!hasUniqueIndex) {
          console.log('No se encontró restricción UNIQUE para DNI. Es necesario actualizar la tabla clientes.');
          needsClientUpdate = true;
        }
      }
    } catch (err) {
      console.error('Error al verificar DNIs duplicados:', err);
    }

    // Verificar si necesitamos actualizar la tabla ordenes
    let needsOrderUpdate = false;
    try {
      // Intentar obtener información sobre la columna abono
      await db.execute(`SELECT abono FROM ordenes LIMIT 1`);
    } catch (err) {
      // Si hay un error, la columna no existe y necesitamos actualizar
      console.log('La columna abono no existe, actualizando esquema de la tabla ordenes...');
      needsOrderUpdate = true;
    }

    // Crear o verificar la tabla barrios
    await db.execute(`
      CREATE TABLE IF NOT EXISTS barrios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE
      )
    `);

    // Actualizar la tabla clientes si es necesario
    if (needsClientUpdate) {
      console.log('Actualizando tabla clientes para añadir restricción de DNI único...');
      
      // Respaldar los datos actuales
      const { rows: existingClients } = await db.execute(`SELECT * FROM clientes`);
      
      // Eliminar la tabla actual
      await db.execute(`DROP TABLE IF EXISTS clientes`);
      
      // Crear la nueva tabla con la restricción de DNI único
      await db.execute(`
        CREATE TABLE clientes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          direccion TEXT NOT NULL,
          telefono TEXT,
          mail TEXT,
          dni TEXT NOT NULL UNIQUE,
          codigo TEXT UNIQUE NOT NULL,
          m2 REAL,
          id_barrio INTEGER,
          FOREIGN KEY (id_barrio) REFERENCES barrios(id)
        )
      `);
      
      // Encontrar y manejar DNIs duplicados
      const processedDnis = new Set();
      let duplicateCount = 0;
      
      // Restaurar los datos evitando duplicados de DNI
      for (const client of existingClients) {
        if (processedDnis.has(client.dni)) {
          // Este DNI ya existe, modificarlo para hacerlo único
          duplicateCount++;
          client.dni = client.dni + '-' + duplicateCount;
          console.log(`DNI duplicado encontrado. Modificado a: ${client.dni}`);
        }
        
        processedDnis.add(client.dni);
        
        // Insertar cliente con DNI único
        await db.execute(`
          INSERT INTO clientes (id, nombre, direccion, telefono, mail, dni, codigo, m2, id_barrio)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          client.id,
          client.nombre,
          client.direccion,
          client.telefono || null,
          client.mail || null,
          client.dni,
          client.codigo,
          client.m2 || null,
          client.id_barrio || null
        ]);
      }
      
      console.log(`Tabla clientes actualizada correctamente. Se modificaron ${duplicateCount} DNIs duplicados.`);
    } else {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS clientes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          direccion TEXT NOT NULL,
          telefono TEXT,
          mail TEXT,
          dni TEXT NOT NULL UNIQUE,
          codigo TEXT UNIQUE NOT NULL,
          m2 REAL,
          id_barrio INTEGER,
          FOREIGN KEY (id_barrio) REFERENCES barrios(id)
        )
      `);
      console.log('La tabla clientes ya tiene la estructura correcta con DNI único');
    }

    // Si la tabla ordenes necesita actualización
    if (needsOrderUpdate) {
      // Primero respaldar los datos actuales
      const { rows: existingOrders } = await db.execute(`SELECT * FROM ordenes`);
      
      // Eliminar la tabla actual
      await db.execute(`DROP TABLE IF EXISTS ordenes`);
      
      // Crear la nueva tabla con la estructura correcta
      await db.execute(`
        CREATE TABLE ordenes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          id_cliente INTEGER,
          tipo_servicio TEXT,
          abono TEXT,
          numero_recibo TEXT,
          dependencia_municipal TEXT,
          horario_trabajo TEXT,
          tecnicos TEXT,
          estado TEXT DEFAULT 'Pendiente',
          FOREIGN KEY (id_cliente) REFERENCES clientes(id)
        )
      `);
      
      // Restaurar los datos antiguos a la nueva estructura
      for (const order of existingOrders) {
        await db.execute(`
          INSERT INTO ordenes (id, id_cliente, tipo_servicio, numero_recibo, dependencia_municipal, horario_trabajo, tecnicos, estado)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          order.id, 
          order.id_cliente, 
          order.tipo_servicio, 
          order.numero_recibo || '', 
          order.dependencia_municipal || '', 
          order.horario_trabajo,
          order.tecnicos || '',
          order.estado || 'Pendiente'
        ]);
        
        // Actualizar el campo abono según si tienen número de recibo
        await db.execute(`
          UPDATE ordenes SET abono = ? WHERE id = ?
        `, [
          order.numero_recibo && order.numero_recibo.trim() !== '' ? 'sí' : 'no',
          order.id
        ]);
      }
      
      console.log('Tabla ordenes actualizada correctamente con el nuevo esquema');
    } else {
      console.log('La tabla ordenes ya tiene la estructura correcta');
    }

    await db.execute(`
      CREATE TABLE IF NOT EXISTS visitas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_orden INTEGER,
        fecha_visita TEXT,
        observaciones TEXT,
        FOREIGN KEY (id_orden) REFERENCES ordenes(id)
      )
    `);

    // Verificar si hay barrios y agregarlos si es necesario
    const { rows } = await db.execute('SELECT COUNT(*) as count FROM barrios');
    if (rows[0].count === 0) {
      await db.execute(`
        INSERT INTO barrios (nombre) VALUES 
        ('San Isidro'), ('Acassuso'), ('Beccar'), 
        ('Boulogne Sur Mer'), ('Martínez'), ('Villa Adelina'),
        ('Bajo San Isidro'), ('La Calabria'), ('Barrancas de San Isidro'),
        ('Barrio Parque Aguirre'), ('Bajo Beccar'), ('Santa Rita'),
        ('Las Lomas'), ('La Cava'), ('Santa Rosa'), ('El Congo'),
        ('Ombú'), ('Covicom'), ('Los Perales'), ('San Cayetano')
      `);
    }
    console.log('Conectado a Turso y tablas creadas/verificadas correctamente');
  } catch (err) {
    console.error('Error al conectar o crear tablas:', err);
  }
})();

// Importar y usar las rutas correctamente
const clientesRoutes = require('./routes/clientes');
const ordenesRoutes = require('./routes/ordenes');
const visitasRoutes = require('./routes/visitas');
const estadisticasRoutes = require('./routes/estadisticas');

app.use('/api/clientes', clientesRoutes);
app.use('/api/ordenes', ordenesRoutes);
app.use('/api/visitas', visitasRoutes);
app.use('/api/estadisticas', estadisticasRoutes);

// Ruta para servir el archivo index.html para cualquier petición que no sea de API
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});

// Ya no incluimos db en este objeto, porque lo exportamos antes
exports.app = app;