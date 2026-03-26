/* ==========================================================================
   firebase.js - Codigo Ebel | Configuración Firebase
   Maneja: Auth anónimo, Realtime Database, Analytics
   ========================================================================== */

// ========== CONFIGURACIÓN FIREBASE ==========
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

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Exportar instancias a variables globales
window.db = firebase.database();
window.auth = firebase.auth();
window.analytics = firebase.analytics();

// ========== FUNCIONES DE AUTH ==========

/**
 * Iniciar sesión anónima
 * @returns {Promise} UserCredential o error
 */
async function signInAnonymous() {
  try {
    const userCredential = await auth.signInAnonymously();
    localStorage.setItem('firebaseUid', userCredential.user.uid);
    localStorage.setItem('currentFirebaseUid', userCredential.user.uid);
    console.log('✅ Auth anónimo exitoso:', userCredential.user.uid);
    return userCredential;
  } catch (error) {
    console.error('❌ Error en auth anónimo:', error);
    throw error;
  }
}

/**
 * Escuchar cambios en el estado de auth
 * @param {Function} callback - Función a ejecutar cuando cambia el estado
 */
function onAuthStateChanged(callback) {
  auth.onAuthStateChanged((user) => {
    if (user) {
      localStorage.setItem('firebaseUid', user.uid);
      localStorage.setItem('currentFirebaseUid', user.uid);
    }
    callback(user);
  });
}

/**
 * Obtener Firebase UID actual
 * @returns {string|null} UID o null
 */
function getCurrentFirebaseUid() {
  return localStorage.getItem('currentFirebaseUid') || 
         (auth.currentUser ? auth.currentUser.uid : null);
}

/**
 * Verificar si usuario está autenticado
 * @returns {boolean}
 */
function isAuthenticated() {
  return auth.currentUser !== null;
}

// ========== FUNCIONES DE DATABASE ==========

/**
 * Guardar datos de jugador en Firebase
 * @param {string} uid - Firebase UID
 * @param {Object} data - Datos del jugador
 * @returns {Promise}
 */
async function saveJugadorData(uid, data) {
  try {
    await db.ref(`jugadores/${uid}`).set(data);
    console.log('✅ Datos guardados en Firebase:', uid);
    return true;
  } catch (error) {
    console.error('❌ Error al guardar en Firebase:', error);
    throw error;
  }
}

/**
 * Leer datos de jugador desde Firebase
 * @param {string} uid - Firebase UID
 * @returns {Promise<Object|null>}
 */
async function getJugadorData(uid) {
  try {
    const snapshot = await db.ref(`jugadores/${uid}`).once('value');
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.error('❌ Error al leer de Firebase:', error);
    return null;
  }
}

/**
 * Verificar si misión está disponible
 * @param {string} misionId - ID de la misión
 * @param {string} zona - Zona del jugador
 * @returns {Promise<boolean>}
 */
async function isMisionDisponible(misionId, zona) {
  try {
    const misionRef = db.ref(`misiones/${misionId}-${zona}`);
    const snapshot = await misionRef.once('value');
    if (!snapshot.exists()) {
      return true;
    }
    const data = snapshot.val();
    return data.estado !== 'completada';
  } catch (err) {
    console.error('Error en Firebase:', err);
    return true;
  }
}

/**
 * Completar misión con transacción atómica
 * @param {string} misionId - ID de la misión
 * @param {string} zona - Zona
 * @param {string} hunterId - Hunter ID del jugador
 * @returns {Promise<boolean>} True si fue el primero
 */
async function completarMision(misionId, zona, hunterId) {
  try {
    const misionRef = db.ref(`misiones/${misionId}-${zona}`);
    const transactionResult = await misionRef.transaction((currentData) => {
      if (currentData === null) {
        return {
          estado: 'completada',
          hunter_ganador: hunterId,
          timestamp: firebase.database.ServerValue.TIMESTAMP
        };
      }
      if (currentData.estado === 'completada') {
        return;
      }
      return currentData;
    });
    
    if (transactionResult.committed && 
        transactionResult.snapshot.val()?.hunter_ganador === hunterId) {
      return true;
    }
    return false;
  } catch (err) {
    console.error('Error en transacción atómica:', err);
    return false;
  }
}

/**
 * Guardar progreso de misión en Firebase
 * @param {string} uid - Firebase UID
 * @param {string} misionId - ID de la misión
 * @returns {Promise}
 */
async function saveMisionProgreso(uid, misionId) {
  try {
    await db.ref(`jugadores/${uid}/misiones_completadas`).push({
      misionId: misionId,
      timestamp: Date.now()
    });
    return true;
  } catch (error) {
    console.error('Error al guardar progreso:', error);
    return false;
  }
}

// ========== ANALYTICS ==========

/**
 * Registrar evento en Analytics
 * @param {string} eventName - Nombre del evento
 * @param {Object} params - Parámetros del evento
 */
function logEvent(eventName, params) {
  if (window.analytics) {
    analytics.logEvent(eventName, params);
  }
}

// ========== EXPORTAR FUNCIONES GLOBALES ==========
window.firebaseSignInAnonymous = signInAnonymous;
window.firebaseOnAuthStateChanged = onAuthStateChanged;
window.firebaseGetCurrentUid = getCurrentFirebaseUid;
window.firebaseIsAuthenticated = isAuthenticated;
window.firebaseSaveJugadorData = saveJugadorData;
window.firebaseGetJugadorData = getJugadorData;
window.firebaseIsMisionDisponible = isMisionDisponible;
window.firebaseCompletarMision = completarMision;
window.firebaseSaveMisionProgreso = saveMisionProgreso;
window.firebaseLogEvent = logEvent;

console.log('✅ firebase.js cargado correctamente');