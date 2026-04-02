/**
 * ==========================================================================
   app.js - Codigo Ebel | Inicialización y Orquestación (VERSIÓN FINAL CORREGIDA)
   ========================================================================== */

// ========== FIREBASE (INICIALIZACIÓN) ==========
const firebaseConfig = {
  apiKey: "AIzaSyDvMo1LPD_FGk-Ahju8oN7WEn9w0B5bqUE",
  authDomain: "let-s-hunt.firebaseapp.com",
  databaseURL: "https://let-s-hunt-default-rtdb.firebaseio.com",
  projectId: "let-s-hunt",
  storageBucket: "let-s-hunt.firebasestorage.app",
  messagingSenderId: "787017812046",
  appId: "1:787017812046:web:da098b2361df4dda995b1f",
  measurementId: "G-07SR9WR8NV"
};

// ✅ Inicializar Firebase (solo si no está ya inicializado)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();
const auth = firebase.auth();
const analytics = firebase.analytics();

// ========== VARIABLES GLOBALES ==========
let accessibilityMode = localStorage.getItem('lh_accessibility_mode') || 'normal';
let redemptionOffered = false;
let misionesSolitario = [];
let misionesEquipo = [];
let currentMission = null;
let currentTeamMission = null;
let missionStartTime = null;
let jugador = null;
let firebaseUser = null;
let deferredPrompt = null;
let scannerActive = false;
let stream = null;
let proximityWatchId = null;
let gpsWatchId = null;
let mapInstance = null;
let missionTimer = null;
let globalTimer = null;
let radarInterval = null;
let teamCoordinationTimer = null;
let playerProgress = {
  level: 1,
  missionsCompleted: 0,
  streak: 0,
  lastPlayed: null,
  unlockedZones: ['CABA'],
  badges: []
};

// ========== CONSTANTES ==========
const GPS_ACCURACY_THRESHOLD = 40;
const MISSION_RADIUS = 50;

// ========== FUNCIÓN UNIFICADA PARA ZONA (FUENTE DE VERDAD) ==========
function getZonaFinal() {
  const params = new URLSearchParams(window.location.search);
  
  // 1. PRIORIDAD: URL (si viene explícita)
  let zona = params.get('zona');
  if (zona) {
    zona = decodeURIComponent(zona).replace(/\+/g, ' ').trim();
    localStorage.setItem('zonaSeleccionada', zona);
    return zona;
  }
  
  // 2. SEGUNDA: localStorage (persistencia real del usuario)
  const savedZona = localStorage.getItem('zonaSeleccionada');
  if (savedZona) return savedZona;
  
  // 3. FALLBACK: CABA (solo si no hay nada)
  return 'CABA';
}

// ========== CLEANUP ==========
function stopGPS() {
  if (gpsWatchId !== null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }
  if (proximityWatchId !== null) {
    navigator.geolocation.clearWatch(proximityWatchId);
    proximityWatchId = null;
  }
}

function cleanupMap() {
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
}

function stopTimer() {
  if (missionTimer !== null) {
    clearInterval(missionTimer);
    missionTimer = null;
  }
  if (globalTimer !== null) {
    clearInterval(globalTimer);
    globalTimer = null;
  }
}

function cleanupAll() {
  stopGPS();
  cleanupMap();
  stopTimer();
  if (radarInterval !== null) {
    clearInterval(radarInterval);
    radarInterval = null;
  }
  if (teamCoordinationTimer) {
    clearInterval(teamCoordinationTimer);
    teamCoordinationTimer = null;
  }
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
}

// ========== VALIDAR GPS ==========
function validateGPSAccuracy(position) {
  if (!position || !position.coords) return { valid: false, reason: 'Sin coordenadas' };
  const accuracy = position.coords.accuracy;
  const timestamp = position.timestamp || Date.now();
  const now = Date.now();
  
  if (now - timestamp > 60000) {
    return { valid: false, reason: 'Timestamp muy viejo', accuracy };
  }
  
  if (accuracy > GPS_ACCURACY_THRESHOLD) {
    return { valid: false, reason: 'Precisión insuficiente', accuracy };
  }
  const { latitude, longitude } = position.coords;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return { valid: false, reason: 'Coordenadas inválidas' };
  }
  if (position.coords.speed !== null && position.coords.speed > 100) {
    return { valid: false, reason: 'Velocidad sospechosa' };
  }
  return { valid: true, accuracy, latitude, longitude, timestamp };
}

// ========== TOAST ==========
function showToast(msg, duration = 3500) {
  const t = document.getElementById('toast');
  if (t) {
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), duration);
  }
}

