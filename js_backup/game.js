function startLocal() {
    music.init();
    sfx.init();
    isSurvival = !1;
    isTraining = !1;
    isMemeBall = !1;
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('char-select').classList.remove('hidden');
    document.getElementById('cpu-controls').classList.remove('hidden');
    renderCharGrid();
    music.play('MENU');

    function startSurvival() {
        music.init();
        sfx.init();
        isSurvival = true;
        survivalWave = 1;
        isTraining = false;
        isMemeBall = false;
        document.getElementById('title-screen').classList.add('hidden');
        document.getElementById('char-select').classList.remove('hidden');
        document.getElementById('cpu-controls').classList.add('hidden');
        renderCharGrid();
        music.play('MENU');
    }
    function startOnline() {
        music.init();
        audioFiles.init();
        sfx.init();
        isSurvival = !1; isTraining = !1; isMemeBall = !1; isOnline = true; isHost = false; netPeerReady = false;
        document.getElementById('title-screen').classList.add('hidden');
        document.getElementById('online-screen').classList.remove('hidden');
        document.getElementById('online-status').textContent = '';
    }
    function hideOnline() {
        document.getElementById('online-screen').classList.add('hidden');
        document.getElementById('title-screen').classList.remove('hidden');
        try { if (netSocket) { netSocket.close(); netSocket = null; } } catch (e) { }
        isOnline = false; isHost = false; netRoom = null; netPeerReady = false;
        stopNetPingLoop();
    }
    function hostRoom() {
        const nickInput = document.getElementById('online-nickname');
        const nickname = (nickInput && nickInput.value.trim()) || 'Host';
        isHost = true; isOnline = true; netRoom = Math.random().toString(36).slice(2, 8).toUpperCase(); netReadyCount = 0; netPeerReady = false;
        netConnectedPlayers = [{ id: 'host', name: nickname + ' (Host)', ready: true }];
        netGameMode = '1v1';
        document.getElementById('online-room-code').textContent = netRoom;
        const box = document.getElementById('online-start-box'); if (box) box.style.display = 'none';
        const lobby = document.getElementById('online-lobby-list'); if (lobby) lobby.style.display = 'none';
        initSocket();
    }
    function joinRoom() {
        const code = (document.getElementById('online-join-code').value || '').trim().toUpperCase();
        if (!code) { document.getElementById('online-status').textContent = 'Enter a room code'; return; }
        const nickInput = document.getElementById('online-nickname');
        const nickname = (nickInput && nickInput.value.trim()) || 'Player';
        isHost = false; isOnline = true; netRoom = code; netReadyCount = 0; netPeerReady = false;
        netConnectedPlayers = [];
        const box = document.getElementById('online-start-box'); if (box) box.style.display = 'none';
        const lobby = document.getElementById('online-lobby-list'); if (lobby) lobby.style.display = 'none';
        initSocket();
    }
    function quickMatch() {
        const nickInput = document.getElementById('online-nickname');
        const nickname = (nickInput && nickInput.value.trim()) || 'Player';
        // Generate a quick match code with "QM" prefix
        const quickCode = 'QM' + Math.random().toString(36).slice(2, 6).toUpperCase();
        isHost = false; isOnline = true; netRoom = quickCode; netReadyCount = 0; netPeerReady = false;
        netConnectedPlayers = [];
        const box = document.getElementById('online-start-box'); if (box) box.style.display = 'none';
        const lobby = document.getElementById('online-lobby-list'); if (lobby) lobby.style.display = 'none';
        document.getElementById('online-status').textContent = 'Quick matching...';
        initSocket();
    }
    function normalizeWSURL(raw) {
        let u = (raw || '').trim();
        if (!u) return 'ws://localhost:8080';
        // Convert http/https schemes
        if (u.startsWith('http://')) u = 'ws://' + u.slice(7);
        else if (u.startsWith('https://')) u = 'wss://' + u.slice(8);
        // If user pasted a railway/render domain without protocol
        if (!u.startsWith('ws://') && !u.startsWith('wss://')) {
            // Prefer ws for local dev, wss for remote
            if (u.startsWith('localhost') || u.startsWith('127.') || u.startsWith('192.168.')) {
                u = 'ws://' + u;
            } else {
                u = 'wss://' + u;
            }
        }
        return u;
    }
    function initSocket() {
        netOpened = false;
        try {
            const urlInput = document.getElementById('online-ws-url');
            const WS_URL = normalizeWSURL(urlInput && urlInput.value ? urlInput.value : 'ws://localhost:8080');
            const st = document.getElementById('online-status');
            if (st) st.textContent = 'Connecting to ' + WS_URL + ' ...';
            netSocket = new WebSocket(WS_URL);
            netSocket.onerror = () => {
                const st2 = document.getElementById('online-status');
                if (st2) st2.textContent = 'Connection failed. Ensure a WebSocket server is running at that URL (use wss:// for hosted domains).';
            };
            netSocket.onclose = () => {
                // Only show Disconnected if connection was previously opened
                const st = document.getElementById('online-status');
                if (netOpened && st && isOnline) {
                    st.textContent = 'Disconnected';
                    // If disconnect happens mid-match, pause and show notification
                    if (gameState === 'GAME' && !netDisconnected) {
                        netDisconnected = true;
                        gameState = 'PAUSED';
                        showDisconnectNotification();
                    }
                }
            };
        } catch (e) {
            const st = document.getElementById('online-status');
            if (st) st.textContent = 'Server connection failed. Check server URL and availability.';
            return;
        }
        netSocket.onopen = () => {
            netOpened = true;
            const nickInput = document.getElementById('online-nickname');
            const nickname = (nickInput && nickInput.value.trim()) || 'Player';
            // Include friendCode so peers can verify and record stats
            try { initFriendCode(); } catch (e) { }
            sendNet({ t: 'join', room: netRoom, host: !!isHost, nickname: nickname, friendCode: saveData && saveData.friendCode ? saveData.friendCode : undefined });
            document.getElementById('online-status').textContent = 'Joined relay. Negotiating room...';
            startNetPingLoop();
        };
        netSocket.onmessage = ev => {
            let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
            if (msg.t === 'pong' || msg.t === 'ping') {
                // Measure round-trip time
                const sent = typeof msg.ts === 'number' ? msg.ts : netLastPingTs;
                if (sent) {
                    netCurrentPing = Math.max(1, Math.round(performance.now() - sent));
                    const el = document.getElementById('net-ping');
                    if (el && isOnline) {
                        el.style.display = 'block';
                        el.textContent = `PING: ${netCurrentPing} ms`;
                        el.style.color = netCurrentPing < 60 ? '#2ecc71' : (netCurrentPing < 120 ? '#ffd700' : '#e74c3c');
                    }
                }
                return; // Don't fall through
            }
            if (msg.t === 'joined') {
                document.getElementById('online-status').textContent = 'Room created. Waiting for players...';
                updateLobbyList();
                initOnlineCharSelect();
            } else if (msg.t === 'playerlist') {
                // Server sends updated player list
                if (msg.players) {
                    const oldCount = netConnectedPlayers.length;
                    // Preserve friendCode if provided by server; otherwise keep name/ready/id
                    netConnectedPlayers = msg.players.map(p => ({
                        id: p.id,
                        name: p.name,
                        ready: !!p.ready,
                        friendCode: p.friendCode || p.code || p.fc
                    }));
                    const newCount = netConnectedPlayers.length;
                    // If player left during match, pause and notify
                    if (gameState === 'GAME' && newCount < oldCount && !netDisconnected) {
                        netDisconnected = true;
                        gameState = 'PAUSED';
                        showDisconnectNotification();
                    }
                    netReadyCount = msg.players.length;
                    updateLobbyList();
                    try { verifyFriendsAgainstLobby(); } catch (e) { }
                    if (isHost) {
                        const minPlayers = (netGameMode === '2v2') ? 4 : 2;
                        if (netReadyCount >= minPlayers) {
                            netPeerReady = true;
                            document.getElementById('online-status').textContent = `Ready! ${netReadyCount}/${minPlayers} players`;
                            const box = document.getElementById('online-start-box'); if (box) box.style.display = 'flex';
                            initOnlineCharSelect();
                        } else {
                            document.getElementById('online-status').textContent = `Waiting... ${netReadyCount}/${minPlayers} players`;
                            const box = document.getElementById('online-start-box'); if (box) box.style.display = 'none';
                        }
                    } else {
                        document.getElementById('online-status').textContent = 'Connected! Waiting for host...';
                        netPeerReady = true;
                    }
                }
            } else if (msg.t === 'ready') {
                // Legacy ready handling (fallback if server doesn't send playerlist)
                netReadyCount++;
                if (isHost) {
                    const minPlayers = (netGameMode === '2v2') ? 4 : 2;
                    if (netReadyCount >= minPlayers) {
                        netPeerReady = true;
                        document.getElementById('online-status').textContent = `Player joined! ${netReadyCount}/${minPlayers}`;
                        const box = document.getElementById('online-start-box'); if (box) box.style.display = 'flex';
                    } else {
                        document.getElementById('online-status').textContent = `Waiting... ${netReadyCount}/${minPlayers}`;
                    }
                } else {
                    document.getElementById('online-status').textContent = 'Connected! Waiting for host...';
                    netPeerReady = true;
                }
            } else if (msg.t === 'inp' && isHost) {
                // Host maps client inputs to player slots (P2, P3, P4) by playerId
                const k = msg.k; const v = msg.v ? 1 : 0;
                const pid = msg.playerId;

                // Assign player slot based on connection order
                let slot = 'p2'; // default
                const playerIndex = netConnectedPlayers.findIndex(p => p.id === pid);
                if (playerIndex === 1) slot = 'p2';
                else if (playerIndex === 2) slot = 'p3';
                else if (playerIndex === 3) slot = 'p4';

                try {
                    // All online players use WASD by default
                    const left = getControl(slot, 'left') || 'a';
                    const right = getControl(slot, 'right') || 'd';
                    const up = getControl(slot, 'up') || 'w';
                    const down = getControl(slot, 'down') || 's';
                    const attack = getControl(slot, 'attack') || 'f';
                    const ult = getControl(slot, 'ult') || 'r';
                    const shield = getControl(slot, 'shield') || 'g';
                    const eq = (a, b) => (a === b) || (a && b && a.toLowerCase && b.toLowerCase && a.toLowerCase() === b.toLowerCase());

                    let targetInputs = netP2Inputs;
                    if (slot === 'p3') targetInputs = netP3Inputs;
                    else if (slot === 'p4') targetInputs = netP4Inputs;

                    if (eq(k, left)) targetInputs.l = v;
                    if (eq(k, right)) targetInputs.r = v;
                    if (eq(k, up)) { targetInputs.u = v; targetInputs.j = v; }
                    if (eq(k, down)) targetInputs.d = v;
                    if (eq(k, attack)) targetInputs.a = v;
                    if (eq(k, ult)) targetInputs.U = v;
                    if (eq(k, shield)) targetInputs.S = v;
                } catch (e) { }
            } else if (msg.t === 'start') {
                // Host instructs client to start with chosen settings
                isMemeBall = msg.mode === 'meme'; isSurvival = false; isTraining = false;
                netGameMode = msg.gameMode || '1v1'; // Receive mode from host
                p1Char = CHARACTERS.find(c => c.id === msg.p1);
                p2Char = CHARACTERS.find(c => c.id === msg.p2);
                selectedMap = MAPS.find(m => m.id === msg.map) || MAPS[0];
                customStocks = msg.stocks || 3;
                rulesItemsEnabled = msg.items !== undefined ? msg.items : true;
                rulesHazardsEnabled = msg.hazards !== undefined ? msg.hazards : true;
                rulesTeamAttack = msg.teamAttack || false;
                const ts = document.getElementById('title-screen'); if (ts) ts.classList.add('hidden');
                const os = document.getElementById('online-screen'); if (os) os.classList.add('hidden');
                const sb = document.getElementById('online-start-box'); if (sb) sb.style.display = 'none';
                const hud = document.getElementById('hud'); if (hud) hud.classList.remove('hidden');
                // Initialize scene but as client renderer
                if (isMemeBall) beginMemeBall(); else startGame();
            } else if (msg.t === 'state') {
                applyNetState(msg.s);
            } else if (msg.t === 'ping') {
                sendNet({ t: 'pong' });
            }
        };
        netSocket.onclose = () => {
            if (isOnline) document.getElementById('online-status').textContent = 'Disconnected';
        };
    }

    // Quick server health check using WebSocket open/close timing
    async function checkServerStatus() {
        const urlInput = document.getElementById('online-ws-url');
        const indicator = document.getElementById('server-health-indicator');
        const textEl = document.getElementById('server-health-text');
        if (!urlInput || !indicator || !textEl) return;

        indicator.style.display = 'block';
        textEl.style.color = '#ffd700';
        textEl.textContent = 'CHECKING...';

        let ws;
        let timer;
        const started = performance.now();
        try {
            const WS_URL = normalizeWSURL(urlInput.value || 'ws://localhost:8080');
            await new Promise((resolve, reject) => {
                try {
                    ws = new WebSocket(WS_URL);
                } catch (e) {
                    reject(e);
                    return;
                }
                timer = setTimeout(() => {
                    try { ws && ws.close(); } catch (e) { }
                    reject(new Error('Timeout'));
                }, 5000);
                ws.onopen = () => resolve();
                ws.onerror = () => reject(new Error('Socket error'));
            });
            const rtt = Math.max(1, Math.round(performance.now() - started));
            textEl.style.color = '#2ecc71';
            textEl.textContent = `ONLINE (${rtt} ms)`;
        } catch (e) {
            textEl.style.color = '#e74c3c';
            textEl.textContent = 'OFFLINE / UNREACHABLE';
        } finally {
            clearTimeout(timer);
            try { ws && ws.close(); } catch (e) { }
        }
    }
    function showDisconnectNotification(isHostDisconnect = false) {
        // Create overlay notification
        const overlay = document.createElement('div');
        overlay.id = 'disconnect-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center';
        const title = document.createElement('div');
        title.style.cssText = "font-family:'Press Start 2P';font-size:24px;color:#ff4444;margin-bottom:20px";
        title.textContent = isHostDisconnect ? 'HOST DISCONNECTED' : 'PLAYER DISCONNECTED';
        const msg = document.createElement('div');
        msg.style.cssText = "font-family:'Press Start 2P';font-size:12px;color:#fff;margin-bottom:30px;text-align:center;max-width:500px;line-height:1.8";
        msg.textContent = isHostDisconnect ? 'The host has left the match.' : 'A player has disconnected from the match.';
        const btn = document.createElement('button');
        btn.className = 'menu-btn';
        btn.textContent = 'RETURN TO LOBBY';
        btn.onclick = () => {
            document.body.removeChild(overlay);
            hideOnline();
            showTitle();
        };
        overlay.appendChild(title);
        overlay.appendChild(msg);
        overlay.appendChild(btn);
        document.body.appendChild(overlay);
    }
    function showDisconnectNotification(isHostDisconnect = false) {
        // Create overlay notification
        const overlay = document.createElement('div');
        overlay.id = 'disconnect-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center';
        const title = document.createElement('div');
        title.style.cssText = "font-family:'Press Start 2P';font-size:24px;color:#ff4444;margin-bottom:20px";
        title.textContent = isHostDisconnect ? 'HOST DISCONNECTED' : 'PLAYER DISCONNECTED';
        const msg = document.createElement('div');
        msg.style.cssText = "font-family:'Press Start 2P';font-size:12px;color:#fff;margin-bottom:30px;text-align:center;max-width:500px;line-height:1.8";
        msg.textContent = isHostDisconnect ? 'The host has left the match.' : 'A player has disconnected from the match.';
        const btn = document.createElement('button');
        btn.className = 'menu-btn';
        btn.textContent = 'RETURN TO LOBBY';
        btn.onclick = () => {
            document.body.removeChild(overlay);
            hideOnline();
            showTitle();
        };
        overlay.appendChild(title);
        overlay.appendChild(msg);
        overlay.appendChild(btn);
        document.body.appendChild(overlay);
    }
    function sendNet(obj) { try { if (netSocket && netSocket.readyState === 1) netSocket.send(JSON.stringify(obj)); } catch (e) { } }

    function startNetPingLoop() {
        stopNetPingLoop();
        // Only run when online and socket open
        if (!isOnline || !netSocket) return;
        netPingTimer = setInterval(() => {
            if (!netSocket || netSocket.readyState !== 1) return;
            netLastPingTs = performance.now();
            sendNet({ t: 'ping', ts: netLastPingTs });
        }, 3000);
    }

    function stopNetPingLoop() {
        if (netPingTimer) { clearInterval(netPingTimer); netPingTimer = null; }
        const el = document.getElementById('net-ping');
        if (el) el.style.display = 'none';
    }

    function selectOnlineMode(mode) {
        if (!isHost) return;
        netGameMode = mode;
        // Update button styles
        const btn1v1 = document.getElementById('mode-1v1-btn');
        const btn2v2 = document.getElementById('mode-2v2-btn');
        if (mode === '1v1') {
            if (btn1v1) { btn1v1.style.background = '#0f0'; btn1v1.style.color = '#000'; }
            if (btn2v2) { btn2v2.style.background = ''; btn2v2.style.color = ''; }
        } else {
            if (btn1v1) { btn1v1.style.background = ''; btn1v1.style.color = ''; }
            if (btn2v2) { btn2v2.style.background = '#0f0'; btn2v2.style.color = '#000'; }
        }
        // Re-check player count requirement
        const minPlayers = (netGameMode === '2v2') ? 4 : 2;
        if (netReadyCount >= minPlayers) {
            netPeerReady = true;
            document.getElementById('online-status').textContent = `Ready! ${netReadyCount}/${minPlayers} players`;
            const box = document.getElementById('online-start-box'); if (box) box.style.display = 'flex';
        } else {
            netPeerReady = false;
            document.getElementById('online-status').textContent = `Waiting... ${netReadyCount}/${minPlayers} players`;
            const box = document.getElementById('online-start-box'); if (box) box.style.display = 'none';
        }
    }

    function updateLobbyList() {
        const listEl = document.getElementById('online-player-list');
        const lobbyEl = document.getElementById('online-lobby-list');
        const ctrlEl = document.getElementById('online-controls-help');
        if (!listEl || !lobbyEl) return;

        if (netConnectedPlayers.length > 0) {
            lobbyEl.style.display = 'flex';
            if (ctrlEl) ctrlEl.style.display = 'flex';
            let html = '';
            netConnectedPlayers.forEach((p, i) => {
                const icon = p.ready ? 'âœ“' : 'â—‹';
                const color = p.ready ? '#0f0' : '#888';
                const fc = p.friendCode ? ` <span style="color:#666">(${p.friendCode})</span>` : '';
                html += `<div style="color:${color}">${icon} ${p.name || 'Player ' + (i + 1)}${fc}</div>`;
            });
            listEl.innerHTML = html;
        } else {
            lobbyEl.style.display = 'none';
            if (ctrlEl) ctrlEl.style.display = 'none';
        }
    }

    // Mark friends as verified if their code appears in the current lobby
    function verifyFriendsAgainstLobby() {
        if (!saveData || !saveData.friends || saveData.friends.length === 0) return;
        let changed = false;
        const codesInLobby = new Set(netConnectedPlayers.filter(p => p.friendCode).map(p => p.friendCode));
        saveData.friends.forEach(f => {
            if (f && f.code && codesInLobby.has(f.code)) {
                if (!f.verified) { f.verified = true; changed = true; }
                const p = netConnectedPlayers.find(p => p.friendCode === f.code);
                if (p && p.name && f.name !== p.name) { f.name = p.name; changed = true; }
                f.lastSeenAt = Date.now();
            }
        });
        if (changed) { try { saveGame(); renderFriends(); } catch (e) { } }
    }

    function initOnlineCharSelect() {
        try {
            const p1Sel = document.getElementById('online-p1-char');
            const p2Sel = document.getElementById('online-p2-char');
            if (!p1Sel || !p2Sel) return;
            // Populate options
            const makeOpts = sel => {
                sel.innerHTML = '';
                CHARACTERS.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id; opt.textContent = `${c.icon} ${c.name}`;
                    sel.appendChild(opt);
                });
            };
            makeOpts(p1Sel); makeOpts(p2Sel);
            // Set defaults
            p1Sel.value = (p1Char && p1Char.id) || 'doge';
            p2Sel.value = (p2Char && p2Char.id) || 'chad';
            const prev = document.getElementById('online-picked-preview');
            const renderPrev = () => {
                const c1 = CHARACTERS.find(x => x.id === p1Sel.value);
                const c2 = CHARACTERS.find(x => x.id === p2Sel.value);
                if (prev) prev.textContent = `P1: ${c1 ? (c1.icon + ' ' + c1.name) : p1Sel.value} | P2: ${c2 ? (c2.icon + ' ' + c2.name) : p2Sel.value}`;
            };
            p1Sel.onchange = renderPrev; p2Sel.onchange = renderPrev; renderPrev();
        } catch (e) { }
    }

    function onlineStart(mode) {
        if (!isHost || !netPeerReady) return;
        try {
            // Default characters if not chosen yet
            const p1Sel = document.getElementById('online-p1-char');
            const p2Sel = document.getElementById('online-p2-char');
            const p1Pick = p1Sel && p1Sel.value ? p1Sel.value : ((p1Char && p1Char.id) || 'doge');
            const p2Pick = p2Sel && p2Sel.value ? p2Sel.value : ((p2Char && p2Char.id) || 'chad');
            p1Char = CHARACTERS.find(c => c.id === p1Pick) || CHARACTERS.find(c => c.id === 'doge') || CHARACTERS[0];
            p2Char = CHARACTERS.find(c => c.id === p2Pick) || CHARACTERS.find(c => c.id === 'chad') || CHARACTERS[1];
            const stageSel = document.getElementById('online-stage-sel');
            const stocksInput = document.getElementById('online-stocks');
            const stageId = (stageSel && stageSel.value) || 'flat';
            const stocks = (stocksInput && parseInt(stocksInput.value)) || 3;
            customStocks = stocks; // Set global for host
            // Read custom rules
            const itemsCheck = document.getElementById('online-items');
            const hazardsCheck = document.getElementById('online-hazards');
            const teamAttackCheck = document.getElementById('online-teamattack');
            rulesItemsEnabled = itemsCheck ? itemsCheck.checked : true;
            rulesHazardsEnabled = hazardsCheck ? hazardsCheck.checked : true;
            rulesTeamAttack = teamAttackCheck ? teamAttackCheck.checked : false;
            selectedMap = MAPS.find(m => m.id === stageId) || MAPS[0];
            sendNet({ t: 'start', mode: mode === 'meme' ? 'meme' : 'vs', gameMode: netGameMode, p1: p1Char.id, p2: p2Char.id, map: selectedMap.id, stocks: stocks, items: rulesItemsEnabled, hazards: rulesHazardsEnabled, teamAttack: rulesTeamAttack });
            document.getElementById('online-screen').classList.add('hidden');
            document.getElementById('hud').classList.remove('hidden');
            isSurvival = false; isTraining = false; isMemeBall = (mode === 'meme');
            if (isMemeBall) beginMemeBall(); else startGame();
        } catch (e) { }
    }

    // Client: capture inputs and send to host
    window.addEventListener('keydown', e => {
        if (isOnline && !isHost && netPeerReady) sendNet({ t: 'inp', k: e.key, v: 1 });
    });
    window.addEventListener('keyup', e => {
        if (isOnline && !isHost && netPeerReady) sendNet({ t: 'inp', k: e.key, v: 0 });
    });

    function applyNetState(s) {
        try {
            if (!isOnline || isHost) return;
            // players - sync all received player states
            if (players && s.players) {
                const numPlayers = Math.min(players.length, s.players.length);
                for (let i = 0; i < numPlayers; i++) {
                    const sp = s.players[i];
                    if (!players[i] || !sp) continue;
                    players[i].x = sp.x; players[i].y = sp.y; players[i].vx = sp.vx; players[i].vy = sp.vy;
                    players[i].pct = sp.pct; players[i].stocks = sp.stocks; players[i].ult = sp.ult;
                }
                // Refresh HUD to reflect authoritative host values (damage %, stocks, ult charge)
                if (typeof updateHUD === 'function') updateHUD();
            }
            if (typeof isMemeBall !== 'undefined' && s.ball && ball) {
                ball.x = s.ball.x; ball.y = s.ball.y; ball.vx = s.ball.vx; ball.vy = s.ball.vy;
                ball.inPlay = s.ball.inPlay; ball.hasCrossedNet = s.ball.cross;
            }
            if (typeof p1Score !== 'undefined' && s.score) {
                p1Score = s.score[0]; p2Score = s.score[1];
                const sc = document.getElementById('game-score-val'); if (sc) sc.innerText = `${p1Score} - ${p2Score}`;
            }
        } catch (e) { }
    }
    function startSurvival() {
        music.init();
        sfx.init();
        isSurvival = !0;
        isTraining = !1;
        isMemeBall = !1;
        document.getElementById('title-screen').classList.add('hidden');
        document.getElementById('char-select').classList.remove('hidden');
        document.getElementById('cpu-controls').classList.remove('hidden');
        document.getElementById('select-instruction').innerText = "CHOOSE YOUR HEROES";
        renderCharGrid();
        music.play('MENU');
    }
    function startTraining() {
        music.init();
        sfx.init();
        isTraining = !0;
        isSurvival = !1;
        isMemeBall = !1;
        document.getElementById('title-screen').classList.add('hidden');
        document.getElementById('char-select').classList.remove('hidden');
        document.getElementById('cpu-controls').classList.add('hidden');
        document.getElementById('select-instruction').innerText = "CHOOSE HERO";
        renderCharGrid();
        music.play('MENU');
    }
    function startSpectator() {
        music.init();
        sfx.init();
        isTraining = !1;
        isSurvival = !1;
        isMemeBall = !1;

        // Auto-select two random unlocked characters
        const unlocked = CHARACTERS.filter(c => saveData.unlocks.includes(c.id));
        if (unlocked.length < 2) {
            alert('Unlock more characters to use Spectator Mode!');
            return;
        }

        p1Char = unlocked[Math.floor(Math.random() * unlocked.length)];
        p2Char = unlocked[Math.floor(Math.random() * unlocked.length)];
        while (p2Char.id === p1Char.id) {
            p2Char = unlocked[Math.floor(Math.random() * unlocked.length)];
        }

        // Set both to CPU
        p2IsCpu = true;

        // Random map
        selectedMap = MAPS[Math.floor(Math.random() * MAPS.length)];

        showNotification('SPECTATOR MODE', `${p1Char.name} VS ${p2Char.name}`);

        // Start immediately
        document.getElementById('title-screen').classList.add('hidden');
        setTimeout(() => {
            document.getElementById('hud').classList.remove('hidden');
            initGame();
            saveMatchSettings();
            gameState = 'GAME';
            music.play('BATTLE');
            loop();
        }, 1000);
    }
    function startMemeBall() {
        music.init();
        sfx.init();
        isMemeBall = !0;
        isSurvival = !1;
        isTraining = !1;
        document.getElementById('title-screen').classList.add('hidden');
        document.getElementById('char-select').classList.remove('hidden');
        document.getElementById('cpu-controls').classList.add('hidden');
        document.getElementById('select-instruction').innerText = "CHOOSE PLAYER";
        renderCharGrid();
        music.play('MENU');
    }
    function showMoves() {
        sfx.init();
        document.getElementById('title-screen').classList.add('hidden');
        document.getElementById('moves-screen').classList.remove('hidden');
        // Hide overlapping HUD elements while viewing moves
        const coin = document.getElementById('coin-display'); if (coin) coin.dataset.prevDisplay = coin.style.display, coin.style.display = 'none';
        const warn = document.getElementById('mega-warning'); if (warn) warn.dataset.prevDisplay = warn.style.display, warn.style.display = 'none';
        const secret = document.getElementById('secret-unlock'); if (secret) secret.dataset.prevDisplay = secret.style.display, secret.style.display = 'none';
        // Tone down heavy text effects in low perf
        if (window.EFFECTS_LOW) {
            if (warn) warn.style.textShadow = 'none';
            if (secret) secret.style.textShadow = 'none';
        }
        const c = document.getElementById('moves-content');
        c.innerHTML = `
        <div>
            <h3>Universal Moves (All Characters)</h3>
            <ul>
                <li><strong>Neutral Attack</strong> (F/L): 8% dmg â€¢ low KB â€¢ 30f CD.</li>
                <li><strong>Side Attack</strong> (â†/â†’ + F/L): 12% dmg â€¢ med-high horiz KB â€¢ 30f CD.</li>
                <li><strong>Up Attack</strong> (â†‘ + F/L): 10% dmg â€¢ high vertical KB â€¢ 30f CD.</li>
                <li><strong>Down Attack</strong> (â†“ + F/L): 10% dmg â€¢ pop-up â€¢ 30f CD.</li>
            </ul>
        </div>
        <h3>Roster Details</h3>
        <div class="moves-grid" id="moves-grid"></div>
        `;

        // Add CSS to make modal work properly
        const styleTagId = 'moves-modal-style';
        if (!document.getElementById(styleTagId)) {
            const style = document.createElement('style');
            style.id = styleTagId;
            style.textContent = `
                    #moves-screen { padding-top: 20px; }
                    #move-detail { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: none; align-items: center; justify-content: center; z-index: 500; }
                    #move-detail.show { display: flex; }
                    .move-card { cursor: pointer; transition: transform 0.2s; }
                    .move-card:hover { transform: scale(1.02); }
                `;
            document.head.appendChild(style);
        }

        // Define complete character detail content map before cards are built
        window._moveDetailContent = {
            'doge': {
                specials: 'Uses universal moveset.',
                ult: 'Moon Crash: Summon falling moon at opponent; strong projectile for pressure and kills.'
            },
            'frog': {
                specials: 'Uses universal moveset.',
                ult: 'Mega Hit: 40% dmg, very high horizontal knockback.'
            },
            'cat': {
                specials: 'Uses universal moveset.',
                ult: 'Mega Hit: 40% dmg, very high horizontal knockback.'
            },
            'capy': {
                specials: 'Uses universal moveset.',
                ult: 'Mega Hit: 40% dmg, very high horizontal knockback.'
            },
            'spongy': {
                specials: 'Uses universal moveset. Low weight makes combo-friendly.',
                ult: 'Mega Hit: 40% dmg, very high horizontal knockback.'
            },
            'troll': {
                specials: 'Uses universal moveset.',
                ult: 'Mega Hit: 40% dmg, very high horizontal knockback.'
            },
            'sanic': {
                specials: 'Universal standard attacks.',
                ult: 'Light Speed: Teleport to opponent, 30% hit, 1s invincibility.'
            },
            'chad': {
                specials: 'Universal; high power/weight amplify effectiveness.',
                ult: 'Giga Stun: 180f stun; guaranteed follow-up setup.'
            },
            '67kid': {
                specials: 'Up: Self 67% dmg + stun. Down: Ground pound, 10% dmg, strong vertical KB.',
                ult: 'Brain Rot: Reverse opponent velocity + 60f stun; gimp recoveries.'
            },
            'amogus': {
                specials: 'Side: Vent dash (no hitbox). Up: High vertical recovery.',
                ult: 'Emergency Meeting: Screen nuke ~50% dmg.'
            },
            'sahur': {
                specials: 'Down: 200x40 hitbox, 20% dmg. Up: 12% dmg, very high vertical KB. Side: 15% dmg high KB.',
                ult: 'Deafening Beat: 180f stun; setup tool.'
            },
            'primo': {
                specials: 'Down: Wide ground-pound. Up: Diagonal recovery with hitbox. Side: Fast dash 12% dmg.',
                ult: 'Tag Team: Summon projectile Primo across screen.'
            },
            'ocralito': {
                specials: 'Down: 150px belly flop 14%. Up: Safe vertical recovery 10%. Side: Belly slide reduces friction to 0.98.',
                ult: 'Deep Freeze: 120f stun.'
            },
            'mechabara': {
                specials: 'Down: Ground Laser pops up (16%). Up: Huge vertical jump (10%). Side: Drill Lunge multi-hit.',
                ult: 'Orbital Strike: Falling projectile (moon style).'
            },
            'bluedude': {
                specials: 'Down: 15f parry + 25% counter. Up: 100x100 spin 12%. Side: Blade Dash 9%.',
                ult: 'Zero Slash: Massive close-range slash, 35%.'
            },
            'johnpork': {
                specials: 'Down: Global 10%. Up: Random buff 5s. Side: 120f stun.',
                ult: 'Pig Slam: Falling pig, extreme KB, 100%.'
            },
            'thememe': {
                specials: 'All stats 999; universal moves overpower.',
                ult: 'DEATH: 999%.'
            },
            'gps': {
                specials: 'Down: Confuse 5s. Up: Vertical teleport. Side: Horizontal teleport.',
                ult: 'Global Rotation: Flip stage physics ~10s.'
            },
            'luckyblock': {
                specials: 'Side: 50% chance for 5x rapid 100% hits. Up: Spawn coin + delayed hit. Down: Crush from above.',
                ult: 'Gambling Fever: Random slot machine buffs for 20s.'
            },
            'brokeboy': {
                specials: 'Side: Beg/boost chance; side animation. Up: Sucker Punch with custom animation. Down: Parry (shield).',
                ult: 'Mrbeast: Temporary power/speed/weight/inv boost; plays unique ult animation.'
            },
            'glitch': {
                specials: 'Side: Pixel Shift (70% forward/30% reverse dash). Up: Data Corruption (random teleport + 10% position swap). Down: Reality Break (50% stun opponent 60f OR self 30f).',
                ult: 'System Crash: Reverse opponent controls 3s + 1.5x damage.'
            }
        };

        // Build roster cards if not already and attach handlers
        const grid = document.getElementById('moves-grid');
        if (grid) {
            // If grid is empty, build from available CHARACTERS
            if (!grid.children.length && typeof CHARACTERS !== 'undefined' && Array.isArray(CHARACTERS)) {
                const toCard = (ch) => {
                    const stats = `<span class=statline>Speed: ${ch.speed} â€¢ Power: ${ch.power} â€¢ Jump: ${ch.jump} â€¢ Weight: ${ch.weight}</span>`;
                    return `
                        <div class="move-card" data-char-key="${ch.id}">
                          <div class="move-thumb"><canvas width="16" height="16" id="moves-thumb-${ch.id}" style="width:48px;height:48px"></canvas></div>
                          <div class="move-details">
                            <div class="move-title">${ch.name}</div>
                            ${stats}
                            <div><span class="badge">SIDE</span>${ch.moves.side}</div>
                            <div><span class="badge">UP</span>${ch.moves.up}</div>
                            <div><span class="badge">DOWN</span>${ch.moves.down}</div>
                            <div><span class="badge">ULT</span>${ch.moves.ult}</div>
                          </div>
                        </div>`;
                };
                grid.innerHTML = CHARACTERS.map(toCard).join('');
                // Render thumbnails
                CHARACTERS.forEach(ch => {
                    const cvs = document.getElementById(`moves-thumb-${ch.id}`);
                    if (!cvs) return;
                    const mctx = cvs.getContext('2d');
                    mctx.imageSmoothingEnabled = !1;
                    const spr = characterSprites[ch.id];
                    if (spr) {
                        if (spr.idle && spr.idle[0]) {
                            mctx.drawImage(spr.idle[0], 0, 0, cvs.width, cvs.height);
                        } else {
                            mctx.drawImage(spr, 0, 0, cvs.width, cvs.height);
                        }
                    } else {
                        mctx.font = "16px Arial";
                        mctx.textAlign = "center";
                        mctx.textBaseline = "middle";
                        mctx.fillText(ch.icon || '?', 8, 8);
                    }
                });
            }

            const openModal = (ch, entry) => {
                const modalEl = document.getElementById('move-detail');
                if (!modalEl) return;
                document.getElementById('move-detail-title').innerText = ch?.name || 'Character';
                document.getElementById('move-detail-stats').innerHTML = `Speed: ${ch?.speed || 'â€”'} â€¢ Power: ${ch?.power || 'â€”'} â€¢ Jump: ${ch?.jump || 'â€”'} â€¢ Weight: ${ch?.weight || 'â€”'}`;
                document.getElementById('move-detail-universal').innerHTML = `<strong>Universal Attacks</strong><br>Neutral: 8% dmg â€¢ low KB â€¢ 30f CD<br>Side: 12% dmg â€¢ med-high horiz KB â€¢ 30f CD<br>Up: 10% dmg â€¢ high vertical KB â€¢ 30f CD<br>Down: 10% dmg â€¢ pop-up â€¢ 30f CD`;
                document.getElementById('move-detail-specials').innerHTML = `<strong>Special Moves</strong><br>${entry.specials}`;
                document.getElementById('move-detail-ult').innerHTML = `<strong>Ultimate</strong><br>${entry.ult}`;
                modalEl.classList.add('show');
            };

            const closeModal = () => {
                const modalEl = document.getElementById('move-detail');
                if (modalEl) modalEl.classList.remove('show');
            };
            // Make closeModal available globally for the CLOSE button
            window.closeMoveDetail = closeModal;

            // Close handlers
            const closeBtn = document.getElementById('move-detail-close');
            if (closeBtn) closeBtn.onclick = closeModal;
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') closeModal();
            });
            document.getElementById('move-detail')?.addEventListener('click', (e) => {
                if (e.target.id === 'move-detail') closeModal();
            });

            // Card click handlers
            Array.from(grid.children).forEach((el) => {
                if (!el.dataset.bound) {
                    el.dataset.bound = '1';
                    el.addEventListener('click', () => {
                        const key = el.getAttribute('data-char-key');
                        const ch = CHARACTERS.find(c => c.id === key);
                        const entry = window._moveDetailContent?.[key] || { specials: 'Uses universal moves.', ult: 'Default ult' };
                        openModal(ch, entry);
                    });
                }
            });
        }
        // Old card build removed to prevent duplicate variable declarations and handlers
    }
    function hideMoves() {
        document.getElementById('moves-screen').classList.add('hidden');
        document.getElementById('title-screen').classList.remove('hidden');
        // Restore HUD elements
        const coin = document.getElementById('coin-display'); if (coin) coin.style.display = coin.dataset.prevDisplay || '';
        const warn = document.getElementById('mega-warning'); if (warn) warn.style.display = warn.dataset.prevDisplay || '';
        const secret = document.getElementById('secret-unlock'); if (secret) secret.style.display = secret.dataset.prevDisplay || '';
    }
    function openMoveDetail(id) {
        const ch = CHARACTERS.find(c => c.id === id);
        if (!ch) return;
        const md = document.getElementById('move-detail');
        md.style.display = 'flex';
        document.getElementById('move-detail-title').innerText = ch.name;
        document.getElementById('move-detail-stats').innerHTML = `Speed: ${ch.speed} â€¢ Power: ${ch.power} â€¢ Jump: ${ch.jump} â€¢ Weight: ${ch.weight}`;
        const uni = document.getElementById('move-detail-universal');
        uni.innerHTML = `<strong>Universal Attacks</strong><br>Neutral 8% â€¢ Side 12% â€¢ Up 10% â€¢ Down 10% â€¢ Typical CD: 30f`;
        const spec = document.getElementById('move-detail-specials');
        const ult = document.getElementById('move-detail-ult');
        const entry = (window._moveDetailContent || {})[id] || { specials: 'Uses universal moves.', ult: 'Default ult' };
        spec.innerHTML = `<strong>Specials</strong><br>${entry.specials}`;
        ult.innerHTML = `<strong>Ult</strong><br>${entry.ult}`;
        // Render thumb
        const cvs = document.getElementById('move-detail-thumb');
        const ctx2 = cvs.getContext('2d');
        ctx2.clearRect(0, 0, cvs.width, cvs.height);
        ctx2.imageSmoothingEnabled = !1;
        const spr = characterSprites[id];
        if (spr) {
            if (spr.idle && spr.idle[0]) ctx2.drawImage(spr.idle[0], 0, 0, cvs.width, cvs.height);
            else ctx2.drawImage(spr, 0, 0, cvs.width, cvs.height);
        } else {
            ctx2.font = "48px Arial"; ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle'; ctx2.fillText(ch.icon || '?', cvs.width / 2, cvs.height / 2);
        }
    }
    function closeMoveDetail() {
        document.getElementById('move-detail').style.display = 'none';
    }
    function openSettings() {
        sfx.init();
        document.getElementById('title-screen').classList.add('hidden');
        document.getElementById('settings-screen').classList.remove('hidden');
        updateMobileControlsSetting();
    }
    function closeSettings() {
        document.getElementById('settings-screen').classList.add('hidden');
        document.getElementById('title-screen').classList.remove('hidden');
    }
    function deleteSaveFile() {
        if (confirm('Are you sure you want to delete your save file? This will reset all progress, coins, unlocks, and cosmetics. This action cannot be undone!')) {
            localStorage.removeItem(SAVE_KEY);
            alert('Save file deleted! The game will now reload.');
            location.reload();
        }
    }
    function toggleHitboxSetting() {
        showHitboxes = !showHitboxes;
        const b = document.getElementById('btn-hitbox');
        if (showHitboxes) {
            b.innerText = "ON";
            b.className = "toggle-btn toggle-on";
        } else {
            b.innerText = "OFF";
            b.className = "toggle-btn toggle-off";
        }
        sfx.play('coin');
    }
    function toggleMusicSetting() {
        let e = music.toggle();
        const b = document.getElementById('btn-music');
        if (u) {
            // Up attack: use custom up-attack animation and lock for a bit
            this.playAnimation("attack_up", 36);
        } else {
            b.innerText = "OFF";
            b.className = "toggle-btn toggle-off";
        }
        sfx.play('coin');
    }
    function toggleMobileSetting() {
        saveData.mobileControls = !saveData.mobileControls;
        saveGame();
        updateMobileControlsSetting();
        sfx.play('coin');
    }
    function updateMobileControlsSetting() {
        const b = document.getElementById('btn-mobile');
        const controls = document.getElementById('mobile-controls');
        const touchCapable = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (b) {
            if (saveData.mobileControls) {
                b.innerText = "ON";
                b.className = "toggle-btn toggle-on";
            } else {
                b.innerText = "OFF";
                b.className = "toggle-btn toggle-off";
            }
        }
        if (saveData.mobileControls && touchCapable) {
            controls.style.display = 'block';
        } else {
            controls.style.display = 'none';
        }
    }
    function showTrophies() {
        sfx.init();
        document.getElementById('title-screen').classList.add('hidden');
        document.getElementById('trophy-screen').classList.remove('hidden');
        renderTrophies();
    }
    function hideTrophies() {
        document.getElementById('trophy-screen').classList.add('hidden');
        document.getElementById('title-screen').classList.remove('hidden');
    }

    // ========== MASTERY SYSTEM ==========
    function initMastery(charId) {
        if (!saveData.mastery) saveData.mastery = {};
        if (!saveData.mastery[charId]) {
            saveData.mastery[charId] = { wins: 0, matches: 0, damage: 0, level: 0 };
        }
    }
    function trackMatch(charId, won, damageDealt) {
        initMastery(charId);
        saveData.mastery[charId].matches++;
        if (won) saveData.mastery[charId].wins++;
        saveData.mastery[charId].damage += Math.floor(damageDealt);

        // Calculate level: Bronze(5), Silver(15), Gold(30), Diamond(50), Master(100)
        const wins = saveData.mastery[charId].wins;
        let oldLevel = saveData.mastery[charId].level;
        if (wins >= 100) saveData.mastery[charId].level = 5;
        else if (wins >= 50) saveData.mastery[charId].level = 4;
        else if (wins >= 30) saveData.mastery[charId].level = 3;
        else if (wins >= 15) saveData.mastery[charId].level = 2;
        else if (wins >= 5) saveData.mastery[charId].level = 1;

        saveGame();
        return saveData.mastery[charId].level > oldLevel;
    }
    function getMasteryRank(level) {
        const ranks = ['UNRANKED', 'BRONZE', 'SILVER', 'GOLD', 'DIAMOND', 'MASTER'];
        const colors = ['#666', '#cd7f32', '#c0c0c0', '#ffd700', '#b9f2ff', '#ff00ff'];
        const icons = ['', 'ðŸ¥‰', 'ðŸ¥ˆ', 'ðŸ¥‡', 'ðŸ’Ž', 'ðŸ‘‘'];
        return { name: ranks[level], color: colors[level], icon: icons[level] };
    }
    function showMastery() {
        document.getElementById('title-screen').classList.add('hidden');
        document.getElementById('mastery-screen').classList.remove('hidden');
        renderMastery();
    }
    function hideMastery() {
        document.getElementById('mastery-screen').classList.add('hidden');
        document.getElementById('title-screen').classList.remove('hidden');
    }
    function renderMastery() {
        const grid = document.getElementById('mastery-grid');
        grid.innerHTML = '';

        CHARACTERS.forEach(char => {
            initMastery(char.id);
            const m = saveData.mastery[char.id];
            const rank = getMasteryRank(m.level);
            const winRate = m.matches > 0 ? ((m.wins / m.matches) * 100).toFixed(1) : 0;

            const card = document.createElement('div');
            card.style.cssText = `background:#222;border:3px solid ${rank.color};padding:20px;border-radius:10px;`;
            card.innerHTML = `
            <div style="display:flex;align-items:center;gap:15px;margin-bottom:15px">
                <div style="font-size:48px">${char.icon}</div>
                <div>
                    <div style="font-family:'Press Start 2P';font-size:16px;color:#fff">${char.name}</div>
                    <div style="font-family:'Press Start 2P';font-size:12px;color:${rank.color};margin-top:5px">${rank.icon} ${rank.name}</div>
                </div>
            </div>
            <div style="font-family:'Press Start 2P';font-size:10px;color:#aaa;line-height:1.8">
                <div>WINS: <span style="color:#0f0">${m.wins}</span></div>
                <div>MATCHES: <span style="color:#fff">${m.matches}</span></div>
                <div>WIN RATE: <span style="color:#ffd700">${winRate}%</span></div>
                <div>DAMAGE DEALT: <span style="color:#f00">${m.damage}</span></div>
            </div>
            <div style="margin-top:10px;background:#333;border-radius:5px;height:10px;overflow:hidden">
                <div style="background:${rank.color};height:100%;width:${(m.wins % (rank.name === 'MASTER' ? 100 : [5, 10, 15, 20, 50][m.level])) / ([5, 10, 15, 20, 50, 100][m.level]) * 100}%"></div>
            </div>
            <div style="font-family:'Press Start 2P';font-size:8px;color:#666;margin-top:5px;text-align:right">
                ${m.level < 5 ? `Next: ${[5, 15, 30, 50, 100][m.level]} wins` : 'MAX RANK!'}
            </div>
        `;
            grid.appendChild(card);
        });
    }

    // ========== FRIEND CODE SYSTEM ==========
    function generateFriendCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            if (i === 4) code += '-';
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
    function initFriendCode() {
        if (!saveData.friendCode) {
            saveData.friendCode = generateFriendCode();
            saveGame();
        }
    }
    function showFriends() {
        initFriendCode();
        document.getElementById('title-screen').classList.add('hidden');
        document.getElementById('friends-screen').classList.remove('hidden');
        document.getElementById('your-friend-code').textContent = saveData.friendCode;
        renderFriends();
    }
    function hideFriends() {
        document.getElementById('friends-screen').classList.add('hidden');
        document.getElementById('title-screen').classList.remove('hidden');
    }
    function copyFriendCode() {
        navigator.clipboard.writeText(saveData.friendCode).then(() => {
            showNotification('COPIED!', 'Friend code copied to clipboard');
            sfx.play('coin');
        });
    }
    function addFriend() {
        const input = document.getElementById('friend-code-input');
        const code = input.value.trim().toUpperCase();

        if (!code) {
            alert('Please enter a friend code');
            return;
        }
        if (code === saveData.friendCode) {
            alert("You can't add yourself!");
            return;
        }
        if (saveData.friends.some(f => f.code === code)) {
            alert('Friend already added!');
            return;
        }

        // Add as unverified until seen online (or validated by server)
        saveData.friends.push({
            code: code,
            name: `Player ${code.substr(0, 4)}`,
            addedAt: Date.now(),
            verified: false
        });
        saveGame();
        input.value = '';
        renderFriends();
        showNotification('FRIEND ADDED', code + ' (UNVERIFIED)');
        sfx.play('coin');
    }
    function removeFriend(code) {
        if (confirm('Remove this friend?')) {
            saveData.friends = saveData.friends.filter(f => f.code !== code);
            saveGame();
            renderFriends();
            sfx.play('break');
        }
    }
    function renderFriends() {
        const list = document.getElementById('friends-list');
        if (!saveData.friends || saveData.friends.length === 0) {
            list.innerHTML = '<div style="text-align:center;color:#666;font-family:Press Start 2P;font-size:12px;padding:40px">No friends yet. Share your code!</div>';
            return;
        }

        list.innerHTML = saveData.friends.map(f => {
            const hasStats = f.stats && typeof f.stats.wins === 'number' && typeof f.stats.losses === 'number' && f.stats.favoriteChar;
            let statsHtml = '<div style="font-family: \'Press Start 2P\'; font-size:10px; color:#666; margin-top:8px">No stats yet</div>';
            if (hasStats) {
                const total = (f.stats.wins || 0) + (f.stats.losses || 0);
                const winRate = total > 0 ? Math.floor(((f.stats.wins || 0) / total) * 100) : 0;
                statsHtml = `
            <div style="display:flex;gap:15px;flex-wrap:wrap;font-family:'Press Start 2P';font-size:9px;color:#aaa;border-top:1px solid #444;padding-top:10px">
                <div style="color:#0f0">W: ${f.stats.wins}</div>
                <div style="color:#f00">L: ${f.stats.losses}</div>
                <div style="color:#ffd700">WR: ${winRate}%</div>
                <div style="color:#fff">Main: ${String(f.stats.favoriteChar).toUpperCase()}</div>
            </div>`;
            }
            return `
        <div style="background:#222;border:2px solid #555;padding:15px;margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <div>
                    <div style="font-family:'Press Start 2P';font-size:14px;color:#fff">${f.name} ${f.verified ? '<span style=\'color:#0f0;font-size:10px\'>[VERIFIED]</span>' : '<span style=\'color:#999;font-size:10px\'>[UNVERIFIED]</span>'}</div>
                    <div style="font-family:'Press Start 2P';font-size:10px;color:#666;margin-top:5px">${f.code}</div>
                </div>
                <button class="menu-btn danger-btn" onclick="removeFriend('${f.code}')" style="font-size:10px;padding:8px 16px">REMOVE</button>
            </div>
            ${statsHtml}
        </div>
        `;
        }).join('');
    }

    // ========== SOUND TEST ==========
    function showSoundTest() {
        document.getElementById('title-screen').classList.add('hidden');
        document.getElementById('sound-test-screen').classList.remove('hidden');
        renderSoundTest();
    }
    function hideSoundTest() {
        document.getElementById('sound-test-screen').classList.add('hidden');
        document.getElementById('title-screen').classList.remove('hidden');
        music.stop();
    }
    function renderSoundTest() {
        const musicList = document.getElementById('music-list');
        const sfxList = document.getElementById('sfx-list');

        const musicTracks = ['MENU', 'GAME', 'BOSS'];
        musicList.innerHTML = musicTracks.map(track => `
        <button class="menu-btn" onclick="music.play('${track}')" style="font-size:12px;padding:12px">
            ðŸŽµ ${track}
        </button>
    `).join('');

        const sfxNames = ['hit', 'jump', 'coin', 'shield', 'break', 'ult', 'parry'];
        sfxList.innerHTML = sfxNames.map(name => `
        <button class="menu-btn" onclick="sfx.play('${name}')" style="font-size:12px;padding:12px">
            ðŸ”Š ${name.toUpperCase()}
        </button>
    `).join('');
    }

    // ========== CONTROL REMAPPING ==========
    let remappingPlayer = null;
    let remappingAction = null;
    function showControlsConfig() {
        document.getElementById('settings-screen').classList.add('hidden');
        document.getElementById('controls-config-screen').classList.remove('hidden');
        loadControlsDisplay();
    }
    function hideControlsConfig() {
        document.getElementById('controls-config-screen').classList.add('hidden');
        document.getElementById('settings-screen').classList.remove('hidden');
    }
    function loadControlsDisplay() {
        if (!saveData.customControls) {
            saveData.customControls = {
                p1: { left: 'a', right: 'd', up: 'w', down: 's', attack: 'f', ult: 'q', shield: 'g' },
                p2: { left: 'a', right: 'd', up: 'w', down: 's', attack: 'f', ult: 'r', shield: 'g' },
                p3: { left: 'a', right: 'd', up: 'w', down: 's', attack: 'f', ult: 'r', shield: 'g' },
                p4: { left: 'a', right: 'd', up: 'w', down: 's', attack: 'f', ult: 'r', shield: 'g' }
            };
        }

        // Update button displays
        for (const player of ['p1', 'p2', 'p3', 'p4']) {
            for (const action in saveData.customControls[player]) {
                const btn = document.querySelector(`button[onclick="remapKey('${player}','${action}')"]`);
                if (btn) btn.textContent = saveData.customControls[player][action];
            }
        }
    }
    function remapKey(player, action) {
        remappingPlayer = player;
        remappingAction = action;
        const btn = document.querySelector(`button[onclick="remapKey('${player}','${action}')"]`);
        if (btn) {
            btn.classList.add('remapping');
            btn.textContent = 'PRESS KEY...';
        }

        const handler = (e) => {
            e.preventDefault();
            let key = e.key;
            if (key && key.length === 1) key = key.toLowerCase();

            if (!saveData.customControls) saveData.customControls = { p1: {}, p2: {} };
            saveData.customControls[player][action] = key;
            saveGame();

            if (btn) {
                btn.classList.remove('remapping');
                btn.textContent = key;
            }

            document.removeEventListener('keydown', handler);
            remappingPlayer = null;
            remappingAction = null;
            sfx.play('coin');
        };

        document.addEventListener('keydown', handler);
    }
    function resetControls() {
        saveData.customControls = null;
        saveGame();
        loadControlsDisplay();
        showNotification('CONTROLS RESET', 'Default controls restored');
        sfx.play('coin');
    }
    function getControl(player, action) {
        if (!saveData.customControls) return null;
        return saveData.customControls[player] && saveData.customControls[player][action];
    }

    // ========== REMATCH SYSTEM ==========
    let lastMatchSettings = null;
    function rematch() {
        if (!lastMatchSettings) {
            location.reload();
            return;
        }

        // Restore previous match settings
        p1Char = lastMatchSettings.p1Char;
        p2Char = lastMatchSettings.p2Char;
        selectedMap = lastMatchSettings.stage;
        p2IsCpu = lastMatchSettings.isCpu;
        cpuLevel = lastMatchSettings.cpuLevel;

        // Hide game over, start new match
        document.getElementById('game-over').classList.add('hidden');
        startGameLoop();
    }
    function saveMatchSettings() {
        lastMatchSettings = {
            p1Char: p1Char,
            p2Char: p2Char,
            stage: selectedMap,
            isCpu: p2IsCpu,
            cpuLevel: cpuLevel
        };
    }

    function renderTrophies() {
        const grid = document.getElementById('trophy-grid');
        grid.innerHTML = '';
        for (const id in MASTER_TROPHY_LIST) {
            const trophy = MASTER_TROPHY_LIST[id];
            const unlocked = saveData.trophies.includes(id);
            const div = document.createElement('div');
            div.className = unlocked ? 'trophy-item unlocked' : 'trophy-item locked';
            if (unlocked) {
                div.innerHTML = `<div class="trophy-icon">${trophy.icon}</div><div class="trophy-name">${trophy.name}</div><div class="trophy-desc">${trophy.desc}</div>`;
            } else {
                div.innerHTML = `<div class="trophy-icon">â“</div><div class="trophy-name">LOCKED</div><div class="trophy-desc">???</div>`;
            }
            grid.appendChild(div);
        }
    }
    function toggleCpu() {
        p2IsCpu = !p2IsCpu;
        document.getElementById('cpu-toggle').innerText = p2IsCpu ? "P2: CPU" : "P2: HUMAN";
        document.getElementById('cpu-toggle').classList.toggle('cpu-active', p2IsCpu);
        document.getElementById('cpu-level-container').style.display = p2IsCpu ? 'flex' : 'none';
    }
    function updateCpuLevel(v) {
        cpuLevel = parseInt(v);
        document.getElementById('cpu-level-val').innerText = cpuLevel;
    }
    function renderCharGrid() {
        const g = document.getElementById('char-grid');
        g.innerHTML = '';
        CHARACTERS.forEach(c => {
            const d = document.createElement('div');
            d.className = 'char-card';
            d.id = `card-${c.id}`;
            let iconHtml;
            if (characterSprites[c.id]) {
                iconHtml = `<canvas width="16" height="16" id="sprite-${c.id}"></canvas>`;
            } else {
                iconHtml = `<span class="char-icon" style="font-size: 40px;">${c.icon}</span>`;
            }
            if (!saveData.unlocks.includes(c.id)) {
                d.classList.add('locked');
                d.innerHTML = `<div class="lock-icon">ðŸ”’</div>${iconHtml}`;
            } else {
                d.innerHTML = iconHtml;
                d.onclick = () => selectCharacter(c);
            }
            g.appendChild(d);
            if (characterSprites[c.id]) {
                const miniCanvas = document.getElementById(`sprite-${c.id}`);
                if (miniCanvas) {
                    const miniCtx = miniCanvas.getContext('2d');
                    miniCtx.imageSmoothingEnabled = !1;
                    const sprite = characterSprites[c.id];
                    if (sprite.idle && sprite.idle[0]) {
                        miniCtx.drawImage(sprite.idle[0], 0, 0, miniCanvas.width, miniCanvas.height);
                    } else if (sprite) {
                        miniCtx.drawImage(sprite, 0, 0, miniCanvas.width, miniCanvas.height);
                    }
                }
            }
        });
        updateMasteryToggles();
    }

    function isCharMastered(charId) {
        try {
            initMastery(charId);
            return saveData.mastery[charId].level >= 5;
        } catch (e) {
            return false;
        }
    }

    function checkJackUnlock() {
        // Check if Jack is already unlocked
        if (saveData.unlocks.includes('jack')) return false;

        // Get all characters except Jack
        const nonJackChars = CHARACTERS.filter(c => c.id !== 'jack');

        // Check if ALL non-Jack characters are mastered
        const allMastered = nonJackChars.every(c => isCharMastered(c.id));

        if (allMastered) {
            saveData.unlocks.push('jack');
            saveGame();
            // Show unlock notification
            showJackUnlock();
            return true;
        }
        return false;
    }

    function showJackUnlock() {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;animation:fadeIn 0.5s';

        const icon = document.createElement('div');
        icon.style.cssText = "font-size:120px;margin-bottom:30px;animation:bounce 1s infinite";
        icon.textContent = 'ðŸƒ';

        const title = document.createElement('div');
        title.style.cssText = "font-family:'Press Start 2P';font-size:32px;color:#FFD700;margin-bottom:20px;text-align:center";
        title.textContent = 'CHARACTER UNLOCKED!';

        const charName = document.createElement('div');
        charName.style.cssText = "font-family:'Press Start 2P';font-size:24px;color:#fff;margin-bottom:40px;text-align:center";
        charName.textContent = 'JACK OF ALL TRADES';

        const desc = document.createElement('div');
        desc.style.cssText = "font-family:'Press Start 2P';font-size:12px;color:#aaa;margin-bottom:40px;text-align:center;max-width:600px;line-height:2";
        desc.innerHTML = 'Master of None<br/>You have mastered every character!<br/>The ultimate fighter awaits...';

        const btn = document.createElement('button');
        btn.className = 'menu-btn';
        btn.textContent = 'CONTINUE';
        btn.onclick = () => {
            document.body.removeChild(overlay);
            renderCharGrid();
        };

        overlay.appendChild(icon);
        overlay.appendChild(title);
        overlay.appendChild(charName);
        overlay.appendChild(desc);
        overlay.appendChild(btn);
        document.body.appendChild(overlay);

        // Add animations
        const style = document.createElement('style');
        style.textContent = `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
    `;
        document.head.appendChild(style);
    }

    function updateMasteryToggles() {
        const b1 = document.getElementById('p1-mastery-toggle');
        const b2 = document.getElementById('p2-mastery-toggle');
        if (b1) {
            if (p1Char && isCharMastered(p1Char.id)) {
                b1.style.display = 'inline-block';
                b1.innerText = `P1 MASTERY: ${useMasteryP1 ? 'ON' : 'OFF'}`;
            } else {
                b1.style.display = 'none';
            }
        }
        if (b2) {
            if (p2Char && isCharMastered(p2Char.id)) {
                b2.style.display = 'inline-block';
                b2.innerText = `P2 MASTERY: ${useMasteryP2 ? 'ON' : 'OFF'}`;
            } else {
                b2.style.display = 'none';
            }
        }
    }

    function toggleMastery(player) {
        if (player === 1 && p1Char && isCharMastered(p1Char.id)) {
            useMasteryP1 = !useMasteryP1;
        } else if (player === 2 && p2Char && isCharMastered(p2Char.id)) {
            useMasteryP2 = !useMasteryP2;
        }
        updateMasteryToggles();
        sfx.play('coin');
    }
    function highlightChar(id, p) {
        const cards = document.getElementsByClassName('char-card');
        for (let c of cards) c.classList.remove(`selected-p${p}`);
        document.getElementById(`card-${id}`)?.classList.add(`selected-p${p}`);
    }
    function selectCharacter(c) {
        sfx.play('coin');
        if (isSurvival) {
            if (!p1Char) {
                p1Char = c;
                highlightChar(c.id, 1);
                try { initMastery(p1Char.id); useMasteryP1 = isCharMastered(p1Char.id); } catch (e) { }
                updateMasteryToggles();
                document.getElementById('select-instruction').innerText = "P2 CHOOSE";
                document.getElementById('select-instruction').style.color = "var(--p2)";
            } else if (!p2Char) {
                p2Char = c;
                highlightChar(c.id, 2);
                try { initMastery(p2Char.id); useMasteryP2 = isCharMastered(p2Char.id); } catch (e) { }
                updateMasteryToggles();
                document.getElementById('char-select').classList.add('hidden');
                selectedMap = MAPS[2];
                beginSurvival();
            }
        } else if (isTraining) {
            p1Char = c;
            p2Char = CHARACTERS.find(ch => ch.id === 'chad');
            try { initMastery(p1Char.id); useMasteryP1 = isCharMastered(p1Char.id); } catch (e) { }
            try { initMastery(p2Char.id); useMasteryP2 = isCharMastered(p2Char.id); } catch (e) { }
            document.getElementById('char-select').classList.add('hidden');
            goToMapSelect();
        } else if (isMemeBall) {
            p1Char = c;
            let normalChars = ['doge', 'frog', 'cat', 'capy', 'spongy', 'sanic', 'chad', 'troll', '67kid', 'amogus', 'sahur', 'primo', 'ocralito', 'mechabara', 'bluedude', 'johnpork'];
            let enemyCharId = normalChars[Math.floor(Math.random() * normalChars.length)];
            p2Char = CHARACTERS.find(c => c.id === enemyCharId);
            try { initMastery(p1Char.id); useMasteryP1 = isCharMastered(p1Char.id); } catch (e) { }
            try { initMastery(p2Char.id); useMasteryP2 = isCharMastered(p2Char.id); } catch (e) { }
            document.getElementById('char-select').classList.add('hidden');
            selectedMap = MAPS[0];
            beginMemeBall();
        } else {
            if (!p1Char) {
                p1Char = c;
                highlightChar(c.id, 1);
                try { initMastery(p1Char.id); useMasteryP1 = isCharMastered(p1Char.id); } catch (e) { }
                updateMasteryToggles();
                document.getElementById('select-instruction').innerText = "P2 CHOOSE";
                document.getElementById('select-instruction').style.color = "var(--p2)";
            } else if (!p2Char) {
                p2Char = c;
                highlightChar(c.id, 2);
                try { initMastery(p2Char.id); useMasteryP2 = isCharMastered(p2Char.id); } catch (e) { }
                updateMasteryToggles();
                setTimeout(goToMapSelect, 500);
            }
        }
    }
    function goToMapSelect() {
        document.getElementById('char-select').classList.add('hidden');
        document.getElementById('map-select').classList.remove('hidden');
        const g = document.getElementById('map-grid');
        g.innerHTML = '';
        MAPS.forEach(m => {
            const d = document.createElement('div');
            d.className = 'map-card';
            d.innerHTML = `<div style="font-size:40px">ðŸ—ºï¸</div><div>${m.id.toUpperCase()}</div>`;
            d.onclick = () => {
                selectedMap = m;
                document.getElementById('map-select').classList.add('hidden');
                startGame();
            };
            g.appendChild(d);
        });
    }
    function startGame() {
        document.getElementById('hud').classList.remove('hidden');
        audioFiles.init();
        initGame();
        saveMatchSettings();
        gameState = 'GAME';
        music.play('BATTLE');
        // Show ping HUD if playing online
        const pingEl = document.getElementById('net-ping');
        if (pingEl) pingEl.style.display = isOnline ? 'block' : 'none';
        loop();
    }
    const startGameLoop = startGame;
    function togglePause() {
        // Toggle between running and paused game states
        if (gameState === 'GAME') {
            gameState = 'PAUSED';
            const pm = document.getElementById('pause-menu');
            if (pm) pm.classList.remove('hidden');
        } else if (gameState === 'PAUSED') {
            gameState = 'GAME';
            const pm = document.getElementById('pause-menu');
            if (pm) pm.classList.add('hidden');
            // Resume the game loop
            loop();
        }
    }
    function beginSurvival() {
        killCount = 0;
        survivalWave = 1;
        spawnTimer = 0;
        document.getElementById('hud').classList.remove('hidden');
        if (p2IsCpu || p2Char) {
            document.getElementById('p2-hud-box').style.display = 'block';
        } else {
            document.getElementById('p2-hud-box').style.display = 'none';
        }
        document.getElementById('game-mode-hud').style.display = 'block';
        document.getElementById('game-mode-title').innerText = "CO-OP SURVIVAL";
        document.getElementById('game-score-val').innerText = "KILLS: 0";
        platforms = [];
        items = [];
        ultEffects = [];
        players = [];
        backgrounds = [];
        itemTimer = 0;
        megaCoinSpawned = !1;
        worldFlipped = !1;
        mapTimer = 0;
        particles = [];
        targets = [];
        for (let i = 0; i < 20; i++) backgrounds.push({
            x: Math.random() * 2000 - 1000,
            y: Math.random() * 600 - 300,
            s: Math.random() * 30 + 20,
            sp: Math.random() * 0.5 + 0.1
        });
        platforms.push({
            x: -200,
            y: 200,
            w: 400,
            h: 500,
            t: 'solid',
            c: '#4e342e',
            vx: 0,
            vy: 0,
            angle: 0
        });
        platforms.push({
            x: -1000,
            y: 400,
            w: 2000,
            h: 200,
            t: 'lava',
            c: '#e74c3c',
            vx: 0,
            vy: -0.2,
            angle: 0
        });
        players = [new Fighter(1, p1Char, -100, 0, !0, !1)];
        if (p2Char) {
            players.push(new Fighter(2, p2Char, 100, 0, !p2IsCpu, p2IsCpu));
        }
        players.forEach(p => p.stocks = 3);
        if (saveData.powerBoosters > 0) {
            const boost = 1.2;
            players.forEach(p => {
                if (!p.cpu) {
                    const originalStats = p.stats;
                    p.stats = {
                        ...originalStats,
                        speed: originalStats.speed * boost,
                        power: originalStats.power * boost,
                        jump: originalStats.jump * boost,
                        weight: Math.max(0.5, originalStats.weight / boost)
                    };
                }
            });
            saveData.powerBoosters = Math.max(0, (saveData.powerBoosters || 0) - 1);
            saveGame();
            setTimeout(() => {
                showNotification("âš¡ POWER BOOSTER ACTIVATED! âš¡", "Speed, Attack, Health, Regen Boosted!");
            }, 500);
        }
        document.getElementById('p1-name').innerText = p1Char.name;
        if (p2Char) document.getElementById('p2-name').innerText = p2Char.name;
        updateHUD();
        gameState = 'GAME';
        music.play('BOSS');
        loop();
    }
    function beginMemeBall() {
        p1Score = 0;
        p2Score = 0;
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('game-mode-hud').style.display = 'block';
        document.getElementById('game-mode-title').innerText = "FIRST TO 5";
        document.getElementById('game-score-val').innerText = "0 - 0";
        platforms = [];
        items = [];
        ultEffects = [];
        players = [];
        backgrounds = [];
        itemTimer = 0;
        megaCoinSpawned = !1;
        worldFlipped = !1;
        mapTimer = 0;
        particles = [];
        targets = [];
        for (let i = 0; i < 20; i++) backgrounds.push({
            x: Math.random() * 2000 - 1000,
            y: Math.random() * 600 - 300,
            s: Math.random() * 30 + 20,
            sp: Math.random() * 0.5 + 0.1
        });
        platforms.push({
            x: -600,
            y: 200,
            w: 1200,
            h: 500,
            t: 'solid',
            c: '#546E7A'
        });
        platforms.push({
            x: -10,
            y: -100,
            w: 20,
            h: 300,
            t: 'solid',
            c: '#FFF'
        });
        players = [new Fighter(1, p1Char, -200, 0, !0, !1), new Fighter(2, p2Char, 200, 0, !1, isOnline ? !1 : !0)];
        try {
            players[0].masteryActive = (isCharMastered(p1Char.id) && useMasteryP1);
            players[1].masteryActive = (isCharMastered(p2Char.id) && useMasteryP2);
        } catch (e) { }
        players.forEach(p => {
            p.stocks = 99;
        });
        ball = new Ball();
        ball.reset(1);
        gameState = 'GAME';
        music.play('BATTLE');
        loop();
    }
    function initGame() {
        if (!p1Char) p1Char = CHARACTERS[0];
        if (!p2Char) p2Char = CHARACTERS[1];
        platforms = [];
        items = [];
        ultEffects = [];
        targets = [];
        itemTimer = 0;
        megaCoinSpawned = !1;
        backgrounds = [];
        particles = [];
        worldFlipped = !1;
        flipTimer = 0;
        const gy = 200;
        for (let i = 0; i < 20; i++) backgrounds.push({
            x: Math.random() * 2000 - 1000,
            y: Math.random() * 600 - 300,
            s: Math.random() * 30 + 20,
            sp: Math.random() * 0.5 + 0.1
        });
        if (selectedMap.id === 'flat') platforms.push({
            x: -600,
            y: gy,
            w: 1200,
            h: 500,
            t: 'solid',
            c: selectedMap.c,
            vx: 0,
            vy: 0,
            angle: 0,
            pivotX: 0,
            pivotY: 0
        });
        else if (selectedMap.id === 'plat') {
            platforms.push({
                x: -500,
                y: gy,
                w: 1000,
                h: 500,
                t: 'solid',
                c: selectedMap.c,
                vx: 0,
                vy: 0,
                angle: 0
            });
            platforms.push({
                x: -300,
                y: gy - 150,
                w: 150,
                h: 20,
                t: 'pass',
                c: '#ddd',
                vx: 1,
                vy: 0,
                angle: 0
            });
            platforms.push({
                x: 150,
                y: gy - 150,
                w: 150,
                h: 20,
                t: 'pass',
                c: '#ddd',
                vx: -1,
                vy: 0,
                angle: 0
            });
            platforms.push({
                x: -75,
                y: gy - 280,
                w: 150,
                h: 20,
                t: 'pass',
                c: '#ddd',
                vx: 0,
                vy: 0,
                angle: 0
            });
        } else if (selectedMap.id === 'edge') {
            platforms.push({
                x: -200,
                y: gy,
                w: 400,
                h: 500,
                t: 'solid',
                c: selectedMap.c,
                vx: 0,
                vy: 0,
                angle: 0
            });
            if (rulesHazardsEnabled) {
                platforms.push({
                    x: -1000,
                    y: 400,
                    w: 2000,
                    h: 200,
                    t: 'lava',
                    c: '#e74c3c',
                    vx: 0,
                    vy: -0.2,
                    angle: 0
                });
            }
        } else if (selectedMap.id === 'machine') {
            platforms.push({
                x: -400,
                y: 300,
                w: 400,
                h: 20,
                t: 'machine_left',
                c: '#95a5a6',
                vx: 0,
                vy: 0,
                angle: 0,
                pivotX: -400,
                pivotY: 300
            });
            platforms.push({
                x: 0,
                y: 300,
                w: 400,
                h: 20,
                t: 'machine_right',
                c: '#95a5a6',
                vx: 0,
                vy: 0,
                angle: 0,
                pivotX: 400,
                pivotY: 300
            });
        } else platforms.push({
            x: -600,
            y: gy,
            w: 1200,
            h: 500,
            t: 'solid',
            c: selectedMap.c
        });
        let p2C = !p2IsCpu && !isTraining;
        let p2CPU = p2IsCpu || isTraining;

        // Determine player count based on mode
        const playerCount = (isOnline && netGameMode === '2v2') ? 4 : 2;

        if (playerCount === 4) {
            // 2v2: 4 fighters
            const p3Char = CHARACTERS.find(c => c.id === 'pepe') || CHARACTERS[2] || CHARACTERS[0];
            const p4Char = CHARACTERS.find(c => c.id === 'wojak') || CHARACTERS[3] || CHARACTERS[1];
            players = [
                new Fighter(1, p1Char, -300, 0, true, false),   // Team 1
                new Fighter(2, p2Char, 300, 0, true, false),    // Team 2
                new Fighter(3, p3Char, -150, 0, true, false),   // Team 1
                new Fighter(4, p4Char, 150, 0, true, false)     // Team 2
            ];
            players[0].team = 1; players[2].team = 1;  // P1 & P3 = Team 1
            players[1].team = 2; players[3].team = 2;  // P2 & P4 = Team 2
            // Ensure no boss behavior in online
            players.forEach(p => { p.isBoss = false; console.log(`P${p.id}: ${p.stats.id}, isBoss=${p.isBoss}`); });
            // Apply custom stocks if in online mode
            if (isOnline && typeof customStocks !== 'undefined') {
                players.forEach(p => p.stocks = customStocks);
            }
        } else {
            // 1v1: 2 fighters
            players = [new Fighter(1, p1Char, -200, 0, true, false), new Fighter(2, p2Char, 200, 0, p2C, p2CPU)];
            // Ensure no boss behavior in online
            if (isOnline) players.forEach(p => { p.isBoss = false; console.log(`P${p.id}: ${p.stats.id}, isBoss=${p.isBoss}`); });
            // Apply custom stocks if in online mode
            if (isOnline && typeof customStocks !== 'undefined') {
                players.forEach(p => p.stocks = customStocks);
            }
        }

        // Ensure mastery flags reflect latest toggles
        try {
            players[0].masteryActive = (isCharMastered(p1Char.id) && useMasteryP1);
            if (players.length > 1) players[1].masteryActive = (isCharMastered(p2Char.id) && useMasteryP2);
        } catch (e) { }
        document.getElementById('p1-name').innerText = p1Char.name;
        document.getElementById('p2-name').innerText = p2Char.name;
        document.getElementById('p2-hud-box').style.display = 'block';
        updateHUD();
        document.getElementById('game-mode-hud').style.display = 'none';
    }
    function updateHUD() {
        players.forEach(p => {
            const x = p.id === 1 ? 'p1' : 'p2';
            if (document.getElementById(`${x}-pct`)) {
                document.getElementById(`${x}-pct`).innerText = Math.floor(p.pct) + '%';
                document.getElementById(`${x}-stocks`).innerText = 'â—'.repeat(p.stocks);
                const b = document.getElementById(`${x}-ult-bar`);
                b.style.width = p.ult + '%';
                if (p.ult >= 100) b.parentNode.classList.add('ult-ready');
                else b.parentNode.classList.remove('ult-ready');
            }
        });
    }
    function endGame(w) {
        gameState = 'GAMEOVER';
        document.getElementById('game-over').classList.remove('hidden');

        // Track mastery for both players
        let masteryMsg = '';
        if (!isSurvival && !isMemeBall && players.length >= 2) {
            const p1Damage = players[1].pct; // Damage dealt to opponent
            const p2Damage = players[0].pct;

            const p1LeveledUp = trackMatch(p1Char.id, w === 1, p1Damage);
            const p2LeveledUp = trackMatch(p2Char.id, w === 2, p2Damage);

            if (p1LeveledUp) {
                const rank = getMasteryRank(saveData.mastery[p1Char.id].level);
                masteryMsg += `\n${p1Char.name}: ${rank.icon} ${rank.name}!`;
            }
            if (p2LeveledUp) {
                const rank = getMasteryRank(saveData.mastery[p2Char.id].level);
                masteryMsg += `\n${p2Char.name}: ${rank.icon} ${rank.name}!`;
            }

            if (masteryMsg) {
                document.getElementById('mastery-progress').innerHTML = `<div style="color:#ffd700">MASTERY UP!</div>${masteryMsg}`;
                // Check if Jack should be unlocked
                setTimeout(() => checkJackUnlock(), 1000);
            } else {
                document.getElementById('mastery-progress').innerHTML = '';
                // Still check for Jack unlock even without level up
                checkJackUnlock();
            }
        }

        // Record vs-friend stats for online 1v1 when opponent is a verified friend
        try {
            if (isOnline && netConnectedPlayers && netConnectedPlayers.length >= 2) {
                const myNickInput = document.getElementById('online-nickname');
                const myName = (myNickInput && myNickInput.value.trim()) || 'Player';
                const opponent = netConnectedPlayers.find(p => p && p.name && p.name !== myName);
                const oppCode = opponent && opponent.friendCode;
                if (oppCode && saveData && Array.isArray(saveData.friends)) {
                    const friend = saveData.friends.find(f => f.code === oppCode);
                    if (friend) {
                        friend.verified = true;
                        friend.lastSeenAt = Date.now();
                        if (!friend.stats) friend.stats = { wins: 0, losses: 0, favoriteChar: p2Char && p2Char.id ? p2Char.id : '' };
                        // Winner is w (1 for P1, 2 for P2). Assume you are P1 when hosting or local.
                        // If you are not host, mapping may vary; we use myName to infer winner string on the GAME! text.
                        if (w === 1) friend.losses = (friend.losses || 0) + 1; else friend.wins = (friend.wins || 0) + 1;
                        // Update favoriteChar heuristic: most recently used char when winning
                        if (w === 2 && p2Char && p2Char.id) friend.stats.favoriteChar = p2Char.id;
                        if (w === 1 && p1Char && p1Char.id) friend.stats.favoriteChar = p1Char.id;
                        try { saveGame(); renderFriends(); } catch (e) { }
                    }
                }
            }
        } catch (e) { }

        if (isSurvival) {
            document.getElementById('winner-display').innerText = `KILLS: ${killCount}`;
            if (killCount >= 50) unlockTrophy('kills_50');
        } else if (isMemeBall) {
            if (w === 1) {
                earnCoins(100);
                document.getElementById('winner-display').innerText = "P1 WINS!";
            } else {
                document.getElementById('winner-display').innerText = "CPU WINS!";
            }
        } else {
            if (w === 1) {
                earnCoins(50);
                document.getElementById('winner-display').innerText = `GAME!\n${p1Char.name} WINS`;
                if (players.length > 0 && players[0].pct === 0) unlockTrophy('flawless');
            } else {
                document.getElementById('winner-display').innerText = `GAME!\n${p2Char.name} WINS`;
                if (players.length > 1 && players[1].pct === 0) unlockTrophy('flawless');
            }
        }
        document.getElementById('winner-display').style.color = "";
        for (let i = 0; i < 50; i++) confetti.push({
            x: canvas.width / 2,
            y: canvas.height / 2,
            vx: (Math.random() - 0.5) * 20,
            vy: (Math.random() - 0.5) * 20,
            c: `hsl(${Math.random() * 360},100%,50%)`
        });
    }
    function loop() {
        // Perf timing
        const now = performance.now();
        if (perfLastTs) {
            const dt = now - perfLastTs;
            perfFrameTimes.push(dt);
            if (perfFrameTimes.length > 60) perfFrameTimes.shift();
            const avgDt = perfFrameTimes.reduce((a, b) => a + b, 0) / perfFrameTimes.length;
            perfAvgFps = Math.round(1000 / Math.max(1, avgDt));
            const perfHud = document.getElementById('perf-hud');
            if (perfHud) {
                perfHud.style.display = 'block';
                perfHud.textContent = `FPS: ${perfAvgFps} | FT: ${Math.round(avgDt)} ms`;
                perfHud.style.color = perfAvgFps >= 55 ? '#2ecc71' : (perfAvgFps >= 40 ? '#ffd700' : '#e74c3c');
            }
            // Auto-tune effects
            if (perfAvgFps < 50) {
                lowPerfStreak++;
                recoverStreak = 0;
                if (lowPerfStreak > 120 && !lowPerf) { // ~2s sustained
                    lowPerf = true;
                    applyLowPerfSettings(true);
                }
            } else {
                recoverStreak++;
                if (recoverStreak > 180 && lowPerf) { // ~3s sustained
                    lowPerf = false;
                    applyLowPerfSettings(false);
                }
                lowPerfStreak = 0;
            }
        }
        perfLastTs = now;
        if (gameState === 'SHOP') {
            drawShop();
            requestAnimationFrame(loop);
            return;
        }
        if (gameState === 'PAUSED') return;
        if (gameState === 'GAMEOVER') {
            draw();
            requestAnimationFrame(loop);
            return;
        }
        if (gameState !== 'GAME') return;
        if (hitStop > 0) {
            hitStop--;
            draw();
            requestAnimationFrame(loop);
            return;
        }
        mapTimer++;
        if (selectedMap.id === 'plat') {
            platforms[1].x = -300 + Math.sin(mapTimer * 0.05) * 100;
            platforms[1].vx = Math.cos(mapTimer * 0.05) * 5;
            platforms[2].x = 150 - Math.sin(mapTimer * 0.05) * 100;
            platforms[2].vx = -Math.cos(mapTimer * 0.05) * 5;
        } else if (selectedMap.id === 'edge') {
            platforms[1].y = 400 + Math.sin(mapTimer * 0.02) * 100;
        } else if (selectedMap.id === 'machine') {
            let cycle = mapTimer % 1800;
            let targetAngle = 0;
            if (cycle > 480 && cycle < 840) {
                targetAngle = -0.5;
            } else if (cycle > 1320 && cycle < 1680) {
                targetAngle = 0.5;
            }
            platforms[0].angle += (targetAngle - platforms[0].angle) * 0.01;
            platforms[1].angle += (-targetAngle - platforms[1].angle) * 0.01;
        }
        if (!isMemeBall) {
            itemTimer++;
            if (itemTimer > 400) {
                if (rulesItemsEnabled && Math.random() < 0.7) items.push(new Item());
                itemTimer = 0;
            }
            if (!megaCoinSpawned && selectedMap.id !== 'machine' && mapTimer > 600 && Math.random() < 0.01) {
                items.push(new Item('mega'));
                megaCoinSpawned = !0;
                const warn = document.getElementById('mega-warning');
                warn.style.display = 'block';
                sfx.play('ult');
                setTimeout(() => warn.style.display = 'none', 3000);
            }
        }
        if (worldFlipped) {
            flipTimer--;
            if (flipTimer <= 0) worldFlipped = !1;
        }

        // Handle Meme Ball serving
        if (isMemeBall && isServing) {
            const server = players.find(p => p.id === servingPlayer);
            if (server) {
                // CPU auto-serve logic
                if (server.cpu) {
                    serveCharge += 2;
                    if (serveCharge >= 40 + Math.random() * 40) {
                        ball.serve(serveCharge, servingPlayer);
                        serveCharge = 0;
                    }
                } else {
                    // Check for serve input (attack button)
                    const controls = servingPlayer === 1 ?
                        { atk: getControl('p1', 'attack') || 'f' } :
                        { atk: getControl('p2', 'attack') || 'l' };

                    if (keys[controls.atk]) {
                        serveCharge = Math.min(serveCharge + 3, 100);
                    } else if (serveCharge > 0) {
                        // Release serve
                        ball.serve(serveCharge, servingPlayer);
                        serveCharge = 0;
                    }
                }
            }
        }

        if (isSurvival) {
            spawnTimer++;
            let playersAlive = players.filter(p => p.stocks > 0 && !p.cpu).length;
            let rate = Math.max(60, 120 - (killCount * 2));
            if (playersAlive > 1) rate = Math.max(30, 80 - (killCount * 2));
            if (spawnTimer > rate && players.filter(p => p.cpu).length < 5) {
                let normalChars = ['doge', 'frog', 'cat', 'capy', 'spongy', 'sanic', 'chad', 'troll', '67kid', 'amogus', 'sahur', 'primo', 'ocralito', 'mechabara', 'bluedude', 'johnpork'];
                let enemyCharId = normalChars[Math.floor(Math.random() * normalChars.length)];
                let enemyChar = CHARACTERS.find(c => c.id === enemyCharId);
                let enemy = new Fighter(players.length + 1, enemyChar, Math.random() * 600 - 300, -300, !1, !0);
                enemy.stocks = 1;
                enemy.pct = killCount * 5;
                players.push(enemy);
                spawnTimer = 0;
            }
        }
        if (isMemeBall) ball.update();
        let livingPlayers = 0;
        for (let i = players.length - 1; i >= 0; i--) {
            if (players[i].stocks <= 0) {
                if (isSurvival) {
                    if (players[i].cpu) {
                        killCount++;
                        earnCoins(5);
                        sfx.play('coin');
                        document.getElementById('game-score-val').innerText = `KILLS: ${killCount}`;
                        players.splice(i, 1);
                    }
                }
            } else {
                livingPlayers++;
            }
        }
        if (!isSurvival && gameState === 'GAME') {
            let p1 = players.find(p => p.id === 1);
            let p2 = players.find(p => p.id === 2);
            if (p1 && p1.stocks <= 0) {
                endGame(2);
                return;
            }
            if (p2 && p2.stocks <= 0) {
                endGame(1);
                return;
            }
        } else if (isSurvival && gameState === 'GAME') {
            let livingHumans = players.filter(p => !p.cpu && p.stocks > 0).length;
            if (livingHumans === 0) {
                endGame(2);
                return;
            }
        }
        players.forEach(p => p.update());
        items.forEach(i => i.update());
        for (let i = particles.length - 1; i >= 0; i--) {
            let p = particles[i];
            p.life--;
            if (p.life <= 0) {
                particles.splice(i, 1);
            } else {
                if (p.text) {
                    p.y += p.vy;
                } else {
                    p.x += p.vx;
                    p.y += p.vy;
                    p.vy += 0.2;
                }
            }
        }
        for (let i = ultEffects.length - 1; i >= 0; i--) {
            let e = ultEffects[i];
            e.l--;
            if (e.t === 'moon') {
                e.y += 15;
                players.forEach(p => {
                    if (p.stocks > 0 && Math.abs(p.x - e.x) < 100 && Math.abs(p.y - e.y) < 100) p.hit(0, 20, 2);
                });
            } else if (e.t === 'tear') {
                e.y += 10;
                players.forEach(p => {
                    if (p.stocks > 0 && Math.abs(p.x - e.x) < 30 && Math.abs(p.y - e.y) < 30) p.hit(10, 0, 1);
                });
            } else if (e.t === 'primo') {
                e.x += e.vx;
                players.forEach(p => {
                    if (p.stocks > 0 && p.id !== e.owner && Math.abs(p.x - e.x) < 50 && Math.abs(p.y - e.y) < 50) p.hit(e.vx, -10, 25);
                });
            } else if (e.t === 'pork') {
                e.y += 25;
                ctx.font = "200px Arial";
                ctx.fillText('ðŸ–', e.x - 100, e.y);
                players.forEach(p => {
                    if (p.stocks > 0 && p.id !== e.owner && Math.abs(p.x - (e.x - 50)) < 100 && Math.abs(p.y - e.y) < 100) {
                        p.hit(0, -30, 100);
                        e.l = 0;
                    }
                });
            }
            if (e.l <= 0) ultEffects.splice(i, 1);
        }
        players.forEach(atk => {
            if (atk.box && atk.box.act) {
                let ax = atk.x + atk.box.relX,
                    ay = atk.y + atk.box.relY;
                players.forEach(def => {
                    // Skip if same player, or same team in 2v2 mode (unless team attack enabled)
                    const sameTeam = (atk.team && def.team && atk.team === def.team);
                    const skipTeammate = sameTeam && !rulesTeamAttack;
                    if (def.stocks > 0 && atk.id !== def.id && !skipTeammate && ax < def.x + def.w && ax + atk.box.w > def.x && ay < def.y + def.h && ay + atk.box.h > def.y) {
                        let d = atk.dir ? 1 : -1;
                        // Mastery Lucky Block global buffs to all moves
                        let kbx = atk.box.kbx;
                        let kby = atk.box.kby;
                        let dmg = atk.box.dmg;
                        if (atk.masteryActive && atk.stats && atk.stats.id === 'luckyblock') {
                            kbx *= 1.2;
                            kby *= 1.15;
                            dmg *= 1.2;
                        }
                        def.hit(Math.abs(kbx) * d, kby, dmg);
                        atk.box.act = !1;
                    }
                });
            }
        });
        let targetsArr = players.filter(p => p.stocks > 0);
        if (targetsArr.length === 0 && players[0]) targetsArr = [players[0]];
        let mx = 0,
            my = 0;
        if (targetsArr.length > 0) {
            mx = targetsArr.reduce((sum, p) => sum + p.x, 0) / targetsArr.length;
            my = targetsArr.reduce((sum, p) => sum + p.y, 0) / targetsArr.length;
        }
        let d = 0;
        if (targetsArr.length > 1) d = Math.sqrt(Math.pow(targetsArr[1].x - targetsArr[0].x, 2));
        let tz = Math.max(0.5, Math.min(1.2, 1000 / (d + 200)));
        if (targetsArr.length === 1) tz = 0.8;
        my = Math.max(my, -400);
        my = Math.min(my, 400);
        camera.x += (mx - camera.x) * 0.1;
        camera.y += (my - camera.y) * 0.1;
        camera.zoom += (tz - camera.zoom) * (window.EFFECTS_LOW ? 0.03 : 0.05);
        // Online client: render-only
        if (isOnline && !isHost) {
            draw();
            requestAnimationFrame(loop);
            return;
        }
        // Host: broadcast state to client at ~30Hz
        if (isOnline && isHost && netPeerReady) {
            if ((netTick++ % 2) === 0) {
                const snap = {
                    players: players.map(p => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy, pct: p.pct, stocks: p.stocks, ult: p.ult })),
                    score: [p1Score, p2Score]
                };
                if (isMemeBall && ball) {
                    snap.ball = { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, inPlay: ball.inPlay, cross: ball.hasCrossedNet };
                }
                sendNet({ t: 'state', s: snap });
            }
        }
        draw();
        requestAnimationFrame(loop);
    }
    function applyLowPerfSettings(enable) {
        // Reduce visual costs when enable=true, restore when false
        try {
            // Canvas smoothing
            ctx.imageSmoothingEnabled = !enable;
            // Particle density: trim existing particles
            if (enable) {
                if (particles && particles.length > 0) particles.length = Math.floor(particles.length * 0.5);
            }
            // Shadows: disable heavy blur when low perf
            if (enable) {
                ctx.shadowBlur = 0;
            }
            // Global flags you may have
            window.EFFECTS_LOW = enable;
        } catch (e) { }
    }
    function draw() {
        ctx.imageSmoothingEnabled = !1;
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        const scrollX = mapTimer * 0.2;
        for (let i = 0; i < backgrounds.length; i++) {
            const b = backgrounds[i];
            ctx.fillStyle = isSurvival ? 'rgba(255,100,100,0.1)' : 'rgba(255,255,255,0.1)';
            let bx = b.x - (camera.x * 0.2) - scrollX * b.sp;
            if (bx < -1500) b.x += 3000;
            let by = b.y - (camera.y * 0.1);
            ctx.beginPath();
            ctx.arc(400 + bx, 300 + by, b.s, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
        if (isTraining) {
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let x = 0; x < canvas.width; x += 50) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
            }
            for (let y = 0; y < canvas.height; y += 50) {
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
            }
            ctx.stroke();
        }
        ctx.save();
        ctx.imageSmoothingEnabled = !1;
        ctx.translate(canvas.width / 2, canvas.height / 2);
        if (worldFlipped) ctx.rotate(Math.PI);
        if (shake > 0) {
            ctx.translate(Math.random() * shake - shake / 2, Math.random() * shake - shake / 2);
            shake *= 0.9;
        }
        ctx.scale(camera.zoom, camera.zoom);
        ctx.translate(-camera.x, -camera.y);
        platforms.forEach(p => {
            if (p.t.startsWith('machine')) {
                ctx.save();
                ctx.translate(p.pivotX, p.pivotY);
                ctx.rotate(p.angle);
                let drawX = p.x - p.pivotX;
                ctx.fillStyle = p.c;
                ctx.fillRect(drawX, 0, p.w, p.h);
                ctx.restore();
            } else {
                ctx.fillStyle = p.c;
                ctx.fillRect(p.x, p.y, p.w, p.h);
            }
        });
        items.forEach(i => i.draw());
        targets.forEach(t => {
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.arc(t.x + 20, t.y + 20, 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(t.x + 20, t.y + 20, 10, 0, Math.PI * 2);
            ctx.fill()
        });
        ultEffects.forEach(e => {
            if (e.t === 'moon') {
                ctx.font = "200px Arial";
                ctx.fillText('ðŸŒš', e.x - 100, e.y)
            } else if (e.t === 'tear') {
                ctx.fillStyle = '#3498db';
                ctx.beginPath();
                ctx.arc(e.x, e.y, 10, 0, Math.PI * 2);
                ctx.fill()
            } else if (e.t === 'primo') {
                ctx.save();
                ctx.translate(e.x, e.y);
                if (e.vx < 0) ctx.scale(-1, 1);
                const sprite = characterSprites['primo'];
                if (sprite) {
                    ctx.drawImage(sprite, -25, -25, 50, 50);
                } else {
                    ctx.font = "50px Arial";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText('ðŸ§±', 0, 0);
                }
                ctx.restore();
            } else if (e.t === 'pork') {
                ctx.font = "200px Arial";
                ctx.fillText('ðŸ–', e.x - 100, e.y);
            }
        });
        players.forEach(p => p.draw());
        if (isMemeBall && ball) ball.draw();

        // Draw serve indicator
        if (isMemeBall && isServing) {
            const server = players.find(p => p.id === servingPlayer);
            if (server) {
                ctx.save();
                ctx.font = "20px 'Press Start 2P'";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";

                // Serve prompt
                ctx.fillStyle = '#ff0';
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 3;
                const promptY = server.y - 120;
                ctx.strokeText('HOLD TO CHARGE', server.x, promptY);
                ctx.fillText('HOLD TO CHARGE', server.x, promptY);

                // Power bar
                if (serveCharge > 0) {
                    const barW = 100;
                    const barH = 10;
                    const barX = server.x - barW / 2;
                    const barY = server.y - 100;

                    // Background
                    ctx.fillStyle = '#333';
                    ctx.fillRect(barX, barY, barW, barH);

                    // Power fill
                    const powerColor = serveCharge < 50 ? '#0f0' : serveCharge < 80 ? '#ff0' : '#f00';
                    ctx.fillStyle = powerColor;
                    ctx.fillRect(barX, barY, (serveCharge / 100) * barW, barH);

                    // Border
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(barX, barY, barW, barH);
                }

                ctx.restore();
            }
        }

        particles.forEach(p => {
            ctx.save();
            ctx.globalAlpha = p.life / 60;
            if (p.text) {
                ctx.fillStyle = 'red';
                ctx.font = "bold 30px 'Black Ops One'";
                ctx.shadowColor = 'white';
                ctx.shadowBlur = 5;
                ctx.fillText(p.text, p.x, p.y);
                ctx.shadowBlur = 0;
            } else {
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            }
            ctx.restore();
        });
        if (gameState === 'GAMEOVER') {
            confetti.forEach(c => {
                c.x += c.vx;
                c.y += c.vy;
                c.vy += 0.5;
                ctx.fillStyle = c.c;
                ctx.fillRect(c.x, c.y, 10, 10);
            });
        }
        ctx.restore();
    }
    function drawShop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const pb = document.getElementById('shop-right');
        if (pb) {
            const r = pb.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2 - 50;
            ctx.save();
            ctx.imageSmoothingEnabled = !1;
            ctx.translate(cx, cy);
            ctx.scale(5, 5);
            const c = CHARACTERS[shopCharIndex];
            const sprite = characterSprites[c.id];
            if (saveData.goldMode) {
                ctx.shadowColor = '#ffd700';
                ctx.shadowBlur = 15;
            } else {
                ctx.shadowBlur = 0;
            }
            if (sprite && sprite.idle) {
                ctx.drawImage(sprite.idle[0], -25, -25, 50, 50);
            } else if (sprite) {
                ctx.drawImage(sprite, -25, -25, 50, 50);
            } else {
                ctx.font = "50px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(c.icon, 0, 0);
            }
            if (saveData.goldMode) {
                ctx.shadowColor = '#ffd700';
                ctx.shadowBlur = 15;
                if (sprite && sprite.idle) {
                    ctx.drawImage(sprite.idle[0], -25, -25, 50, 50);
                } else if (sprite) {
                    ctx.drawImage(sprite, -25, -25, 50, 50);
                }
            }
            ctx.shadowBlur = 0;
            let cos = equippedCosmetic;
            if (shopSelectedItem && shopSelectedItem.type === 'cosmetic') cos = shopSelectedItem.id;
            ctx.fillStyle = 'white';
            ctx.font = "30px Arial";
            if (cos === 'tophat') ctx.fillText('ðŸŽ©', 0, -30);
            if (cos === 'shades') ctx.fillText('ðŸ•¶ï¸', 5, 0);
            if (cos === 'crown') ctx.fillText('ðŸ‘‘', 0, -35);
            ctx.restore();
        }
    }
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        ctx.imageSmoothingEnabled = !1;
    }
    window.addEventListener('resize', resize);
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        const b = (id, k) => {
            const e = document.getElementById(id);
            e.addEventListener('touchstart', e => {
                e.preventDefault();
                touchInput[k] = !0
            });
            e.addEventListener('touchend', e => {
                e.preventDefault();
                touchInput[k] = !1
            })
        };
        b('btn-left', 'left');
        b('btn-right', 'right');
        b('btn-up', 'up');
        b('btn-down', 'down');
        b('btn-atk', 'atk');
        b('btn-jump', 'jump');
        b('btn-ult', 'ult');
        b('btn-shield', 'shield');
    }


    function openFeedback() {
        // Capture screenshot before hiding other screens
        try {
            pendingScreenshot = canvas.toDataURL('image/jpeg', 0.5);
            document.getElementById('screenshot-preview').style.backgroundImage = `url(${pendingScreenshot})`;
        } catch (e) {
            console.error("Screenshot failed", e);
            pendingScreenshot = null;
            document.getElementById('screenshot-preview').style.backgroundImage = 'none';
        }

        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById('feedback-screen').classList.remove('hidden');
        document.getElementById('feedback-status').innerText = '';
        document.getElementById('feedback-list').classList.add('hidden');
    }

    function closeFeedback() {
        document.getElementById('feedback-screen').classList.add('hidden');
        document.getElementById('title-screen').classList.remove('hidden');
    }

    function submitFeedback() {
        const text = document.getElementById('feedback-text').value;
        if (!text.trim()) return;

        const includeScreenshot = document.getElementById('include-screenshot').checked;

        // Save to local storage for now
        let feedbacks = JSON.parse(localStorage.getItem('smash_feedback') || '[]');
        feedbacks.push({
            date: new Date().toLocaleString(),
            text: text,
            image: includeScreenshot ? pendingScreenshot : null
        });
        localStorage.setItem('smash_feedback', JSON.stringify(feedbacks));

        document.getElementById('feedback-text').value = '';
        document.getElementById('feedback-status').innerText = 'FEEDBACK SENT! THANK YOU!';
        document.getElementById('feedback-status').style.color = '#2ecc71';

        setTimeout(() => {
            document.getElementById('feedback-status').innerText = '';
        }, 3000);
    }

} // This brace closes the loadGame function.

