function showNotification(title, subtitle) {
    const el = document.getElementById('secret-unlock');
    el.innerHTML = `${title}<br><span id="secret-name" style="font-size:20px">${subtitle}</span>`;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 3000);
}
function unlockTrophy(id) {
    if (!saveData.trophies.includes(id)) {
        saveData.trophies.push(id);

        // Award Gacha Coins for special trophies
        const gachaCoinTrophies = ['first_blood', 'combo_master', 'survivor', 'perfect_victory', 'unlock_all', 'collector', 'unlock_meme'];
        if (gachaCoinTrophies.includes(id)) {
            saveData.gachaCoins = (saveData.gachaCoins || 0) + 1;
            showNotification("ðŸŽ« BONUS! ðŸŽ«", "+1 Gacha Coin from Trophy!");
        }

        saveGame();
        sfx.play('ult');
        showNotification("ðŸ† TROPHY UNLOCKED! ðŸ†", MASTER_TROPHY_LIST[id].name);
    }
}

function openShop() {
    sfx.init();
    music.init();
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('shop-screen').classList.remove('hidden');
    gameState = 'SHOP';
    renderShop();
    music.play('MENU');
    loop();
}
function closeShop() {
    document.getElementById('shop-screen').classList.add('hidden');
    document.getElementById('title-screen').classList.remove('hidden');
    gameState = 'TITLE';
}
function cycleShopChar(dir) {
    shopCharIndex = (shopCharIndex + dir + CHARACTERS.length) % CHARACTERS.length;
    document.getElementById('shop-char-name').innerText = CHARACTERS[shopCharIndex].name;
    sfx.play('coin');
}
function renderShop() {
    const grid = document.getElementById('shop-grid');
    grid.innerHTML = '';
    SHOP_ITEMS.forEach(item => {
        const div = document.createElement('div');
        div.className = 'shop-item';
        if (shopSelectedItem && shopSelectedItem.id === item.id) div.classList.add('selected');
        let owned = !1;
        if (item.type === 'char' && saveData.unlocks.includes(item.id)) owned = !0;
        if (item.type === 'skin' && saveData.goldMode) owned = !0;
        if (item.type === 'cosmetic' && saveData.cosmetics.includes(item.id)) owned = !0;
        let iconHtml = '';
        const charForItem = CHARACTERS.find(c => c.id === item.id);
        if (item.type === 'char' && (characterSprites[item.id] || (charForItem && charForItem.icon))) {
            if (characterSprites[item.id]) {
                iconHtml = `<canvas width="16" height="16" id="shop-sprite-${item.id}"></canvas>`;
            } else {
                iconHtml = `<div style="font-size:30px">${charForItem.icon}</div>`;
            }
        } else {
            iconHtml = `<div style="font-size:30px">${item.icon || (owned ? 'âœ…' : 'ðŸ”’')}</div>`;
        }
        let content = `${iconHtml}<div style="font-size:10px">${item.name}</div>`;
        if (!owned) content += `<div class="shop-cost">${item.cost}</div>`;
        else content += `<div class="shop-cost" style="color:var(--on)">OWNED</div>`;
        div.innerHTML = content;
        div.onclick = () => selectShopItem(item);
        grid.appendChild(div);
        if (item.type === 'char' && characterSprites[item.id]) {
            const miniCanvas = document.getElementById(`shop-sprite-${item.id}`);
            if (miniCanvas) {
                const miniCtx = miniCanvas.getContext('2d');
                miniCtx.imageSmoothingEnabled = !1;
                const sprite = characterSprites[item.id];
                if (sprite.idle && sprite.idle[0]) {
                    miniCtx.drawImage(sprite.idle[0], 0, 0, miniCanvas.width, miniCanvas.height);
                } else if (sprite) {
                    miniCtx.drawImage(sprite, 0, 0, miniCanvas.width, miniCanvas.height);
                }
            }
        }
    });
    updateBuyButton();
}
function selectShopItem(item) {
    shopSelectedItem = item;
    renderShop();
    updateBuyButton();
    sfx.play('coin');
}
function updateBuyButton() {
    const btn = document.getElementById('buy-btn');
    const info = document.getElementById('shop-item-info');
    if (!shopSelectedItem) {
        btn.style.display = 'none';
        info.innerText = "SELECT ITEM";
        return;
    }
    btn.style.display = 'block';
    let owned = !1;
    if (shopSelectedItem.type === 'char' && saveData.unlocks.includes(shopSelectedItem.id)) owned = !0;
    if (shopSelectedItem.type === 'skin' && saveData.goldMode) owned = !0;
    if (shopSelectedItem.type === 'cosmetic' && saveData.cosmetics.includes(shopSelectedItem.id)) owned = !0;
    if (!owned) {
        btn.innerText = "BUY";
        btn.className = "btn-buy";
        btn.onclick = buyOrEquip;
        info.innerText = `COST: ${shopSelectedItem.cost} COINS`;
    } else {
        if (shopSelectedItem.type === 'cosmetic') {
            if (equippedCosmetic === shopSelectedItem.id) {
                btn.innerText = "UNEQUIP";
                btn.className = "btn-unequip";
            } else {
                btn.innerText = "EQUIP";
                btn.className = "btn-equip";
            }
            btn.onclick = buyOrEquip;
            info.innerText = "OWNED";
        } else {
            info.innerText = "UNLOCKED";
            btn.style.display = 'none';
        }
    }
}
function buyOrEquip() {
    const item = shopSelectedItem;
    let owned = !1;
    if (item.type === 'char' && saveData.unlocks.includes(item.id)) owned = !0;
    if (item.type === 'skin' && saveData.goldMode) owned = !0;
    if (item.type === 'cosmetic' && saveData.cosmetics.includes(item.id)) owned = !0;
    if (!owned) {
        if (saveData.coins >= item.cost) {
            saveData.coins -= item.cost;
            if (item.type === 'char') {
                saveData.unlocks.push(item.id);
                if (item.id === 'chad') unlockTrophy('unlock_chad');
                if (item.id === 'mechabara') unlockTrophy('unlock_mechabara');
                if (item.id === 'bluedude') unlockTrophy('unlock_bluedude');
            }
            if (item.type === 'skin') {
                saveData.goldMode = !0;
                unlockTrophy('buy_gold');
            }
            if (item.type === 'cosmetic') {
                saveData.cosmetics.push(item.id);
                equippedCosmetic = item.id;
            }
            sfx.play('ult');
            saveGame();
            renderShop();
        } else {
            sfx.play('break');
        }
    } else if (item.type === 'cosmetic') {
        if (equippedCosmetic === item.id) equippedCosmetic = null;
        else equippedCosmetic = item.id;
        sfx.play('shield');
        saveGame();
        renderShop();
    }
}
function openGacha() {
    sfx.init();
    music.init();
    audioFiles.init();
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('gacha-screen').classList.remove('hidden');
    gameState = 'GACHA';
    updateGachaDisplay();
    initBanner();

    // Update banner timer every second
    if (window.bannerTimerInterval) clearInterval(window.bannerTimerInterval);
    window.bannerTimerInterval = setInterval(updateBannerDisplay, 1000);

    music.play('MENU');
    loop();
}
function closeGacha() {
    if (window.bannerTimerInterval) clearInterval(window.bannerTimerInterval);
    document.getElementById('gacha-screen').classList.add('hidden');
    document.getElementById('title-screen').classList.remove('hidden');
    gameState = 'TITLE';
}
function initBanner() {
    const now = Date.now();
    if (!saveData.bannerEndTime || now >= saveData.bannerEndTime) {
        // Start new banner
        const bannerChars = ['thememe', 'gps', 'johnpork', 'mechabara', 'bluedude', 'glitch'];
        saveData.currentBanner = bannerChars[Math.floor(Math.random() * bannerChars.length)];
        saveData.bannerEndTime = now + (60 * 60 * 1000); // 1 hour
        saveGame();
    }
    updateBannerDisplay();
}
function updateBannerDisplay() {
    const now = Date.now();
    const timerEl = document.getElementById('banner-timer');
    const btnEl = document.getElementById('gacha-banner-btn');
    const timeLeftEl = document.getElementById('banner-time-left');
    const charNameEl = document.getElementById('banner-char-name');

    if (saveData.bannerEndTime && now < saveData.bannerEndTime && saveData.currentBanner) {
        const remaining = saveData.bannerEndTime - now;
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);

        const charNames = { thememe: 'THE MEME', gps: 'GPS', johnpork: 'JOHN PORK', mechabara: 'MECHA-BARA', bluedude: 'BLUE DUDE', glitch: 'GLITCH' };
        const charIcons = { thememe: 'ðŸ’ª', gps: 'ðŸ—ºï¸', johnpork: 'ðŸ“ž', mechabara: 'ðŸ¤–', bluedude: 'ðŸ—¡ï¸', glitch: 'âš¡' };

        if (charNameEl) charNameEl.textContent = `${charIcons[saveData.currentBanner]} ${charNames[saveData.currentBanner]} ${charIcons[saveData.currentBanner]}`;
        if (timeLeftEl) timeLeftEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        if (timerEl) timerEl.style.display = 'block';
        if (btnEl) btnEl.style.display = 'block';
    } else {
        if (timerEl) timerEl.style.display = 'none';
        if (btnEl) btnEl.style.display = 'none';
        if (saveData.bannerEndTime && now >= saveData.bannerEndTime) {
            initBanner();
        }
    }
}
function rollBannerGacha() {
    if ((saveData.gachaCoins || 0) < 1) {
        sfx.play('break');
        alert('Not enough Gacha Coins! Convert 1000 coins or earn from achievements.');
        return;
    }
    if (!saveData.currentBanner) {
        initBanner();
        return;
    }

    saveData.gachaCoins -= 1;
    saveGame();
    updateGachaDisplay();
    sfx.play('ult');

    const display = document.getElementById('gacha-display');
    display.innerHTML = '<canvas id="gacha-anim-canvas" width="160" height="160" style="image-rendering: pixelated; width: 160px; height: 160px;"></canvas>';

    let frameIndex = 0;
    const animInterval = setInterval(() => {
        const canvas = document.getElementById('gacha-anim-canvas');
        if (!canvas) {
            clearInterval(animInterval);
            return;
        }
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const frame = gachaAnimFrames[frameIndex];
        const pixelSize = 10;
        for (let y = 0; y < frame.length; y++) {
            for (let x = 0; x < frame[y].length; x++) {
                const colorKey = frame[y][x];
                if (gachaColors[colorKey] && colorKey !== '0') {
                    ctx.fillStyle = gachaColors[colorKey];
                    ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                }
            }
        }
        frameIndex = (frameIndex + 1) % gachaAnimFrames.length;
    }, 100);

    setTimeout(() => {
        clearInterval(animInterval);

        const roll = Math.random() * 100;
        let reward, rarity, icon, name, desc;

        // Banner gacha: 50% featured character, 30% other ultra, 20% rare char
        if (roll < 50) {
            // 50% - Featured banner character
            reward = saveData.currentBanner;
            const charNames = { thememe: 'THE MEME', gps: 'GPS', johnpork: 'JOHN PORK', mechabara: 'MECHA-BARA', bluedude: 'BLUE DUDE', glitch: 'GLITCH' };
            name = charNames[reward];
            rarity = 'â­ BANNER FEATURED â­';
            icon = 'ðŸŒŸ';
            desc = 'Limited Character!';
            if (!saveData.unlocks.includes(reward)) {
                saveData.unlocks.push(reward);
                showNotification("ðŸŒŸ BANNER FEATURED! ðŸŒŸ", `${name} UNLOCKED!`);
            } else {
                showNotification("ðŸŒŸ BANNER FEATURED! ðŸŒŸ", `${name} (Already Owned)`);
            }
        } else if (roll < 80) {
            // 30% - Other ultra rare characters
            const ultraChars = ['thememe', 'gps', 'johnpork', 'mechabara', 'bluedude', 'glitch'].filter(c => c !== saveData.currentBanner);
            const unlockedUltra = ultraChars.filter(c => !saveData.unlocks.includes(c));
            if (unlockedUltra.length > 0) {
                reward = unlockedUltra[Math.floor(Math.random() * unlockedUltra.length)];
                const charNames = { thememe: 'THE MEME', gps: 'GPS', johnpork: 'JOHN PORK', mechabara: 'MECHA-BARA', bluedude: 'BLUE DUDE', glitch: 'GLITCH' };
                name = charNames[reward];
                rarity = 'ULTRA RARE';
                icon = 'âœ¨';
                desc = 'Character Unlocked!';
                saveData.unlocks.push(reward);
                showNotification("âœ¨ ULTRA RARE! âœ¨", `${name} UNLOCKED!`);
            } else {
                reward = 'crown';
                name = 'CROWN';
                rarity = 'RARE';
                icon = 'ðŸ‘‘';
                desc = 'Cosmetic!';
                if (!saveData.cosmetics.includes('crown')) saveData.cosmetics.push('crown');
            }
        } else {
            // 20% - Rare characters
            const rareChars = ['luckyblock', 'brokeboy'];
            const unlockedRare = rareChars.filter(c => !saveData.unlocks.includes(c));
            if (unlockedRare.length > 0) {
                reward = unlockedRare[Math.floor(Math.random() * unlockedRare.length)];
                const charNames = { luckyblock: 'LUCKY BLOCK', brokeboy: 'BROKE BOY' };
                name = charNames[reward];
                rarity = 'RARE';
                icon = 'ðŸŒŸ';
                desc = 'Character Unlocked!';
                saveData.unlocks.push(reward);
                showNotification("ðŸŒŸ RARE! ðŸŒŸ", `${name} UNLOCKED!`);
            } else {
                reward = 'shades';
                name = 'SHADES';
                rarity = 'RARE';
                icon = 'ðŸ•¶ï¸';
                desc = 'Cosmetic!';
                if (!saveData.cosmetics.includes('shades')) saveData.cosmetics.push('shades');
            }
        }

        saveGame();
        renderCharGrid && renderCharGrid();

        display.innerHTML = `
            <div class="gacha-result-icon" style="font-size:72px">${icon}</div>
            <div class="gacha-result-name">${name}</div>
            <div class="gacha-result-desc">${desc}</div>
            <div class="gacha-rarity" style="color:#ff0">${rarity}</div>
        `;
    }, 2000);
}
function toggleGachaInfo() {
    const panel = document.getElementById('gacha-info-panel');
    if (!panel) return;

    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');

        // Update pity counter display
        const pityEl = document.getElementById('gacha-pity-display');
        if (pityEl) {
            const pity = saveData.gachaPity || 0;
            const remaining = 200 - pity;
            pityEl.innerHTML = `<strong>Pity Counter:</strong> ${pity}/200 rolls (${remaining} until guaranteed Lucky Block)`;
        }
    } else {
        panel.classList.add('hidden');
    }
}
function updateGachaDisplay() {
    const btn = document.getElementById('gacha-roll-btn');
    const premiumBtn = document.getElementById('gacha-roll-premium-btn');
    const coinEl = document.getElementById('gacha-coin-count');
    const gachaEl = document.getElementById('gacha-coin-special-count');

    if (coinEl) coinEl.innerText = saveData.coins;
    if (gachaEl) gachaEl.innerText = saveData.gachaCoins || 0;

    if (btn) {
        if (saveData.coins >= 100) {
            btn.disabled = false;
            btn.innerText = `NORMAL GACHA (100ðŸ’°)`;
        } else {
            btn.disabled = true;
            btn.innerText = `NOT ENOUGH COINS`;
        }
    }

    if (premiumBtn) {
        if ((saveData.gachaCoins || 0) >= 1) {
            premiumBtn.disabled = false;
        } else {
            premiumBtn.disabled = true;
        }
    }
}
const gachaAnimFrames = [
    ["0000000000000000", "0000000000000000", "0000000000000000", "0000000000000000", "0011111111111100", "0013344455444100", "0013444544544100", "0013444444544100", "0013444445444100", "0013444454444100", "0013344444444100", "0013333353333100", "0011111111111100", "0000000000000000", "0000000000000000", "0000000000000000"],
    ["0000000000000000", "0000000000000000", "0000000000000000", "0000000000000000", "0011111111111100", "0013344455444100", "0013444544544100", "0013444444544100", "0013444445444100", "0013444454444100", "0013344444444100", "0013333353333100", "0011111111111100", "0000000000000000", "0000000000000000", "0000000000000000"],
    ["0000000000000000", "0000000000000000", "0000000000000000", "0000000000000000", "0011111111111100", "0010011111100100", "0010015322100100", "0010013355100100", "0010012222100100", "0010015555100100", "0010111111110100", "0010000000000100", "0011111111111100", "0000000000000000", "0000000000000000", "0000000000000000"],
    ["0000000000000000", "0000000000000000", "0000000000000000", "0000000000000000", "0011111111111100", "0010000000000100", "0014400040440100", "0010040400000100", "0010000000000100", "0014000004000100", "0010444040440100", "0010000000000100", "0011111111111100", "0000000000000000", "0000000000000000", "0000000000000000"],
    ["0000000000000000", "0000000000000000", "0000000000000000", "0000000000000000", "0011111111111100", "0010011111100100", "0010012222100100", "0010111515110100", "0011012222101100", "0010011111100100", "0010001001000100", "0010011011000100", "0011111111111100", "0000000000000000", "0000000000000000", "0000000000000000"],
    ["0000000000000000", "0000000000000000", "0000000000000000", "0000000000000000", "0011111111111100", "0010000000000100", "0010001111000100", "0010001551000100", "0010001331000100", "0010001441000100", "0010001221000100", "0010001111000100", "0011111111111100", "0000000000000000", "0000000000000000", "0000000000000000"]
];
const gachaColors = {
    '0': "rgba(0,0,0,0)",
    '1': '#000000',
    '2': '#ff0000',
    '3': '#3c587c',
    '4': '#417ea4',
    '5': '#ffffff',
    '6': '#FF0000',
    '7': '#FFA500',
    '8': '#FFFF00',
    '9': '#00FF00',
    'A': '#00FFFF',
    'B': '#0000FF',
    'C': '#8000FF',
    'D': '#FF00FF',
    'E': '#964B00',
    'F': '#808080',
    'G': '#404040',
    'H': '#606060',
    'I': '#202020',
    'J': '#008000',
    'K': '#008080',
    'L': '#800000',
    'M': '#808000',
    'N': '#0080FF',
    'O': '#FF0080',
    'P': '#C0C0C0',
    'Q': '#A0A0A0',
    'R': '#303030',
    'S': '#101010',
    'T': '#FFD700',
    'U': '#ADFF2F',
    'V': '#4B0082'
};

