/* ==========================================================================
   ui.js - Codigo Ebel | Interfaz de Usuario
   Maneja: Toast, Accesibilidad, Controles flotantes, Banner PWA
   ========================================================================== */

// ========== VARIABLES GLOBALES ==========
let accessibilityMode = localStorage.getItem('lh_accessibility_mode') || 'normal';
let deferredPrompt = null;

// ========== TOAST NOTIFICATION ==========

/**
 * Mostrar notificación toast
 * @param {string} msg - Mensaje a mostrar
 */
function showToast(msg) {
  const t = document.getElementById('toast');
  if (t) {
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3500);
  }
}

// ========== ACCESIBILIDAD ==========

/**
 * Aplicar modo de accesibilidad
 */
function applyAccessibilityMode() {
  const body = document.body;
  body.classList.remove('accessibility-high-contrast', 'accessibility-large-text');
  
  // Limpiar estilos anteriores
  const oldStyle1 = document.getElementById('accessibility-high-contrast-styles');
  const oldStyle2 = document.getElementById('accessibility-large-text-styles');
  if (oldStyle1) oldStyle1.remove();
  if (oldStyle2) oldStyle2.remove();
  
  if (accessibilityMode === 'high-contrast') {
    body.classList.add('accessibility-high-contrast');
    const style = document.createElement('style');
    style.id = 'accessibility-high-contrast-styles';
    style.textContent = `
      .accessibility-high-contrast { background: black !important; color: yellow !important; }
      .accessibility-high-contrast .mission-card,
      .accessibility-high-contrast .modal-content { background: #111 !important; border: 2px solid yellow !important; color: yellow !important; }
      .accessibility-high-contrast button,
      .accessibility-high-contrast .btn { background: yellow !important; color: black !important; border: 2px solid yellow !important; font-weight: bold !important; }
      .accessibility-high-contrast .btn-outline { background: transparent !important; color: yellow !important; }
      .accessibility-high-contrast .pista,
      .accessibility-high-contrast .tension-bar { color: #ffaa33 !important; }
      .accessibility-high-contrast .hunter-id { color: lime !important; font-weight: bold !important; }
    `;
    document.head.appendChild(style);
  } else if (accessibilityMode === 'large-text') {
    body.classList.add('accessibility-large-text');
    const style = document.createElement('style');
    style.id = 'accessibility-large-text-styles';
    style.textContent = `
      .accessibility-large-text { font-size: 110% !important; }
      .accessibility-large-text h1 { font-size: 180% !important; }
      .accessibility-large-text h2 { font-size: 160% !important; }
      .accessibility-large-text h3 { font-size: 140% !important; }
      .accessibility-large-text h4 { font-size: 130% !important; }
      .accessibility-large-text p,
      .accessibility-large-text .pista { font-size: 120% !important; }
      .accessibility-large-text button,
      .accessibility-large-text .btn { padding: 12px 20px !important; font-size: 110% !important; min-height: 50px !important; }
      .accessibility-large-text .mission-card { padding: 20px !important; }
    `;
    document.head.appendChild(style);
  }
  
  updateAccessibilityButton();
}

/**
 * Actualizar botón de accesibilidad
 */
function updateAccessibilityButton() {
  const btn = document.getElementById('accessibility-toggle');
  if (!btn) return;
  const modes = { 'normal': '👁️', 'high-contrast': '☀️', 'large-text': '🅰️' };
  btn.textContent = modes[accessibilityMode] || '👁️';
  btn.title = getAccessibilityModeName(accessibilityMode);
}

/**
 * Obtener nombre del modo de accesibilidad
 * @param {string} mode - Modo actual
 * @returns {string}
 */
function getAccessibilityModeName(mode) {
  const names = {
    'normal': 'Modo normal',
    'high-contrast': 'Modo exterior (alto contraste)',
    'large-text': 'Texto grande'
  };
  return names[mode] || 'Accesibilidad';
}

/**
 * Alternar modo de accesibilidad
 */
function toggleAccessibilityMode() {
  const modes = ['normal', 'high-contrast', 'large-text'];
  const currentIndex = modes.indexOf(accessibilityMode);
  const nextIndex = (currentIndex + 1) % modes.length;
  accessibilityMode = modes[nextIndex];
  localStorage.setItem('lh_accessibility_mode', accessibilityMode);
  
  applyAccessibilityMode();
  showToast(`✅ ${getAccessibilityModeName(accessibilityMode)}`);
}