// Cheat Code: "feedback"
let feedbackCheatInput = '';
const feedbackCheatCode = 'feedback';

window.addEventListener('keydown', (e) => {
    // Only listen if feedback screen is open
    if (document.getElementById('feedback-screen').classList.contains('hidden')) return;

    // Ignore non-character keys to keep it simple
    if (e.key.length > 1) return;

    feedbackCheatInput += e.key.toLowerCase();
    if (feedbackCheatInput.length > feedbackCheatCode.length) {
        feedbackCheatInput = feedbackCheatInput.slice(-feedbackCheatCode.length);
    }

    if (feedbackCheatInput === feedbackCheatCode) {
        showFeedbackList();
        feedbackCheatInput = '';
    }
});

function showFeedbackList() {
    const list = document.getElementById('feedback-list');
    list.classList.remove('hidden');
    list.innerHTML = '';

    const feedbacks = JSON.parse(localStorage.getItem('smash_feedback') || '[]');
    if (feedbacks.length === 0) {
        list.innerHTML = '<div style="color: #aaa; text-align: center;">NO FEEDBACK YET</div>';
        return;
    }

    feedbacks.reverse().forEach(f => {
        const item = document.createElement('div');
        item.style.borderBottom = '1px solid #444';
        item.style.padding = '10px';
        item.style.marginBottom = '10px';

        let imgHtml = '';
        if (f.image) {
            imgHtml = `<img src="${f.image}" style="max-width: 100%; border: 1px solid #555; margin-top: 10px; border-radius: 4px;">`;
        }

        item.innerHTML = `
            <div style="color: #888; font-size: 10px; margin-bottom: 5px;">${f.date}</div>
            <div style="color: #fff; white-space: pre-wrap;">${f.text}</div>
            ${imgHtml}
        `;
        list.appendChild(item);
    });
}

