console.log("RUNNING FILE VERSION: 15:15 PM");
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let gameState = 'TITLE',
    p1Char = null,
    p2Char = null,
    p2IsCpu = !1,
    cpuLevel = 5;
let useMasteryP1 = false,
    useMasteryP2 = false;
let isSurvival = !1,
    isMemeBall = !1,
    servingPlayer = 1,
    isServing = false,
    serveCharge = 0,
    p1Score = 0,
    p2Score = 0,
    ball = null;
// Online multiplayer
let isOnline = false,
    isHost = false,
    netSocket = null,
    netRoom = null,
    netPeerReady = false,
    netOpened = false,
    netReadyCount = 0,
    netConnectedPlayers = [], // [{id, name, ready}]
    netP2Inputs = { l: 0, r: 0, u: 0, d: 0, a: 0, j: 0, U: 0, S: 0 },
    netP3Inputs = { l: 0, r: 0, u: 0, d: 0, a: 0, j: 0, U: 0, S: 0 },
    netP4Inputs = { l: 0, r: 0, u: 0, d: 0, a: 0, j: 0, U: 0, S: 0 },
    netTick = 0,
    netGameMode = '1v1', // '1v1' or '2v2'
    customStocks = 3, // Custom stock count for online matches
    rulesItemsEnabled = true,
    rulesHazardsEnabled = true,
    rulesTeamAttack = false, // Friendly fire in teams
    netDisconnected = false; // Track mid-match disconnect
// Ping tracking
let netPingTimer = null,
    netLastPingTs = 0,
    netCurrentPing = null;
let survivalWave = 0,
    spawnTimer = 0,
    isTraining = !1,
    trainingCpuMode = 0;
let players = [],
    platforms = [],
    items = [],
    ultEffects = [],
    particles = [],
    itemTimer = 0,
    camera = {
        x: 0,
        y: 0,
        zoom: 1
    },
    shake = 0,
    hitStop = 0,
    mapTimer = 0;
let megaCoinSpawned = !1,
    backgrounds = [],
    confetti = [];
let worldFlipped = !1,
    flipTimer = 0;
const keys = {};
const touchInput = {
    left: !1,
    right: !1,
    up: !1,
    down: !1,
    atk: !1,
    jump: !1,
    ult: !1,
    shield: !1
};
// Performance tracking
let perfLastTs = 0,
    perfFrameTimes = [],
    perfAvgFps = 60,
    lowPerf = false,
    lowPerfStreak = 0,
    recoverStreak = 0;
let showHitboxes = !1,
    shopCharIndex = 0,
    shopSelectedItem = null,
    pendingScreenshot = null;
let killCount = 0;

