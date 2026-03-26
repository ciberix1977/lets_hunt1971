/* ==========================================================================
   app.js - Codigo Ebel | Inicialización y Orquestación
   NOTA: Las funciones UI (showToast, showInstallBanner, etc.) vienen de ui.js
   ========================================================================== */

// ========== INICIALIZACIÓN PRINCIPAL ==========
async function initApp() {
  console.log('🚀 Iniciando Codigo Ebel App...');
  
  // Cargar misiones (definido en missions.js)
  await loadMisiones();
  
  // Aplicar modo de accesibilidad (definido en ui.js)
  applyAccessibilityMode();
  
  // Configurar jugador y comenzar flujo
  setupJugador();
  
  console.log('✅ Codigo Ebel App inicializada');
}

// ========== CONFIGURACIÓN DEL JUGADOR ==========
function setupJugador() {
  const urlParams = new URLSearchParams(window.location.search);
  let hunterId = urlParams.get('id') || localStorage.getItem('currentHunterId');
  
  // Iniciar sesión anónima (firebase.js ya inicializó auth)
  auth.signInAnonymously().catch(function(error) {
    console.error('Error al iniciar sesión anónima:', error);
  });
  
  // Escuchar estado de auth
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
    restoredData = await restoreProgresoFromFirebase(firebaseUid, hunterId);
  }
  
  if (!hunterId) {
    const nextId = parseInt(localStorage.getItem('lastHunterId') || '0') + 1;
    hunterId = 'LH-' + String(nextId).padStart(4, '0');
    localStorage.setItem('lastHunterId', nextId);
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
        modo: 'individual',
        progreso: { misiones: 0, desafios: 0, zona: ciudadFromURL, lastUpdate: Date.now() },
        misiones_aceptadas: [],
        desafios_completados: [],
        recoveryCode: null,
        misionActual: null
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
    
    jugador = storedJugador || { id: hunterId, zona: 'CABA', modo: 'individual' };
    const ciudadFromURL = decodeURIComponent((new URLSearchParams(window.location.search).get('zona') || '').replace(/\+/g, ' ')).trim();
    if (ciudadFromURL) {
      const zonaNormalizada = ciudadFromURL.normalize('NFC');
      if (getMisionesByZona(zonaNormalizada, 'solitario').length > 0) {
        jugador.zona = zonaNormalizada;
      }
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
  
  document.getElementById('hunterIdDisplay').textContent = jugador.modo === 'equipo' ? ('👥 ' + (jugador.equipo || hunterId)) : ('ID: ' + hunterId);
  redemptionOffered = false;
  
  if (jugador.modo === 'equipo') {
    showTeamMission();
  } else {
    showPhase1();
  }
}

// ========== EVENT LISTENERS GLOBALES ==========
// ========== EVENT LISTENERS GLOBALES (CON VALIDACIÓN DE EXISTENCIA) ==========
function setupGlobalEventListeners() {
  // Narración toggle - SOLO si existe el elemento
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
  
  // Cerrar escáner
  const closeScannerBtn = document.getElementById('closeScannerBtn');
  if (closeScannerBtn && typeof stopScanner === 'function') {
    closeScannerBtn.addEventListener('click', stopScanner);
  }
  
  // Input manual
  const manualInputBtn = document.getElementById('manualInputBtn');
  if (manualInputBtn) {
    manualInputBtn.addEventListener('click', function() {
      if (typeof stopScanner === 'function') stopScanner();
      if (typeof showToast === 'function') showToast('⚠️ Usa el escáner QR');
    });
  }
  
  // Tecla Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && typeof scannerActive !== 'undefined' && scannerActive) {
      if (typeof stopScanner === 'function') stopScanner();
    }
  });
  
  // Accesibilidad toggle
  const accessibilityToggle = document.getElementById('accessibility-toggle');
  if (accessibilityToggle && typeof toggleAccessibilityMode === 'function') {
    accessibilityToggle.addEventListener('click', toggleAccessibilityMode);
  }
  
  // Resize para controles flotantes
  window.addEventListener('resize', function() {
    if (typeof updateFloatingControlsPosition === 'function') {
      updateFloatingControlsPosition();
    }
  });
  
  // Cleanup al cerrar
  window.addEventListener('beforeunload', function() {
    if (typeof cleanupAll === 'function') cleanupAll();
  });
}

// ========== INICIALIZAR AL CARGAR ==========
window.addEventListener('load', function() {
  // Esperar a que todos los scripts se carguen
  setTimeout(function() {
    setupGlobalEventListeners();
    updateFloatingControlsPosition();
    showInstallBanner();
    initApp();
  }, 100);
});