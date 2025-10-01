document.addEventListener("DOMContentLoaded", function () {
  // ====== Config ======
  const SCANNER_DELAY_MS = 400; // tiempo de espera tras última tecla del escáner
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwJMg6JoAi4q4_iwq1cPjWhS2eayUX9ipCphEAJkWnLLswYMU8UziOqlsgfCpIKfak5hw/exec";

  // ====== Estado ======
  let globalUnitsScanned = 0; // Contador global de unidades escaneadas
  let codigosCorrectos = [];  // [{codigo, hora}]
  let barcodeTimeout = null;  // temporizador de debounce
  let audioContext = null;    // Web Audio

  // ====== Audio ======
  function initializeAudioContext() {
    if (!audioContext) {
      try { audioContext = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { console.debug("AudioContext no disponible:", e); }
    }
  }
  function playTone(frequency, duration, type = "sine", volume = 0.3) {
    try {
      if (!audioContext) initializeAudioContext();
      if (!audioContext) return;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, audioContext.currentTime);
      gain.gain.value = volume;
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start();
      setTimeout(() => {
        osc.stop();
        osc.disconnect();
        gain.disconnect();
      }, duration);
    } catch (e) { console.debug("No se pudo reproducir tono:", e); }
  }
  document.body.addEventListener("click", initializeAudioContext, { once: true });

  // ====== Persistencia (localStorage comprimido) ======
  function saveProgressToLocalStorage() {
    try {
      const data = { globalUnitsScanned, codigosCorrectos };
      const compressed = LZString.compress(JSON.stringify(data));
      localStorage.setItem("scanProgress", compressed);
    } catch (e) { console.warn("No se pudo guardar en localStorage:", e); }
  }
  function restoreProgressFromLocalStorage() {
    try {
      const saved = localStorage.getItem("scanProgress");
      if (!saved) return;
      const json = LZString.decompress(saved);
      if (!json) return;
      const parsed = JSON.parse(json) || {};
      globalUnitsScanned = parsed.globalUnitsScanned || 0;
      codigosCorrectos = Array.isArray(parsed.codigosCorrectos) ? parsed.codigosCorrectos : [];
      updateGlobalCounter();
      limpiarTabla();
      codigosCorrectos.forEach((it, i) => agregarCodigoATabla(it.codigo, it.hora, i + 1));
    } catch (e) {
      console.warn("No se pudo restaurar; se limpia la clave:", e);
      localStorage.removeItem("scanProgress");
    }
  }

  // ====== UI helpers ======
  function tbody() {
    const t = document.getElementById("tabla-codigos");
    return t ? t.getElementsByTagName("tbody")[0] : null;
  }
  function updateGlobalCounter() {
    const el = document.getElementById("global-counter");
    if (el) el.innerText = "Unidades Escaneadas: " + globalUnitsScanned;
  }
  function clearBarcodeInput() {
    const el = document.getElementById("barcodeInput");
    if (el) el.value = "";
  }
  function obtenerHoraFormateada() {
    const d = new Date();
    let h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    const pad = (n) => (n < 10 ? "0" + n : String(n));
    return h + ":" + pad(m) + ":" + pad(s) + " " + ampm;
  }
  function agregarCodigoATabla(codigo, hora, n) {
    const tb = tbody();
    if (!tb) return;
    const row = tb.insertRow();
    row.insertCell(0).textContent = n;
    row.insertCell(1).textContent = codigo;
    row.insertCell(2).textContent = hora;
  }
  function limpiarTabla() {
    const tb = tbody();
    if (!tb) return;
    while (tb.rows.length) tb.deleteRow(0);
  }

  // ====== Lógica de escaneo (input tipo pistola) ======
  function handleBarcodeScan(scannedCode) {
    const code = String(scannedCode || "").trim();
    if (!code) return;
    const time = obtenerHoraFormateada();
    codigosCorrectos.push({ codigo: code, hora: time });
    globalUnitsScanned += 1;
    updateGlobalCounter();
    agregarCodigoATabla(code, time, codigosCorrectos.length);
    saveProgressToLocalStorage();
    playTone(880, 120, "sine", 0.25);
    clearBarcodeInput();
  }

  const inputEl = document.getElementById("barcodeInput");
  if (inputEl) {
    inputEl.addEventListener("input", () => {
      const value = inputEl.value.trim();
      if (barcodeTimeout) clearTimeout(barcodeTimeout);
      if (value) {
        barcodeTimeout = setTimeout(() => {
          handleBarcodeScan(value);
          clearBarcodeInput();
        }, SCANNER_DELAY_MS);
      }
    });
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (barcodeTimeout) clearTimeout(barcodeTimeout);
        handleBarcodeScan(inputEl.value);
      }
    });
  }

  // ====== Modal ======
  const btnAbrir = document.getElementById("abrir-modal");
  if (btnAbrir) {
    btnAbrir.addEventListener("click", () => {
      const modal = document.getElementById("modal");
      if (modal) modal.style.display = "flex";
      const fechaEl = document.getElementById("fecha");
      if (fechaEl) {
        if (fechaEl.type === "date") {
          const d = new Date();
          const pad = (n) => (n < 10 ? "0" + n : String(n));
          fechaEl.value = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
        } else {
          fechaEl.value = new Date().toLocaleDateString();
        }
      }
    });
  }
  const btnCerrar = document.getElementById("cerrar-modal");
  if (btnCerrar) {
    btnCerrar.addEventListener("click", () => {
      const modal = document.getElementById("modal");
      if (modal) modal.style.display = "none";
    });
  }

  // ====== Terminar proceso ======
  const btnTerminar = document.getElementById("terminar-proceso");
  if (btnTerminar) {
    btnTerminar.addEventListener("click", () => {
      const ok = confirm("¿Estás seguro de que deseas finalizar el proceso? Esto eliminará todos los datos escaneados.");
      if (!ok) return;
      if (barcodeTimeout) { clearTimeout(barcodeTimeout); barcodeTimeout = null; }
      localStorage.removeItem("scanProgress");
      globalUnitsScanned = 0;
      codigosCorrectos = [];
      updateGlobalCounter();
      limpiarTabla();
      saveProgressToLocalStorage();
      alert("Proceso finalizado. Los datos se han eliminado.");
    });
  }

  // ====== Enviar a Google Sheets ======
  const btnReporte = document.getElementById("generar-reporte");
  if (btnReporte) {
    btnReporte.addEventListener("click", async () => {
      const placa = (document.getElementById("placa")?.value || "").trim();
      const remitente = (document.getElementById("remitente")?.value || "").trim();
      const fecha = (document.getElementById("fecha")?.value || "").trim();
      const tipo = (document.getElementById("tipo")?.value || "").trim(); // CARGUE/DESCARGUE/INVENTARIO/NOVEDADES

      if (!tipo) { alert("Selecciona el Tipo."); return; }
      const requiresPlaca = (tipo === "CARGUE" || tipo === "DESCARGUE");
      if (requiresPlaca && !placa) { alert("La placa es obligatoria para CARGUE/DESCARGUE."); return; }
      if (!codigosCorrectos.length) { alert("No hay códigos para enviar."); return; }
      if (!/^https?:\/\/script\.google\.com\/macros\//.test(SCRIPT_URL)) {
        alert("Configura tu SCRIPT_URL de Google Apps Script.");
        return;
      }

      const payload = {
        meta: {
          placa,
          tipo,
          remitente,
          fecha, // informativo; backend usa timestamp_envio + regla 6am
          total_unidades: codigosCorrectos.length,
          timestamp_envio: new Date().toISOString()
        },
        datos: codigosCorrectos.map((it, i) => ({ n: i + 1, codigo: it.codigo, hora: it.hora }))
      };

      const original = btnReporte.textContent;
      btnReporte.disabled = true;
      btnReporte.textContent = "Enviando...";

      try {
        const resp = await fetch(SCRIPT_URL, {
          method: "POST",
          mode: "cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error("HTTP " + resp.status + ": " + text);
        }
        const result = await resp.json().catch(() => ({}));
        const destino = result.target ? " | Archivo: " + result.target : "";
        alert("Datos enviados. Hoja: " + (result.sheet || "-") + " | Col inicial: " + (result.startCol || "-") + destino);

        const modal = document.getElementById("modal");
        if (modal) modal.style.display = "none";
      } catch (err) {
        console.error("Error enviando a Sheets:", err);
        alert("No se pudo enviar a Google Sheets. Revisa la consola.");
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
