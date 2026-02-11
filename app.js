"use strict";

let enviandoProceso = false;
let firmaUltimoEnvio = null;

document.addEventListener('DOMContentLoaded', function () {

  // ====== Config ======
  const SCANNER_DELAY_MS = 400;
  const API_GUARDAR = 'https://exprecar.com/api/guardar_proceso.php';

  // ====== Estado ======
  let globalUnitsScanned = 0;
  let codigosCorrectos = [];
  let barcodeTimeout = null;
  let audioContext = null;

  // ====== Audio ======
  function initializeAudioContext() {
    if (!audioContext) {
      try { audioContext = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) {}
    }
  }

  function playTone(freq, dur) {
    if (!audioContext) return;
    const o = audioContext.createOscillator();
    const g = audioContext.createGain();
    o.frequency.value = freq;
    g.gain.value = 0.25;
    o.connect(g); g.connect(audioContext.destination);
    o.start();
    setTimeout(() => o.stop(), dur);
  }

  document.body.addEventListener('click', initializeAudioContext, { once: true });

  // ====== Persistencia ======
  function saveProgress() {
    const data = { globalUnitsScanned, codigosCorrectos };
    localStorage.setItem('scanProgress', LZString.compress(JSON.stringify(data)));
  }

  function restoreProgress() {
    const saved = localStorage.getItem('scanProgress');
    if (!saved) return;
    const data = JSON.parse(LZString.decompress(saved) || '{}');
    globalUnitsScanned = data.globalUnitsScanned || 0;
    codigosCorrectos = data.codigosCorrectos || [];
    updateCounter();
    limpiarTabla();
    codigosCorrectos.forEach((c, i) =>
      agregarFila(c.codigo, c.hora, i + 1)
    );
  }

  // ====== UI ======
  const tbody = document.querySelector('#tabla-codigos tbody');
  const counter = document.getElementById('global-counter');

  function updateCounter() {
    counter.textContent = `Unidades Escaneadas: ${globalUnitsScanned}`;
  }

  function limpiarTabla() {
    tbody.innerHTML = '';
  }

  function horaActual() {
    return new Date().toLocaleTimeString('es-CO');
  }

  function agregarFila(codigo, hora, n) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${n}</td><td>${codigo}</td><td>${hora}</td>`;
    tbody.appendChild(tr);
  }

  // ====== Escaneo ======
  function handleScan(code) {
  if (!code) return;

  const limpio = code.trim();
  const partes = limpio.split('-');
  const tieneSufijo = partes.length > 1;

  // 🔹 Si tiene sufijo → NO permitir repetir exactamente el mismo
  if (tieneSufijo) {
    const ya = codigosCorrectos.some(x => x.codigo === limpio);
    if (ya) {
      playTone(220, 200);
      alert("Este subcódigo ya fue escaneado.");
      return;
    }
  }

  // 🔹 Si NO tiene sufijo → SÍ permitir repetidos
  const hora = horaActual();
  codigosCorrectos.push({ codigo: limpio, hora });
  globalUnitsScanned++;
  agregarFila(limpio, hora, codigosCorrectos.length);
  updateCounter();
  saveProgress();
  playTone(880, 120);
}


  const input = document.getElementById('barcodeInput');

  input.addEventListener('input', () => {
    clearTimeout(barcodeTimeout);
    barcodeTimeout = setTimeout(() => {
      handleScan(input.value.trim());
      input.value = '';
    }, SCANNER_DELAY_MS);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(barcodeTimeout);
      handleScan(input.value.trim());
      input.value = '';
    }
  });

  // ====== Modal ======
  const modal = document.getElementById('modal');
  document.getElementById('abrir-modal').onclick = () => {
    modal.style.display = 'flex';
    document.getElementById('fecha').value =
      new Date().toISOString().slice(0, 10);
  };
  document.getElementById('cerrar-modal').onclick = () => modal.style.display = 'none';

  // ====== Terminar ======
  document.getElementById('terminar-proceso').onclick = () => {
    if (!confirm('¿Finalizar proceso y borrar datos?')) return;
    codigosCorrectos = [];
    globalUnitsScanned = 0;
    limpiarTabla();
    updateCounter();
    localStorage.removeItem('scanProgress');
    firmaUltimoEnvio = null;
  };

  // ====== Firma ======
  function crearFirmaActual(sede, placa, tipo, fecha) {
    return JSON.stringify({
      sede,
      placa,
      tipo,
      fecha,
      // Importante: incluir código + hora para detectar cambios reales
      unidades: codigosCorrectos.map(c => ({ codigo: c.codigo, hora: c.hora }))
    });
  }

  // ====== ENVIAR A API ======
  const btnEnviar = document.getElementById('generar-reporte');

  btnEnviar.onclick = async () => {

    if (enviandoProceso) return;

    const sede  = document.getElementById('sede').value;
    const placa = document.getElementById('placa').value.trim();
    const tipo  = document.getElementById('tipo').value;
    const fecha = document.getElementById('fecha').value;

    if (!sede) { alert('Selecciona la sede'); return; }
    if ((tipo === 'CARGUE' || tipo === 'DESCARGUE') && !placa) {
      alert('La placa es obligatoria');
      return;
    }
    if (!codigosCorrectos.length) {
      alert('No hay unidades escaneadas');
      return;
    }

    const firmaActual = crearFirmaActual(sede, placa, tipo, fecha);

    // Si es exactamente igual a lo último enviado (y fue exitoso), bloquear
    if (firmaUltimoEnvio === firmaActual) {
      alert('Este proceso ya fue enviado. Si cambias algo, podrás enviarlo de nuevo.');
      return;
    }

    enviandoProceso = true;

    btnEnviar.disabled = true;
    const textoOriginal = btnEnviar.innerHTML;
    btnEnviar.innerHTML = 'Enviando... ⏳';

    try {

      const resp = await fetch(API_GUARDAR, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          placa,
          sede,
          fecha_operativa: fecha,
          unidades: codigosCorrectos
        })
      });

      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || 'Error desconocido');

      // ✅ SOLO aquí marcamos como enviado
      firmaUltimoEnvio = firmaActual;

      alert(`Proceso guardado correctamente\nUnidades: ${data.total_unidades}`);
      modal.style.display = 'none';

    } catch (e) {
      console.error(e);
      alert('Error enviando el proceso');
      // ❌ No tocamos firmaUltimoEnvio para no “bloquear” el envío
    } finally {
      enviandoProceso = false;
      btnEnviar.disabled = false;
      btnEnviar.innerHTML = textoOriginal;
    }
  };

  // ====== Init ======
  updateCounter();
  restoreProgress();
});