const SAVE_KEY = 'meme_bros_save_v4';
let saveData = {
    coins: 0,
    gachaCoins: 0,
    gachaPity: 0,
    unlocks: ['doge', 'frog', 'cat', 'capy', 'spongy', 'sanic', '67kid', 'amogus', 'sahur', 'primo', 'ocralito'],
    goldMode: !1,
    cosmetics: [],
    trophies: [],
    mobileControls: !0,
    bannerEndTime: 0,
    currentBanner: null,
    mastery: {},
    friendCode: '',
    friends: [],
    customControls: null
};
let equippedCosmetic = null;
function generateSprite(pixelData, colors) {
    const pixelSize = 1;
    const canvas = document.createElement('canvas');
    if (!pixelData || pixelData.length === 0) return canvas;
    const width = pixelData[0].length;
    const height = pixelData.length;
    canvas.width = width * pixelSize;
    canvas.height = height * pixelSize;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = !1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (!pixelData[y] || x >= pixelData[y].length) continue;
            const colorKey = pixelData[y][x];
            if (colors[colorKey]) {
                ctx.fillStyle = colors[colorKey];
                ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
            }
        }
    }
    return canvas;
}
function generateAnimationSheet(sheetData, colors) {
    const animations = {};
    for (const animName in sheetData) {
        animations[animName] = [];
        const animFrames = sheetData[animName].frames;
        animFrames.forEach(frameData => {
            animations[animName].push(generateSprite(frameData, colors));
        });
    }
    return animations;
}
const sfx = {
    ctx: null,
    vol: 0.5,
    init: function () {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    },
    setVol: function (v) {
        this.vol = v;
    },
    play: function (type) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime,
            osc = this.ctx.createOscillator(),
            gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        let g = 0.1 * this.vol;
        if (type === 'jump') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(150, t);
            osc.frequency.linearRampToValueAtTime(300, t + 0.1);
            gain.gain.setValueAtTime(g, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        } else if (type === 'hit') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, t);
            osc.frequency.exponentialRampToValueAtTime(10, t + 0.1);
            gain.gain.setValueAtTime(g * 2, t);
        } else if (type === 'break') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(800, t);
            gain.gain.setValueAtTime(g * 5, t);
            gain.gain.linearRampToValueAtTime(0, t + 0.5);
        } else if (type === 'ult') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, t);
            osc.frequency.linearRampToValueAtTime(800, t + 0.5);
            gain.gain.setValueAtTime(g * 3, t);
            osc.start(t);
            osc.stop(t + 1.0);
            return;
        } else if (type === 'coin') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1000, t);
            gain.gain.setValueAtTime(g, t);
            gain.gain.linearRampToValueAtTime(0, t + 0.1);
        } else if (type === 'shield') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(300, t);
            gain.gain.setValueAtTime(g, t);
            gain.gain.linearRampToValueAtTime(0, t + 0.1);
        } else if (type === 'mega') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(200, t);
            osc.frequency.linearRampToValueAtTime(600, t + 1.0);
            gain.gain.setValueAtTime(g * 3, t);
            gain.gain.linearRampToValueAtTime(0, t + 1.0);
        }
        osc.start(t);
        osc.stop(t + 0.1);
    }
};
const music = {
    ctx: null,
    enabled: !0,
    currentTheme: null,
    nextNoteTime: 0,
    noteIndex: 0,
    tempo: 120,
    timerID: null,
    vol: 0.5,
    init: function () {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    },
    setVol: function (v) {
        this.vol = v;
    },
    toggle: function () {
        this.enabled = !this.enabled;
        if (!this.enabled) this.stop();
        else if (this.currentTheme) this.play(this.currentTheme);
        return this.enabled;
    },
    play: function (theme) {
        if (this.currentTheme === theme && this.timerID) return;
        this.stop();
        this.currentTheme = theme;
        if (!this.enabled || !this.ctx) return;
        this.noteIndex = 0;
        this.nextNoteTime = this.ctx.currentTime;
        this.scheduler();
    },
    stop: function () {
        clearTimeout(this.timerID);
        this.timerID = null;
    },
    scheduler: function () {
        if (!this.enabled) return;
        while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
            this.playPattern();
            this.nextNoteTime += (60 / this.tempo) * 0.25;
            this.noteIndex++;
        }
        this.timerID = setTimeout(() => this.scheduler(), 25);
    },
    playPattern: function () {
        if (!this.enabled) return;
        const t = this.nextNoteTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        let freq = 0;
        let step = this.noteIndex % 16;
        if (this.currentTheme === 'MENU') {
            this.tempo = 100;
            osc.type = 'triangle';
            const seq = [261, 0, 311, 0, 392, 0, 311, 0, 466, 0, 392, 0, 311, 0, 261, 0];
            freq = seq[step];
            gain.gain.value = 0.05 * this.vol;
        } else if (this.currentTheme === 'BATTLE') {
            this.tempo = 140;
            osc.type = 'square';
            const seq = [261, 261, 329, 392, 440, 440, 392, 329, 349, 349, 329, 293, 261, 293, 329, 0];
            freq = seq[step];
            gain.gain.value = 0.03 * this.vol;
            if (step % 4 === 0) this.playBass(130, t);
        } else if (this.currentTheme === 'BOSS') {
            this.tempo = 110;
            osc.type = 'sawtooth';
            const seq = [65, 0, 65, 0, 69, 0, 65, 0, 73, 0, 69, 0, 65, 0, 61, 0];
            freq = seq[step];
            gain.gain.value = 0.08 * this.vol;
        } else if (this.currentTheme === 'WIN') {
            this.tempo = 120;
            osc.type = 'triangle';
            const seq = [523, 0, 523, 0, 523, 0, 659, 0, 783, 783, 783, 783, 0, 0, 0, 0];
            freq = seq[step];
            gain.gain.value = 0.05 * this.vol;
        }
        if (freq > 0) {
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
            osc.start(t);
            osc.stop(t + 0.1);
        }
    },
    playBass: function (freq, t) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.05 * this.vol, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.2);
        osc.start(t);
        osc.stop(t + 0.2);
    }
};
const audioFiles = {
    vivaldi: null,
    init: function () {
        if (this.vivaldi) return; // Already initialized
        try {
            // Create audio element for Vivaldi
            this.vivaldi = new Audio();
            this.vivaldi.src = 'vivaldi-winter.mp3'; // Place MP3 file in same directory
            this.vivaldi.volume = 0.5;
            this.vivaldi.loop = false;
            console.log('[AudioFiles] Vivaldi initialized. File: vivaldi-winter.mp3');
        } catch (e) {
            console.error('[AudioFiles] Failed to initialize:', e);
        }
    },
    play: function (track) {
        if (track === 'VIVALDI') {
            if (!this.vivaldi) {
                console.warn('[AudioFiles] Vivaldi not initialized, initializing now...');
                this.init();
            }
            if (this.vivaldi) {
                this.vivaldi.currentTime = 0;
                this.vivaldi.play()
                    .then(() => console.log('[AudioFiles] Vivaldi playing!'))
                    .catch(e => console.error('[AudioFiles] Vivaldi playback failed:', e.message));
            }
        }
    },
    stop: function (track) {
        if (track === 'VIVALDI' && this.vivaldi) {
            this.vivaldi.pause();
            this.vivaldi.currentTime = 0;
        }
    }
};

