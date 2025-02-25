let chartPagos, chartServicios, chartTecnicos;
let map;

function initMap() {}

function showNotification(message, isError = false) {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = `notification ${isError ? 'error' : ''}`;
    notification.textContent = message;
    container.appendChild(notification);
    
    // Aumenta el tiempo de visualización de las notificaciones a 5 segundos
    setTimeout(() => notification.remove(), 5000);
}

async function cargarBarrios() {
    try {
        const response = await fetch('/api/clientes/barrios');
        const barrios = await response.json();
        const select = document.getElementById('barrioCliente');
        select.innerHTML = '<option value="">Seleccione un barrio</option>';
        barrios.sort((a, b) => a.nombre.localeCompare(b.nombre));
        barrios.forEach(barrio => {
            const option = document.createElement('option');
            option.value = barrio.id;
            option.textContent = barrio.nombre;
            select.appendChild(option);
        });
    } catch (error) {
        showNotification('Error al cargar barrios: ' + error.message, true);
    }
}

function toggleNuevoBarrio() {
    const container = document.getElementById('nuevoBarrioContainer');
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
}

async function agregarBarrio() {
    const nombre = document.getElementById('nuevoBarrio').value.trim();
    if (!nombre) {
        showNotification('Ingrese el nombre del barrio', true);
        return;
    }

    try {
        const response = await fetch('/api/clientes/barrios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre })
        });
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        showNotification('Barrio agregado correctamente');
        cargarBarrios();
        document.getElementById('nuevoBarrio').value = '';
        toggleNuevoBarrio();
    } catch (error) {
        showNotification('Error al agregar barrio: ' + error.message, true);
    }
}

function mostrarFormularioCliente() {
    document.getElementById('formClienteContainer').style.display = 'block';
    cargarBarrios();
}

document.getElementById('formCliente').addEventListener('submit', async function(e) {
    e.preventDefault();
    const data = {
        nombre: document.getElementById('nombreCliente').value,
        direccion: document.getElementById('direccionCliente').value,
        telefono: document.getElementById('telefonoCliente').value,
        mail: document.getElementById('mailCliente').value,
        dni: document.getElementById('dniCliente').value,
        m2: document.getElementById('m2Cliente').value,
        id_barrio: document.getElementById('barrioCliente').value || null
    };

    const response = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    const result = await response.json();
    if (response.ok) {
        showNotification(`Cliente creado con código: ${result.codigo}`);
        document.getElementById('formClienteContainer').style.display = 'none';
        document.getElementById('formCliente').reset();
        buscarCliente();
    } else {
        showNotification(result.error, true);
    }
});

async function buscarCliente() {
    const query = document.getElementById('buscarCliente').value;
    const response = await fetch(`/api/clientes/buscar?q=${query}`);
    const clientes = await response.json();
    const lista = document.getElementById('listaClientes');
    lista.innerHTML = clientes.map(c => 
        `<p>${c.nombre} (Código: ${c.codigo}, DNI: ${c.dni}${c.barrio ? ', Barrio: ' + c.barrio : ''}) <button class="material-btn" onclick="verFichaCliente(${c.id})"><span class="material-icons">visibility</span> Ver Ficha</button></p>`
    ).join('');
}

