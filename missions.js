/* ==========================================================================
   missions.js - Codigo Ebel | Flujo de Misiones
   Maneja: Fases 1-4, Timer, Geolocalización, Mapa
   ========================================================================== */

// ========== VARIABLES GLOBALES ==========
let misionesSolitario = [];
let misionesEquipo = [];
let currentMission = null;
let currentTeamMission = null;
let missionStartTime = null;
let jugador = null;
let redemptionOffered = false;
let proximityWatchId = null;

// ========== CARGAR MISIONES ==========

/**
 * Cargar misiones desde JSON
 */
async function loadMisiones() {
  try {
    const [solitarioRes, equipoRes] = await Promise.all([
      fetch('misiones-solitario.json'),
      fetch('misiones-equipo-local.json')
    ]);
    if (!solitarioRes.ok) throw new Error(`Error ${solitarioRes.status}: misiones-solitario.json`);
    if (!equipoRes.ok) throw new Error(`Error ${equipoRes.status}: misiones-equipo-local.json`);
    misionesSolitario = await solitarioRes.json();
    misionesEquipo = await equipoRes.json();
    return true;
  } catch (err) {
    console.error("⚠️ Error crítico:", err);
    showToast("⚠️ Error al cargar misiones. Verifica los archivos JSON.");
    misionesSolitario = [
      { id: 1, zona: "CABA", titulo: "Misión de prueba", ubicacion_mapa: "Plaza de Mayo", pista_al_llegar: "Busca la pista final.", coordenadas: { lat: -34.6037, lng: -58.3816 } }
    ];
    return false;
  }
}

// ========== UTILIDADES DE MISIÓN ==========

/**
 * Obtener misiones por zona
 * @param {string} zona - Zona del jugador
 * @param {string} tipo - 'solitario' o 'equipo'
 * @returns {Array}
 */
function getMisionesByZona(zona, tipo = 'solitario') {
  const lista = tipo === 'equipo' ? misionesEquipo : misionesSolitario;
  const zonaNormalizada = (zona || '').trim().toLowerCase();
  const barriosCABA = [
    'san telmo', 'la boca', 'recoleta', 'microcentro', 'palermo',
    'congreso', 'almagro', 'retiro', 'balvanera', 'villa crespo',
    'belgrano', 'barracas', 'flores', 'villa urquiza', 'puerto madero',
    'san cristóbal'
  ];
  
  return lista.filter(m => {
    const misionZona = (m.zona || '').trim().toLowerCase();
    if (misionZona === zonaNormalizada) return true;
    if (zonaNormalizada === 'caba' && barriosCABA.includes(misionZona)) return true;
    if (barriosCABA.includes(zonaNormalizada) && barriosCABA.includes(misionZona)) return true;
    return false;
  });
}

/**
 * Seleccionar misión aleatoria
 * @param {string} zona - Zona del jugador
 * @param {string} tipo - 'solitario' o 'equipo'
 * @returns {Object}
 */
function selectRandomMission(zona, tipo = 'solitario') {
  const misiones = getMisionesByZona(zona, tipo);
  if (misiones.length === 0) {
    return getMisionesByZona('CABA', tipo)[0] || misionesSolitario[0];
  }
  return misiones[Math.floor(Math.random() * misiones.length)];
}

// ========== OCULTAR FASES ==========

/**
 * Ocultar todas las fases
 */
function hideAllPhases() {
  document.getElementById('phase1-consigna').style.display = 'none';
  document.getElementById('phase2-mapa').style.display = 'none';
  document.getElementById('phase3-pista').style.display = 'none';
  document.getElementById('phase4-completed').style.display = 'none';
  document.getElementById('teamSection').style.display = 'none';
}

// ========== FASE 1: CONSIGNA INICIAL ==========

/**
 * Mostrar Fase 1 - Consigna inicial
 */