function loadGame() {
    const d = localStorage.getItem(SAVE_KEY);
    if (d) saveData = JSON.parse(d);
    if (!saveData.unlocks) saveData.unlocks = ['doge', 'frog', 'cat', 'capy', 'spongy', 'sanic', '67kid', 'amogus', 'sahur', 'primo', 'ocralito'];
    if (!saveData.unlocks.includes('sahur')) saveData.unlocks.push('sahur');
    if (!saveData.unlocks.includes('primo')) saveData.unlocks.push('primo');
    if (!saveData.unlocks.includes('ocralito')) saveData.unlocks.push('ocralito');
    if (!saveData.cosmetics) saveData.cosmetics = [];
    if (!saveData.trophies) saveData.trophies = [];
    if (!saveData.titles) saveData.titles = [];
    if (!saveData.powerBoosters) saveData.powerBoosters = 0;
    if (saveData.mobileControls === undefined) saveData.mobileControls = !0;
    if (saveData.equipped) equippedCosmetic = saveData.equipped;
    updateCoinDisplay();
    updateMobileControlsSetting();
}
function saveGame() {
    saveData.equipped = equippedCosmetic;
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    updateCoinDisplay();
}
function updateCoinDisplay() {
    const el = document.getElementById('coin-count');
    if (el) el.innerText = saveData.coins;
}
function earnCoins(amount) {
    saveData.coins += amount;
    saveGame();
    const pop = document.createElement('div');
    pop.className = 'coin-pop';
    pop.innerText = `+${amount} ðŸ’°`;
    pop.style.left = '50%';
    pop.style.top = '50%';
    document.body.appendChild(pop);
    setTimeout(() => pop.remove(), 1000);
}