// ========== POSICIONAMIENTO DE BOTONES ==========

/**
 * Actualizar posición de controles flotantes
 */
function updateFloatingControlsPosition() {
  const controls = document.getElementById('floating-controls');
  if (!controls) return;
  
  const mobileNav = document.querySelector('.mobile-nav');
  const isMobileNavVisible = mobileNav && (window.getComputedStyle(mobileNav).display !== 'none');
  
  if (isMobileNavVisible) {
    const navHeight = mobileNav.offsetHeight || 60;
    controls.style.bottom = `${navHeight + 20}px`;
  } else {
    controls.style.bottom = '20px';
  }
}

// ========== PWA INSTALL BANNER ==========

/**
 * Mostrar banner de instalación PWA
 */
function showInstallBanner() {
  const banner = document.getElementById('pwa-install-banner');
  if (!banner) return;
  
  const bannerDismissed = localStorage.getItem('pwaBannerDismissed');
  const now = Date.now();
  
  if (bannerDismissed && (now - parseInt(bannerDismissed)) < 24 * 60 * 60 * 1000) {
    return;
  }
  
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                       window.navigator.standalone === true;
  
  if (isStandalone) {
    banner.innerHTML = `
      <button class="close-btn" id="close-install-banner">×</button>
      <p style="margin:0 0 8px;">🎯 Codigo Ebel está instalado.</p>
      <p style="font-size:0.85rem; margin:0; color:#94a3b8;">¿Ves esto? Cierra el banner.</p>
    `;
    banner.style.display = 'block';
    document.getElementById('close-install-banner').onclick = () => {
      banner.style.display = 'none';
      localStorage.setItem('pwaBannerDismissed', now.toString());
    };
    return;
  }
  
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  setTimeout(() => {
    banner.style.display = 'block';
    if (isIOS) {
      banner.innerHTML = `
        <button class="close-btn" id="close-install-banner">×</button>
        <p style="margin:0 0 8px;">👆 Toca <strong>Compartir</strong> → <strong>"Añadir a pantalla de inicio"</strong></p>
      `;
    } else {
      banner.innerHTML = `
        <button class="close-btn" id="close-install-banner">×</button>
        <p style="margin:0 0 8px;">📥 ¿Agregar Codigo Ebel a tu pantalla de inicio?</p>
        <button id="install-btn" style="
          background:var(--primary); color:white; border:none;
          padding:6px 12px; border-radius:6px; font-weight:bold;
          font-size:0.9rem; margin-top:4px;
        ">Instalar</button>
      `;
      document.getElementById('install-btn').onclick = () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then((choiceResult) => {
            banner.style.display = 'none';
            deferredPrompt = null;
          });
        } else {
          banner.innerHTML = `
            <button class="close-btn" id="close-install-banner">×</button>
            <p style="margin:0 0 8px;">Abre el menú del navegador (⋯ o ≡) y busca <strong>"Instalar app"</strong>.</p>
          `;
        }
      };
    }
    document.getElementById('close-install-banner').onclick = () => {
      banner.style.display = 'none';
      localStorage.setItem('pwaBannerDismissed', now.toString());
    };
  }, 3000);
}

// ========== SERVICE WORKER ==========

/**
 * Registrar Service Worker
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('✅ SW registrado'))
        .catch(err => console.error('❌ Error SW:', err));
    });
  }
}

// ========== EXPORTAR FUNCIONES GLOBALES ==========
window.showToast = showToast;
window.applyAccessibilityMode = applyAccessibilityMode;
window.updateAccessibilityButton = updateAccessibilityButton;
window.getAccessibilityModeName = getAccessibilityModeName;
window.toggleAccessibilityMode = toggleAccessibilityMode;
window.updateFloatingControlsPosition = updateFloatingControlsPosition;
window.showInstallBanner = showInstallBanner;
window.registerServiceWorker = registerServiceWorker;
window.deferredPrompt = deferredPrompt;

console.log('✅ ui.js cargado correctamente');