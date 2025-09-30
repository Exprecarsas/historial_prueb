document.addEventListener('DOMContentLoaded', function () {
    let globalUnitsScanned = 0; // Contador global de unidades escaneadas
    let codigosCorrectos = []; // Códigos escaneados correctamente
    let barcodeTimeout; // Variable para almacenar el temporizador
    let audioContext; // Contexto de audio para generar tonos

    // Inicializar contexto de audio para generar tonos
    function initializeAudioContext() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    // Generar un tono con Web Audio API
    function playTone(frequency, duration, type = 'sine', volume = 1.5) {
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
        }, duration);
    }

    // Habilitar contexto de audio al hacer clic en el primer evento (para dispositivos móviles)
    document.body.addEventListener('click', initializeAudioContext, { once: true });

    // Guardar progreso comprimido en localStorage
    function saveProgressToLocalStorage() {
        const progressData = {
            globalUnitsScanned: globalUnitsScanned,
            codigosCorrectos: codigosCorrectos // Guardar códigos correctos
        };
        // Comprimir los datos antes de guardarlos
        const compressedData = LZString.compress(JSON.stringify(progressData));
        localStorage.setItem('scanProgress', compressedData); // Guardar los datos comprimidos en localStorage
        console.log("Datos comprimidos guardados en localStorage:", compressedData); // Verificar en consola los datos guardados
    }

    // Restaurar progreso desde localStorage y descomprimir los datos
    function restoreProgressFromLocalStorage() {
        const savedData = localStorage.getItem('scanProgress');
        if (savedData) {
            // Descomprimir los datos antes de usarlos
            const decompressedData = LZString.decompress(savedData);
            const parsedData = JSON.parse(decompressedData);

            globalUnitsScanned = parsedData.globalUnitsScanned || 0; // Restaurar contador global
            codigosCorrectos = parsedData.codigosCorrectos || []; // Restaurar códigos correctos

            // Actualizar la interfaz con el contador restaurado
            updateGlobalCounter();
            console.log("Datos descomprimidos y restaurados de localStorage:", parsedData); // Depuración
            // Volver a mostrar los códigos restaurados en la tabla
            codigosCorrectos.forEach((item, index) => {
                agregarCodigoATabla(item.codigo, item.hora, index + 1);
            });
        } else {
            console.log("No se encontraron datos guardados en localStorage.");
        }
    }

    // Llamar a esta función al cargar la página
    restoreProgressFromLocalStorage();

    // Manejar el evento de entrada en el campo de código de barras
    document.getElementById('barcodeInput').addEventListener('input', (event) => {
        const barcodeValue = document.getElementById('barcodeInput').value.trim();

        // Limpiar el temporizador anterior si el usuario sigue escribiendo
        clearTimeout(barcodeTimeout);

        // Si el campo no está vacío, esperar 1 segundo y luego simular el "Enter"
        if (barcodeValue !== '') {
            barcodeTimeout = setTimeout(() => {
                handleBarcodeScan(barcodeValue); // Llamar a la función que procesa el escaneo
                clearBarcodeInput(); // Limpiar el campo de entrada
            }, 1000); // Esperar 1 segundo
        }
    });

    // Función para limpiar el campo de código de barras (reutilizada)
    function clearBarcodeInput() {
        document.getElementById('barcodeInput').value = '';
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
        minutos = minutos < 10 ? '0' + minutos : minutos; // Añadir un 0 delante si los minutos son menores a 10
        segundos = segundos < 10 ? '0' + segundos : segundos; // Añadir un 0 delante si los segundos son menores a 10

        const horaFormateada = horas + ':' + minutos + ':' + segundos + ' ' + ampm;
        return horaFormateada;
    }

    function updateGlobalCounter() {
        const globalCounterElement = document.getElementById('global-counter');
        globalCounterElement.innerText = `Unidades Escaneadas: ${globalUnitsScanned}`;
    }

    // Llamar a esta función cada vez que se escanee un código correctamente
    updateGlobalCounter();

    // Función para manejar el escaneo de códigos (sin validación)
    function handleBarcodeScan(scannedCode) {
        const currentTime = obtenerHoraFormateada(); // Obtener la hora formateada en 12 horas AM/PM

        // Registrar el código en el historial sin validar
        codigosCorrectos.push({
            codigo: scannedCode,
            hora: currentTime // Almacenar la hora de escaneo
        });

        globalUnitsScanned += 1; // Incrementar el contador global de unidades escaneadas

        // Actualizar el contador global en la interfaz
        updateGlobalCounter();

        // Mostrar retroalimentación visual y sonora de éxito
        playTone(440, 200, 'sine'); // Tono de éxito

        // Guardar el progreso después de escanear o ingresar un código
        saveProgressToLocalStorage();

        // Añadir el código escaneado a la tabla
        agregarCodigoATabla(scannedCode, currentTime, codigosCorrectos.length);

        // Limpiar el campo de entrada
        clearBarcodeInput();
    }
    // Función para agregar un código a la tabla
    function agregarCodigoATabla(codigo, hora, numeroFila) {
        const tabla = document.getElementById('tabla-codigos').getElementsByTagName('tbody')[0];
        const nuevaFila = tabla.insertRow(); // Insertar una nueva fila al final de la tabla

        // Insertar las celdas correspondientes (Número, Código, Hora)
        const celdaNumero = nuevaFila.insertCell(0);
        const celdaCodigo = nuevaFila.insertCell(1);
        const celdaHora = nuevaFila.insertCell(2);

        // Asignar los valores a las celdas
        celdaNumero.innerHTML = numeroFila; // El número será el tamaño del array + 1
        celdaCodigo.innerHTML = codigo;
        celdaHora.innerHTML = hora;
    }

    // Mostrar el modal para ingresar datos cuando se hace clic en "Descargar"
    document.getElementById('abrir-modal').addEventListener('click', () => {
        const modal = document.getElementById('modal');
        modal.style.display = 'flex'; // Mostrar el modal
        document.getElementById('fecha').value = new Date().toLocaleDateString(); // Poner la fecha actual
    });


    // Cerrar el modal cuando se hace clic en el botón "Cerrar"
    document.getElementById('cerrar-modal').addEventListener('click', () => {
        const modal = document.getElementById('modal');
        modal.style.display = 'none'; // Ocultar el modal
    });

    document.getElementById('terminar-proceso').addEventListener('click', function () {
        // Mostrar confirmación antes de continuar
        const confirmacion = confirm("¿Estás seguro de que deseas finalizar el proceso? Esto eliminará todos los datos escaneados.");

        if (confirmacion) {
            // Si el usuario confirma, eliminar los datos
            localStorage.removeItem('scanProgress'); // Limpiar localStorage

            // Vaciar los arrays de códigos correctos e incorrectos

            globalUnitsScanned = 0;
            codigosCorrectos = []; // Vaciar los códigos correctos

            // Actualizar la interfaz de usuario
            updateGlobalCounter();
            // Vaciar la tabla de códigos escaneados
            limpiarTabla();
            // Guardar el estado limpio en localStorage (opcional si quieres guardar el estado vacío)
            saveProgressToLocalStorage();

            alert('Proceso finalizado. Los datos se han eliminado.');
        } else {
            // Si el usuario cancela, no hacer nada
            console.log('El usuario canceló la finalización del proceso.');
        }
    });

    // Función para limpiar la tabla
    function limpiarTabla() {
        const tabla = document.getElementById('tabla-codigos').getElementsByTagName('tbody')[0];
        while (tabla.rows.length > 0) {
            tabla.deleteRow(0); // Eliminar cada fila de la tabla
        }
    }

    // Generar reporte en Excel solo con el historial de códigos escaneados
    document.getElementById('generar-reporte').addEventListener('click', () => {
        const placa = document.getElementById('placa').value;
        const remitente = document.getElementById('remitente').value;
        const fecha = document.getElementById('fecha').value;

        if (!placa || !remitente) {
            alert("Por favor, completa todos los campos.");
            return;
        }

        const reportData = [
            ['Placa de Vehículo', placa],
            ['Remitente', remitente],
            ['Fecha de Descargue', fecha],
            [],
            ['Código Escaneado', 'Hora de Escaneo']
        ];

        // Agregar los códigos escaneados al reporte
        codigosCorrectos.forEach((item, index) => {
            reportData.push([index + 1, item.codigo, item.hora]);
        });

        const ws = XLSX.utils.aoa_to_sheet(reportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Historial Escaneo');
    // Reemplazar espacios y caracteres especiales en el nombre de archivo
        const remitenteCleaned = remitente.replace(/[^a-zA-Z0-9]/g, '_');
        const fechaCleaned = fecha.replace(/\//g, '-'); // Cambiar / por - en la fecha

    // Nombre de archivo personalizado con remitente y fecha
        const fileName = `reporte_${remitenteCleaned}_${fechaCleaned}.xlsx`;

        XLSX.writeFile(wb, fileName);

        alert('Reporte generado correctamente.');
        document.getElementById('modal').style.display = 'none';
    });
});