async function showPhase1() {
  currentMission = selectRandomMission(jugador.zona, 'solitario');
  
  // Registrar evento de Analytics
  if (window.firebaseLogEvent) {
    firebaseLogEvent('mision_aceptada', {
      zona: jugador.zona,
      tipo: 'solitario',
      hunter_id: jugador.id
    });
  }
  
  // Verificar disponibilidad en tiempo real
  const disponible = await firebaseIsMisionDisponible(currentMission.id, jugador.zona);
  
  if (!disponible) {
    // Mostrar consuelo narrativo
    playConsolationNarration('already_completed');
    
    // Mostrar sugerencia y opción de redención
    document.querySelector('#phase1-consigna .mission-card').innerHTML = `
      <div class="mission-title">
        <span class="icon">⚠️</span>
        <span class="title-text">Misión ya completada</span>
      </div>
      <div class="tension-bar" style="margin: 1rem 0; background: rgba(255, 170, 51, 0.15);">
        ⏳ Alguien fue más rápido
      </div>
      <p class="pista">
        ${getSuggestionBasedOnContext('already_completed')}
        <br><br>
        Pero no te preocupes. En Let's Hunt, cada fracaso es una lección.
      </p>
      <button class="btn btn-primary" id="new-mission-btn">🎯 Nueva misión</button>
      <button class="btn btn-outline" id="redemption-btn" style="margin-top: 10px;">🕊️ Misión de redención</button>
    `;
    
    document.getElementById('phase1-consigna').style.display = 'block';
    document.getElementById('new-mission-btn').addEventListener('click', showPhase1);
    document.getElementById('redemption-btn').addEventListener('click', showRedemptionMission);
    return;
  }
  
  document.querySelector('#phase1-consigna .mission-card').innerHTML = `
    <div class="mission-title">
      <span class="icon">🦁</span>
      <span class="title-text">${currentMission.titulo}</span>
    </div>
    <div class="tension-bar" style="margin: 1rem 0; background: rgba(255,69,58,0.15);">
      ⏳ Listo para cazar
    </div>
    <p class="pista">${currentMission.descripcion_narrativa || currentMission.pista_al_llegar}</p>
    <button class="btn btn-primary" id="start-mission-btn">✅ Aceptar y comenzar</button>
  `;
  
  document.getElementById('phase1-consigna').style.display = 'block';
  document.getElementById('start-mission-btn').addEventListener('click', () => {
    missionStartTime = Date.now();
    startTimer();
    guardarProgreso(currentMission.id);
    showPhase2();
  });
}

// ========== FASE 2: MAPA DE APROXIMACIÓN ==========

/**
 * Mostrar Fase 2 - Mapa de aproximación
 */
function showPhase2() {
  document.getElementById('phase1-consigna').style.display = 'none';
  
  document.querySelector('#phase2-mapa .mission-card').innerHTML = `
    <h3>📍 Acércate al objetivo</h3>
    <p style="margin: 1rem 0; color:#cbd5e1; line-height: 1.4;">${currentMission.ubicacion_mapa}</p>
    <div id="mapApprox" style="height: 300px; border-radius:12px; margin:1rem 0;"></div>
    <p id="proximity-instructions" style="font-size:0.9rem; color:#94a3b8;">Esperando tu ubicación...</p>
    <button class="btn btn-primary" id="back-to-phase1-btn" style="margin-top: 15px; width: 100%; padding: 12px;">
      🔙 Volver a misión
    </button>
  `;
  
  document.getElementById('phase2-mapa').style.display = 'block';
  loadApproxMap(currentMission.coordenadas.lat, currentMission.coordenadas.lng);
  startProximityCheck(currentMission.coordenadas.lat, currentMission.coordenadas.lng);
  
  document.getElementById('back-to-phase1-btn').onclick = () => {
    document.getElementById('phase2-mapa').style.display = 'none';
    document.getElementById('phase1-consigna').style.display = 'block';
  };
}

// ========== FASE 3: PISTA FINAL + QR ==========

/**
 * Mostrar Fase 3 - Pista final + QR
 */
function showPhase3() {
  document.getElementById('phase2-mapa').style.display = 'none';
  const recoveryCode = generarRecoveryCode();
  localStorage.setItem(`recovery_${jugador.id}`, recoveryCode);
  
  document.querySelector('#phase3-pista .mission-card').innerHTML = `
    <h3>🔍 Pista final</h3>
    <p class="pista">${currentMission.pista_al_llegar}</p>
    <div class="actions">
      <button class="btn btn-primary" id="scan-btn">🔍 Escanear QR</button>
    </div>
    <div style="margin-top:1.2rem; font-size:0.9rem;">
      🔑 Código de recuperación: <code>${recoveryCode}</code>
    </div>
  `;
  
  document.getElementById('phase3-pista').style.display = 'block';
  document.getElementById('scan-btn').addEventListener('click', openQRScanner);
  
  if (window.playNarration) {
    playNarration(`Cazador ${jugador.id.replace('LH-', '')}. Estás en la zona. La pista final ha sido revelada.`);
  }
}

