const { WebSocketServer } = require('ws');

const wss = new WebSocketServer({ port: 8080 });

console.log('📡 Servidor WebSocket escuchando en ws://localhost:8080');

// Almacenamiento simulado
const players = new Map();
const zones = ['CABA', 'AVELLANEDA', 'LANUS', 'LOMAS'];

wss.on('connection', (ws) => {
  console.log('🔌 Nueva conexión');

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      
      switch (msg.type) {
        case 'join':
          players.set(msg.id, {
            id: msg.id,
            zone: msg.zone,
            missions: msg.missions || 0,
            challenges: msg.challenges || 0,
            lastSeen: Date.now()
          });
          console.log(`✅ ${msg.id} se unió en ${msg.zone}`);
          
          // Enviar jugadores en su zona
          const zonePlayers = Array.from(players.values())
            .filter(p => p.zone === msg.zone);
          
          ws.send(JSON.stringify({
            type: 'players',
            players: zonePlayers
          }));
          
          // Enviar ranking
          const ranking = Array.from(players.values())
            .sort((a, b) => (b.missions + b.challenges) - (a.missions + a.challenges))
            .slice(0, 10);
          
          ws.send(JSON.stringify({
            type: 'ranking',
            ranking: ranking
          }));
          break;
          
        case 'update':
          if (players.has(msg.id)) {
            const p = players.get(msg.id);
            p.missions = msg.missions;
            p.challenges = msg.challenges;
            p.lastSeen = Date.now();
            
            // Enviar actualización a todos en la misma zona
            wss.clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                // Obtenemos la zona del cliente desde su último mensaje (simplificado)
                // En producción: guardarías client.zone al conectar
                client.send(JSON.stringify({
                  type: 'update',
                  id: msg.id,
                  zone: msg.zone,
                  missions: msg.missions,
                  challenges: msg.challenges
                }));
              }
            });
          }
          break;
      }
    } catch (e) {
      console.error('❌ Error en mensaje:', e.message);
    }
  });

  ws.on('close', () => {
    console.log('🔌 Conexión cerrada');
  });
});

// Simular jugadores cada 10s
setInterval(() => {
  if (players.size < 5) {
    const id = `hunter_sim_${Math.floor(10000 + Math.random() * 90000)}`;
    players.set(id, {
      id: id,
      zone: zones[Math.floor(Math.random() * zones.length)],
      missions: Math.floor(Math.random() * 4),
      challenges: Math.floor(Math.random() * 10),
      lastSeen: Date.now()
    });
    console.log(`🤖 Jugador simulado ${id} añadido`);
  }
}, 10000);

// Limpiar jugadores inactivos cada minuto
setInterval(() => {
  const now = Date.now();
  players.forEach((p, id) => {
    if (now - p.lastSeen > 300000) { // 5 minutos
      players.delete(id);
      console.log(`🗑️ ${id} eliminado por inactividad`);
    }
  });
}, 60000);