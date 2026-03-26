/* ==========================================================================
   scanner.js - Codigo Ebel | Escáner QR
   Maneja: Cámara, decoding QR, validación
   ========================================================================== */

// ========== VARIABLES GLOBALES ==========
let scannerActive = false;
let stream = null;

// ========== ABRIR ESCÁNER QR ==========

/**
 * Abrir escáner QR
 */
async function openQRScanner() {
  const overlay = document.getElementById('scannerOverlay');
  const video = document.getElementById('scannerVideo');
  const canvas = document.getElementById('scannerCanvas');
  
  if (!overlay || !video || !canvas) {
    console.error('❌ Elementos del escáner no encontrados');
    return;
  }
  
  try {
    const constraints = {
      video: { facingMode: { ideal: "environment" } }
    };
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    };
    
    overlay.style.display = 'block';
    scannerActive = true;
    
    const scanInterval = setInterval(async () => {
      if (!scannerActive || !video.videoWidth) return;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: "dontInvert" });
      
      if (code && code.data) {
        clearInterval(scanInterval);
        stopScanner();
        const scannedData = code.data.trim();
        
        // Verificar si es una URL válida
        try {
          const url = new URL(scannedData);
          // Si es una URL de qr-zona.html, redirigir
          if (url.hostname === 'codigoebel.com' && url.pathname.includes('qr-zona.html')) {
            window.location.href = scannedData;
            return;
          }
        } catch (e) {
          // No es una URL válida → ignorar
        }
        
        // Si llega aquí, no es una URL válida
        showToast("❌ Código no reconocido. Escanea el QR del Vigilante Oscuro.");
      }
    }, 300);
  } catch (err) {
    stopScanner();
    console.error("Error de cámara:", err);
    if (err.name === 'NotAllowedError') {
      showToast("⚠️ Necesitas permitir el acceso a la cámara para escanear QR.");
    } else if (err.name === 'NotFoundError') {
      showToast("⚠️ No se encontró ninguna cámara en tu dispositivo.");
    } else {
      showToast("⚠️ Error de cámara: " + (err.message || "dispositivo no compatible"));
    }
  }
}

// ========== CERRAR ESCÁNER ==========

/**
 * Detener escáner QR
 */
function stopScanner() {
  scannerActive = false;
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  const overlay = document.getElementById('scannerOverlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

// ========== EXPORTAR FUNCIONES GLOBALES ==========
window.openQRScanner = openQRScanner;
window.stopScanner = stopScanner;

console.log('✅ scanner.js cargado correctamente');