// ========== ACCESIBILIDAD ==========
function applyAccessibilityMode() {
  const body = document.body;
  body.classList.remove('accessibility-high-contrast', 'accessibility-large-text');
  ['accessibility-high-contrast-styles', 'accessibility-large-text-styles'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
  if (accessibilityMode === 'high-contrast') {
    body.classList.add('accessibility-high-contrast');
    const style = document.createElement('style');
    style.id = 'accessibility-high-contrast-styles';
    style.textContent = '.accessibility-high-contrast{background:black!important;color:yellow!important}.accessibility-high-contrast .mission-card,.accessibility-high-contrast .modal-content{background:#111!important;border:2px solid yellow!important;color:yellow!important}.accessibility-high-contrast button,.accessibility-high-contrast .btn{background:yellow!important;color:black!important;border:2px solid yellow!important;font-weight:bold!important}';
    document.head.appendChild(style);
  } else if (accessibilityMode === 'large-text') {
    body.classList.add('accessibility-large-text');
    const style = document.createElement('style');
    style.id = 'accessibility-large-text-styles';
    style.textContent = '.accessibility-large-text{font-size:110%!important}.accessibility-large-text h1{font-size:180%!important}.accessibility-large-text h2{font-size:160%!important}.accessibility-large-text h3{font-size:140%!important}.accessibility-large-text p{font-size:120%!important}.accessibility-large-text button{padding:12px 20px!important;font-size:110%!important;min-height:50px!important}';
    document.head.appendChild(style);
  }
  updateAccessibilityButton();
}

function updateAccessibilityButton() {
  const btn = document.getElementById('accessibility-toggle');
  if (!btn) return;
  const modes = { 'normal': '👁️', 'high-contrast': '☀️', 'large-text': '🅰️' };
  btn.textContent = modes[accessibilityMode] || '👁️';
}

function toggleAccessibilityMode() {
  const modes = ['normal', 'high-contrast', 'large-text'];
  const idx = modes.indexOf(accessibilityMode);
  accessibilityMode = modes[(idx + 1) % modes.length];
  localStorage.setItem('lh_accessibility_mode', accessibilityMode);
  applyAccessibilityMode();
  showToast('✅ ' + accessibilityMode);
}

// ========== POSICIONAMIENTO ==========
function updateFloatingControlsPosition() {
  const controls = document.getElementById('floating-controls');
  if (!controls) return;
  const nav = document.querySelector('.mobile-nav');
  const navVisible = nav && window.getComputedStyle(nav).display !== 'none';
  controls.style.bottom = navVisible ? ((nav.offsetHeight || 60) + 20) + 'px' : '20px';
}

// ========== CARGAR MISIONES ==========
async function loadMisiones() {
  try {
    const [res1, res2] = await Promise.all([
      fetch('misiones-solitario.json'),
      fetch('misiones-equipo-local.json')
    ]);
    if (!res1.ok || !res2.ok) throw new Error('Error JSON');
    misionesSolitario = await res1.json();
    misionesEquipo = await res2.json();
  } catch (err) {
    console.error('⚠️ Error cargando misiones:', err);
    showToast('⚠️ Usando misiones de prueba');
    misionesSolitario = [{
      id: 1,
      zona: 'CABA',
      titulo: 'Misión de prueba',
      ubicacion_mapa: 'Plaza de Mayo',
      pista_al_llegar: 'Busca la pista final.',
      coordenadas: { lat: -34.6037, lng: -58.3816 }
    }];
  }
}

// ========== UTILIDADES MISIÓN ==========
function getMisionesByZona(zona, tipo) {
  tipo = tipo || 'solitario';
  const lista = tipo === 'equipo' ? misionesEquipo : misionesSolitario;
  const z = (zona || '').trim().toLowerCase();
  const barrios = ['san telmo','la boca','recoleta','microcentro','palermo','congreso','almagro','retiro','balvanera','villa crespo','belgrano','barracas','flores','villa urquiza','puerto madero','san cristóbal'];
  return lista.filter(m => {
    const mz = (m.zona || '').trim().toLowerCase();
    return mz === z || (z === 'caba' && barrios.includes(mz)) || (barrios.includes(z) && barrios.includes(mz));
  });
}

function selectRandomMission(zona, tipo) {
  tipo = tipo || 'solitario';
  const misiones = getMisionesByZona(zona, tipo);
  return misiones.length > 0 ? misiones[Math.floor(Math.random() * misiones.length)] : (misionesSolitario[0] || null);
}

// ========== OCULTAR FASES ==========
function hideAllPhases() {
  cleanupAll();
  ['phase0-intro','phase1-consigna','phase2-mapa','phase3-pista','phase4-completed','teamSection','radar-section'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

// ========== FIREBASE: VERIFICAR MISIÓN ==========
async function isMisionDisponible(misionId, zona) {
  try {
    const ref = db.ref('misiones_publicas/' + misionId + '-' + zona);
    const snap = await ref.once('value');
    if (!snap.exists()) return false;
    return snap.val().estado !== 'completada';
  } catch (err) {
    console.error('Error Firebase:', err);
    return false;
  }
}

// ========== FIREBASE: SYNC PROGRESO ==========
async function syncProgresoToFirebase(firebaseUid, data) {
  if (!firebaseUid) return;
  try {
    await db.ref('jugadores/' + firebaseUid).update({
      hunterId: data.hunterId || null,
      zona: data.zona || null,
      modo: data.modo || null
    });
  } catch (err) {
    console.warn('⚠️ Sync offline:', err);
  }
}

async function restoreProgresoFromFirebase(firebaseUid) {
  if (!firebaseUid) return null;
  try {
    const snap = await db.ref('jugadores/' + firebaseUid).once('value');
    if (snap.exists()) {
      return snap.val();
    }
  } catch (err) { console.warn('⚠️ Restore offline:', err); }
  return null;
}

// ========== CONFIGURACIÓN JUGADOR ==========
function setupJugador() {
  const urlParams = new URLSearchParams(window.location.search);
  let hunterId = urlParams.get('id') || localStorage.getItem('currentHunterId');
  
  auth.signInAnonymously().catch(function(error) {
    console.error('Error al iniciar sesión anónima:', error);
  });
  
  auth.onAuthStateChanged(function(user) {
    if (user) {
      firebaseUser = user;
      localStorage.setItem('firebaseUid', user.uid);
      _continueSetupJugador(hunterId, user.uid);
    } else {
      _continueSetupJugador(hunterId, null);
    }
  });
}

async function _continueSetupJugador(hunterId, firebaseUid) {
  let restoredData = null;
  if (firebaseUid) {
    restoredData = await restoreProgresoFromFirebase(firebaseUid);
  }
  
  if (!hunterId) {
    const nextId = parseInt(localStorage.getItem('lastHunterId') || '0') + 1;
    hunterId = 'LH-' + String(nextId).padStart(4, '0');
    localStorage.setItem('lastHunterId', nextId);
    
    // ✅ CORREGIDO: Obtener zona del URL y respetarla SIEMPRE
    const ciudadFromURL = decodeURIComponent((new URLSearchParams(window.location.search).get('zona') || 'CABA').replace(/\+/g, ' ')).trim();
    jugador = {
      id: hunterId,
      nombre: 'Jugador de Prueba',
      telefono: '+5491112345678',
      zona: ciudadFromURL,
      modo: 'individual'
    };
    
    localStorage.setItem('jugador_' + hunterId, JSON.stringify(jugador));
    localStorage.setItem('currentHunterId', hunterId);
    
    if (firebaseUid) {
      syncProgresoToFirebase(firebaseUid, {
        hunterId: hunterId,
        zona: ciudadFromURL,
        modo: 'individual'
      });
    }
  } else {
    let storedJugador = null;
    
    if (restoredData && restoredData.hunterId === hunterId) {
      storedJugador = {
        id: restoredData.hunterId,
        zona: restoredData.zona,
        modo: restoredData.modo
      };
    } else {
      try {
        storedJugador = JSON.parse(localStorage.getItem('jugador_' + hunterId));
      } catch (e) {
        console.warn('Datos corruptos en localStorage. Reiniciando jugador.');
        storedJugador = null;
      }
    }
    
    // ✅ CORREGIDO: Siempre usar la zona del URL (sin verificar misiones)
    jugador = storedJugador || { id: hunterId, zona: 'CABA', modo: 'individual' };
    const zonaUrl = decodeURIComponent((new URLSearchParams(window.location.search).get('zona') || '').replace(/\+/g, ' ')).trim();
    if (zonaUrl) {
      jugador.zona = zonaUrl;
    }
    
    localStorage.setItem('jugador_' + hunterId, JSON.stringify(jugador));
    localStorage.setItem('currentHunterId', hunterId);
    
    if (firebaseUid) {
      syncProgresoToFirebase(firebaseUid, {
        hunterId: jugador.id,
        zona: jugador.zona,
        modo: jugador.modo
      });
    }
  }
  
  // ✅ Actualizar UI con la zona correcta
  document.getElementById('hunterIdDisplay').textContent = jugador.modo === 'equipo' ? ('👥 ' + (jugador.equipo || hunterId)) : ('ID: ' + hunterId);
  document.getElementById('activation-zone').innerHTML = `Tu señal ha sido detectada en <strong>${jugador.zona}</strong>`;
  
  redemptionOffered = false;
  
  if (jugador.modo === 'equipo') {
    showTeamMission();
  } else {
    showPhase1();
  }
}

// ========== PANTALLA ACTIVACIÓN ==========
function showActivationScreen() {
  const screen = document.getElementById('activation-screen');
  const zoneEl = document.getElementById('activation-zone');
  const textEl = document.getElementById('activation-text');
  const btn = document.getElementById('enter-system-btn');
  
  // ✅ Actualizar zona en UI
  if (zoneEl && jugador?.zona) {
    // Formatear zona para mostrar (primera letra mayúscula)
    const zonaDisplay = jugador.zona.split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    zoneEl.innerHTML = `Tu señal ha sido detectada en <strong>${zonaDisplay}</strong>`;
  }
  
  // Secuencia de pasos de loading
  const steps = [
    { text: 'Sincronizando misiones activas...', delay: 800 },
    { text: 'Verificando tu zona de juego...', delay: 800 },
    { text: 'Preparando tu primera cacería...', delay: 800 },
    { text: '✅ Listo para empezar', delay: 400 }
  ];
  
  let i = 0;
  const interval = setInterval(() => {
    if (i < steps.length && textEl) {
      textEl.textContent = steps[i].text;
      i++;
    }
  }, 800);
  
  // ✅ Habilitar botón y desbloquear flujo
  setTimeout(() => {
    clearInterval(interval);
    
    // 🔥 FORZAR texto final
    if (textEl) textEl.textContent = '✅ Listo para empezar';
    
    if (btn) {
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
      btn.addEventListener('click', () => {
        screen.style.display = 'none';
        
        // 🔥 INICIAR GEOLOCALIZACIÓN AL ENTRAR
        if (typeof iniciarGeolocalizacion === 'function') {
          iniciarGeolocalizacion();
        }
        
        if (jugador.modo === 'equipo') showTeamMission();
        else showPhase0();
      }, { once: true });
    }
  }, 2500);
  
  screen.style.display = 'flex';
}

// ========== ACTUALIZAR PROGRESO ==========
async function updateProgressDisplay() {
  const firebaseUid = localStorage.getItem('firebaseUid');
  
  if (firebaseUid) {
    try {
      const snap = await db.ref(`jugadores/${firebaseUid}`).once('value');
      if (snap.exists()) {
        const data = snap.val();
        const desafiosRef = db.ref(`desafios_completados/${firebaseUid}`);
        const desafiosSnap = await desafiosRef.once('value');
        const misionesCompletadas = desafiosSnap.exists() 
          ? Object.keys(desafiosSnap.val()).length 
          : 0;
        
        const thresholds = [0, 3, 7, 12, 20];
        const level = thresholds.findIndex((t, i, arr) => 
          misionesCompletadas < (arr[i+1] || Infinity)
        ) + 1;
        
        const streak = data.streak || 0;
        
        document.getElementById('missions-count').textContent = misionesCompletadas;
        document.getElementById('streak-count').textContent = streak;
        document.getElementById('current-level').textContent = 'N' + level;
        
        const levelEl = document.getElementById('level-display');
        if (levelEl) levelEl.textContent = 'N' + level;
        
        playerProgress = {
          ...playerProgress,
          missionsCompleted: misionesCompletadas,
          level: level,
          streak: streak
        };
        return;
      }
    } catch (err) {
      console.warn('⚠️ Error obteniendo progreso:', err);
    }
  }
  
  document.getElementById('missions-count').textContent = playerProgress.missionsCompleted;
  document.getElementById('streak-count').textContent = playerProgress.streak;
  document.getElementById('current-level').textContent = 'N' + playerProgress.level;
  
  const levelEl = document.getElementById('level-display');
  if (levelEl) levelEl.textContent = 'N' + playerProgress.level;
}

async function checkLevelUp() {
  const firebaseUid = localStorage.getItem('firebaseUid');
  if (firebaseUid) {
    try {
      const desafiosRef = db.ref(`desafios_completados/${firebaseUid}`);
      const desafiosSnap = await desafiosRef.once('value');
      const misionesCompletadas = desafiosSnap.exists() 
        ? Object.keys(desafiosSnap.val()).length 
        : 0;
      
      const thresholds = [0, 3, 7, 12, 20];
      const newLevel = thresholds.findIndex((t, i, arr) => 
        misionesCompletadas < (arr[i+1] || Infinity)
      ) + 1;
      
      if (newLevel > playerProgress.level) {
        playerProgress.level = newLevel;
        showToast('🎉 ¡Nivel ' + newLevel + ' desbloqueado!');
        if (newLevel >= 2 && !playerProgress.unlockedZones.includes('Avellaneda')) {
          playerProgress.unlockedZones.push('Avellaneda');
          showToast('🗺️ Nueva zona: Avellaneda');
        }
        if (newLevel >= 3 && !playerProgress.unlockedZones.includes('Lanús')) {
          playerProgress.unlockedZones.push('Lanús');
          showToast('🗺️ Nueva zona: Lanús');
        }
        updateProgressDisplay();
      }
      return;
    } catch (err) {
      console.warn('⚠️ Error verificando nivel:', err);
    }
  }
  const thresholds = [0, 3, 7, 12, 20];
  const newLevel = thresholds.findIndex((t, i, arr) => 
    playerProgress.missionsCompleted < (arr[i+1] || Infinity)
  ) + 1;
  if (newLevel > playerProgress.level) {
    playerProgress.level = newLevel;
    showToast('🎉 ¡Nivel ' + newLevel + ' desbloqueado!');
    updateProgressDisplay();
  }
}

// ========== GUARDAR PROGRESO ==========
function guardarProgreso(misionId, desafioId) {
  const key = 'progreso_' + jugador.id;
  let data = JSON.parse(localStorage.getItem(key) || '{}');
  if (!data.misiones) data.misiones = 0;
  if (!data.desafios) data.desafios = 0;
  if (!data.zona) data.zona = jugador.zona;
  if (misionId) {
    const mKey = 'misiones_aceptadas_' + jugador.id;
    let misiones = JSON.parse(localStorage.getItem(mKey) || '[]');
    if (!misiones.includes(misionId)) {
      misiones.push(misionId);
      localStorage.setItem(mKey, JSON.stringify(misiones));
      data.misiones = misiones.length;
    }
  }
  if (desafioId) {
    const dKey = 'desafios_completados_' + jugador.id;
    let desafios = JSON.parse(localStorage.getItem(dKey) || '[]');
    if (!desafios.includes(desafioId)) {
      desafios.push(desafioId);
      localStorage.setItem(dKey, JSON.stringify(desafios));
      data.desafios = desafios.length;
    }
  }
  data.zona = jugador.zona;
  data.lastUpdate = Date.now();
  localStorage.setItem(key, JSON.stringify(data));
}

// ========== NARRACIÓN ==========
function playNarration(text) {
  if (localStorage.getItem('lh_narration_off') === '1') return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.62;
  u.pitch = 0.4;
  u.volume = 0.95;
  const loadVoice = () => {
    const voices = speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.includes('es') && (v.name.includes('Male') || v.name === 'Diego' || v.name === 'Juan'))
      || voices.find(v => v.lang.includes('es')) || null;
    if (voice) u.voice = voice;
  };
  loadVoice();
  speechSynthesis.addEventListener('voiceschanged', loadVoice, { once: true });
  speechSynthesis.speak(u);
}

function playConsolationNarration(reason) {
  const msgs = {
    timeout: 'El tiempo se agotó, pero tu instinto de caza permanece.',
    already_completed: 'Alguien fue más rápido, pero eso no define tu habilidad.',
    wrong_code: 'El código no era correcto, pero cada error te acerca más a la verdad.',
    general: 'No todos los cazadores triunfan a la primera. Pero los verdaderos nunca se rinden.'
  };
  playNarration(msgs[reason] || msgs.general);
}

// ========== SHOW REDEMPTION ==========
async function showRedemptionMission() {
  if (redemptionOffered) return;
  cleanupAll();
  const allZones = ['CABA','Avellaneda','Lanús','Lomas de Zamora'].filter(z => playerProgress.unlockedZones.includes(z));
  const otherZones = allZones.filter(z => z !== jugador.zona);
  const randomZone = otherZones[Math.floor(Math.random() * otherZones.length)] || jugador.zona;
  const redemption = selectRandomMission(randomZone, 'solitario');
  document.querySelector('#phase1-consigna .mission-card').innerHTML = `
    <div class="mission-title"><span class="icon">🕊️</span><span class="title-text">Misión de Redención</span></div>
    <div class="tension-bar" style="margin:1rem 0;background:rgba(106,170,255,0.15)">🌟 Segunda oportunidad</div>
    <p class="pista">No todos los cazadores triunfan a la primera. Pero tú... tienes el instinto necesario.<br><br><strong>${redemption.titulo}</strong><br>${redemption.descripcion_narrativa || redemption.pista_al_llegar}</p>
    <button class="btn btn-primary" id="accept-redemption-btn">✅ Aceptar misión de redención</button>
    <button class="btn btn-outline" id="retry-original-btn" style="margin-top:10px">🔄 Intentar original</button>
  `;
  redemptionOffered = true;
  document.getElementById('accept-redemption-btn').onclick = () => {
    currentMission = redemption;
    jugador.zona = randomZone;
    localStorage.setItem('jugador_' + jugador.id, JSON.stringify(jugador));
    missionStartTime = Date.now();
    startTimer();
    guardarProgreso(currentMission.id);
    showPhase2();
  };
  document.getElementById('retry-original-btn').onclick = showPhase0;
}

// ========== SHOW PHASE 0 ==========
async function showPhase0() {
  cleanupAll();
  currentMission = selectRandomMission(jugador.zona, 'solitario');
  if (!currentMission) { showToast('⚠️ No hay misiones'); return; }
  analytics.logEvent('mision_aceptada', { zona: jugador.zona, tipo: 'solitario', hunter_id: jugador.id });
  const disponible = await isMisionDisponible(currentMission.id, jugador.zona);
  if (!disponible) {
    playConsolationNarration('already_completed');
    document.querySelector('#phase1-consigna .mission-card').innerHTML = `
      <div class="mission-title"><span class="icon">⚠️</span><span class="title-text">Misión ya completada</span></div>
      <div class="tension-bar" style="margin:1rem 0;background:rgba(255,170,51,0.15)">⏳ Alguien fue más rápido</div>
      <p class="pista">💡 Consejo: Activa notificaciones para nuevas misiones.<br><br>En Let's Hunt, cada fracaso es una lección.</p>
      <button class="btn btn-primary" id="new-mission-btn">🎯 Nueva misión</button>
      <button class="btn btn-outline" id="redemption-btn" style="margin-top:10px">🕊️ Misión de redención</button>
    `;
    document.getElementById('phase1-consigna').style.display = 'block';
    document.getElementById('new-mission-btn').onclick = showPhase0;
    document.getElementById('redemption-btn').onclick = showRedemptionMission;
    return;
  }
  document.getElementById('intro-mission-title').textContent = currentMission.titulo;
  document.getElementById('intro-mission-desc').textContent = (currentMission.descripcion_narrativa || currentMission.pista_al_llegar).substring(0, 120) + '...';
  document.getElementById('phase0-intro').style.display = 'block';
  document.getElementById('accept-intro-btn').onclick = async () => {
    document.getElementById('phase0-intro').style.display = 'none';
    const firebaseUid = localStorage.getItem('firebaseUid');
    if (firebaseUid && currentMission) {
      try {
        const asignarMision = firebase.functions().httpsCallable('asignarMision');
        await asignarMision({
          misionId: currentMission.id,
          zona: jugador.zona
        });
      } catch (err) {
        console.warn('⚠️ Error asignando misión:', err);
        showToast('⚠️ Error: ' + err.message);
        return;
      }
    }
    missionStartTime = Date.now();
    startTimer();
    startGlobalTimer();
    guardarProgreso(currentMission.id);
    showPhase2();
  };
}

// ========== SHOW PHASE 1 ==========
async function showPhase1() {
  cleanupAll();
  currentMission = selectRandomMission(jugador.zona, 'solitario');
  if (!currentMission) { showToast('⚠️ No hay misiones'); return; }
  analytics.logEvent('mision_aceptada', { zona: jugador.zona, tipo: 'solitario', hunter_id: jugador.id });
  const disponible = await isMisionDisponible(currentMission.id, jugador.zona);
  if (!disponible) {
    playConsolationNarration('already_completed');
    document.querySelector('#phase1-consigna .mission-card').innerHTML = `
      <div class="mission-title"><span class="icon">⚠️</span><span class="title-text">Misión ya completada</span></div>
      <div class="tension-bar" style="margin:1rem 0;background:rgba(255,170,51,0.15)">⏳ Alguien fue más rápido</div>
      <p class="pista">💡 Consejo: Activa notificaciones para nuevas misiones.<br><br>En Let's Hunt, cada fracaso es una lección.</p>
      <button class="btn btn-primary" id="new-mission-btn">🎯 Nueva misión</button>
      <button class="btn btn-outline" id="redemption-btn" style="margin-top:10px">🕊️ Misión de redención</button>
    `;
    document.getElementById('phase1-consigna').style.display = 'block';
    document.getElementById('new-mission-btn').onclick = showPhase1;
    document.getElementById('redemption-btn').onclick = showRedemptionMission;
    return;
  }
  document.querySelector('#phase1-consigna .mission-card').innerHTML = `
    <div class="mission-title"><span class="icon">🦁</span><span class="title-text">${currentMission.titulo}</span></div>
    <div class="tension-bar" style="margin:1rem 0;background:rgba(255,69,58,0.15)">⏳ Listo para cazar</div>
    <p class="pista">${currentMission.descripcion_narrativa || currentMission.pista_al_llegar}</p>
    <button class="btn btn-primary" id="start-mission-btn">✅ Aceptar y comenzar</button>
  `;
  document.getElementById('phase1-consigna').style.display = 'block';
  document.getElementById('start-mission-btn').onclick = async () => {
    const firebaseUid = localStorage.getItem('firebaseUid');
    if (firebaseUid && currentMission) {
      try {
        const asignarMision = firebase.functions().httpsCallable('asignarMision');
        await asignarMision({
          misionId: currentMission.id,
          zona: jugador.zona
        });
      } catch (err) {
        console.warn('⚠️ Error asignando misión:', err);
        showToast('⚠️ Error: ' + err.message);
        return;
      }
    }
    missionStartTime = Date.now();
    startTimer();
    startGlobalTimer();
    guardarProgreso(currentMission.id);
    showPhase2();
  };
}

// ========== SHOW PHASE 2 ==========
function showPhase2() {
  cleanupAll();
  document.getElementById('phase0-intro').style.display = 'none';
  document.getElementById('phase1-consigna').style.display = 'none';
  document.querySelector('#phase2-mapa .mission-card').innerHTML = `
    <h3>📍 Acércate al objetivo</h3>
    <p style="margin:1rem 0;color:#cbd5e1;line-height:1.4">${currentMission.ubicacion_mapa}</p>
    <div id="mapApprox" style="height:300px;border-radius:12px;margin:1rem 0"></div>
    <p id="proximity-instructions" style="font-size:0.9rem;color:#94a3b8">Esperando ubicación...</p>
    <button class="btn btn-outline" id="back-to-phase1-btn" style="margin-top:15px;width:100%;padding:12px">🔙 Volver</button>
  `;
  document.getElementById('phase2-mapa').style.display = 'block';
  loadApproxMap(currentMission.coordenadas.lat, currentMission.coordenadas.lng);
  startProximityCheck(currentMission.coordenadas.lat, currentMission.coordenadas.lng);
  startRadarScan();
  document.getElementById('back-to-phase1-btn').onclick = () => {
    cleanupAll();
    document.getElementById('phase2-mapa').style.display = 'none';
    showPhase0();
  };
  document.getElementById('manual-code-btn').onclick = openManualCodeModal;
}

// ========== RADAR ==========
function startRadarScan() {
  if (radarInterval) {
    clearInterval(radarInterval);
    radarInterval = null;
  }
  document.getElementById('radar-section').style.display = 'block';
  const nearbyEl = document.getElementById('nearby-players');
  const urgencyEl = document.getElementById('radar-urgency');
  const mockPlayers = [
    { id: 'LH-2847', distance: 120, lastSeen: 'ahora' },
    { id: 'LH-1923', distance: 340, lastSeen: '2min' }
  ];
  nearbyEl.innerHTML = mockPlayers.map(p => `
    <div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px dashed rgba(255,255,255,0.1);">
      <span style="color:var(--primary);font-weight:600;">${p.id}</span>
      <span style="color:var(--text-muted);font-size:0.85rem;">${p.distance}m • ${p.lastSeen}</span>
    </div>
  `).join('');
  const veryNear = mockPlayers.filter(p => p.distance < 200);
  if (veryNear.length > 0 && urgencyEl) {
    document.getElementById('urgency-text').textContent = `${veryNear.length} cazador${veryNear.length>1?'es':''} en tu zona`;
    urgencyEl.style.display = 'block';
  }
  radarInterval = setInterval(() => {
    const fluctuation = Math.floor(Math.random() * 3) - 1;
    const count = Math.max(0, mockPlayers.length + fluctuation);
    if (urgencyEl && count > 0) {
      document.getElementById('urgency-text').textContent = `${count} cazador${count>1?'es':''} en tu zona`;
    }
  }, 30000);
}

// ========== SHOW PHASE 3 ==========
function showPhase3() {
  cleanupAll();
  document.getElementById('phase2-mapa').style.display = 'none';
  const recoveryCode = generarRecoveryCode();
  localStorage.setItem('recovery_' + jugador.id, recoveryCode);
  document.querySelector('#phase3-pista .mission-card').innerHTML = `
    <h3>🔍 Pista final</h3>
    <p class="pista">${currentMission.pista_al_llegar}</p>
    <div class="actions">
      <button class="btn btn-primary" id="scan-btn">🔍 Escanear QR</button>
      <button class="btn btn-outline" id="manual-scan-btn" style="margin-left:0.5rem;">⌨️ Código manual</button>
    </div>
    <div style="margin-top:1.2rem;font-size:0.9rem">🔑 Recuperación: <code>${recoveryCode}</code></div>
  `;
  document.getElementById('phase3-pista').style.display = 'block';
  document.getElementById('scan-btn').onclick = openQRScanner;
  document.getElementById('manual-scan-btn').onclick = openManualCodeModal;
  playNarration('Cazador ' + jugador.id.replace('LH-','') + '. Estás en la zona. La pista final ha sido revelada.');
}

// ========== SHOW PHASE 4 ==========
async function showMissionCompleted() {
  const firebaseUid = localStorage.getItem('firebaseUid');
  if (firebaseUid && currentMission) {
    try {
      const snap = await db.ref(`verificaciones/${firebaseUid}/${currentMission.id}`).once('value');
      if (!snap.exists() || !snap.val().validado) {
        console.warn('⚠️ Intento de completar misión sin validación');
        showToast('⚠️ Validación pendiente');
        return;
      }
    } catch (err) {
      console.warn('⚠️ Error verificando validación:', err);
    }
  }
  cleanupAll();
  hideAllPhases();
  const elapsed = Math.floor((Date.now() - missionStartTime) / 60000);
  const recoveryCode = localStorage.getItem('recovery_' + jugador.id) || '—';
  const title = jugador.modo === 'equipo' ? currentTeamMission?.titulo : currentMission?.titulo;
  const today = new Date().toDateString();
  if (playerProgress.lastPlayed !== today) {
    playerProgress.streak = playerProgress.lastPlayed ? playerProgress.streak + 1 : 1;
    playerProgress.lastPlayed = today;
  }
  await updateProgressDisplay();
  await checkLevelUp();
  document.querySelector('#phase4-completed .mission-card').innerHTML = `
    <h2 style="color:#ffd700;margin-bottom:1rem">✅ Operación Completada</h2>
    <p><strong>${title}</strong></p>
    <p style="font-size:0.95rem;color:#cbd5e1;margin:1rem 0">Tu posición ha sido registrada.</p>
    <div style="margin:1.5rem 0;font-size:0.9rem;color:#64b5f7">⏱️ Completado en: <strong>${elapsed} min</strong></div>
    <div style="font-size:0.85rem;color:#94a3b8;margin-bottom:1.5rem">🔑 Código: <code>${recoveryCode}</code></div>
    <div style="margin:1.2rem 0;padding:0.8rem;border-radius:10px;background:rgba(255,215,0,0.08);color:#ffd700;font-size:0.9rem">
      🎖️ <strong>Desafío completado</strong><br>
      Has ganado el badge <strong>"Primer Cazador"</strong><br>
      📡 Tu alias permanece visible en el radar
    </div>
    <div class="actions">
      <button class="btn btn-primary" id="new-mission-btn">🔁 Nueva misión</button>
      <button class="btn btn-outline" id="view-progress-btn">📊 Ver progreso</button>
    </div>
  `;
  document.getElementById('phase4-completed').style.display = 'block';
  document.getElementById('new-mission-btn').onclick = () => {
    showPhase0();
  };
  document.getElementById('view-progress-btn').onclick = () => {
    window.location.href = 'progreso.html';
  };
}

// ========== SHOW TEAM MISSION ==========
async function showTeamMission() {
  cleanupAll();
  document.body.classList.add('modo-equipo');
  currentTeamMission = selectRandomMission(jugador.zona, 'equipo');
  const recoveryCode = generarRecoveryCode();
  localStorage.setItem('recovery_' + jugador.id, recoveryCode);
  const coordText = currentTeamMission.qr_cercanos?.length >= 2
    ? `Tu equipo debe escanear ambos QR en menos de 2 minutos.<br><strong>QR A:</strong> ${currentTeamMission.qr_cercanos[0].descripcion}<br><strong>QR B:</strong> ${currentTeamMission.qr_cercanos[1].descripcion}`
    : 'Coordina con tu equipo para completar la misión.';
  document.querySelector('#teamSection .mission-card').innerHTML = `
    <div class="mission-title"><span class="icon">👁️</span><span class="title-text">${currentTeamMission.titulo}</span><span class="status active nivel-N2">ACTIVA • N2</span></div>
    <p class="pista">${currentTeamMission.descripcion_narrativa}</p>
    <div class="actions">
      <button class="btn btn-primary" id="accept-mission-btn">✅ Aceptar misión</button>
      <button class="btn btn-outline" id="scan-btn-team">🔍 Escanear QR</button>
    </div>
    <div style="margin-top:1.2rem;font-size:0.9rem">🔑 Recuperación: <code>${recoveryCode}</code></div>
  `;
  document.getElementById('teamSection').style.display = 'block';
  document.getElementById('accept-mission-btn').onclick = async () => {
    const firebaseUid = localStorage.getItem('firebaseUid');
    if (firebaseUid && currentTeamMission) {
      try {
        const asignarMision = firebase.functions().httpsCallable('asignarMision');
        await asignarMision({
          misionId: currentTeamMission.id,
          zona: jugador.zona
        });
      } catch (err) {
        console.warn('⚠️ Error asignando misión de equipo:', err);
        showToast('⚠️ Error: ' + err.message);
        return;
      }
    }
    missionStartTime = Date.now();
    startTimer();
    startGlobalTimer();
    guardarProgreso(currentTeamMission.id);
    showToast('📍 Misión registrada · Tu alias ya está activo');
    startTeamProximityCheck();
    if (currentTeamMission.qr_cercanos?.length >= 2) {
      document.getElementById('team-coordination').style.display = 'block';
      document.getElementById('team-task').innerHTML = coordText;
      startTeamCoordinationTimer(120);
    }
  };
  document.getElementById('scan-btn-team').onclick = openQRScanner;
}

// ========== TIMER EQUIPO ==========
function startTeamCoordinationTimer(seconds) {
  let timeLeft = seconds;
  const timerEl = document.getElementById('team-timer');
  teamCoordinationTimer = setInterval(() => {
    if (timeLeft <= 0) {
      clearInterval(teamCoordinationTimer);
      timerEl.textContent = '⏰ Tiempo agotado';
      timerEl.style.color = '#ff453a';
      showToast('⚠️ Tiempo de coordinación agotado');
      return;
    }
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    timerEl.textContent = `⏱️ Coordinación: ${m}:${s < 10 ? '0' : ''}${s}`;
    timeLeft--;
  }, 1000);
}

function startTeamProximityCheck() {
  const coordsA = currentTeamMission.qr_cercanos?.[0]?.coordenadas;
  if (!coordsA) return;
  loadApproxMap(coordsA.lat, coordsA.lng);
  document.getElementById('team-proximity-status').textContent = '📍 Esperando ubicación...';
  if (navigator.geolocation) {
    gpsWatchId = navigator.geolocation.watchPosition(
      pos => {
        const validation = validateGPSAccuracy(pos);
        if (!validation.valid) {
          document.getElementById('team-proximity-status').textContent = '⚠️ Señal GPS imprecisa';
          document.getElementById('team-proximity-status').style.color = '#ff9500';
          return;
        }
        document.getElementById('team-proximity-status').style.color = '#64b5f7';
        const { latitude, longitude } = validation;
        const distA = calculateDistance(latitude, longitude, coordsA.lat, coordsA.lng);
        const coordsB = currentTeamMission.qr_cercanos?.[1]?.coordenadas;
        let text = `Estás a ${distA.toFixed(0)}m del QR A (±${validation.accuracy.toFixed(0)}m)`;
        if (coordsB) {
          const distB = calculateDistance(latitude, longitude, coordsB.lat, coordsB.lng);
          text += ` | ${distB.toFixed(0)}m del QR B`;
        }
        document.getElementById('team-proximity-status').textContent = text;
      },
      err => { document.getElementById('team-proximity-status').textContent = '⚠️ Ubicación desactivada'; },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );
  }
}

// ========== PROXIMIDAD ==========
function startProximityCheck(targetLat, targetLng) {
  if (!navigator.geolocation) {
    document.getElementById('proximity-instructions').textContent = '⚠️ GPS no soportado';
    return;
  }
  gpsWatchId = navigator.geolocation.watchPosition(
    pos => {
      const validation = validateGPSAccuracy(pos);
      if (!validation.valid) {
        const statusEl = document.getElementById('proximity-status');
        statusEl.innerHTML = `⚠️ Señal GPS imprecisa (±${validation.accuracy.toFixed(0)}m). Busca cielo despejado.`;
        statusEl.style.color = '#ff9500';
        return;
      }
      const statusEl = document.getElementById('proximity-status');
      statusEl.style.color = '#94a3b8';
      const { latitude, longitude } = validation;
      const distance = calculateDistance(latitude, longitude, targetLat, targetLng);
      if (distance <= 50) {
        statusEl.innerHTML = `✅ ¡Estás en la zona! <button class="btn btn-primary" id="unlock-phase3-btn" style="margin-top:10px">🔓 Acceder</button>`;
        statusEl.style.color = '#4ade80';
        const btn = document.getElementById('unlock-phase3-btn');
        if (btn) btn.onclick = showPhase3;
      } else {
        statusEl.innerHTML = `📍 A ${Math.round(distance)}m del objetivo (±${validation.accuracy.toFixed(0)}m). Acércate más.`;
        statusEl.style.color = '#64b5f7';
      }
    },
    err => { document.getElementById('proximity-instructions').textContent = '⚠️ Error GPS'; },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
  );
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI/180, φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180, Δλ = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ========== MAPA ==========
function loadApproxMap(lat, lng) {
  cleanupMap();
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

function initApproxMap(lat, lng) {
  mapInstance = L.map('mapApprox').setView([lat, lng], 18.5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(mapInstance);
  L.circle([lat, lng], { color: '#ff6b6b', fillColor: '#ff6b6b', fillOpacity: 0.15, radius: 50 }).addTo(mapInstance);
  L.marker([lat, lng]).addTo(mapInstance).bindPopup('<strong>Objetivo</strong><br>Zona de 50m');
  setTimeout(() => { if (mapInstance) mapInstance.invalidateSize(); }, 100);
}

// ========== TIMERS ==========
function startTimer() {
  stopTimer();
  let timeLeft = 90 * 60;
  const timerEl = document.getElementById('timer');
  timerEl.textContent = '90:00';
  missionTimer = setInterval(() => {
    if (timeLeft <= 0) {
      timerEl.textContent = '⏰ Caducada';
      stopTimer();
      playConsolationNarration('timeout');
      setTimeout(() => {
        document.querySelector('#phase1-consigna .mission-card').innerHTML = `
          <div class="mission-title"><span class="icon">⏰</span><span class="title-text">Tiempo agotado</span></div>
          <div class="tension-bar" style="margin:1rem 0;background:rgba(255,170,51,0.15)">⏳ La misión ha caducado</div>
          <p class="pista">💡 Consejo: Prueba en horario de menor tráfico.<br><br>¿Aceptas una segunda oportunidad?</p>
          <button class="btn btn-primary" id="redemption-timeout-btn">🕊️ Misión de redención</button>
          <button class="btn btn-outline" id="new-mission-timeout-btn" style="margin-top:10px">🎯 Nueva misión</button>
        `;
        document.getElementById('phase1-consigna').style.display = 'block';
        document.getElementById('phase2-mapa').style.display = 'none';
        document.getElementById('redemption-timeout-btn').onclick = showRedemptionMission;
        document.getElementById('new-mission-timeout-btn').onclick = () => showPhase0();
      }, 2000);
      return;
    }
    const m = Math.floor(timeLeft / 60), s = timeLeft % 60;
    timerEl.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
    timeLeft--;
  }, 1000);
}

function startGlobalTimer() {
  stopTimer();
  let timeLeft = 12 * 60;
  const el = document.getElementById('global-timer');
  const timeEl = document.getElementById('global-time');
  if (el && timeEl) {
    el.style.display = 'block';
    timeEl.textContent = '12:00';
    globalTimer = setInterval(() => {
      if (timeLeft <= 0) {
        clearInterval(globalTimer);
        timeEl.textContent = '00:00';
        el.style.color = '#ff453a';
        showToast('⚠️ La misión global ha expirado');
        return;
      }
      const m = Math.floor(timeLeft / 60), s = timeLeft % 60;
      timeEl.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
      if (timeLeft < 120) el.style.color = '#ff6b6b';
      else if (timeLeft < 300) el.style.color = '#ff9500';
      timeLeft--;
    }, 1000);
  }
}

// ========== EVENTOS ALEATORIOS ==========
function startRandomEvents() {
  const interval = setInterval(() => {
    if (Math.random() < 0.3) {
      const events = [
        { title: '🚨 Interferencia detectada', desc: 'Nueva pista desbloqueada en tu zona', color: '#ff6b6b' },
        { title: '📡 Señal reforzada', desc: '+30 segundos adicionales', color: '#4ade80' },
        { title: '🎯 Objetivo marcado', desc: 'La ubicación ha sido precisada', color: '#ffd60a' }
      ];
      const evt = events[Math.floor(Math.random() * events.length)];
      showToast(`${evt.title}: ${evt.desc}`, 5000);
      const bar = document.getElementById('tension-bar');
      if (bar) {
        bar.style.background = evt.color + '33';
        setTimeout(() => { if (bar) bar.style.background = ''; }, 3000);
      }
    }
  }, 180000 + Math.random() * 120000);
  window.addEventListener('beforeunload', () => clearInterval(interval));
}

// ========== QR SCANNER ==========
async function openQRScanner() {
  const overlay = document.getElementById('scannerOverlay');
  const video = document.getElementById('scannerVideo');
  const canvas = document.getElementById('scannerCanvas');
  if (!overlay || !video || !canvas) {
    showToast('⚠️ Error: Elementos del escáner no encontrados');
    return;
  }
  if (typeof jsQR === 'undefined') {
    showToast('⚠️ Error: Librería QR no cargada');
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast('⚠️ Tu navegador no soporta acceso a cámara');
    return;
  }
  try {
    const constraints = { video: { facingMode: { ideal: 'environment' } } };
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    video.setAttribute('playsinline', true);
    video.play();
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    };
    overlay.style.display = 'block';
    scannerActive = true;
    showToast('🔍 Escaneando... Apuntá al QR');
    const scanInterval = setInterval(() => {
      if (!scannerActive || !video.videoWidth) return;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
      if (code?.data) {
        clearInterval(scanInterval);
        stopScanner();
        const scannedData = code.data.trim();
        try {
          const url = new URL(scannedData);
          if (url.hostname === 'codigoebel.com' && url.pathname.includes('qr-zona.html')) {
            const params = new URLSearchParams(url.search);
            const scannedId = params.get('m');
            const currentId = jugador.modo === 'equipo' ? currentTeamMission?.id : currentMission?.id;
            if (scannedId && String(scannedId) === String(currentId)) {
              showToast('🔄 Validando misión...');
              navigator.geolocation.getCurrentPosition(async (pos) => {
                try {
                  const validarMision = firebase.functions().httpsCallable('validarMision');
                  const result = await validarMision({
                    misionId: scannedId,
                    qrCode: scannedId,
                    coordenadas: {
                      lat: pos.coords.latitude,
                      lng: pos.coords.longitude,
                      accuracy: pos.coords.accuracy
                    },
                    zona: jugador.zona
                  });
                  if (result.data.success) {
                    const completarMision = firebase.functions().httpsCallable('completarMision');
                    await completarMision({ misionId: scannedId });
                    showToast('✅ ' + result.data.message);
                    showMissionCompleted();
                  }
                } catch (error) {
                  console.error('Error en Cloud Function:', error);
                  const errorMsg = error.details || error.message || 'Error al validar';
                  showToast('❌ ' + errorMsg);
                }
              }, (err) => {
                showToast('⚠️ Error obteniendo ubicación');
              }, {
                enableHighAccuracy: true,
                maximumAge: 10000,
                timeout: 10000
              });
              return;
            } else if (scannedId && String(scannedId) !== String(currentId)) {
              showToast('❌ Este QR es de otra misión');
              return;
            }
          }
        } catch (e) {
          console.log('No es URL válida:', e);
        }
        showToast('❌ Código no reconocido');
      }
    }, 300);
  } catch (err) {
    stopScanner();
    console.error('❌ Error de cámara:', err.name, err.message);
    if (err.name === 'NotAllowedError') showToast('⚠️ Permiso de cámara denegado.');
    else if (err.name === 'NotFoundError') showToast('⚠️ No se encontró cámara.');
    else if (err.name === 'NotReadableError') showToast('⚠️ La cámara está en uso.');
    else showToast('⚠️ Error de cámara: ' + err.message);
  }
}

function stopScanner() {
  scannerActive = false;
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  const overlay = document.getElementById('scannerOverlay');
  if (overlay) overlay.style.display = 'none';
}

// ========== MODAL MANUAL ==========
function openManualCodeModal() {
  const modal = document.getElementById('manualCodeModal');
  const input = document.getElementById('manual-code-input');
  if (modal && input) {
    modal.style.display = 'flex';
    input.value = '';
    input.focus();
  }
}

function closeManualCodeModal() {
  const modal = document.getElementById('manualCodeModal');
  if (modal) modal.style.display = 'none';
}

document.getElementById('submit-manual-code')?.addEventListener('click', () => {
  const code = document.getElementById('manual-code-input').value.trim().toUpperCase();
  if (code.length === 6 && /^[A-Z0-9]{6}$/.test(code)) {
    showToast('✅ Código válido · Redirigiendo...');
    closeManualCodeModal();
    setTimeout(() => { showPhase3(); }, 1000);
  } else {
    showToast('⚠️ Código inválido. Debe tener 6 caracteres alfanuméricos.');
  }
});

document.getElementById('cancel-manual-code')?.addEventListener('click', closeManualCodeModal);

document.getElementById('manualCodeModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'manualCodeModal') closeManualCodeModal();
});

// ========== UTILIDADES ==========
function generarRecoveryCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'LH';
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

// ========== GEOLOCALIZACIÓN INDEPENDIENTE (NUEVO) ==========
async function iniciarGeolocalizacion() {
  if (!navigator.geolocation) {
    console.warn('⚠️ Geolocalización no soportada');
    return;
  }
  
  try {
    // Obtener ubicación con timeout
    const posicion = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
    
    const { latitude, longitude, accuracy } = posicion.coords;
    console.log('📍 Ubicación obtenida:', { latitude, longitude, accuracy });
    
    // Obtener coordenadas del objetivo según la zona
    const zona = jugador?.zona || getZonaFinal();
    const mision = currentMission || selectRandomMission(zona, 'solitario');
    
    if (mision?.coordenadas) {
      const distancia = calculateDistance(
        latitude,
        longitude,
        mision.coordenadas.lat,
        mision.coordenadas.lng
      );
      
      console.log('📏 Distancia al objetivo:', distancia.toFixed(0) + 'm');
      
      // Actualizar UI con la distancia
      const statusEl = document.getElementById('proximity-status');
      if (statusEl && distancia <= 50) {
        statusEl.innerHTML = `✅ ¡Estás en la zona! <button class="btn btn-primary" id="unlock-phase3-btn" style="margin-top:10px">🔓 Acceder</button>`;
        statusEl.style.color = '#4ade80';
        document.getElementById('unlock-phase3-btn')?.addEventListener('click', showPhase3);
      } else if (statusEl) {
        statusEl.innerHTML = `📍 A ${Math.round(distancia)}m del objetivo (±${Math.round(accuracy)}m). Acércate más.`;
        statusEl.style.color = '#64b5f7';
      }
    }
    
    // Iniciar watcher para actualizaciones en tiempo real
    if (mision?.coordenadas) {
      startProximityCheck(mision.coordenadas.lat, mision.coordenadas.lng);
    }
    
  } catch (error) {
    console.error('❌ Error en geolocalización:', error.message);
    showToast('⚠️ No se pudo obtener tu ubicación');
  }
}

// ========== PWA ==========
function showInstallBanner() {
  const banner = document.getElementById('pwa-install-banner');
  if (!banner) return;
  const dismissed = localStorage.getItem('pwaBannerDismissed');
  const now = Date.now();
  if (dismissed && (now - parseInt(dismissed)) < 24 * 60 * 60 * 1000) return;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) {
    banner.innerHTML = '<button class="close-btn" id="close-install-banner">×</button><p style="margin:0 0 8px">🎯 Codigo Ebel está instalado.</p><p style="font-size:0.85rem;margin:0;color:#94a3b8">¿Ves esto? Cierra el banner.</p>';
    banner.style.display = 'block';
    document.getElementById('close-install-banner')?.addEventListener('click', () => {
      banner.style.display = 'none';
      localStorage.setItem('pwaBannerDismissed', now.toString());
    });
    return;
  }
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  setTimeout(() => {
    banner.style.display = 'block';
    if (isIOS) {
      banner.innerHTML = '<button class="close-btn" id="close-install-banner">×</button><p style="margin:0 0 8px">👆 Toca <strong>Compartir</strong> → <strong>"Añadir a pantalla de inicio"</strong></p>';
    } else {
      banner.innerHTML = '<button class="close-btn" id="close-install-banner">×</button><p style="margin:0 0 8px">📥 ¿Agregar Codigo Ebel a tu pantalla de inicio?</p><button id="install-btn" style="background:var(--primary);color:white;border:none;padding:6px 12px;border-radius:6px;font-weight:bold;font-size:0.9rem;margin-top:4px">Instalar</button>';
      document.getElementById('install-btn')?.addEventListener('click', () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then(() => {
            banner.style.display = 'none';
            deferredPrompt = null;
          });
        } else {
          banner.innerHTML = '<button class="close-btn" id="close-install-banner">×</button><p style="margin:0 0 8px">Abre el menú (⋯ o ≡) y busca <strong>"Instalar app"</strong>.</p>';
        }
      });
    }
    document.getElementById('close-install-banner')?.addEventListener('click', () => {
      banner.style.display = 'none';
      localStorage.setItem('pwaBannerDismissed', now.toString());
    });
  }, 3000);
}