// ========== FASE 4: MISIÓN COMPLETADA ==========

/**
 * Mostrar Fase 4 - Misión completada
 */
function showMissionCompleted() {
  hideAllPhases();
  
  const elapsedMinutes = Math.floor((Date.now() - missionStartTime) / 60000);
  const recoveryCode = localStorage.getItem(`recovery_${jugador.id}`) || '—';
  const missionTitle = jugador.modo === 'equipo' ? currentTeamMission.titulo : currentMission.titulo;
  
  document.querySelector('#phase4-completed .mission-card').innerHTML = `
    <h2 style="color:#ffd700; margin-bottom:1rem;">✅ Operación Completada</h2>
    <p><strong>${missionTitle}</strong></p>
    <p style="font-size:0.95rem; color:#cbd5e1; margin:1rem 0;">
      Tu posición ha sido registrada en el sistema central.
    </p>
    <div style="margin:1.5rem 0; font-size:0.9rem; color:#64b5f7;">
      ⏱️ Completado en: <strong>${elapsedMinutes} min</strong>
    </div>
    <div style="font-size:0.85rem; color:#94a3b8; margin-bottom:1.5rem;">
      🔑 Código: <code>${recoveryCode}</code>
    </div>
    <div style="
      margin:1.2rem 0;
      padding:0.8rem;
      border-radius:10px;
      background:rgba(255,215,0,0.08);
      color:#ffd700;
      font-size:0.9rem;
    ">
      🎖️ <strong>Desafío completado</strong><br>
      Has ganado el badge <strong>"Primer Cazador"</strong><br>
      📡 Tu alias permanece visible en el radar
    </div>
    <div class="actions">
      <button class="btn btn-primary" id="new-mission-btn">🔁 Nueva operación</button>
      <button class="btn btn-outline" id="view-progress-btn">📊 Ver progreso</button>
    </div>
  `;
  
  document.getElementById('phase4-completed').style.display = 'block';
  document.getElementById('new-mission-btn').addEventListener('click', () => {
    window.location.href = 'registro.html';
  });
  document.getElementById('view-progress-btn').addEventListener('click', () => {
    window.location.href = 'progreso.html';
  });
}

// ========== MISIÓN DE REDENCIÓN ==========

/**
 * Mostrar misión de redención
 */
async function showRedemptionMission() {
  if (redemptionOffered) return;
  
  const allZones = ['CABA', 'Avellaneda', 'Lanús', 'Lomas de Zamora'];
  const otherZones = allZones.filter(z => z !== jugador.zona);
  const randomZone = otherZones[Math.floor(Math.random() * otherZones.length)];
  const redemptionMission = selectRandomMission(randomZone, 'solitario');
  
  document.querySelector('#phase1-consigna .mission-card').innerHTML = `
    <div class="mission-title">
      <span class="icon">🕊️</span>
      <span class="title-text">Misión de Redención</span>
    </div>
    <div class="tension-bar" style="margin: 1rem 0; background: rgba(106, 170, 255, 0.15);">
      🌟 Segunda oportunidad
    </div>
    <p class="pista">
      No todos los cazadores triunfan a la primera. Pero tú... tienes el instinto necesario.
      <br><br>
      <strong>${redemptionMission.titulo}</strong><br>
      ${redemptionMission.descripcion_narrativa || redemptionMission.pista_al_llegar}
    </p>
    <button class="btn btn-primary" id="accept-redemption-btn">✅ Aceptar misión de redención</button>
    <button class="btn btn-outline" id="retry-original-btn" style="margin-top: 10px;">🔄 Intentar original</button>
  `;
  
  redemptionOffered = true;
  
  document.getElementById('accept-redemption-btn').addEventListener('click', () => {
    currentMission = redemptionMission;
    jugador.zona = randomZone;
    localStorage.setItem(`jugador_${jugador.id}`, JSON.stringify(jugador));
    missionStartTime = Date.now();
    startTimer();
    guardarProgreso(currentMission.id);
    showPhase2();
  });
  
  document.getElementById('retry-original-btn').addEventListener('click', showPhase1);
}

// ========== CONSUELO NARRATIVO ==========

/**
 * Reproducir consuelo narrativo
 * @param {string} failureReason - Razón del fallo
 */