function rollGacha() {
    const GACHA_COST = 100;
    if (saveData.coins < GACHA_COST) {
        sfx.play('break');
        return;
    }
    saveData.coins -= GACHA_COST;
    saveData.gachaPity = (saveData.gachaPity || 0) + 1;
    saveGame();
    updateCoinDisplay();
    updateGachaDisplay();
    sfx.play('coin');

    // Show animation
    const display = document.getElementById('gacha-display');
    display.innerHTML = '<canvas id="gacha-anim-canvas" width="160" height="160" style="image-rendering: pixelated; width: 160px; height: 160px;"></canvas>';

    let frameIndex = 0;
    const animInterval = setInterval(() => {
        const canvas = document.getElementById('gacha-anim-canvas');
        if (!canvas) {
            clearInterval(animInterval);
            return;
        }
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const frame = gachaAnimFrames[frameIndex];
        const pixelSize = 10;
        for (let y = 0; y < frame.length; y++) {
            for (let x = 0; x < frame[y].length; x++) {
                const colorKey = frame[y][x];
                if (gachaColors[colorKey] && colorKey !== '0') {
                    ctx.fillStyle = gachaColors[colorKey];
                    ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                }
            }
        }

        frameIndex = (frameIndex + 1) % gachaAnimFrames.length;
    }, 150);

    // After 2 seconds, show result
    setTimeout(() => {
        clearInterval(animInterval);

        // Check pity at 200 rolls for Lucky Block
        const pityTriggered = saveData.gachaPity >= 200;
        const roll = Math.random() * 100;
        let reward = null;
        let rarity = '';
        let icon = '';
        let name = '';
        let desc = '';

        if (pityTriggered) {
            reward = 'luckyblock';
            rarity = 'PITY ULTRA RARE';
            icon = 'ðŸŽ';
            name = 'LUCKY BLOCK';
            desc = 'Character Unlocked! (Pity at 200)';
            if (!saveData.unlocks.includes('luckyblock')) {
                saveData.unlocks.push('luckyblock');
                sfx.play('ult');
                showNotification("ðŸŽ PITY TRIGGERED! ðŸŽ", "LUCKY BLOCK UNLOCKED!");
            }
            saveData.gachaPity = 0;
        } else if (roll < 0.5) {
            reward = 'luckyblock';
            rarity = 'ULTRA RARE';
            icon = 'ðŸŽ';
            name = 'LUCKY BLOCK';
            desc = 'Character Unlocked!';
            if (!saveData.unlocks.includes('luckyblock')) {
                saveData.unlocks.push('luckyblock');
                sfx.play('ult');
                showNotification("ðŸŽ ULTRA RARE! ðŸŽ", "LUCKY BLOCK UNLOCKED!");
            }
            saveData.gachaPity = 0;
        } else if (roll < 1.005) {
            reward = 'title_restless_gambler';
            rarity = 'RARE';
            icon = 'ðŸŽ°';
            name = 'THE RESTLESS GAMBLER';
            desc = 'Title Unlocked!';
            if (!saveData.titles) saveData.titles = [];
            if (!saveData.titles.includes('restless_gambler')) {
                saveData.titles.push('restless_gambler');
                sfx.play('ult');
                showNotification("ðŸŽ° RARE REWARD! ðŸŽ°", "TITLE: THE RESTLESS GAMBLER");
            }
        } else if (roll < 10.005) {
            reward = 'tophat';
            rarity = 'UNCOMMON';
            icon = 'ðŸŽ©';
            name = 'TOP HAT';
            desc = 'Cosmetic Unlocked!';
            if (!saveData.cosmetics.includes('tophat')) {
                saveData.cosmetics.push('tophat');
                equippedCosmetic = 'tophat';
                sfx.play('ult');
                showNotification("ðŸŽ© COSMETIC UNLOCKED! ðŸŽ©", "TOP HAT");
            }
        } else if (roll < 30.005) {
            reward = 'power_booster';
            rarity = 'UNCOMMON';
            icon = 'âš¡';
            name = 'POWER BOOSTER';
            desc = 'Survival Boost Unlocked!';
            saveData.powerBoosters = (saveData.powerBoosters || 0) + 1;
            sfx.play('ult');
            showNotification("âš¡ POWER BOOSTER! âš¡", "Use in Survival Mode");
        } else {
            reward = 'brokeboy';
            rarity = 'COMMON';
            icon = 'ðŸ’¸';
            name = 'BROKE BOY';
            desc = 'Character Unlocked!';
            if (!saveData.unlocks.includes('brokeboy')) {
                saveData.unlocks.push('brokeboy');
                sfx.play('coin');
                showNotification("ðŸ’¸ COMMON REWARD ðŸ’¸", "BROKE BOY UNLOCKED");
            }
        }
        saveGame();
        display.innerHTML = `
            <div class="gacha-result-icon">${icon}</div>
            <div class="gacha-result-name ${rarity === 'ULTRA RARE' ? 'gacha-ultra-rare' : (rarity === 'RARE' ? 'gacha-rare' : 'gacha-common')}">${name}</div>
            <div class="gacha-result-desc">${desc}</div>
            <div class="gacha-rarity ${rarity === 'ULTRA RARE' ? 'gacha-ultra-rare' : (rarity === 'RARE' ? 'gacha-rare' : 'gacha-common')}">${rarity}</div>
        `;
        updateGachaDisplay();
    }, 2000);
}

