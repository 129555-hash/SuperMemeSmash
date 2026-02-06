const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const rooms = {}; // { roomCode: { host: ws, clients: [ws], players: [{id, name, ready}] } }

wss.on('connection', (ws) => {
    let currentRoom = null;
    let isRoomHost = false;
    let playerId = Math.random().toString(36).slice(2, 10);

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());

            if (msg.t === 'join') {
                const room = msg.room;
                currentRoom = room;
                
                if (msg.host) {
                    // Host creates room
                    isRoomHost = true;
                    const hostName = msg.nickname || 'Host';
                    rooms[room] = { 
                        host: ws, 
                        clients: [],
                        players: [{ id: playerId, name: hostName + ' (Host)', ready: true }]
                    };
                    ws.send(JSON.stringify({ t: 'joined' }));
                    // Send initial player list
                    ws.send(JSON.stringify({ 
                        t: 'playerlist', 
                        players: rooms[room].players 
                    }));
                } else {
                    // Client joins room
                    if (!rooms[room]) {
                        ws.send(JSON.stringify({ t: 'error', msg: 'Room not found' }));
                        return;
                    }
                    
                    rooms[room].clients.push(ws);
                    const playerIndex = rooms[room].players.length + 1;
                    const playerName = msg.nickname || `Player ${playerIndex}`;
                    rooms[room].players.push({ 
                        id: playerId, 
                        name: playerName, 
                        ready: true 
                    });
                    
                    // Notify everyone in room with updated player list
                    broadcastToRoom(room, { 
                        t: 'playerlist', 
                        players: rooms[room].players 
                    });
                    
                    // Legacy ready message for backward compat
                    broadcastToRoom(room, { t: 'ready' });
                }
            } else if (msg.t === 'start') {
                // Host starts game, forward to all clients
                if (currentRoom && rooms[currentRoom]) {
                    rooms[currentRoom].clients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify(msg));
                        }
                    });
                }
            } else if (msg.t === 'state') {
                // Host broadcasts state to clients
                if (currentRoom && rooms[currentRoom] && isRoomHost) {
                    rooms[currentRoom].clients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(data);
                        }
                    });
                }
            } else if (msg.t === 'inp') {
                // Client sends input to host
                if (currentRoom && rooms[currentRoom] && rooms[currentRoom].host.readyState === WebSocket.OPEN) {
                    // Add player ID to input message
                    msg.playerId = playerId;
                    rooms[currentRoom].host.send(JSON.stringify(msg));
                }
            } else if (msg.t === 'ping') {
                ws.send(JSON.stringify({ t: 'pong' }));
            } else if (msg.t === 'pong') {
                // Client responded to ping
            }
        } catch (e) {
            console.error('Message parse error:', e);
        }
    });

    ws.on('close', () => {
        if (currentRoom && rooms[currentRoom]) {
            if (isRoomHost) {
                // Host left, notify clients and clean up
                rooms[currentRoom].clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ t: 'error', msg: 'Host disconnected' }));
                        client.close();
                    }
                });
                delete rooms[currentRoom];
            } else {
                // Client left, remove from room
                const idx = rooms[currentRoom].clients.indexOf(ws);
                if (idx !== -1) {
                    rooms[currentRoom].clients.splice(idx, 1);
                }
                // Remove from player list
                rooms[currentRoom].players = rooms[currentRoom].players.filter(p => p.id !== playerId);
                
                // Notify remaining players
                broadcastToRoom(currentRoom, { 
                    t: 'playerlist', 
                    players: rooms[currentRoom].players 
                });
            }
        }
    });
});

function broadcastToRoom(room, msg) {
    if (!rooms[room]) return;
    const data = JSON.stringify(msg);
    
    // Send to host
    if (rooms[room].host && rooms[room].host.readyState === WebSocket.OPEN) {
        rooms[room].host.send(data);
    }
    
    // Send to all clients
    rooms[room].clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

console.log('WebSocket relay server running on ws://localhost:8080');
