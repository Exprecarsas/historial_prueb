document.addEventListener('DOMContentLoaded', function () {
    // ====== Config ======
    const SCANNER_DELAY_MS = 400; // tiempo de espera tras última tecla del escáner

    // ====== Estado ======
    let globalUnitsScanned = 0; // Contador global de unidades escaneadas
    let codigosCorrectos = []; // Códigos escaneados correctamente
    let barcodeTimeout = null; // Variable para almacenar el temporizador
    let audioContext = null; // Contexto de audio para generar tonos

    // ====== Audio ======
    // Inicializar contexto de audio para generar tonos
    function initializeAudioContext() {
        if (!audioContext) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.debug('AudioContext no disponible:', e);
            }
        }
    }

    // Generar un tono con Web Audio API (con guardas para evitar errores)
    function playTone(frequency, duration, type = 'sine', volume = 0.3) {
        try {
            if (!audioContext) initializeAudioContext();
            if (!audioContext) return; // si sigue bloqueado por permisos, salir silenciosamente

            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.type = type;
            oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
            gainNode.gain.value = volume;
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.start();
            setTimeout(() => {
                oscillator.stop();
                oscillator.disconnect();
                gainNode.disconnect();
            }, duration);
        } catch (e) {
            console.debug('No se pudo reproducir tono:', e);
        }
    }

    // Habilitar contexto de audio al hacer clic en el primer evento (para dispositivos móviles)
    document.body.addEventListener('click', initializeAudioContext, { once: true });

    // ====== Persistencia ======
    // Guardar progreso comprimido en localStorage
    function saveProgressToLocalStorage() {
        try {
            const progressData = {
                globalUnitsScanned: globalUnitsScanned,
                codigosCorrectos: codigosCorrectos // Guardar códigos correctos
            };
            const compressedData = LZString.compress(JSON.stringify(progressData));
            localStorage.setItem('scanProgress', compressedData);
            // console.log("Datos comprimidos guardados en localStorage:", compressedData);
        } catch (e) {
            console.warn('No se pudo guardar en localStorage:', e);
        }
    }

    // Restaurar progreso desde localStorage y descomprimir los datos
    function restoreProgressFromLocalStorage() {
        try {
            const savedData = localStorage.getItem('scanProgress');
            if (!savedData) {
                console.log("No se encontraron datos guardados en localStorage.");
                return;
            }
            const decompressedData = LZString.decompress(savedData);
            if (!decompressedData) return; // si está corrupto, salir
            const parsedData = JSON.parse(decompressedData) || {};

            globalUnitsScanned = parsedData.globalUnitsScanned || 0; // Restaurar contador global
            codigosCorrectos = Array.isArray(parsedData.codigosCorrectos) ? parsedData.codigosCorrectos : []; // Restaurar códigos correctos

            // Actualizar la interfaz con el contador restaurado
            updateGlobalCounter();

            // Volver a mostrar los códigos restaurados en la tabla
            limpiarTabla();
            codigosCorrectos.forEach((item, index) => {
                agregarCodigoATabla(item.codigo, item.hora, index + 1);
            });
        } catch (e) {
            console.warn('No se pudo restaurar localStorage; limpiando clave:', e);
            localStorage.removeItem('scanProgress');
        }
    }

    // ====== UI ======
    function getTablaTbody() {
        const tabla = document.getElementById('tabla-codigos');
        return tabla ? tabla.getElementsByTagName('tbody')[0] : null;
    }

    function updateGlobalCounter() {
        const globalCounterElement = document.getElementById('global-counter');
        if (globalCounterElement) {
            globalCounterElement.innerText = `Unidades Escaneadas: ${globalUnitsScanned}`;
        }
    }

    // Función para limpiar el campo de código de barras (reutilizada)
    function clearBarcodeInput() {
        const el = document.getElementById('barcodeInput');
        if (el) el.value = '';
    }

    // Función para formatear la hora en formato de 12 horas con AM/PM y segundos
    function obtenerHoraFormateada() {
        const ahora = new Date();
        let horas = ahora.getHours();
        let minutos = ahora.getMinutes();
        let segundos = ahora.getSeconds();
        const ampm = horas >= 12 ? 'PM' : 'AM';

        horas = horas % 12;
        horas = horas ? horas : 12; // El "0" se convierte en "12"
        minutos = minutos < 10 ? '0' + minutos : minutos;
        segundos = segundos < 10 ? '0' + segundos : segundos;

        return `${horas}:${minutos}:${segundos} ${ampm}`;
    }

    // Llamar a esta función cada vez que se escanee un código correctamente
    updateGlobalCounter();

    // ====== Lógica de escaneo ======
    // Función para manejar el escaneo de códigos (sin validación)
    function handleBarcodeScan(scannedCode) {
        const code = String(scannedCode || '').trim();
        if (!code) return;

        const currentTime = obtenerHoraFormateada(); // Obtener la hora formateada en 12 horas AM/PM

        // Registrar el código en el historial sin validar
        codigosCorrectos.push({
            codigo: code,
            hora: currentTime // Almacenar la hora de escaneo
        });

        globalUnitsScanned += 1; // Incrementar el contador global de unidades escaneadas

        // Actualizar el contador global en la interfaz
        updateGlobalCounter();

        // Mostrar retroalimentación sonora de éxito
        playTone(880, 120, 'sine', 0.25); // Tono de éxito (más corto/suave)

        // Guardar el progreso después de escanear o ingresar un código
        saveProgressToLocalStorage();

        // Añadir el código escaneado a la tabla
        agregarCodigoATabla(code, currentTime, codigosCorrectos.length);

        // Limpiar el campo de entrada
        clearBarcodeInput();
    }

    // Función para agregar un código a la tabla
    function agregarCodigoATabla(codigo, hora, numeroFila) {
        const tbody = getTablaTbody();
        if (!tbody) return;

        const nuevaFila = tbody.insertRow(); // Insertar una nueva fila al final de la tabla

        // Insertar las celdas correspondientes (Número, Código, Hora)
        const celdaNumero = nuevaFila.insertCell(0);
        const celdaCodigo = nuevaFila.insertCell(1);
        const celdaHora = nuevaFila.insertCell(2);

        // Asignar los valores a las celdas
        celdaNumero.textContent = numeroFila; // El número será el tamaño del array + 1
        celdaCodigo.textContent = codigo;
        celdaHora.textContent = hora;
    }

    // Función para limpiar la tabla
    function limpiarTabla() {
        const tbody = getTablaTbody();
        if (!tbody) return;
        while (tbody.rows.length > 0) {
            tbody.deleteRow(0); // Eliminar cada fila de la tabla
        }
    }

    // ====== Listeners de UI ======
    // Manejar el evento de entrada en el campo de código de barras (debounce para pistola)
    const inputEl = document.getElementById('barcodeInput');
    if (inputEl) {
        inputEl.addEventListener('input', () => {
            const barcodeValue = inputEl.value.trim();

            // Limpiar el temporizador anterior si el usuario sigue escribiendo
            if (barcodeTimeout) clearTimeout(barcodeTimeout);

            // Si el campo no está vacío, esperar SCANNER_DELAY_MS y simular Enter
            if (barcodeValue !== '') {
                barcodeTimeout = setTimeout(() => {
                    handleBarcodeScan(barcodeValue);
                    clearBarcodeInput();
                }, SCANNER_DELAY_MS);
            }
        });

        // Soporte si el escáner envía Enter al final
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (barcodeTimeout) clearTimeout(barcodeTimeout);
                handleBarcodeScan(inputEl.value);
            }
        });
    }

    // Mostrar el modal para ingresar datos cuando se hace clic en "Descargar"
    const btnAbrir = document.getElementById('abrir-modal');
    if (btnAbrir) {
        btnAbrir.addEventListener('click', () => {
            const modal = document.getElementById('modal');
            if (modal) modal.style.display = 'flex'; // Mostrar el modal

            const fechaEl = document.getElementById('fecha');
            if (fechaEl) {
                // si es <input type="date"> usa yyyy-mm-dd
                if (fechaEl.type === 'date') {
                    const d = new Date();
                    const pad = (n) => (n < 10 ? '0' + n : n);
                    fechaEl.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                } else {
                    fechaEl.value = new Date().toLocaleDateString();
                }
            }
        });
    }

    // Cerrar el modal cuando se hace clic en el botón "Cerrar"
    const btnCerrar = document.getElementById('cerrar-modal');
    if (btnCerrar) {
        btnCerrar.addEventListener('click', () => {
            const modal = document.getElementById('modal');
            if (modal) modal.style.display = 'none'; // Ocultar el modal
        });
    }

    const btnTerminar = document.getElementById('terminar-proceso');
    if (btnTerminar) {
        btnTerminar.addEventListener('click', function () {
            // Mostrar confirmación antes de continuar
            const confirmacion = confirm("¿Estás seguro de que deseas finalizar el proceso? Esto eliminará todos los datos escaneados.");

            if (confirmacion) {
                // Cancelar temporizador pendiente
                if (barcodeTimeout) {
                    clearTimeout(barcodeTimeout);
                    barcodeTimeout = null;
                }

                // Si el usuario confirma, eliminar los datos
                localStorage.removeItem('scanProgress'); // Limpiar localStorage

                // Vaciar arrays y contador
                globalUnitsScanned = 0;
                codigosCorrectos = [];

                // Actualizar la interfaz de usuario
                updateGlobalCounter();
                limpiarTabla();

                // Guardar el estado limpio en localStorage (opcional)
                saveProgressToLocalStorage();

                alert('Proceso finalizado. Los datos se han eliminado.');
            } else {
                console.log('El usuario canceló la finalización del proceso.');
            }
        });
    }

    // Generar reporte en Excel solo con el historial de códigos escaneados
    const btnReporte = document.getElementById('generar-reporte');
    if (btnReporte) {
        btnReporte.addEventListener('click', () => {
            const placaEl = document.getElementById('placa');
            const remitenteEl = document.getElementById('remitente');
            const fechaEl = document.getElementById('fecha');

            const placa = placaEl ? placaEl.value.trim() : '';
            const remitente = remitenteEl ? remitenteEl.value.trim() : '';
            const fecha = fechaEl ? fechaEl.value.trim() : '';

            if (!placa || !remitente) {
                alert("Por favor, completa todos los campos.");
                return;
            }
            if (!codigosCorrectos.length) {
                alert("No hay códigos para exportar.");
                return;
            }

            const reportData = [
                ['Placa de Vehículo', placa],
                ['Remitente', remitente],
                ['Fecha de Descargue', fecha || new Date().toLocaleDateString()],
                [],
                // Encabezados alineados con los datos que se agregan abajo:
                ['N°', 'Código Escaneado', 'Hora de Escaneo']
            ];

            // Agregar los códigos escaneados al reporte
            codigosCorrectos.forEach((item, index) => {
                reportData.push([index + 1, item.codigo, item.hora]);
            });

            const ws = XLSX.utils.aoa_to_sheet(reportData);
            // Anchos de columna sugeridos
            ws['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 16 }];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Historial Escaneo');

            // Reemplazar espacios y caracteres especiales en el nombre de archivo
            const remitenteCleaned = (remitente || '').replace(/[^a-zA-Z0-9\-_.]/g, '_');
            const fechaCleaned = (fecha || new Date().toLocaleDateString()).replace(/\//g, '-'); // Cambiar / por -

            // Nombre de archivo personalizado con remitente y fecha
            const fileName = `reporte_${remitenteCleaned}_${fechaCleaned}.xlsx`;

            XLSX.writeFile(wb, fileName);

            alert('Reporte generado correctamente.');
            const modal = document.getElementById('modal');
            if (modal) modal.style.display = 'none';
        });
    }

    // ====== Inicio ======
    restoreProgressFromLocalStorage();
});
