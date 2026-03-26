{
  "rules": {
    "jugadores": {
      "$uid": {
        ".read": "auth != null && $uid === auth.uid",
        ".write": "auth != null && $uid === auth.uid && !data.exists()",
        ".validate": "newData.hasChildren(['hunterId', 'zona', 'modo']) && 
                      newData.child('hunterId').isString() && 
                      newData.child('zona').isString() && 
                      newData.child('modo').isString()"
      }
    },

    "misiones": {
      ".read": true,
      ".write": false
    },

    "misiones_asignadas": {
      "$uid": {
        ".read": "auth != null && $uid === auth.uid",
        ".write": "auth != null && $uid === auth.uid",
        ".validate": "newData.hasChildren(['misionId', 'estado', 'fecha_asignacion']) &&
                      newData.child('misionId').isString() &&
                      newData.child('estado').isString() &&
                      newData.child('fecha_asignacion').isNumber() &&
                      (
                        newData.child('estado').val() === 'pendiente' ||
                        newData.child('estado').val() === 'en_progreso' ||
                        newData.child('estado').val() === 'completada'
                      ) &&
                      (
                        !data.exists() || 
                        data.child('estado').val() !== 'completada'
                      )"
      }
    },

    "verificaciones": {
      "$uid": {
        ".read": "auth != null && $uid === auth.uid",
        ".write": "auth != null && $uid === auth.uid",
        ".validate": "newData.hasChildren(['misionId', 'codigo_qr', 'timestamp', 'validado']) &&
                      newData.child('misionId').isString() &&
                      newData.child('timestamp').isNumber() &&
                      newData.child('validado').isBoolean() &&
                      newData.child('validado').val() === false &&
                      newData.child('timestamp').val() <= now"
      }
    },

    "adivinanzas": {
      ".read": true,
      ".write": false
    },

    "registro_adivinanzas": {
      "$id": {
        ".read": "auth != null",
        ".write": "auth != null && 
                   newData.child('uid').val() === auth.uid && 
                   newData.hasChildren(['uid', 'respuesta', 'timestamp']) &&
                   !data.exists()"
      }
    },

    "ranking": {
      "$uid": {
        ".read": true,
        ".write": "auth != null && $uid === auth.uid",
        ".validate": "newData.hasChildren(['puntos', 'misiones_completadas']) && 
                      newData.child('puntos').isNumber() && 
                      newData.child('puntos').val() >= 0 &&
                      (!data.child('puntos').exists() || 
                       newData.child('puntos').val() <= (data.child('puntos').val() + 100))"
      }
    },

    "usuarios": {
      "$uid": {
        ".read": "auth != null && $uid === auth.uid",
        ".write": "auth != null && $uid === auth.uid && (!data.exists() || !newData.hasChild('rol'))",
        ".validate": "newData.hasChildren(['hunterId'])"
      }
    },

    ".read": false,
    ".write": false
  }
}