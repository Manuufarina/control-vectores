const express = require('express');
const serverless = require('serverless-http');
const clientes = require('../routes/clientes');
const ordenes = require('../routes/ordenes');
const visitas = require('../routes/visitas');
const estadisticas = require('../routes/estadisticas');

const app = express();
app.use(express.json());

// Configuración correcta de rutas para la función serverless
app.use('/clientes', clientes);
app.use('/ordenes', ordenes);
app.use('/visitas', visitas);
app.use('/estadisticas', estadisticas);

module.exports = app;
exports.handler = serverless(app);