// ========== EVENT LISTENERS GLOBALES ==========
function setupGlobalEventListeners() {
  const narrationToggle = document.getElementById('narration-toggle');
  if (narrationToggle) {
    narrationToggle.addEventListener('click', function() {
      const isOff = localStorage.getItem('lh_narration_off') === '1';
      localStorage.setItem('lh_narration_off', isOff ? '0' : '1');
      this.textContent = isOff ? '🔊' : '🔇';
      if (typeof showToast === 'function') {
        showToast(isOff ? '✅ Narración activada' : '🔇 Narración desactivada');
      }
    });
  }
  
  const closeScannerBtn = document.getElementById('closeScannerBtn');
  if (closeScannerBtn && typeof stopScanner === 'function') {
    closeScannerBtn.addEventListener('click', stopScanner);
  }
  
  const manualInputBtn = document.getElementById('manualInputBtn');
  if (manualInputBtn) {
    manualInputBtn.addEventListener('click', function() {
      if (typeof stopScanner === 'function') stopScanner();
      if (typeof showToast === 'function') showToast('⚠️ Usa el escáner QR');
    });
  }
  
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && typeof scannerActive !== 'undefined' && scannerActive) {
      if (typeof stopScanner === 'function') stopScanner();
    }
  });
  
  const accessibilityToggle = document.getElementById('accessibility-toggle');
  if (accessibilityToggle && typeof toggleAccessibilityMode === 'function') {
    accessibilityToggle.addEventListener('click', toggleAccessibilityMode);
  }
  
  window.addEventListener('resize', function() {
    if (typeof updateFloatingControlsPosition === 'function') {
      updateFloatingControlsPosition();
    }
  });
  
  window.addEventListener('beforeunload', function() {
    if (typeof cleanupAll === 'function') cleanupAll();
  });
}

