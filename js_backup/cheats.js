const cheatCode = ['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft'];
let cheatIndex = 0;
const cheatCode2 = ['ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowLeft'];
let cheatIndex2 = 0;
const cheatCode3 = ['ArrowLeft', 'ArrowLeft', 'ArrowRight', 'ArrowRight', 'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowRight'];
let cheatIndex3 = 0;
const cheatCode4 = ['ArrowUp', 'ArrowDown', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
let cheatIndex4 = 0;
const cheatCodeGacha = ['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowLeft'];
let cheatIndexGacha = 0;
// Konami code: Up, Up, Down, Down, Left, Right, Left, Right, B, A
const cheatCodeKonami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']; // Normalized to lowercase
let cheatIndexKonami = 0;
// Pork code: (example) Up, Down, Left, Right, P, O, R, K
const cheatCodePork = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'p', 'o', 'r', 'k'];
let cheatIndexPork = 0;
// Glitch code: G, L, I, T, C, H
const cheatCodeGlitch = ['g', 'l', 'i', 't', 'c', 'h'];
let cheatIndexGlitch = 0;

// Feedback Cheat
let feedbackCheatInput = '';
const feedbackCheatCode = 'feedback';

function handleCheatInput(key) {
    if (typeof gameState !== 'undefined' && gameState === 'TITLE') {
        // Check each cheat code independently
        let matched = false;

        // Cheat Code 1: thememe
        if (key === cheatCode[cheatIndex]) {
            cheatIndex++;
            console.log('[DEBUG] cheatCode1 progress:', cheatIndex, '/', cheatCode.length);
            if (cheatIndex === cheatCode.length) {
                if (!saveData.unlocks.includes('thememe')) {
                    saveData.unlocks.push('thememe'); saveGame();
                    showNotification("SECRET UNLOCKED!", "THE MEME");
                    unlockTrophy('unlock_meme');
                }
                cheatIndex = 0;
            }
            matched = true;
        } else {
            cheatIndex = 0;
        }

        // Cheat Code 2: gps
        if (key === cheatCode2[cheatIndex2]) {
            cheatIndex2++;
            console.log('[DEBUG] cheatCode2 progress:', cheatIndex2, '/', cheatCode2.length);
            if (cheatIndex2 === cheatCode2.length) {
                if (!saveData.unlocks.includes('gps')) {
                    saveData.unlocks.push('gps'); saveGame();
                    showNotification("SECRET UNLOCKED!", "GPS");
                    unlockTrophy('unlock_gps');
                }
                cheatIndex2 = 0;
            }
            matched = true;
        } else {
            cheatIndex2 = 0;
        }

        // Cheat Code 3: mechabara
        if (key === cheatCode3[cheatIndex3]) {
            cheatIndex3++;
            console.log('[DEBUG] cheatCode3 progress:', cheatIndex3, '/', cheatCode3.length);
            if (cheatIndex3 === cheatCode3.length) {
                if (!saveData.unlocks.includes('mechabara')) {
                    saveData.unlocks.push('mechabara'); saveGame();
                    showNotification("SECRET UNLOCKED!", "MECHA-BARA");
                    unlockTrophy('unlock_mechabara');
                }
                cheatIndex3 = 0;
            }
            matched = true;
        } else {
            cheatIndex3 = 0;
        }

        // Cheat Code 4: bluedude
        if (key === cheatCode4[cheatIndex4]) {
            cheatIndex4++;
            console.log('[DEBUG] cheatCode4 progress:', cheatIndex4, '/', cheatCode4.length);
            if (cheatIndex4 === cheatCode4.length) {
                if (!saveData.unlocks.includes('bluedude')) {
                    saveData.unlocks.push('bluedude'); saveGame();
                    showNotification("SECRET UNLOCKED!", "BLUEDUDE");
                    unlockTrophy('unlock_bluedude');
                }
                cheatIndex4 = 0;
            }
            matched = true;
        } else {
            cheatIndex4 = 0;
        }

        // Cheat Code 5: glitch
        if (key === cheatCodeGlitch[cheatIndexGlitch]) {
            cheatIndexGlitch++;
            console.log('[DEBUG] cheatCodeGlitch progress:', cheatIndexGlitch, '/', cheatCodeGlitch.length);
            if (cheatIndexGlitch === cheatCodeGlitch.length) {
                if (!saveData.unlocks.includes('glitch')) {
                    saveData.unlocks.push('glitch'); saveGame();
                    showNotification("REALITY BREACHED!", "⚡ GLITCH UNLOCKED ⚡");
                    unlockTrophy('unlock_glitch');
                }
                cheatIndexGlitch = 0;
            }
            matched = true;
        } else {
            cheatIndexGlitch = 0;
        }

        // Konami Code
        // Helper to normalize Konami code check if needed, but array is mixed
        // Array has 'ArrowUp'... and 'b', 'a'. Key is normalized to lowercase if single char.
        // So 'ArrowUp' matches 'ArrowUp'. 'B' matches 'b'.
        let targetKey = cheatCodeKonami[cheatIndexKonami];
        if (targetKey.length === 1) targetKey = targetKey.toLowerCase();

        if (key === targetKey) {
            cheatIndexKonami++;
            console.log('[DEBUG] Konami progress:', cheatIndexKonami, '/', cheatCodeKonami.length, '- Key pressed:', key);
            if (cheatIndexKonami === cheatCodeKonami.length) {
                const allSecrets = ['thememe', 'gps', 'mechabara', 'bluedude', 'johnpork', 'glitch', 'luckyblock', 'brokeboy'];
                let unlocked = [];
                allSecrets.forEach(id => {
                    if (!saveData.unlocks.includes(id)) {
                        saveData.unlocks.push(id);
                        unlocked.push(id);
                    }
                });
                // Max mastery for all characters
                if (!saveData.mastery) saveData.mastery = {};
                CHARACTERS.forEach(ch => {
                    if (!saveData.mastery[ch.id]) saveData.mastery[ch.id] = { wins: 0, matches: 0, damage: 0, level: 0 };
                    saveData.mastery[ch.id].wins = Math.max(saveData.mastery[ch.id].wins, 100);
                    saveData.mastery[ch.id].matches = Math.max(saveData.mastery[ch.id].matches, 100);
                    saveData.mastery[ch.id].level = 5;
                });
                unlocked.push('ALL MASTERIES');
                if (!saveData.goldMode) {
                    saveData.goldMode = true;
                    unlocked.push('gold mode');
                }
                const allCosmetics = ['tophat', 'shades', 'crown'];
                allCosmetics.forEach(cos => {
                    if (!saveData.cosmetics.includes(cos)) {
                        saveData.cosmetics.push(cos);
                        unlocked.push(cos);
                    }
                });
                saveData.coins += 2000;
                saveData.gachaCoins = (saveData.gachaCoins || 0) + 3;
                unlocked.push('2000 coins', '3 gacha coins');
                saveGame();
                updateCoinDisplay();
                if (typeof renderCharGrid === 'function') renderCharGrid();
                // Check if Jack should be unlocked
                if (typeof checkJackUnlock === 'function') checkJackUnlock();
                showNotification("KONAMI CODE!", `SECRETS + MASTERIES!<br>${unlocked.map(u => u.toUpperCase()).join(', ')}`);
                sfx.play('coin');
                cheatIndexKonami = 0;
                if (typeof renderMastery === 'function' && document.getElementById('mastery-screen') && !document.getElementById('mastery-screen').classList.contains('hidden')) {
                    renderMastery();
                }
            }
            matched = true;
        } else if (!matched) {
            cheatIndexKonami = 0;
        }

        // Pork Code
        let targetPork = cheatCodePork[cheatIndexPork];
        if (targetPork.length === 1) targetPork = targetPork.toLowerCase();

        if (key === targetPork) {
            cheatIndexPork++;
            console.log('[DEBUG] cheatCodePork progress:', cheatIndexPork, '/', cheatCodePork.length);
            if (cheatIndexPork === cheatCodePork.length) {
                if (!saveData.unlocks.includes('johnpork')) {
                    saveData.unlocks.push('johnpork'); saveGame();
                    showNotification("SECRET UNLOCKED!", "JOHN PORK");
                    unlockTrophy('unlock_johnpork');
                    if (typeof renderCharGrid === 'function') renderCharGrid();
                }
                cheatIndexPork = 0;
            }
            matched = true;
        } else {
            cheatIndexPork = 0;
        }

        // Gacha Code
        if (key === cheatCodeGacha[cheatIndexGacha]) {
            cheatIndexGacha++;
            console.log('[DEBUG] cheatCodeGacha progress:', cheatIndexGacha, '/', cheatCodeGacha.length);
            if (cheatIndexGacha === cheatCodeGacha.length) {
                console.log('[DEBUG] Gacha code complete! Current unlocks:', saveData.unlocks);
                if (!saveData.unlocks.includes('luckyblock')) {
                    saveData.unlocks.push('luckyblock');
                    saveGame();
                    showNotification("SECRET UNLOCKED!", "LUCKY BLOCK");
                    console.log('[DEBUG] Unlocked luckyblock. New unlocks:', saveData.unlocks);
                } else {
                    console.log('[DEBUG] luckyblock already unlocked');
                }
                if (!saveData.unlocks.includes('brokeboy')) {
                    saveData.unlocks.push('brokeboy');
                    saveGame();
                    showNotification("SECRET UNLOCKED!", "BROKE BOY");
                    console.log('[DEBUG] Unlocked brokeboy. New unlocks:', saveData.unlocks);
                } else {
                    console.log('[DEBUG] brokeboy already unlocked');
                }
                if (typeof renderCharGrid === 'function') renderCharGrid();
                cheatIndexGacha = 0;
            }
            matched = true;
        } else {
            cheatIndexGacha = 0;
        }
    }
}

function handleFeedbackCheat(key) {
    if (document.getElementById('feedback-screen') && document.getElementById('feedback-screen').classList.contains('hidden')) return;

    // Ignore non-character keys for feedback code which is just text 'feedback'
    if (key.length > 1) return;

    feedbackCheatInput += key.toLowerCase();
    if (feedbackCheatInput.length > feedbackCheatCode.length) {
        feedbackCheatInput = feedbackCheatInput.slice(-feedbackCheatCode.length);
    }

    if (feedbackCheatInput === feedbackCheatCode) {
        if (typeof showFeedbackList === 'function') showFeedbackList();
        feedbackCheatInput = '';
    }
}