async function verFichaCliente(id) {
    const response = await fetch(`/api/clientes/${id}/historial`);
    const data = await response.json();
    
    const datosCliente = document.getElementById('datosCliente');
    datosCliente.innerHTML = `
        <p>Código: ${data.cliente.codigo}</p>
        <p>Nombre: ${data.cliente.nombre}</p>
        <p>Dirección: ${data.cliente.direccion}</p>
        <p>Barrio/Localidad: ${data.cliente.barrio || 'No especificado'}</p>
        <p>Teléfono: ${data.cliente.telefono || 'No disponible'}</p>
        <p>Mail: ${data.cliente.mail || 'No disponible'}</p>
        <p>DNI: ${data.cliente.dni}</p>
        <p>Metros Cuadrados: ${data.cliente.m2 ? data.cliente.m2 + ' m²' : 'No especificado'}</p>
    `;
    datosCliente.dataset.id = id;

    const geocoder = new google.maps.Geocoder();
    const mapContainer = document.getElementById('mapaCliente');
    map = new google.maps.Map(mapContainer, {
        zoom: 15,
        center: { lat: -34.467, lng: -58.517 }
    });

    geocoder.geocode({ address: `${data.cliente.direccion}, ${data.cliente.barrio || 'San Isidro'}, San Isidro, Buenos Aires, Argentina` }, (results, status) => {
        if (status === 'OK' && results[0]) {
            map.setCenter(results[0].geometry.location);
            new google.maps.Marker({
                map: map,
                position: results[0].geometry.location
            });
        } else {
            mapContainer.innerHTML = '<p>No se pudo encontrar la ubicación</p>';
        }
    });

    const historial = document.getElementById('historialOrdenes');
    historial.innerHTML = data.ordenes.map(o => `
        <div class="estado-${o.estado.toLowerCase().replace(' ', '-')}">
            <p>Orden #${o.id} - ${o.tipo_servicio} (${o.horario_trabajo}) - Estado: ${o.estado}</p>
            <p>Técnicos: ${o.tecnicos}</p>
            <p>Visitas:</p>
            <ul>${o.visitas.map(v => `
                <li>${v.fecha_visita}: ${v.observaciones} 
                    <button class="material-btn edit" onclick="editarVisita(${v.id}, '${v.fecha_visita}', '${v.observaciones}')"><span class="material-icons">edit</span> Editar</button>
                    <button class="material-btn delete" onclick="eliminarVisita(${v.id})"><span class="material-icons">delete</span> Eliminar</button>
                </li>`).join('')}
            </ul>
            <button class="material-btn edit" onclick="editarOrden(${o.id}, '${o.tipo_servicio}', '${o.abono}', '${o.numero_recibo}', '${o.dependencia_municipal}', '${o.horario_trabajo}', '${o.tecnicos}', '${o.estado}')"><span class="material-icons">edit</span> Editar Orden</button>
            <button class="material-btn delete" onclick="eliminarOrden(${o.id})"><span class="material-icons">delete</span> Eliminar Orden</button>
            <button class="material-btn" onclick="mostrarFormularioVisita(${o.id})"><span class="material-icons">add_circle</span> Agregar Visita</button>
            <button class="material-btn pdf" onclick="descargarPDF(${o.id})"><span class="material-icons">picture_as_pdf</span> Descargar PDF</button>
        </div>
    `).join('') || '<p>No hay órdenes registradas.</p>';

    document.getElementById('fichaCliente').style.display = 'block';
}

function mostrarFormularioOrden(idOrden = null, tipoServicio = '', abono = '', numeroRecibo = '', dependencia = '', horario = '', tecnicos = '', estado = 'Pendiente') {
    const formContainer = document.getElementById('formOrdenContainer');
    const titulo = document.getElementById('tituloFormOrden');
    const form = document.getElementById('formOrden');
    
    if (idOrden) {
        titulo.textContent = 'Editar Orden de Trabajo';
        document.getElementById('idOrden').value = idOrden;
        document.getElementById('tipoServicio').value = tipoServicio;
        document.querySelector(`input[name="abono"][value="${abono}"]`).checked = true;
        document.getElementById('numeroRecibo').value = numeroRecibo;
        document.getElementById('dependencia').value = dependencia;
        document.getElementById('horario').value = horario;
        document.getElementById('tecnicos').value = tecnicos;
        document.getElementById('estadoOrden').value = estado;
        toggleCamposAbono(abono);
    } else {
        titulo.textContent = 'Crear Orden de Trabajo';
        document.getElementById('idOrden').value = '';
        form.reset();
        document.getElementById('idClienteOrden').value = document.getElementById('datosCliente').dataset.id;
        document.getElementById('estadoOrden').value = 'Pendiente';
        
        // Establecer valor predeterminado para abono
        if (document.querySelector('input[name="abono"][value="no"]')) {
            document.querySelector('input[name="abono"][value="no"]').checked = true;
            toggleCamposAbono('no');
        }
    }
    formContainer.style.display = 'block';
}