function playConsolationNarration(failureReason) {
  const consolations = {
    'timeout': "El tiempo se agotó, pero tu instinto de caza permanece. Hay otras presas esperando.",
    'already_completed': "Alguien fue más rápido, pero eso no define tu habilidad. El verdadero cazador siempre encuentra otra oportunidad.",
    'wrong_code': "El código no era correcto, pero cada error te acerca más a la verdad. Confía en tu instinto.",
    'general': "No todos los cazadores triunfan a la primera. Pero los verdaderos nunca se rinden."
  };
  const message = consolations[failureReason] || consolations.general;
  
  if (window.playNarration) {
    playNarration(message);
  }
}

/**
 * Obtener sugerencia basada en contexto
 * @param {string} failureReason - Razón del fallo
 * @returns {string}
 */
function getSuggestionBasedOnContext(failureReason) {
  let suggestion = "";
  if (failureReason === 'timeout') {
    suggestion = "💡 Consejo: Prueba en horario de menor tráfico peatonal.";
  } else if (failureReason === 'already_completed') {
    suggestion = "💡 Consejo: Activa notificaciones para saber cuándo hay nuevas misiones disponibles.";
  } else if (failureReason === 'wrong_code') {
    suggestion = "💡 Consejo: Asegúrate de estar en el lugar exacto antes de escanear.";
  } else {
    suggestion = "💡 Consejo: Cada cacería te hace más fuerte. ¡Intenta de nuevo!";
  }
  return suggestion;
}

// ========== TEMPORIZADOR ==========

/**
 * Iniciar temporizador de 90 minutos
 */
function startTimer() {
  document.getElementById('timer').textContent = "90:00";
  let timeLeft = 90 * 60;
  const timerEl = document.getElementById('timer');
  
  const interval = setInterval(() => {
    if (timeLeft <= 0) {
      timerEl.textContent = "⏰ Caducada";
      clearInterval(interval);
      playConsolationNarration('timeout');
      
      setTimeout(() => {
        document.querySelector('#phase1-consigna .mission-card').innerHTML = `
          <div class="mission-title">
            <span class="icon">⏰</span>
            <span class="title-text">Tiempo agotado</span>
          </div>
          <div class="tension-bar" style="margin: 1rem 0; background: rgba(255, 170, 51, 0.15);">
            ⏳ La misión ha caducado
          </div>
          <p class="pista">
            ${getSuggestionBasedOnContext('timeout')}
            <br><br>
            Pero el espíritu de caza nunca muere. ¿Aceptas una segunda oportunidad?
          </p>
          <button class="btn btn-primary" id="redemption-timeout-btn">🕊️ Misión de redención</button>
          <button class="btn btn-outline" id="new-mission-timeout-btn" style="margin-top: 10px;">🎯 Nueva misión</button>
        `;
        document.getElementById('phase1-consigna').style.display = 'block';
        document.getElementById('phase2-mapa').style.display = 'none';
        document.getElementById('redemption-timeout-btn').addEventListener('click', showRedemptionMission);
        document.getElementById('new-mission-timeout-btn').addEventListener('click', () => {
          window.location.href = 'registro.html';
        });
      }, 2000);
      return;
    }
    
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    timeLeft--;
  }, 1000);
}

// ========== GEOLOCALIZACIÓN Y PROXIMIDAD ==========

/**
 * Iniciar verificación de proximidad
 * @param {number} targetLat - Latitud objetivo
 * @param {number} targetLng - Longitud objetivo
 */
function startProximityCheck(targetLat, targetLng) {
  if (navigator.geolocation) {
    document.getElementById('proximity-instructions').textContent = "Verificando tu ubicación...";
    proximityWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        const distance = calculateDistance(userLat, userLng, targetLat, targetLng);
        const statusEl = document.getElementById('proximity-status');
        
        if (distance <= 50) {
          statusEl.innerHTML = "✅ ¡Estás en la zona! Puedes acceder a la pista final.";
          statusEl.style.color = "#4ade80";
          if (!document.getElementById('unlock-phase3-btn')) {
            const btn = document.createElement('button');
            btn.id = 'unlock-phase3-btn';
            btn.className = 'btn btn-primary';
            btn.textContent = '🔓 Acceder a la pista final';
            btn.onclick = showPhase3;
            document.querySelector('#phase2-mapa .mission-card').appendChild(btn);
          }
        } else {
          statusEl.innerHTML = `📍 A ${Math.round(distance)} metros del objetivo. Acércate más.`;
          statusEl.style.color = "#64b5f7";
          const unlockBtn = document.getElementById('unlock-phase3-btn');
          if (unlockBtn) unlockBtn.remove();
        }
      },
      (err) => {
        document.getElementById('proximity-status').textContent = "⚠️ No se pudo obtener tu ubicación. Activa GPS.";
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );
  } else {
    document.getElementById('proximity-status').textContent = "⚠️ Tu navegador no soporta geolocalización.";
  }
}