loadGame();
resize();


function startMemeBall() {
    music.init();
    sfx.init();
    isSurvival = !1;
    isTraining = !1;
    isMemeBall = !0;
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('char-select').classList.remove('hidden');
    document.getElementById('cpu-controls').classList.add('hidden');
    renderCharGrid();
    music.play('MENU');
}

function startTraining() {
    music.init();
    sfx.init();
    isSurvival = !1;
    isTraining = !0;
    isMemeBall = !1;
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('char-select').classList.remove('hidden');
    document.getElementById('cpu-controls').classList.add('hidden');
    renderCharGrid();
    music.play('MENU');
}

function startSpectator() {
    alert("Spectator Mode coming soon!");
}

function showTrophies() {
    alert("Trophies coming soon!");
}

function showMastery() {
    alert("Mastery coming soon!");
}

function showFriends() {
    alert("Friends list coming soon!");
}

function showSoundTest() {
    alert("Sound Test coming soon!");
}

function openSettings() {
    alert("Settings coming soon!");
}

function checkJackUnlock() {
    // Placeholder
}

function updateMobileControlsSetting() {
    // Placeholder to prevent reference error
    console.log("updateMobileControlsSetting called");
}

function loop() {
    if (gameState === 'GAME' || gameState === 'SHOP' || gameState === 'GACHA') {
        // Main loop logic here
        // This seems to be missing from the extraction.
        // We need to restore the main loop or ensure it was in game.js
        requestAnimationFrame(loop);
    }
}