function mostrarFormularioVisita(idOrden, idVisita = null, fechaVisita = '', observaciones = '') {
    const formContainer = document.getElementById('formVisitaContainer');
    const titulo = document.getElementById('tituloFormVisita');
    const form = document.getElementById('formVisita');
    
    if (idVisita) {
        titulo.textContent = 'Editar Visita';
        document.getElementById('idVisita').value = idVisita;
        document.getElementById('fechaVisita').value = fechaVisita;
        document.getElementById('observaciones').value = observaciones;
    } else {
        titulo.textContent = 'Agregar Visita';
        document.getElementById('idVisita').value = '';
        form.reset();
        document.getElementById('idOrdenVisita').value = idOrden;
    }
    formContainer.style.display = 'block';
}

document.getElementById('formOrden').addEventListener('submit', async function(e) {
    e.preventDefault();
    try {
        const idOrden = document.getElementById('idOrden').value;
        
        // Verificar que se haya seleccionado una opción de abono
        const abonoChecked = document.querySelector('input[name="abono"]:checked');
        if (!abonoChecked) {
            showNotification('Debe seleccionar si abonó o no', true);
            return;
        }
        
        const abono = abonoChecked.value;
        const numeroRecibo = document.getElementById('numeroRecibo').value;
        
        // Validar que haya número de recibo si abonó
        if (abono === 'sí' && (!numeroRecibo || numeroRecibo.trim() === '')) {
            showNotification('El número de recibo es obligatorio si se abona', true);
            return;
        }
        
        // Preparar datos del formulario
        const data = {
            tipo_servicio: document.getElementById('tipoServicio').value,
            abono,
            numero_recibo: numeroRecibo || '',
            dependencia_municipal: document.getElementById('dependencia').value || '',
            horario_trabajo: document.getElementById('horario').value,
            tecnicos: document.getElementById('tecnicos').value,
            estado: document.getElementById('estadoOrden').value
        };
        
        // Si es una orden nueva, agregar el id del cliente
        if (!idOrden) {
            data.id_cliente = document.getElementById('idClienteOrden').value;
            if (!data.id_cliente) {
                showNotification('Error: No se pudo identificar el cliente', true);
                return;
            }
        }
        
        // Preparar URL y método según sea crear o editar
        const url = idOrden ? `/api/ordenes/${idOrden}` : '/api/ordenes';
        const method = idOrden ? 'PUT' : 'POST';

        // Enviar solicitud al servidor
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        // Verificar si la respuesta es exitosa
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error del servidor: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Mostrar mensaje de éxito y actualizar la vista
        showNotification(result.message || 'Operación completada con éxito');
        document.getElementById('formOrdenContainer').style.display = 'none';
        
        // Actualizar la vista del cliente y estadísticas
        const clienteId = document.getElementById('datosCliente').dataset.id;
        await verFichaCliente(clienteId);
        await cargarEstadisticas();
        
    } catch (error) {
        console.error('Error al procesar el formulario de órdenes:', error);
        showNotification(`Error: ${error.message}`, true);
    }
});

