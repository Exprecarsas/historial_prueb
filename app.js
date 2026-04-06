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
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {}
    }
  }

  function playTone(freq, dur) {
    if (!audioContext) return;
    const o = audioContext.createOscillator();
    const g = audioContext.createGain();
    o.frequency.value = freq;
    g.gain.value = 0.25;
    o.connect(g);
    g.connect(audioContext.destination);
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

    codigosCorrectos.forEach((c, i) => {
      agregarFila(c.codigo, c.hora, i + 1);
    });
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

    // Si tiene sufijo, no permitir duplicado exacto dentro del escaneo actual
    if (tieneSufijo) {
      const ya = codigosCorrectos.some(x => x.codigo === limpio);
      if (ya) {
        playTone(220, 200);
        alert("Este subcódigo ya fue escaneado.");
        return;
      }
    }

    // Si no tiene sufijo, sí permitir repetidos
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
    document.getElementById('fecha').value = new Date().toISOString().slice(0, 10);
  };

  document.getElementById('cerrar-modal').onclick = () => {
    modal.style.display = 'none';
  };

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
      unidades: codigosCorrectos.map(c => ({ codigo: c.codigo, hora: c.hora }))
    });
  }

  async function leerRespuestaSegura(resp) {
    const texto = await resp.text();

    if (!texto || !texto.trim()) {
      throw new Error(`Respuesta vacía del servidor (HTTP ${resp.status})`);
    }

    try {
      return JSON.parse(texto);
    } catch (e) {
      console.error('Respuesta no JSON:', texto);
      throw new Error(`Respuesta inválida del servidor (HTTP ${resp.status})`);
    }
  }

  function construirMensajeExito(data) {
    const insertadas = Number(data.insertadas || 0);
    const omitidas = Number(data.omitidas || 0);
    const procesoId = data.proceso_id || '';
    const procesoExistente = !!data.proceso_existente;
    const mensaje = data.mensaje || '';

    let texto = `${mensaje || 'Proceso guardado correctamente'}`;

    if (procesoId) {
      texto += `\nProceso ID: ${procesoId}`;
    }

    texto += `\nInsertadas: ${insertadas}`;
    texto += `\nOmitidas: ${omitidas}`;

    if (procesoExistente) {
      texto += `\nModo: Reenvío / proceso existente`;
    } else {
      texto += `\nModo: Proceso nuevo`;
    }

    return texto;
  }

  // ====== ENVIAR A API ======
  const btnEnviar = document.getElementById('generar-reporte');

  btnEnviar.onclick = async () => {
    if (enviandoProceso) return;

    const sede = document.getElementById('sede').value;
    const placa = document.getElementById('placa').value.trim();
    const tipo = document.getElementById('tipo').value;
    const fecha = document.getElementById('fecha').value;
    const remitente = document.getElementById('remitente').value.trim().toUpperCase();

    if (!sede) {
      alert('Selecciona la sede');
      return;
    }

    if ((tipo === 'CARGUE' || tipo === 'DESCARGUE') && !placa) {
      alert('La placa es obligatoria');
      return;
    }

    if (!remitente) {
      alert('Ingresa el origen / remitente');
      return;
    }

    if (!codigosCorrectos.length) {
      alert('No hay unidades escaneadas');
      return;
    }

    const firmaActual = crearFirmaActual(sede, placa, tipo, fecha);

    if (firmaUltimoEnvio === firmaActual) {
      alert('Este proceso ya fue enviado. Si cambias algo, podrás enviarlo de nuevo.');
      return;
    }

    enviandoProceso = true;
    btnEnviar.disabled = true;
    const textoOriginal = btnEnviar.innerHTML;
    btnEnviar.innerHTML = 'Enviando... ⏳';

    try {
      const payload = {
        tipo,
        placa,
        remitente,
        sede,
        fecha_operativa: fecha,
        unidades: codigosCorrectos
      };

      const resp = await fetch(API_GUARDAR, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await leerRespuestaSegura(resp);

      if (!resp.ok) {
        throw new Error(data.error || `Error HTTP ${resp.status}`);
      }

      if (!data.ok) {
        throw new Error(data.error || 'El servidor respondió con error');
      }

      firmaUltimoEnvio = firmaActual;

      alert(construirMensajeExito(data));
      modal.style.display = 'none';

      // Si quieres limpiar después de enviar exitosamente, descomenta esto:
      /*
      codigosCorrectos = [];
      globalUnitsScanned = 0;
      limpiarTabla();
      updateCounter();
      localStorage.removeItem('scanProgress');
      */

    } catch (e) {
      console.error('Error enviando proceso:', e);
      alert(`Error enviando el proceso:\n${e.message}`);
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