function rollPremiumGacha() {
    if ((saveData.gachaCoins || 0) < 1) {
        sfx.play('break');
        alert('Not enough Gacha Coins! Convert 1000 coins or earn from achievements.');
        return;
    }
    saveData.gachaCoins -= 1;
    saveGame();
    updateGachaDisplay();
    sfx.play('ult');

    const display = document.getElementById('gacha-display');
    display.innerHTML = '<canvas id="gacha-anim-canvas" width="160" height="160" style="image-rendering: pixelated; width: 160px; height: 160px;"></canvas>';

    let frameIndex = 0;
    const animInterval = setInterval(() => {
        const canvas = document.getElementById('gacha-anim-canvas');
        if (!canvas) {
            clearInterval(animInterval);
            return;
        }
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const frame = gachaAnimFrames[frameIndex];
        const pixelSize = 10;
        for (let y = 0; y < frame.length; y++) {
            for (let x = 0; x < frame[y].length; x++) {
                const colorKey = frame[y][x];
                if (gachaColors[colorKey] && colorKey !== '0') {
                    ctx.fillStyle = gachaColors[colorKey];
                    ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                }
            }
        }
        frameIndex = (frameIndex + 1) % gachaAnimFrames.length;
    }, 100);

    setTimeout(() => {
        clearInterval(animInterval);

        const roll = Math.random() * 100;
        let reward, rarity, icon, name, desc;

        // Premium gacha: guaranteed rare+ (characters and cosmetics)
        if (roll < 20) {
            // 20% - Ultra Rare Characters
            const ultraChars = ['thememe', 'gps', 'johnpork', 'mechabara', 'bluedude', 'glitch'];
            const unlockedUltra = ultraChars.filter(c => !saveData.unlocks.includes(c));
            if (unlockedUltra.length > 0) {
                reward = unlockedUltra[Math.floor(Math.random() * unlockedUltra.length)];
                const charNames = { thememe: 'THE MEME', gps: 'GPS', johnpork: 'JOHN PORK', mechabara: 'MECHA-BARA', bluedude: 'BLUE DUDE', glitch: 'GLITCH' };
                name = charNames[reward];
                rarity = 'ULTRA RARE';
                icon = 'âœ¨';
                desc = 'Character Unlocked!';
                saveData.unlocks.push(reward);
                showNotification("âœ¨ ULTRA RARE! âœ¨", `${name} UNLOCKED!`);
            } else {
                reward = 'crown';
                name = 'CROWN';
                rarity = 'RARE';
                icon = 'ðŸ‘‘';
                desc = 'Cosmetic Unlocked!';
                if (!saveData.cosmetics.includes('crown')) saveData.cosmetics.push('crown');
            }
        } else if (roll < 50) {
            // 30% - Rare Characters (only unlockable ones)
            const rareChars = ['luckyblock', 'brokeboy'];
            const unlockedRare = rareChars.filter(c => !saveData.unlocks.includes(c));
            if (unlockedRare.length > 0) {
                reward = unlockedRare[Math.floor(Math.random() * unlockedRare.length)];
                const charNames = { luckyblock: 'LUCKY BLOCK', brokeboy: 'BROKE BOY' };
                name = charNames[reward];
                rarity = 'RARE';
                icon = 'ðŸŒŸ';
                desc = 'Character Unlocked!';
                saveData.unlocks.push(reward);
                showNotification("ðŸŒŸ RARE! ðŸŒŸ", `${name} UNLOCKED!`);
            } else {
                reward = 'shades';
                name = 'SHADES';
                rarity = 'RARE';
                icon = 'ðŸ•¶ï¸';
                desc = 'Cosmetic Unlocked!';
                if (!saveData.cosmetics.includes('shades')) saveData.cosmetics.push('shades');
            }
        } else {
            // 50% - Cosmetics guaranteed
            const cosmetics = ['tophat', 'shades', 'crown'];
            reward = cosmetics[Math.floor(Math.random() * cosmetics.length)];
            const cosNames = { tophat: 'TOP HAT', shades: 'SHADES', crown: 'CROWN' };
            const cosIcons = { tophat: 'ðŸŽ©', shades: 'ðŸ•¶ï¸', crown: 'ðŸ‘‘' };
            name = cosNames[reward];
            icon = cosIcons[reward];
            rarity = 'UNCOMMON';
            desc = 'Cosmetic Unlocked!';
            if (!saveData.cosmetics.includes(reward)) saveData.cosmetics.push(reward);
        }

        saveGame();
        display.innerHTML = `
            <div class="gacha-result-icon">${icon}</div>
            <div class="gacha-result-name ${rarity === 'ULTRA RARE' ? 'gacha-ultra-rare' : (rarity === 'RARE' ? 'gacha-rare' : 'gacha-common')}">${name}</div>
            <div class="gacha-result-desc">${desc}</div>
            <div class="gacha-rarity ${rarity === 'ULTRA RARE' ? 'gacha-ultra-rare' : (rarity === 'RARE' ? 'gacha-rare' : 'gacha-common')}">${rarity} - PREMIUM</div>
        `;
        updateGachaDisplay();
    }, 2000);
}

function convertCoinsToGacha() {
    if (saveData.coins < 1000) {
        sfx.play('break');
        alert('You need at least 1000 coins to convert!');
        return;
    }
    if (confirm('Convert 1000 ðŸ’° to 1 ðŸŽ« Gacha Coin?')) {
        saveData.coins -= 1000;
        saveData.gachaCoins = (saveData.gachaCoins || 0) + 1;
        saveGame();
        updateCoinDisplay();
        updateGachaDisplay();
        sfx.play('coin');
        showNotification("ðŸŽ« CONVERTED!", "+1 Gacha Coin");
    }
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