document.getElementById('formVisita').addEventListener('submit', async function(e) {
    e.preventDefault();
    const idVisita = document.getElementById('idVisita').value;
    const fechaVisita = document.getElementById('fechaVisita').value;
    const observaciones = document.getElementById('observaciones').value;
    const data = {
        fecha_visita: fechaVisita,
        observaciones
    };
    const url = idVisita ? `/api/visitas/${idVisita}` : '/api/visitas';
    const method = idVisita ? 'PUT' : 'POST';
    if (!idVisita) data.id_orden = document.getElementById('idOrdenVisita').value;

    const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    const result = await response.json();
    if (response.ok) {
        showNotification(result.message);
        document.getElementById('formVisitaContainer').style.display = 'none';
        verFichaCliente(document.getElementById('datosCliente').dataset.id);

        const eventStart = new Date(fechaVisita).toISOString();
        const eventEnd = new Date(new Date(fechaVisita).getTime() + 60 * 60 * 1000).toISOString();
        const calendarUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=Visita%20Control%20Vectores&dates=${eventStart.replace(/[-:]/g, '')}/${eventEnd.replace(/[-:]/g, '')}&details=${encodeURIComponent(observaciones)}&location=${encodeURIComponent(document.getElementById('datosCliente').querySelector('p:nth-child(3)').textContent.split(': ')[1] + ', ' + (document.getElementById('datosCliente').querySelector('p:nth-child(4)').textContent.split(': ')[1] || 'San Isidro'))}`;
        window.open(calendarUrl, '_blank');
    } else {
        showNotification(result.error, true);
    }
});

async function eliminarOrden(id) {
    if (confirm('¿Seguro que quieres eliminar esta orden? Esto también eliminará todas sus visitas.')) {
        const response = await fetch(`/api/ordenes/${id}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (response.ok) {
            showNotification(result.message);
            verFichaCliente(document.getElementById('datosCliente').dataset.id);
            cargarEstadisticas();
        } else {
            showNotification(result.error, true);
        }
    }
}

async function eliminarVisita(id) {
    if (confirm('¿Seguro que quieres eliminar esta visita?')) {
        const response = await fetch(`/api/visitas/${id}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (response.ok) {
            showNotification(result.message);
            verFichaCliente(document.getElementById('datosCliente').dataset.id);
        } else {
            showNotification(result.error, true);
        }
    }
}

function toggleCamposAbono(abono) {
    document.getElementById('campoRecibo').style.display = abono === 'sí' ? 'block' : 'none';
    document.getElementById('campoDependencia').style.display = abono === 'no' ? 'block' : 'none';
}
document.querySelectorAll('input[name="abono"]').forEach(radio => {
    radio.addEventListener('change', function() {
        toggleCamposAbono(this.value);
    });
});

function editarOrden(id, tipoServicio, abono, numeroRecibo, dependencia, horario, tecnicos, estado) {
    mostrarFormularioOrden(id, tipoServicio, abono, numeroRecibo, dependencia, horario, tecnicos, estado);
}

function editarVisita(id, fechaVisita, observaciones) {
    mostrarFormularioVisita(null, id, fechaVisita, observaciones);
}

async function descargarPDF(idOrden) {
    const response = await fetch(`/api/ordenes/${idOrden}/pdf`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orden_${idOrden}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
}

async function exportarCSV() {
    const idCliente = document.getElementById('datosCliente').dataset.id;
    const response = await fetch(`/api/ordenes/cliente/${idCliente}`);
    const ordenes = await response.json();

    const headers = ['ID', 'Tipo de Servicio', 'Abonó', 'Número de Recibo', 'Dependencia Municipal', 'Horario', 'Técnicos', 'Estado'];
    const csvRows = [headers.join(',')];
    ordenes.forEach(o => {
        const row = [
            o.id,
            o.tipo_servicio,
            o.abono,
            o.numero_recibo || '',
            o.dependencia_municipal || '',
            o.horario_trabajo,
            o.tecnicos,
            o.estado
        ].map(value => `"${value}"`).join(',');
        csvRows.push(row);
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ordenes_cliente_${idCliente}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    showNotification('Órdenes exportadas a CSV');
}

async function cargarEstadisticas() {
    try {
        const fechaInicio = document.getElementById('fechaInicio').value;
        const fechaFin = document.getElementById('fechaFin').value;
        const query = fechaInicio && fechaFin ? `?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}` : '';
        const response = await fetch(`/api/estadisticas${query}`);
        
        if (!response.ok) {
            throw new Error(`Error al cargar estadísticas: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();

        // Verificar que todos los datos necesarios estén disponibles
        if (!data || !data.porTipoServicio || !Array.isArray(data.porTipoServicio)) {
            showNotification('Datos de estadísticas incompletos', true);
            return;
        }

        // Destruir gráficos existentes si los hay
        if (chartPagos) chartPagos.destroy();
        if (chartServicios) chartServicios.destroy();
        if (chartTecnicos) chartTecnicos.destroy();

        // Calcular pagados con verificación de datos
        const sinPago = data.sinPago || 0;
        const eximidos = data.eximidos || 0;
        const totalServicios = data.porTipoServicio.reduce((sum, item) => sum + (item.cantidad || 0), 0);
        const pagados = Math.max(0, totalServicios - sinPago - eximidos);

        const ctxPagos = document.getElementById('chartPagos').getContext('2d');
        chartPagos = new Chart(ctxPagos, {
            type: 'pie',
            data: {
                labels: ['Sin Pago', 'Eximidos', 'Pagados'],
                datasets: [{
                    data: [sinPago, eximidos, pagados],
                    backgroundColor: ['#f44336', '#ff9800', '#4caf50']
                }]
            },
            options: {
                plugins: {
                    title: { display: true, text: 'Estado de Pagos' }
                }
            }
        });

        // Verificar que haya datos de servicios para mostrar
        if (data.porTipoServicio && data.porTipoServicio.length > 0) {
            const ctxServicios = document.getElementById('chartServicios').getContext('2d');
            chartServicios = new Chart(ctxServicios, {
                type: 'bar',
                data: {
                    labels: data.porTipoServicio.map(item => item.tipo_servicio || 'Sin especificar'),
                    datasets: [{
                        label: 'Cantidad',
                        data: data.porTipoServicio.map(item => item.cantidad || 0),
                        backgroundColor: '#2196f3'
                    }]
                },
                options: {
                    plugins: {
                        title: { display: true, text: 'Trabajos por Tipo de Servicio' }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }

        // Verificar que haya datos de técnicos para mostrar
        if (data.tecnicosActivos && data.tecnicosActivos.length > 0) {
            const ctxTecnicos = document.getElementById('chartTecnicos').getContext('2d');
            chartTecnicos = new Chart(ctxTecnicos, {
                type: 'bar',
                data: {
                    labels: data.tecnicosActivos.map(item => item.tecnicos || 'Sin asignar'),
                    datasets: [{
                        label: 'Cantidad de Trabajos',
                        data: data.tecnicosActivos.map(item => item.cantidad || 0),
                        backgroundColor: '#9c27b0'
                    }]
                },
                options: {
                    plugins: {
                        title: { display: true, text: 'Técnicos Más Activos (Top 5)' }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
        showNotification(`Error al cargar estadísticas: ${error.message}`, true);
    }
}

window.onload = cargarEstadisticas;

// Actualización para agregar al final del archivo scripts.js
// O puedes integrar estas funciones en donde corresponda

// Función para verificar DNI mientras el usuario escribe
async function verificarDniExistente() {
    const dni = document.getElementById('dniCliente').value.trim();
    if (dni.length > 5) { // Verificar solo si el DNI tiene suficientes caracteres
        try {
            const response = await fetch(`/api/clientes/verificar-dni/${dni}`);
            const data = await response.json();
            
            const dniInput = document.getElementById('dniCliente');
            const warningElement = document.getElementById('dniWarning');
            
            if (data.exists) {
                // Si el DNI ya existe, mostrar advertencia
                if (!warningElement) {
                    const warning = document.createElement('div');
                    warning.id = 'dniWarning';
                    warning.className = 'warning-text';
                    warning.style.color = 'red';
                    warning.style.marginTop = '5px';
                    warning.innerHTML = `¡Este DNI ya está registrado! <a href="#" onclick="verFichaCliente(${data.clienteId}); return false;">Ver cliente existente</a>`;
                    dniInput.parentNode.appendChild(warning);
                }
                dniInput.style.borderColor = 'red';
            } else {
                // Si el DNI no existe, quitar advertencia si existe
                if (warningElement) {
                    warningElement.remove();
                }
                dniInput.style.borderColor = '';
            }
        } catch (error) {
            console.error('Error al verificar DNI:', error);
        }
    }
}

// Modificar el evento submit del formulario para verificar DNI antes de enviar
// Reemplaza el addEventListener existente por este:
document.getElementById('formCliente').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Verificar DNI antes de enviar
    const dni = document.getElementById('dniCliente').value.trim();
    const response = await fetch(`/api/clientes/verificar-dni/${dni}`);
    const data = await response.json();
    
    if (data.exists) {
        showNotification('Error: Este DNI ya está registrado en el sistema', true);
        return;
    }
    
    const clienteData = {
        nombre: document.getElementById('nombreCliente').value,
        direccion: document.getElementById('direccionCliente').value,
        telefono: document.getElementById('telefonoCliente').value,
        mail: document.getElementById('mailCliente').value,
        dni: dni,
        m2: document.getElementById('m2Cliente').value,
        id_barrio: document.getElementById('barrioCliente').value || null
    };

    const submitResponse = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clienteData)
    });
    const result = await submitResponse.json();
    
    if (submitResponse.ok) {
        showNotification(`Cliente creado con código: ${result.codigo}`);
        document.getElementById('formClienteContainer').style.display = 'none';
        document.getElementById('formCliente').reset();
        buscarCliente();
    } else {
        showNotification(result.error, true);
    }
});

// Agregar evento para verificar DNI en tiempo real
// Agrega esta línea en algún lugar apropiado, como en la función mostrarFormularioCliente
// O simplemente agrégala al final del archivo
document.getElementById('dniCliente').addEventListener('input', verificarDniExistente);

// Agregar estas funciones al archivo scripts.js

/**
 * Cierra el formulario de orden y reinicia sus campos
 */
function cerrarFormularioOrden() {
    // Ocultar el formulario
    document.getElementById('formOrdenContainer').style.display = 'none';
    
    // Reiniciar el formulario
    document.getElementById('formOrden').reset();
    
    // Eliminar cualquier estilo de error en los campos
    const inputs = document.querySelectorAll('#formOrden input, #formOrden select');
    inputs.forEach(input => {
        input.style.borderColor = '';
    });
    
    // Ocultar campos condicionales
    document.getElementById('campoRecibo').style.display = 'none';
    document.getElementById('campoDependencia').style.display = 'none';
}

/**
 * Cierra el formulario de visita y reinicia sus campos
 */
function cerrarFormularioVisita() {
    // Ocultar el formulario
    document.getElementById('formVisitaContainer').style.display = 'none';
    
    // Reiniciar el formulario
    document.getElementById('formVisita').reset();
    
    // Eliminar cualquier estilo de error en los campos
    const inputs = document.querySelectorAll('#formVisita input, #formVisita textarea');
    inputs.forEach(input => {
        input.style.borderColor = '';
    });
}

// Opcionalmente: Función para cerrar cualquier formulario abierto cuando se presiona ESC
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        if (document.getElementById('formClienteContainer').style.display !== 'none') {
            cerrarFormularioCliente();
        } else if (document.getElementById('formOrdenContainer').style.display !== 'none') {
            cerrarFormularioOrden();
        } else if (document.getElementById('formVisitaContainer').style.display !== 'none') {
            cerrarFormularioVisita();
        }
    }
});

// Agregar esta función al archivo scripts.js

/**
 * Cierra el formulario de cliente y reinicia sus campos
 */
function cerrarFormularioCliente() {
    // Ocultar el formulario
    document.getElementById('formClienteContainer').style.display = 'none';
    
    // Reiniciar el formulario
    document.getElementById('formCliente').reset();
    
    // Eliminar cualquier estilo de error en los campos
    const inputs = document.querySelectorAll('#formCliente input, #formCliente select');
    inputs.forEach(input => {
        input.style.borderColor = '';
    });
    
    // Eliminar advertencias que puedan existir
    const dniWarning = document.getElementById('dniWarning');
    if (dniWarning) {
        dniWarning.remove();
    }
    
    // Cerrar el contenedor de nuevo barrio si está abierto
    document.getElementById('nuevoBarrioContainer').style.display = 'none';
}

// También necesitamos agregar botones y funciones similares a los otros formularios 
// como el de órdenes y visitas para mantener la consistencia en la interfaz