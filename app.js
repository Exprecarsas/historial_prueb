"use strict";

document.addEventListener('DOMContentLoaded', function () {
  // ====== Config ======
  const SCANNER_DELAY_MS = 400; // tiempo de espera tras última tecla del escáner
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxzA0YwFMMysx0Z6IN6-jz478TuPjmpCxFuoXVztaEKUmoBQwvDUnQXgOY_Tdd35ZwbRA/exec'; // <-- tu /exec

  // ====== Estado ======
  let globalUnitsScanned = 0; // Contador global de unidades escaneadas
  let codigosCorrectos = [];  // Códigos escaneados correctamente [{codigo,hora}]
  let barcodeTimeout = null;  // temporizador de debounce
  let audioContext = null;    // Web Audio

  // ====== Audio =====
  function initializeAudioContext() {
    if (!audioContext) {
      try { audioContext = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { console.debug('AudioContext no disponible:', e); }
    }
  }
  function playTone(frequency, duration, type = 'sine', volume = 0.3) {
    try {
      if (!audioContext) initializeAudioContext();
      if (!audioContext) return;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, audioContext.currentTime);
      gain.gain.value = volume;
      osc.connect(gain); gain.connect(audioContext.destination);
      osc.start();
      setTimeout(() => { osc.stop(); osc.disconnect(); gain.disconnect(); }, duration);
    } catch (e) { console.debug('No se pudo reproducir tono:', e); }
  }
  document.body.addEventListener('click', initializeAudioContext, { once: true });

  // ====== Persistencia ======
  function saveProgressToLocalStorage() {
    try {
      const compressed = LZString.compress(JSON.stringify({
        globalUnitsScanned,
        codigosCorrectos
      }));
      localStorage.setItem('scanProgress', compressed);
    } catch (e) { console.warn('No se pudo guardar en localStorage:', e); }
  }

  function restoreProgressFromLocalStorage() {
    try {
      const saved = localStorage.getItem('scanProgress');
      if (!saved) return;
      const json = LZString.decompress(saved);
      if (!json) return;
      const data = JSON.parse(json) || {};
      globalUnitsScanned = data.globalUnitsScanned || 0;
      codigosCorrectos = Array.isArray(data.codigosCorrectos) ? data.codigosCorrectos : [];
      updateGlobalCounter();
      limpiarTabla();
      codigosCorrectos.forEach((it, i) => agregarCodigoATabla(it.codigo, it.hora, i + 1));
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
    const el = document.getElementById('global-counter');
    if (el) el.innerText = `Unidades Escaneadas: ${globalUnitsScanned}`;
  }

  function clearBarcodeInput() {
    const el = document.getElementById('barcodeInput');
    if (el) el.value = '';
  }

  function obtenerHoraFormateada() {
    const d = new Date();
    let h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const pad = (n) => (n < 10 ? '0' + n : String(n));
    return `${h}:${pad(m)}:${pad(s)} ${ampm}`;
  }

  function agregarCodigoATabla(codigo, hora, numeroFila) {
    const tb = getTablaTbody();
    if (!tb) return;
    const row = tb.insertRow();
    row.insertCell(0).textContent = numeroFila;
    row.insertCell(1).textContent = codigo;
    row.insertCell(2).textContent = hora;
  }

  function limpiarTabla() {
    const tb = getTablaTbody();
    if (!tb) return;
    while (tb.rows.length) tb.deleteRow(0);
  }

  // ====== Lógica de escaneo ======
  function handleBarcodeScan(scannedCode) {
    const code = String(scannedCode || '').trim();
    if (!code) return;

    const currentTime = obtenerHoraFormateada();
    codigosCorrectos.push({ codigo: code, hora: currentTime });
    globalUnitsScanned += 1;

    updateGlobalCounter();
    agregarCodigoATabla(code, currentTime, codigosCorrectos.length);
    saveProgressToLocalStorage();
    playTone(880, 120, 'sine', 0.25);
    clearBarcodeInput();
  }

  // Input (pistola/teclado)
  const inputEl = document.getElementById('barcodeInput');
  if (inputEl) {
    inputEl.addEventListener('input', () => {
      const value = inputEl.value.trim();
      if (barcodeTimeout) clearTimeout(barcodeTimeout);
      if (value) {
        barcodeTimeout = setTimeout(() => {
          handleBarcodeScan(value);
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

  // ====== Modal ======
  function setFechaHoySoloLectura() {
    const fechaEl = document.getElementById('fecha');
    if (!fechaEl) return;
    const d = new Date();
    const pad = (n) => (n < 10 ? '0' + n : String(n));
    // dd/mm/aaaa
    fechaEl.value = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  function openModal() {
    const modal = document.getElementById('modal');
    if (!modal) return;
    modal.style.display = 'flex';
    setFechaHoySoloLectura();
  }

  function closeModal() {
    const modal = document.getElementById('modal');
    if (!modal) return;
    modal.style.display = 'none';
  }

  const btnAbrir = document.getElementById('abrir-modal');
  if (btnAbrir) {
    btnAbrir.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });
  }

  const btnCerrar = document.getElementById('cerrar-modal');
  if (btnCerrar) {
    btnCerrar.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal();
    });
  }

  // Cerrar con tecla ESC (extra)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // ====== Terminar proceso ======
  const btnTerminar = document.getElementById('terminar-proceso');
  if (btnTerminar) {
    btnTerminar.addEventListener('click', function () {
      const ok = confirm('¿Estás seguro de que deseas finalizar el proceso? Esto eliminará todos los datos escaneados.');
      if (!ok) return;

      if (barcodeTimeout) { clearTimeout(barcodeTimeout); barcodeTimeout = null; }
      localStorage.removeItem('scanProgress');
      globalUnitsScanned = 0;
      codigosCorrectos = [];
      updateGlobalCounter();
      limpiarTabla();
      saveProgressToLocalStorage();
      alert('Proceso finalizado. Los datos se han eliminado.');
    });
  }

  // ====== ENVIAR A GOOGLE SHEETS (CORS FIX) ======
  const btnReporte = document.getElementById('generar-reporte');
  if (btnReporte) {
    btnReporte.addEventListener('click', async () => {
      const placa = (document.getElementById('placa')?.value || '').trim();
      const remitente = (document.getElementById('remitente')?.value || '').trim();
      const fecha = (document.getElementById('fecha')?.value || '').trim();
      const tipo = (document.getElementById('tipo')?.value || '').trim(); // CARGUE / DESCARGUE / INVENTARIO / NOVEDADES

      if (!tipo) { alert('Selecciona el Tipo (CARGUE/DESCARGUE/INVENTARIO/NOVEDADES).'); return; }

      // Placa requerida solo para CARGUE/DESCARGUE
      const requiresPlaca = (tipo === 'CARGUE' || tipo === 'DESCARGUE');
      if (requiresPlaca && !placa) {
        alert('La placa es obligatoria para CARGUE/DESCARGUE.');
        return;
      }
      if (!codigosCorrectos.length) {
        alert('No hay códigos para enviar.');
        return;
      }
      if (!/^https?:\/\/script\.google\.com\/macros\//.test(SCRIPT_URL)) {
        alert('Configura tu SCRIPT_URL de Google Apps Script.');
        return;
      }

      const payload = {
        meta: {
          placa,
          tipo,                 // decide archivo destino en Code.gs
          remitente,            // se imprime debajo en la misma celda (2da línea)
          fecha,                // informativo; backend usa timestamp_envio + regla 6am
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
        // >>> CORS FIX: request "simple" para evitar preflight (OPTIONS)
        const resp = await fetch(SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, // <-- clave
          body: JSON.stringify(payload)
        });

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`HTTP ${resp.status}: ${text}`);
        }
        const result = await resp.json().catch(() => ({}));
        const destino = result.target ? ` | Archivo: ${result.target}` : '';
        alert(`Datos enviados correctamente. Hoja: ${result.sheet || '-'} | Col inicial: ${result.startCol || '-'}${destino}`);

        // Cerrar modal
        closeModal();

        // (Opcional) limpiar después de enviar:
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
  updateGlobalCounter();
  restoreProgressFromLocalStorage();
});