// ========== INICIALIZAR AL CARGAR ==========
window.addEventListener('load', function() {
  setTimeout(function() {
    setupGlobalEventListeners();
    if (typeof updateFloatingControlsPosition === 'function') {
      updateFloatingControlsPosition();
    }
    if (typeof showInstallBanner === 'function') {
      showInstallBanner();
    }
    if (typeof initApp === 'function') {
      initApp();
    }
  }, 100);
});

// ========== EXPOSICIÓN DE FUNCIONES AL SCOPE GLOBAL ==========
if (typeof window !== 'undefined') {
  window._stopScanner = stopScanner;
  window._openManualCodeModal = openManualCodeModal;
  window._closeManualCodeModal = closeManualCodeModal;
  window._showToast = showToast;
  window._showPhase0 = showPhase0;
  window._showPhase1 = showPhase1;
  window._showPhase2 = showPhase2;
  window._showPhase3 = showPhase3;
  window._showMissionCompleted = showMissionCompleted;
  window._showActivationScreen = showActivationScreen;
  window._iniciarGeolocalizacion = iniciarGeolocalizacion;
  window.scannerActive = false;
  window.stream = null;
}
// ========== INIT APP (ORQUESTADOR REAL) ==========
async function initApp() {
  console.log('🚀 Iniciando app...');

  try {
    // 1. Accesibilidad
    applyAccessibilityMode();

    // 2. UI base
    updateFloatingControlsPosition();

    // 3. Detectar zona FINAL
    const zona = getZonaFinal();
    console.log('📍 Zona detectada:', zona);

    // 4. Cargar misiones (con fallback)
    await loadMisiones();
    console.log('📦 Misiones cargadas');

    // 5. Setup jugador (esto dispara todo lo demás)
    setupJugador();

    // 6. Seguridad: timeout anti-bloqueo
    setTimeout(() => {
      const activationScreen = document.getElementById('activation-screen');
      if (activationScreen && activationScreen.style.display !== 'flex') {
        console.warn('⚠️ Forzando pantalla de activación (fallback)');
        showActivationScreen();
      }
    }, 4000);

  } catch (err) {
    console.error('❌ Error en initApp:', err);

    showToast('⚠️ Error inicializando app');

    // fallback extremo
    showPhase0();
  }
}

// ========== ENTRY POINT ==========
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});