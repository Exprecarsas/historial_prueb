
document.addEventListener('DOMContentLoaded', function () {
    // ====== Config ======
    const SCANNER_DELAY_MS = 400; // tiempo de espera tras última tecla del escáner
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwJMg6JoAi4q4_iwq1cPjWhS2eayUX9ipCphEAJkWnLLswYMU8UziOqlsgfCpIKfak5hw/exec'; // <-- tu /exec

    // ====== Estado ======
    let globalUnitsScanned = 0; // Contador global de unidades escaneadas
    let codigosCorrectos = [];  // Códigos escaneados correctamente
    let barcodeTimeout = null;  // Variable para almacenar el temporizador
    let audioContext = null;    // Contexto de audio para generar tonos

    // ====== Audio ======
    function initializeAudioContext() {
        if (!audioContext) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.debug('AudioContext no disponible:', e);
            }
        }
    }
    function playTone(frequency, duration, type = 'sine', volume = 0.3) {
        try {
            if (!audioContext) initializeAudioContext();
            if (!audioContext) return;

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
    document.body.addEventListener('click', initializeAudioContext, { once: true });

    // ====== Persistencia ======
    function saveProgressToLocalStorage() {
        try {
            const progressData = {
                globalUnitsScanned: globalUnitsScanned,
                codigosCorrectos: codigosCorrectos
            };
            const compressedData = LZString.compress(JSON.stringify(progressData));
            localStorage.setItem('scanProgress', compressedData);
        } catch (e) {
            console.warn('No se pudo guardar en localStorage:', e);
        }
    }
    function restoreProgressFromLocalStorage() {
        try {
            const savedData = localStorage.getItem('scanProgress');
            if (!savedData) {
                console.log("No se encontraron datos guardados en localStorage.");
                return;
            }
            const decompressedData = LZString.decompress(savedData);
            if (!decompressedData) return;
            const parsedData = JSON.parse(decompressedData) || {};

            globalUnitsScanned = parsedData.globalUnitsScanned || 0;
            codigosCorrectos = Array.isArray(parsedData.codigosCorrectos) ? parsedData.codigosCorrectos : [];

            updateGlobalCounter();
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
    function clearBarcodeInput() {
        const el = document.getElementById('barcodeInput');
        if (el) el.value = '';
    }
    function obtenerHoraFormateada() {
        const ahora = new Date();
        let horas = ahora.getHours();
        let minutos = ahora.getMinutes();
        let segundos = ahora.getSeconds();
        const ampm = horas >= 12 ? 'PM' : 'AM';

        horas = horas % 12;
        horas = horas ? horas : 12;
        minutos = minutos < 10 ? '0' + minutos : minutos;
        segundos = segundos < 10 ? '0' + segundos : segundos;

        return `${horas}:${minutos}:${segundos} ${ampm}`;
    }
    updateGlobalCounter();

    // ====== Lógica de escaneo ======
    function handleBarcodeScan(scannedCode) {
        const code = String(scannedCode || '').trim();
        if (!code) return;

        const currentTime = obtenerHoraFormateada();
        codigosCorrectos.push({ codigo: code, hora: currentTime });

        globalUnitsScanned += 1;
        updateGlobalCounter();

        playTone(880, 120, 'sine', 0.25);
        saveProgressToLocalStorage();

        agregarCodigoATabla(code, currentTime, codigosCorrectos.length);
        clearBarcodeInput();
    }
    function agregarCodigoATabla(codigo, hora, numeroFila) {
        const tbody = getTablaTbody();
        if (!tbody) return;
        const nuevaFila = tbody.insertRow();
        nuevaFila.insertCell(0).textContent = numeroFila;
        nuevaFila.insertCell(1).textContent = codigo;
        nuevaFila.insertCell(2).textContent = hora;
    }
    function limpiarTabla() {
        const tbody = getTablaTbody();
        if (!tbody) return;
        while (tbody.rows.length > 0) {
            tbody.deleteRow(0);
        }
    }

    // ====== Listeners de UI ======
    const inputEl = document.getElementById('barcodeInput');
    if (inputEl) {
        inputEl.addEventListener('input', () => {
            const barcodeValue = inputEl.value.trim();
            if (barcodeTimeout) clearTimeout(barcodeTimeout);
            if (barcodeValue !== '') {
                barcodeTimeout = setTimeout(() => {
                    handleBarcodeScan(barcodeValue);
                    clearBarcodeInput();
                }, SCANNER_DELAY_MS);
            }
        });
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (barcodeTimeout) clearTimeout(barcodeTimeout);
                handleBarcodeScan(inputEl.value);
            }
        });
    }

    const btnAbrir = document.getElementById('abrir-modal');
    if (btnAbrir) {
        btnAbrir.addEventListener('click', () => {
            const modal = document.getElementById('modal');
            if (modal) modal.style.display = 'flex';

            const fechaEl = document.getElementById('fecha');
            if (fechaEl) {
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

    const btnCerrar = document.getElementById('cerrar-modal');
    if (btnCerrar) {
        btnCerrar.addEventListener('click', () => {
            const modal = document.getElementById('modal');
            if (modal) modal.style.display = 'none';
        });
    }

    const btnTerminar = document.getElementById('terminar-proceso');
    if (btnTerminar) {
        btnTerminar.addEventListener('click', function () {
            const confirmacion = confirm("¿Estás seguro de que deseas finalizar el proceso? Esto eliminará todos los datos escaneados.");
            if (confirmacion) {
                if (barcodeTimeout) {
                    clearTimeout(barcodeTimeout);
                    barcodeTimeout = null;
                }
                localStorage.removeItem('scanProgress');
                globalUnitsScanned = 0;
                codigosCorrectos = [];
                updateGlobalCounter();
                limpiarTabla();
                saveProgressToLocalStorage();
                alert('Proceso finalizado. Los datos se han eliminado.');
            } else {
                console.log('El usuario canceló la finalización del proceso.');
            }
        });
    }

    // ====== ENVIAR A GOOGLE SHEETS ======
    const btnReporte = document.getElementById('generar-reporte');
    if (btnReporte) {
        btnReporte.addEventListener('click', async () => {
            const placaEl = document.getElementById('placa');
            const remitenteEl = document.getElementById('remitente');
            const fechaEl = document.getElementById('fecha');
            const tipoEl = document.getElementById('tipo'); // <select id="tipo"> CARGUE/DESCARGUE/INVENTARIO/NOVEDADES

            const placa = placaEl ? (placaEl.value || '').trim() : '';
            const remitente = remitenteEl ? (remitenteEl.value || '').trim() : '';
            const fecha = fechaEl ? (fechaEl.value || '').trim() : '';
            const tipo = tipoEl ? (tipoEl.value || '').trim() : '';

            if (!tipo) {
                alert("Selecciona el Tipo (CARGUE/DESCARGUE/INVENTARIO/NOVEDADES).");
                return;
            }
            // Placa requerida solo para CARGUE/DESCARGUE
            const requiresPlaca = (tipo === 'CARGUE' || tipo === 'DESCARGUE');
            if (requiresPlaca && !placa) {
                alert("La placa es obligatoria para CARGUE/DESCARGUE.");
                return;
            }
            if (!codigosCorrectos.length) {
                alert("No hay códigos para enviar.");
                return;
            }
            // Regex corregido (no uses \\ dentro del literal)
            if (!/^https?:\/\/script\.google\.com\/macros\//.test(SCRIPT_URL)) {
                alert("Configura tu SCRIPT_URL de Google Apps Script.");
                return;
            }

            const payload = {
                meta: {
                    placa,
                    tipo,                 // CARGUE / DESCARGUE / INVENTARIO / NOVEDADES
                    remitente,            // se imprime debajo en la misma celda (2da línea)
                    fecha,                // informativo; el backend usa timestamp_envio + regla 6am
                    total_unidades: codigosCorrectos.length,
                    timestamp_envio: new Date().toISOString()
                },
                datos: codigosCorrectos.map((item, index) => ({
                    n: index + 1,
                    codigo: item.codigo,
                    hora: item.hora
                }))
            };

            const original = btnReporte.textContent;
            btnReporte.disabled = true;
            btnReporte.textContent = 'Enviando...';

            try {
                const resp = await fetch(SCRIPT_URL, {
                    method: 'POST',
                    mode: 'cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!resp.ok) {
                    const text = await resp.text();
                    throw new Error(`HTTP ${resp.status}: ${text}`);
                }

                const result = await resp.json().catch(() => ({}));
                // Si tu Code.gs devuelve "target: MAIN/AUX", lo mostramos:
                const destino = result.target ? ` | Archivo: ${result.target}` : '';
                alert(`Datos enviados correctamente. Hoja: ${result.sheet || '-'} | Col inicial: ${result.startCol || '-'}${destino}`);

                // Cerrar modal
                const modal = document.getElementById('modal');
                if (modal) modal.style.display = 'none';

                // (Opcional) Limpiar después de enviar:
                // globalUnitsScanned = 0;
                // codigosCorrectos = [];
                // updateGlobalCounter();
                // limpiarTabla();
                // saveProgressToLocalStorage();

            } catch (err) {
                console.error('Error enviando a Sheets:', err);
                alert('No se pudo enviar a Google Sheets. Revisa la consola para más detalles.');
            } finally {
                btnReporte.disabled = false;
                btnReporte.textContent = original;
            }
        });
    }

    // ====== Inicio ======
    restoreProgressFromLocalStorage();
});

