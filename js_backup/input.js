window.addEventListener('keydown', e => {
    let key = e.key;
    if (key && key.length === 1) key = key.toLowerCase();

    handleCheatInput(key);
    // Feedback cheat listens on keydown too
    handleFeedbackCheat(key);

    keys[key] = !0;
    if (gameState === 'GAME' && (key === 'Escape' || key === 'p')) togglePause();
});

window.addEventListener('keyup', e => {
    let key = e.key;
    if (key && key.length === 1) key = key.toLowerCase();
    keys[key] = !1;
    if (isTraining) {
        if (key === '1') {
            trainingCpuMode = (trainingCpuMode + 1) % 4;
            const m = ["STAND", "JUMP", "ATK", "EVADE"];
            document.getElementById('train-cpu-mode').innerText = m[trainingCpuMode];
        }
        if (key === '2') {
            players.forEach(p => p.pct = 0);
            updateHUD();
            sfx.play('coin');
        }
        if (key === '3') {
            players[0].x = -200;
            players[0].y = 0;
            players[0].vx = 0;
            players[1].x = 200;
            players[1].y = 0;
            players[1].vx = 0;
            sfx.play('jump');
        }
        if (key === '4') {
            toggleHitboxSetting();
            document.getElementById('train-hitbox').innerText = showHitboxes ? "ON" : "OFF";
        }
    }
});