/**
 * Calcular distancia entre dos coordenadas
 * @param {number} lat1 - Latitud 1
 * @param {number} lon1 - Longitud 1
 * @param {number} lat2 - Latitud 2
 * @param {number} lon2 - Longitud 2
 * @returns {number} Distancia en metros
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// ========== MAPA ==========

/**
 * Cargar mapa de aproximación
 * @param {number} lat - Latitud
 * @param {number} lng - Longitud
 */
function loadApproxMap(lat, lng) {
  if (!window.L) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => initApproxMap(lat, lng);
    document.head.appendChild(script);
  } else {
    initApproxMap(lat, lng);
  }
}

/**
 * Inicializar mapa de aproximación
 * @param {number} lat - Latitud
 * @param {number} lng - Longitud
 */
function initApproxMap(lat, lng) {
  const map = L.map('mapApprox').setView([lat, lng], 18.5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  L.circle([lat, lng], {
    color: '#ff6b6b',
    fillColor: '#ff6b6b',
    fillOpacity: 0.15,
    radius: 50
  }).addTo(map);
  L.marker([lat, lng]).addTo(map).bindPopup(`<strong>Objetivo</strong><br>Zona de 50m`);
}

// ========== UTILIDADES ==========

/**
 * Generar código de recuperación
 * @returns {string}
 */
function generarRecoveryCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'LH';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Guardar progreso
 * @param {string} misionId - ID de misión
 * @param {string} desafioId - ID de desafío
 */
function guardarProgreso(misionId = null, desafioId = null) {
  const firebaseUid = localStorage.getItem('currentFirebaseUid');
  const key = `progreso_${jugador.id}`;
  let data = JSON.parse(localStorage.getItem(key) || '{}');
  
  if (!data.misiones) data.misiones = 0;
  if (!data.desafios) data.desafios = 0;
  if (!data.zona) data.zona = jugador.zona;
  
  if (misionId) {
    const misionesKey = `misiones_aceptadas_${jugador.id}`;
    let misiones = JSON.parse(localStorage.getItem(misionesKey) || '[]');
    if (!misiones.includes(misionId)) {
      misiones.push(misionId);
      localStorage.setItem(misionesKey, JSON.stringify(misiones));
      data.misiones = misiones.length;
      
      // Guardar en Firebase también si hay uid
      if (firebaseUid && window.firebaseSaveMisionProgreso) {
        firebaseSaveMisionProgreso(firebaseUid, misionId);
      }
    }
  }
  
  if (desafioId) {
    const desafiosKey = `desafios_completados_${jugador.id}`;
    let desafios = JSON.parse(localStorage.getItem(desafiosKey) || '[]');
    if (!desafios.includes(desafioId)) {
      desafios.push(desafioId);
      localStorage.setItem(desafiosKey, JSON.stringify(desafios));
      data.desafios = desafios.length;
    }
  }
  
  data.zona = jugador.zona;
  data.lastUpdate = Date.now();
  localStorage.setItem(key, JSON.stringify(data));
}

// ========== EXPORTAR FUNCIONES GLOBALES ==========
window.loadMisiones = loadMisiones;
window.getMisionesByZona = getMisionesByZona;
window.selectRandomMission = selectRandomMission;
window.hideAllPhases = hideAllPhases;
window.showPhase1 = showPhase1;
window.showPhase2 = showPhase2;
window.showPhase3 = showPhase3;
window.showMissionCompleted = showMissionCompleted;
window.showRedemptionMission = showRedemptionMission;
window.playConsolationNarration = playConsolationNarration;
window.getSuggestionBasedOnContext = getSuggestionBasedOnContext;
window.startTimer = startTimer;
window.startProximityCheck = startProximityCheck;
window.calculateDistance = calculateDistance;
window.loadApproxMap = loadApproxMap;
window.initApproxMap = initApproxMap;
window.generarRecoveryCode = generarRecoveryCode;
window.guardarProgreso = guardarProgreso;

console.log('✅ missions.js cargado correctamente');