// globals.js
window.appState = {
  jugador: null,
  misionesSolitario: [],
  misionesEquipo: [],
  currentMission: null,
  currentTeamMission: null,
  missionStartTime: null,
  redemptionOffered: false,
  deferredPrompt: null,
  accessibilityMode: localStorage.getItem('lh_accessibility_mode') || 'normal',
  scannerActive: false,
  stream: null
};