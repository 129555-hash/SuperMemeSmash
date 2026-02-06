class Fighter {
    constructor(id, s, x, y, loc, cpu) {
        this.id = id;
        this.stats = s;
        this.x = x;
        this.y = y;
        this.w = 50;
        this.h = 50;
        this.vx = 0;
        this.vy = 0;
        this.pct = 0;
        this.stocks = 3;
        this.ult = 0;
        this.dir = id === 1;
        this.loc = loc;
        this.cpu = cpu;
        this.jumps = 2;
        this.stun = 0;
        this.inv = 0;
        this.cd = 0;
        this.box = null;
        this.hasHammer = !1;
        this.hasLandmine = !1;
        this.shieldHP = 100;
        this.shielding = !1;
        this.rolling = !1;
        this.rollDir = 0;
        this.rollTime = 0;
        this.isBoss = !1;
        this.bossHP = 0;
        this.alpha = 1;
        this.friction = 0.85;
        this.confused = 0;
        this.animation = "idle";
        this.frame = 0;
        this.frameTimer = 0;
        this.animSpeed = 0.1;
        this.animOverrideTimer = 0;
        this.animOverride = null;
        this.isParrying = !1;
        this.parryTimer = 0;
        // Mastery variant active flag (per character)
        try {
            if (this.stats && this.stats.id) {
                initMastery(this.stats.id);
                const lvl = (saveData.mastery && saveData.mastery[this.stats.id]) ? saveData.mastery[this.stats.id].level : 0;
                const unlocked = lvl >= 5;
                const want = (this.id === 1 ? useMasteryP1 : useMasteryP2);
                this.masteryActive = !!(unlocked && want);
            } else {
                this.masteryActive = false;
            }
        } catch (e) {
            this.masteryActive = false;
        }
    }
    updateAnimationState() {
        // Respect temporary animation overrides (e.g., attacks/ults)
        if (this.animOverrideTimer > 0) {
            this.animOverrideTimer--;
            return;
        }
        if (this.isParrying && this.parryTimer > 0) {
            this.setAnimation("shield");
            return;
        }
        if (this.stun > 0) {
            this.setAnimation("stun");
        } else if (!this.grounded) {
            this.setAnimation(this.vy < 0 ? "fall" : "jump");
        } else if (this.rolling) {
            this.setAnimation("roll");
        } else if (this.shielding) {
            this.setAnimation("shield");
        } else if (Math.abs(this.vx) > 0.5) {
            this.setAnimation("walk");
        } else {
            this.setAnimation("idle");
        }
    }
    setAnimation(newAnim) {
        if (this.animation !== newAnim) {
            this.animation = newAnim;
            this.frame = 0;
            this.frameTimer = 0;
            const animData = this.stats.animSheet ? this.stats.animSheet[newAnim] : null;
            if (animData && animData.speed) {
                this.animSpeed = animData.speed;
            } else if (this.stats.id === 'doge' && newAnim === 'idle') {
                this.animSpeed = 0.05;
            } else {
                this.animSpeed = 0.1;
            }
            if (this.stats.id === 'brokeboy') {
                console.log(`[ANIM] brokeboy -> ${newAnim} (speed=${this.animSpeed})`);
            }
        }
    }
    // Play an animation and prevent auto-state overrides for a short duration (in frames)
    playAnimation(animName, durationFrames) {
        this.setAnimation(animName);
        this.animOverride = animName;
        this.animOverrideTimer = Math.max(1, durationFrames | 0);
    }
    update() {
        if (this.stocks <= 0) return;
        this.ult = Math.min(100, this.ult + 0.05);
        if (this.shieldHP < 100 && !this.shielding) this.shieldHP += 0.5;
        if (this.alpha < 1) this.alpha += 0.001;
        if (this.friction > 0.85) this.friction -= 0.0005;
        if (this.confused > 0) this.confused--;
        if (this.luckyBlockCrush && this.grounded) {
            let t = players.find(p => p.id !== this.id && Math.abs(p.x - this.x) < 80 && Math.abs(p.y - this.y) < 100);
            if (t) {
                t.hit(0, -15, 50);
                this.luckyBlockCrush = false;
                if (Math.random() < 0.2) {
                    this.autoParryNext = true;
                }
            } else {
                this.luckyBlockCrush = false;
            }
        }
        if (this.gamblingFever) {
            this.gamblingFeverTimer--;
            if (this.gamblingFeverTimer <= 0) {
                this.gamblingFever = false;
            } else {
                if (this.gamblingFeverLastRoll <= 0) {
                    this.gamblingFeverLastRoll = Math.floor(Math.random() * 5) * 60 + 60;
                    const slot1 = Math.floor(Math.random() * 10);
                    const slot2 = Math.floor(Math.random() * 10);
                    const slot3 = Math.floor(Math.random() * 10);
                    if (slot1 === slot2 && slot2 === slot3 && [0, 1, 2, 3, 4, 5, 7, 8, 9].includes(slot1)) {
                        this.gamblingFeverActive = true;
                        this.gamblingFeverActiveTimer = 1200;
                        this.stats = { ...this.stats, speed: this.stats.speed * 1.5 };
                        this.alpha = 1;
                        this.inv = 1200;
                        setTimeout(() => {
                            if (this.gamblingFeverActive) {
                                this.stats = { ...this.stats, speed: this.stats.speed / 1.5 };
                                this.gamblingFeverActive = false;
                            }
                        }, 20000);
                        sfx.play('ult');
                    }
                } else {
                    this.gamblingFeverLastRoll--;
                }
            }
        }
        if (this.mrbeastBoost) {
            this.mrbeastTimer--;
            if (this.mrbeastTimer <= 0) {
                this.mrbeastBoost = false;
            }
        }
        this.updateAnimationState();
        if (this.isParrying) {
            if (this.parryTimer > 0) {
                this.parryTimer--;
                this.vx *= 0.1;
            } else {
                this.isParrying = !1;
            }
        }
        if (this.isBoss) {
            if (Math.random() < 0.01 && this.cd <= 0) {
                ultEffects.push({
                    t: 'moon',
                    x: players[0].x,
                    y: -500,
                    l: 50
                });
                this.cd = 60;
            }
            if (players[0].x > this.x + 100) this.vx += 0.5;
            else if (players[0].x < this.x - 100) this.vx -= 0.5;
            this.phys();
            if (this.cd > 0) this.cd--;
            return;
        }
        if (this.rolling) {
            this.rollTime--;
            this.vx = this.rollDir * 15;
            this.inv = 2;
            if (this.rollTime <= 0) {
                this.rolling = !1;
                this.vx = 0;
            }
            this.phys();
            return;
        }
        if (this.stun > 0) {
            this.stun--;
            this.shielding = !1;
            this.vx *= 0.8;
            this.phys();
            return;
        }
        let l = 0,
            r = 0,
            u = 0,
            d = 0,
            a = 0,
            j = 0,
            U = 0,
            S = 0;
        if (this.cpu) {
            let t = players.find(p => p.id !== this.id);
            if (isMemeBall && ball) {
                // Predict ball landing position
                let predictX = ball.x;
                let predictY = ball.y;
                let testVx = ball.vx;
                let testVy = ball.vy;

                // Simulate up to 60 frames ahead
                for (let i = 0; i < 60 && predictY < 200; i++) {
                    testVy += 0.4; // gravity
                    predictX += testVx;
                    predictY += testVy;
                    testVx *= 0.99;
                    testVy *= 0.99;

                    // Check for net collision
                    if (predictX > -50 && predictX < 40 && predictY > 0 && predictY < 200) {
                        testVx *= -0.8;
                        predictX = testVx > 0 ? 40 : -50;
                    }
                }

                // Determine which side CPU should stay on
                let mySide = this.id === 1 ? -1 : 1; // P1 on left, P2 on right
                let targetX = predictX;

                // If ball is on opponent's side and moving away, stay near net
                if ((mySide === -1 && ball.x > 0 && ball.vx > 0) ||
                    (mySide === 1 && ball.x < 0 && ball.vx < 0)) {
                    targetX = mySide * 100; // Stay near net but not too close
                }

                // If ball is coming toward my side, position at predicted landing
                else if ((mySide === -1 && ball.x <= 0) || (mySide === 1 && ball.x >= 0)) {
                    // Clamp to my side with margin
                    targetX = Math.max(mySide * 250, Math.min(mySide * 50, predictX));
                }

                // Move toward target position
                let moveThreshold = 30 + (10 - cpuLevel) * 5; // Higher level = more precise
                if (Math.abs(targetX - this.x) > moveThreshold) {
                    if (targetX > this.x) r = 1;
                    else l = 1;
                }

                // Jump to hit ball when it's near
                let distToBall = Math.sqrt((ball.x - this.x) ** 2 + (ball.y - this.y) ** 2);
                let ballApproaching = (mySide === -1 && ball.vx < 0) || (mySide === 1 && ball.vx > 0);

                // Jump heuristics: easier levels still jump for obvious descending balls
                if (distToBall < 170 && ball.y < 170 && this.grounded) {
                    let obviousHigh = ball.y < this.y - 40; // Ball noticeably above character
                    let descending = ball.vy > -2; // Not rising too fast
                    if (ballApproaching || cpuLevel <= 3 || (obviousHigh && descending)) {
                        j = 1;
                    }
                }

                // Attack when ball is in range
                let attackRange = 90 + cpuLevel * 6; // Slightly larger to ensure easy hits
                let canAttack = distToBall < attackRange && ball.y < this.y + 50 && ball.y > this.y - 100;
                if (canAttack) {
                    // Decide attack direction based on ball position
                    if (ball.y < this.y - 30) u = 1; // Up attack for high balls
                    else if (ball.y > this.y + 30) d = 1; // Down attack for low balls

                    // Directional attack based on where we want to hit
                    if (Math.abs(ball.x - this.x) < 100) {
                        // Close range - hit toward opponent's side
                        if (mySide === -1) r = 1; // Hit right
                        else l = 1; // Hit left
                    }

                    a = 1; // Trigger attack

                    // Miss chance scaled gently; very low levels still mostly succeed
                    if (cpuLevel <= 2 && Math.random() > 0.92) a = 0; // ~8% miss
                    else if (cpuLevel <= 4 && Math.random() > 0.95) a = 0; // ~5% miss
                }

                // Simple fallback swing for very easy levels when ball is close but canAttack false
                if (!canAttack && cpuLevel <= 3) {
                    if (distToBall < 140 && Math.abs(ball.x - this.x) < 120 && ball.y < this.y + 30) {
                        // Light adjust to center under ball
                        if (ball.x > this.x + 20) r = 1; else if (ball.x < this.x - 20) l = 1;
                        a = 1;
                        if (ball.y < this.y - 20) u = 1;
                    }
                }

                // Avoid drifting off net line unless not in attack situation
                if (!canAttack) {
                    let boundaryBuffer = 5;
                    if (mySide === -1 && this.x > -boundaryBuffer) l = 1;
                    if (mySide === 1 && this.x < boundaryBuffer) r = 1;
                }
            } else if (t) {
                let dx = t.x - this.x,
                    dy = t.y - this.y,
                    dist = Math.sqrt(dx * dx + dy * dy);
                if (this.y > 250 || Math.abs(this.x) > 700) {
                    if (this.x < 0) r = 1;
                    else l = 1;
                    if (this.jumps > 0 && this.vy > 0) j = 1;
                    if (this.jumps == 0) {
                        u = 1;
                        a = 1;
                    }
                } else {
                    if (Math.abs(dx) > 60) {
                        if (dx > 0) r = 1;
                        else l = 1;
                    }
                    if (dy < -100 && this.jumps > 0 && Math.random() < (cpuLevel * 0.02)) j = 1;
                    if (dist < 150 && Math.random() < (cpuLevel * 0.01)) {
                        a = 1;
                        if (dy > 50) d = 1;
                        else if (dy < -50) u = 1;
                        else if (Math.abs(dx) > 20) {
                            if (dx > 0) r = 1;
                            else l = 1;
                        }
                    }
                    if (cpuLevel > 6 && dist < 100 && t.box && t.box.act && Math.random() < 0.3) S = 1;
                    if (this.ult >= 100 && dist < 200 && cpuLevel > 5) U = 1;
                }
            }
        } else {
            if (this.id === 1) {
                const p1 = getControl('p1', 'left') || 'a';
                const p1r = getControl('p1', 'right') || 'd';
                const p1u = getControl('p1', 'up') || 'w';
                const p1d = getControl('p1', 'down') || 's';
                const p1a = getControl('p1', 'attack') || 'f';
                const p1ult = getControl('p1', 'ult') || 'q';
                const p1shield = getControl('p1', 'shield') || 'g';

                l = keys[p1] || touchInput.left;
                r = keys[p1r] || touchInput.right;
                u = keys[p1u] || touchInput.up;
                d = keys[p1d] || touchInput.down;
                a = keys[p1a] || touchInput.atk;
                j = keys[p1u] || touchInput.jump;
                U = keys[p1ult] || touchInput.ult;
                S = keys[p1shield] || touchInput.shield;
            } else {
                if (isOnline && isHost) {
                    // Use networked inputs for P2/P3/P4 on host
                    if (this.id === 2) {
                        l = netP2Inputs.l; r = netP2Inputs.r; u = netP2Inputs.u; d = netP2Inputs.d; a = netP2Inputs.a; j = netP2Inputs.j; U = netP2Inputs.U; S = netP2Inputs.S;
                    } else if (this.id === 3) {
                        l = netP3Inputs.l; r = netP3Inputs.r; u = netP3Inputs.u; d = netP3Inputs.d; a = netP3Inputs.a; j = netP3Inputs.j; U = netP3Inputs.U; S = netP3Inputs.S;
                    } else if (this.id === 4) {
                        l = netP4Inputs.l; r = netP4Inputs.r; u = netP4Inputs.u; d = netP4Inputs.d; a = netP4Inputs.a; j = netP4Inputs.j; U = netP4Inputs.U; S = netP4Inputs.S;
                    }
                } else {
                    const p2l = getControl('p2', 'left') || 'ArrowLeft';
                    const p2r = getControl('p2', 'right') || 'ArrowRight';
                    const p2u = getControl('p2', 'up') || 'ArrowUp';
                    const p2d = getControl('p2', 'down') || 'ArrowDown';
                    const p2a = getControl('p2', 'attack') || 'l';
                    const p2ult = getControl('p2', 'ult') || 'Shift';
                    const p2shield = getControl('p2', 'shield') || 'k';
                    l = keys[p2l]; r = keys[p2r]; u = keys[p2u]; d = keys[p2d]; a = keys[p2a]; j = keys[p2u]; U = keys[p2ult]; S = keys[p2shield];
                }
            }
        }
        if (this.confused > 0) {
            let temp = l;
            l = r;
            r = temp;
        }
        if (a && l) this.dir = !1;
        if (a && r) this.dir = !0;
        this.shielding = !1;
        if (S && !a && this.grounded && this.shieldHP > 0 && this.stun <= 0 && !isMemeBall) {
            this.shielding = !0;
            this.vx *= 0.5;
            this.shieldHP -= 0.5;
            if (l || r) {
                this.rolling = !0;
                this.rollDir = l ? -1 : 1;
                this.rollTime = 15;
                this.shielding = !1;
                this.inv = 15;
                sfx.play('roll');
                return;
            }
            if (this.shieldHP <= 0) {
                sfx.play('break');
                this.shielding = !1;
                this.stun = 180;
                this.vy = -10;
            }
        }
        if (U && this.ult >= 100 && !isMemeBall) this.fireUlt();
        const sp = 1.5 * this.stats.speed;
        if (!this.shielding && !this.isParrying) {
            if (l) {
                this.vx -= sp;
                this.dir = !1;
            }
            if (r) {
                this.vx += sp;
                this.dir = !0;
            }
        }
        this.vx *= this.friction;
        if (j && !this.pj && this.jumps > 0 && !this.shielding && !this.isParrying) {
            this.vy = -14 * this.stats.jump;
            this.jumps--;
            sfx.play('jump');
        }
        this.pj = j;
        if (this.cd > 0) this.cd--;
        else if (a && !this.shielding && !this.isParrying) this.atk(u, d, l, r);
        this.phys();
        if (this.inv > 0) this.inv--;
        this.chkItm();
        if (this.box && this.box.act) {
            this.box.f--;
            if (this.box.f <= 0) this.box.act = !1;
        }
    }
    fireUlt() {
        if (this.ult < 100) return; // Safety check
        this.ult = 0;
        this.cd = 30; // Add cooldown to prevent rapid re-fire
        sfx.play('ult');
        shake = 30;
        updateHUD();
        let t = players.find(p => p.id !== this.id);
        if (!t) return;

        // Debug: log which character is firing ult
        console.log(`Player ${this.id} (${this.stats.id}) firing ult`);

        if (this.stats.id === 'doge') ultEffects.push({
            t: 'moon',
            x: t.x,
            y: -500,
            l: 50
        });
        else if (this.stats.id === 'frog') {
            for (let i = 0; i < 20; i++) ultEffects.push({
                t: 'tear',
                x: Math.random() * 2000 - 1000,
                y: -200 - Math.random() * 500,
                l: 100
            });
        } else if (this.stats.id === 'sanic') {
            this.x = t.x;
            this.y = t.y;
            t.hit(0, -15, 30);
            this.inv = 60;
        } else if (this.stats.id === 'chad') {
            t.stun = 180;
            t.vx = 0;
            t.vy = 0;
        } else if (this.stats.id === '67kid') {
            t.vx = -t.vx;
            t.vy = -t.vy;
            t.stun = 60;
        } else if (this.stats.id === 'amogus') {
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            t.hit(0, 0, 50);
        } else if (this.stats.id === 'thememe') {
            t.hit(0, -50, 999);
        } else if (this.stats.id === 'gps') {
            worldFlipped = !0;
            flipTimer = 600;
        } else if (this.stats.id === 'sahur') {
            t.stun = 180;
        } else if (this.stats.id === 'primo') {
            ultEffects.push({
                t: 'primo',
                owner: this.id,
                x: this.x,
                y: this.y - 50,
                vx: (this.dir ? 1 : -1) * 15,
                l: 100
            });
        } else if (this.stats.id === 'ocralito') {
            t.stun = 120;
        } else if (this.stats.id === 'mechabara') {
            ultEffects.push({
                t: 'moon',
                x: t.x,
                y: -500,
                l: 50
            });
        } else if (this.stats.id === 'bluedude') {
            this.box = {
                relX: this.dir ? 50 : -150,
                relY: -25,
                w: 100,
                h: 100,
                act: !0,
                own: this.id,
                kbx: 25,
                kby: -20,
                dmg: 35,
                f: 10
            };
        } else if (this.stats.id === 'johnpork') {
            ultEffects.push({
                t: 'pork',
                x: t.x,
                y: -600,
                l: 120
            });
        } else if (this.stats.id === 'luckyblock') {
            this.gamblingFever = true;
            this.gamblingFeverTimer = 1200;
            this.gamblingFeverLastRoll = 0;
            sfx.play('ult');
        } else if (this.stats.id === 'brokeboy') {
            this.mrbeastBoost = true;
            this.mrbeastTimer = 600;
            this.stats = { ...this.stats, speed: this.stats.speed * 1.3, power: this.stats.power * 1.2 };
            this.weight *= 1.5;
            this.alpha = 1;
            this.inv = 600;
            // Play ult animation for a short duration
            this.playAnimation('ult', 40);
            setTimeout(() => {
                if (this.mrbeastBoost) {
                    this.stats = { ...this.stats, speed: this.stats.speed / 1.3, power: this.stats.power / 1.2 };
                    this.weight /= 1.5;
                    this.mrbeastBoost = false;
                }
            }, 10000);
            sfx.play('ult');
        } else if (this.stats.id === 'jack') {
            // Everything Everywhere All At Once: Fire ALL ults!
            console.log('Jack ult: EVERYTHING EVERYWHERE ALL AT ONCE!');
            shake = 60;
            // Make Jack invincible during ult to prevent self-damage
            this.inv = 240; // 4 seconds of invincibility
            // Play Vivaldi Four Seasons Winter
            audioFiles.play('VIVALDI');

            // Fire every ult effect with extended delays for longer sequence
            setTimeout(() => ultEffects.push({ t: 'moon', x: t.x, y: -500, l: 50 }), 200); // Doge
            setTimeout(() => {
                for (let i = 0; i < 20; i++) ultEffects.push({
                    t: 'tear',
                    x: Math.random() * 1400 - 700,
                    y: -200 - Math.random() * 400,
                    l: 90
                });
            }, 400); // Frog
            setTimeout(() => { if (t && t.stocks > 0) { this.x = t.x; this.y = t.y; t.hit(0, -15, 30); } }, 600); // Sanic
            setTimeout(() => ultEffects.push({ t: 'fire', owner: this.id, x: this.x, y: this.y, vx: 0, vy: 0, l: 70 }), 800); // Chad
            setTimeout(() => { if (t) t.confused = 300; }, 1000); // Gps
            setTimeout(() => ultEffects.push({ t: 'sword', owner: this.id, x: this.x, y: this.y - 20, l: 100 }), 1200); // Sahur
            setTimeout(() => ultEffects.push({ t: 'primo', owner: this.id, x: this.x, y: this.y - 50, vx: (this.dir ? 1 : -1) * 15, l: 110 }), 1400); // Primo
            setTimeout(() => { if (t) t.stun = 180; }, 1600); // Ocralito/others
            setTimeout(() => ultEffects.push({ t: 'pork', x: t.x, y: -600, l: 130 }), 1800); // Johnpork
            setTimeout(() => {
                // Bluedude punch
                this.box = {
                    relX: this.dir ? 50 : -150,
                    relY: -25,
                    w: 120,
                    h: 120,
                    act: !0,
                    own: this.id,
                    kbx: 35,
                    kby: -28,
                    dmg: 50,
                    f: 10
                };
            }, 2000);
            // Giant combined FINALE - ONE SHOT KILL
            setTimeout(() => {
                shake = 100;
                const count = window.EFFECTS_LOW ? 20 : 50;
                for (let i = 0; i < count; i++) {
                    particles.push({
                        x: this.x + this.w / 2,
                        y: this.y + this.h / 2,
                        vx: (Math.random() - 0.5) * 25,
                        vy: (Math.random() - 0.5) * 25,
                        size: 15,
                        life: 100,
                        color: ['#FFD700', '#FF4500', '#8B00FF', '#00CED1', '#FF1493', '#FFFFFF'][Math.floor(Math.random() * 6)]
                    });
                }
                // ONE SHOT: Deal 999 damage to guarantee kill
                if (t && t.stocks > 0) {
                    t.pct = 999;
                    t.hit(35 * (this.x < t.x ? 1 : -1), -40, 999);
                }
                // Stop Vivaldi after ult completes
                audioFiles.stop('VIVALDI');
            }, 2400);
            sfx.play('ult');
        } else t.hit(20 * (this.x < t.x ? 1 : -1), -20, 40);
    }
    atk(u, d, l, r) {
        this.cd = 30;
        sfx.play('hit');
        let ox = this.dir ? 50 : -60,
            dmg = 10,
            kbx = 10,
            kby = -10;
        const s = this.stats;
        if (this.hasLandmine) {
            this.hasLandmine = !1;
            let trap = new Item('landmine');
            trap.x = this.x;
            trap.y = this.y;
            trap.active = !0;
            trap.placed = !0;
            items.push(trap);
            return;
        }
        if (this.hasHammer) {
            this.hasHammer = !1;
            this.cd = 45;
            this.box = {
                relX: this.dir ? 0 : -40,
                relY: -20,
                w: 90,
                h: 70,
                act: !0,
                own: this.id,
                kbx: 25,
                kby: -15,
                dmg: 25,
                f: 5
            };
            return;
        }
        if (s.id === '67kid') {
            if (u) {
                this.pct += 67;
                this.stun = 60;
                return;
            }
            if (d) {
                this.vy = -20;
                setTimeout(() => this.vy = 25, 200);
                this.box = {
                    relX: -40,
                    relY: 20,
                    w: 130,
                    h: 40,
                    act: !0,
                    own: this.id,
                    kbx: 12 * s.power,
                    kby: 15 * s.power,
                    dmg: 10 * s.power,
                    f: 8
                };
                return;
            }
        } else if (s.id === 'amogus') {
            if (l || r) {
                this.x += (this.dir ? 100 : -100);
                return;
            }
            if (u) {
                this.vy = -20;
                ultEffects.push({
                    t: 'tear',
                    x: this.x,
                    y: this.y + 20,
                    l: 10
                });
                return;
            }
        } else if (s.id === 'gps') {
            if (d) {
                let t = players.find(p => p.id !== this.id);
                if (t) t.confused = 300;
                sfx.play('break');
                return;
            }
            if (u) {
                this.y -= 200;
                this.vy = 0;
                return;
            }
            if (l || r) {
                this.x += (this.dir ? 150 : -150);
                this.box = {
                    relX: -20,
                    relY: 0,
                    w: 40,
                    h: 50,
                    act: !0,
                    own: this.id,
                    kbx: 10,
                    kby: -10,
                    dmg: 5,
                    f: 10
                };
                return;
            }
        } else if (s.id === 'sahur') {
            if (d) {
                this.vy = 10;
                this.box = {
                    relX: -75,
                    relY: 20,
                    w: 200,
                    h: 40,
                    act: !0,
                    own: this.id,
                    kbx: 15 * s.power,
                    kby: -15 * s.power,
                    dmg: 20 * s.power,
                    f: 10
                };
                sfx.play('break');
                this.cd = 60;
                return;
            }
            if (u) {
                this.vy = -10 * s.jump;
                this.box = {
                    relX: -25,
                    relY: 50,
                    w: 100,
                    h: 40,
                    act: !0,
                    own: this.id,
                    kbx: 5 * s.power,
                    kby: 20 * s.power,
                    dmg: 12 * s.power,
                    f: 5
                };
                sfx.play('hit');
                return;
            }
            if (l || r) {
                this.vx = (this.dir ? 1 : -1) * 10;
                this.box = {
                    relX: this.dir ? 40 : -90,
                    relY: -10,
                    w: 50,
                    h: 70,
                    act: !0,
                    own: this.id,
                    kbx: 20 * s.power,
                    kby: -10 * s.power,
                    dmg: 15 * s.power,
                    f: 8
                };
                this.cd = 45;
                return;
            }
        } else if (s.id === 'primo') {
            if (d) {
                this.box = {
                    relX: this.dir ? 0 : -100,
                    relY: 0,
                    w: 100,
                    h: 60,
                    act: !0,
                    own: this.id,
                    kbx: 12 * s.power,
                    kby: -10 * s.power,
                    dmg: 14 * s.power,
                    f: 10
                };
                this.cd = 40;
                return;
            }
            if (u) {
                this.vy = -12;
                this.vx = (this.dir ? 1 : -1) * 8;
                this.box = {
                    relX: -25,
                    relY: 0,
                    w: 100,
                    h: 50,
                    act: !0,
                    own: this.id,
                    kbx: 10 * s.power,
                    kby: -15 * s.power,
                    dmg: 12 * s.power,
                    f: 15
                };
                this.cd = 50;
                return;
            }
            if (l || r) {
                this.vx = (this.dir ? 1 : -1) * 15;
                this.box = {
                    relX: this.dir ? 40 : -80,
                    relY: 0,
                    w: 40,
                    h: 50,
                    act: !0,
                    own: this.id,
                    kbx: 18 * s.power,
                    kby: -8 * s.power,
                    dmg: 12 * s.power,
                    f: 8
                };
                this.cd = 40;
                return;
            }
        } else if (s.id === 'ocralito') {
            if (d) {
                this.box = {
                    relX: -50,
                    relY: 40,
                    w: 150,
                    h: 20,
                    act: !0,
                    own: this.id,
                    kbx: 10 * s.power,
                    kby: -10 * s.power,
                    dmg: 14 * s.power,
                    f: 5
                };
                this.vy = 10;
                this.cd = 40;
                return;
            }
            if (u) {
                this.vy = -15 * s.jump;
                this.box = {
                    relX: -25,
                    relY: -20,
                    w: 100,
                    h: 40,
                    act: !0,
                    own: this.id,
                    kbx: 5 * s.power,
                    kby: -15 * s.power,
                    dmg: 10 * s.power,
                    f: 8
                };
                this.cd = 45;
                return;
            }
            if (l || r) {
                this.vx = (this.dir ? 1 : -1) * 12;
                this.box = {
                    relX: this.dir ? 40 : -70,
                    relY: 20,
                    w: 30,
                    h: 30,
                    act: !0,
                    own: this.id,
                    kbx: 15 * s.power,
                    kby: -5 * s.power,
                    dmg: 8 * s.power,
                    f: 12
                };
                this.friction = 0.98;
                this.cd = 50;
                return;
            }
        } else if (s.id === 'mechabara') {
            if (d) {
                this.box = {
                    relX: -25,
                    relY: 50,
                    w: 100,
                    h: 20,
                    act: !0,
                    own: this.id,
                    kbx: 10 * s.power,
                    kby: 15 * s.power,
                    dmg: 16 * s.power,
                    f: 5
                };
                this.vy = 5;
                this.cd = 45;
                return;
            }
            if (u) {
                this.vy = -18 * s.jump;
                this.box = {
                    relX: -25,
                    relY: 0,
                    w: 100,
                    h: 50,
                    act: !0,
                    own: this.id,
                    kbx: 5 * s.power,
                    kby: -15 * s.power,
                    dmg: 10 * s.power,
                    f: 12
                };
                this.cd = 50;
                return;
            }
            if (l || r) {
                this.vx = (this.dir ? 1 : -1) * 10;
                this.box = {
                    relX: this.dir ? 40 : -80,
                    relY: 0,
                    w: 40,
                    h: 50,
                    act: !0,
                    own: this.id,
                    kbx: 16 * s.power,
                    kby: -5 * s.power,
                    dmg: 7 * s.power,
                    f: 15
                };
                this.cd = 50;
                return;
            }
        } else if (s.id === 'bluedude') {
            if (d) {
                this.isParrying = !0;
                this.parryTimer = 15;
                this.cd = 30;
                return;
            }
            if (u) {
                this.setAnimation("attack_up");
                this.vy = -16 * s.jump;
                this.box = {
                    relX: -25,
                    relY: -50,
                    w: 100,
                    h: 100,
                    act: !0,
                    own: this.id,
                    kbx: 8 * s.power,
                    kby: -18 * s.power,
                    dmg: 12 * s.power,
                    f: 8
                };
                this.cd = 50;
                return;
            }
            if (l || r) {
                this.setAnimation("attack_side");
                this.vx = (this.dir ? 1 : -1) * 12;
                this.box = {
                    relX: this.dir ? 50 : -90,
                    relY: 10,
                    w: 40,
                    h: 30,
                    act: !0,
                    own: this.id,
                    kbx: 14 * s.power,
                    kby: -5 * s.power,
                    dmg: 9 * s.power,
                    f: 6
                };
                this.cd = 40;
                return;
            }
        } else if (s.id === 'johnpork') {
            let t = players.find(p => p.id !== this.id);
            if (d) {
                if (t) t.hit(0, 0, 10);
                showNotification("CALL DECLINED", "Dealt 10 damage");
                this.cd = 60;
                return;
            }
            if (u) {
                const boosts = ['speed', 'power', 'jump'];
                const boost = boosts[Math.floor(Math.random() * boosts.length)];
                if (boost === 'speed') this.stats.speed *= 1.5;
                if (boost === 'power') this.stats.power *= 1.5;
                if (boost === 'jump') this.stats.jump *= 1.5;
                showNotification("CALL ACCEPTED", `+${boost.toUpperCase()} for 5s`);
                setTimeout(() => {
                    if (boost === 'speed') this.stats.speed /= 1.5;
                    if (boost === 'power') this.stats.power /= 1.5;
                    if (boost === 'jump') this.stats.jump /= 1.5;
                }, 5000);
                this.cd = 120;
                return;
            }
            if (l || r) {
                if (t) t.stun = 120;
                showNotification("RING RING", "Enemy Stunned!");
                this.cd = 180;
                return;
            }
        } else if (s.id === 'luckyblock') {
            // Mastery Lucky Block: buffed moves + replaced down move (Jackpot)
            if (l || r) {
                if (Math.random() < 0.5) {
                    let t = players.find(p => p.id !== this.id);
                    if (t) {
                        for (let i = 0; i < 5; i++) {
                            setTimeout(() => {
                                if (t && t.stocks > 0) {
                                    let kbm = (this.masteryActive ? 1.2 : 1);
                                    let dmgm = (this.masteryActive ? 1.2 : 1);
                                    t.hit((this.dir ? 1 : -1) * 8 * kbm, -5 * kbm, 100 * dmgm);
                                }
                            }, i * 100);
                        }
                        sfx.play('ult');
                    }
                } else {
                    sfx.play('break');
                }
                this.cd = this.masteryActive ? 50 : 60;
                return;
            }
            if (u) {
                let t = players.find(p => p.id !== this.id);
                if (t) {
                    let coin = new Item('coin');
                    coin.x = this.x;
                    coin.y = this.y - 30;
                    items.push(coin);
                    setTimeout(() => {
                        if (t && t.stocks > 0) {
                            let kbm = (this.masteryActive ? 1.2 : 1);
                            let dmgm = (this.masteryActive ? 1.5 : 1);
                            t.hit((this.x < t.x ? 1 : -1) * 5 * kbm, -8 * kbm, 10 * dmgm);
                        }
                    }, 300);
                }
                this.cd = this.masteryActive ? 40 : 50;
                return;
            }
            if (d) {
                if (this.masteryActive) {
                    // Replaced move: Jackpot Block
                    // Large sweeping hitbox with big knockback and a chance for a bonus effect
                    this.playAnimation("attack_down", 16);
                    this.box = {
                        relX: -60,
                        relY: -30,
                        w: 170,
                        h: 80,
                        act: !0,
                        own: this.id,
                        kbx: 22 * s.power,
                        kby: -25 * s.power,
                        dmg: 30 * s.power,
                        f: 10
                    };
                    // 30% chance to rain an extra coin hit shortly after
                    if (Math.random() < 0.3) {
                        setTimeout(() => {
                            let t = players.find(p => p.id !== this.id);
                            if (t && t.stocks > 0) {
                                t.hit((this.x < t.x ? 1 : -1) * 6, -10, 12);
                            }
                            let coin = new Item('coin');
                            coin.x = this.x + (this.dir ? 40 : -40);
                            coin.y = this.y - 40;
                            items.push(coin);
                        }, 200);
                    }
                    this.cd = 70;
                } else {
                    this.vy = -15;
                    this.cd = 80;
                    this.luckyBlockCrush = true;
                }
                return;
            }
        } else if (s.id === 'brokeboy') {
            if (l || r) {
                // Side attack: beg/boost chance; play side animation briefly
                this.playAnimation("attack_side", 18);
                if (Math.random() < 0.1) {
                    const boosts = ['speed', 'power', 'regen', 'knockback'];
                    const boost = boosts[Math.floor(Math.random() * boosts.length)];
                    if (boost === 'speed') {
                        this.stats = { ...this.stats, speed: this.stats.speed * 1.3 };
                        setTimeout(() => {
                            this.stats = { ...this.stats, speed: this.stats.speed / 1.3 };
                        }, 10000);
                    } else if (boost === 'power') {
                        this.stats = { ...this.stats, power: this.stats.power * 1.3 };
                        setTimeout(() => {
                            this.stats = { ...this.stats, power: this.stats.power / 1.3 };
                        }, 10000);
                    } else if (boost === 'regen') {
                        this.alpha = 1;
                        this.inv = 600;
                    } else if (boost === 'knockback') {
                        this.weight *= 1.5;
                        setTimeout(() => {
                            this.weight /= 1.5;
                        }, 10000);
                    }
                    sfx.play('ult');
                } else {
                    sfx.play('break');
                }
                this.cd = 60;
                return;
            }
            if (u) {
                // Up attack: use custom up-attack animation and lock for a bit
                this.playAnimation("attack_up", 20);
                if (Math.random() < 0.1) {
                    let t = players.find(p => p.id !== this.id);
                    if (t) {
                        t.stats = { ...t.stats, speed: t.stats.speed * 1.2, power: t.stats.power * 1.2 };
                        t.stun = 120;
                        t.hit(0, -5, 10);
                        setTimeout(() => {
                            if (t) {
                                t.stats = { ...t.stats, speed: t.stats.speed / 1.2, power: t.stats.power / 1.2 };
                            }
                        }, 2000);
                        sfx.play('ult');
                    }
                } else {
                    sfx.play('break');
                }
                this.cd = 50;
                return;
            }
            if (d) {
                if (Math.random() < 0.5) {
                    // Down special: Broken Sword parry uses shield animation
                    this.setAnimation("shield");
                    this.isParrying = !0;
                    this.parryTimer = 20;
                    this.cd = 30;
                    sfx.play('shield');
                } else {
                    sfx.play('break');
                    this.cd = 40;
                }
                return;
            }
        } else if (s.id === 'glitch') {
            if (l || r) {
                // Pixel Shift: 70% normal dash, 30% opposite direction
                if (Math.random() < 0.7) {
                    this.vx = (this.dir ? 1 : -1) * 12;
                    this.box = {
                        relX: this.dir ? 40 : -80,
                        relY: 0,
                        w: 40,
                        h: 50,
                        act: !0,
                        own: this.id,
                        kbx: 10 * s.power,
                        kby: -8 * s.power,
                        dmg: 10 * s.power,
                        f: 8
                    };
                } else {
                    // Glitch: dash opposite direction
                    this.vx = (this.dir ? -1 : 1) * 12;
                    this.box = {
                        relX: this.dir ? -80 : 40,
                        relY: 0,
                        w: 40,
                        h: 50,
                        act: !0,
                        own: this.id,
                        kbx: 15 * s.power,
                        kby: -10 * s.power,
                        dmg: 20 * s.power,
                        f: 8
                    };
                    sfx.play('ult');
                }
                this.cd = 40;
                return;
            }
            if (u) {
                // Data Corruption: Random teleport + 10% position swap
                let oldX = this.x;
                let oldY = this.y;
                this.y -= 150 + Math.random() * 100;
                this.vy = 0;
                this.box = {
                    relX: -40,
                    relY: oldY - this.y,
                    w: 80,
                    h: 60,
                    act: !0,
                    own: this.id,
                    kbx: 8 * s.power,
                    kby: -12 * s.power,
                    dmg: 12 * s.power,
                    f: 10
                };
                if (Math.random() < 0.1) {
                    let t = players.find(p => p.id !== this.id);
                    if (t) {
                        let tx = t.x;
                        let ty = t.y;
                        t.x = oldX;
                        t.y = oldY;
                        this.x = tx;
                        this.y = ty;
                        sfx.play('ult');
                    }
                }
                this.cd = 50;
                return;
            }
            if (d) {
                // Reality Break: 50% stun opponent 60f OR stun self 30f
                if (Math.random() < 0.5) {
                    let t = players.find(p => p.id !== this.id);
                    if (t) {
                        t.stun = 60;
                        t.hit(0, -8, 15);
                        sfx.play('hit');
                    }
                } else {
                    this.stun = 30;
                    sfx.play('break');
                }
                this.cd = 60;
                return;
            }
        } else if (s.id === 'jack') {
            if (l || r) {
                // Master Of None: Rush attack + stat comparison buff + projectile
                let t = players.find(p => p.id !== this.id);
                this.vx = (this.dir ? 1 : -1) * 15;
                this.box = {
                    relX: this.dir ? 40 : -80,
                    relY: 0,
                    w: 60,
                    h: 50,
                    act: !0,
                    own: this.id,
                    kbx: 12 * s.power,
                    kby: -8 * s.power,
                    dmg: 15 * s.power,
                    f: 10
                };
                // Get 0.5 better stats than opponent temporarily
                if (t && !this.jackStatBoost) {
                    this.jackStatBoost = true;
                    const oldSpeed = this.stats.speed;
                    const oldPower = this.stats.power;
                    const oldJump = this.stats.jump;
                    this.stats.speed = Math.max(this.stats.speed, t.stats.speed + 0.5);
                    this.stats.power = Math.max(this.stats.power, t.stats.power + 0.5);
                    this.stats.jump = Math.max(this.stats.jump, t.stats.jump + 0.5);
                    setTimeout(() => {
                        if (this.stats) {
                            this.stats.speed = oldSpeed;
                            this.stats.power = oldPower;
                            this.stats.jump = oldJump;
                            this.jackStatBoost = false;
                        }
                    }, 180);
                }
                // Throw projectile
                setTimeout(() => {
                    ultEffects.push({
                        t: 'tear',
                        x: this.x + (this.dir ? 30 : -30),
                        y: this.y,
                        l: 30
                    });
                }, 100);
                this.cd = 60;
                return;
            }
            if (d) {
                // Parry Combo: Hybrid of BlueDude and BrokeBoy parry with 50% buff chance
                this.isParrying = !0;
                this.parryTimer = 15;
                this.jackParryBonus = Math.random() < 0.5; // 50% chance for buff
                if (this.jackParryBonus) {
                    // Visual feedback for bonus
                    for (let i = 0; i < 5; i++) {
                        particles.push({
                            x: this.x + this.w / 2,
                            y: this.y + this.h / 2,
                            vx: (Math.random() - 0.5) * 8,
                            vy: (Math.random() - 0.5) * 8,
                            size: 6,
                            life: 30,
                            color: '#FFD700'
                        });
                    }
                }
                this.cd = 35;
                return;
            }
            if (u) {
                // Rising Mastery: Stat buff + low damage attack
                this.vy = -18 * s.jump;
                this.box = {
                    relX: -30,
                    relY: -20,
                    w: 60,
                    h: 70,
                    act: !0,
                    own: this.id,
                    kbx: 3 * s.power,
                    kby: -5 * s.power,
                    dmg: 5 * s.power,
                    f: 12
                };
                // Temporary stat boost
                if (!this.jackRisingBoost) {
                    this.jackRisingBoost = true;
                    const oldStats = { speed: this.stats.speed, power: this.stats.power, jump: this.stats.jump };
                    this.stats.speed += 0.3;
                    this.stats.power += 0.3;
                    this.stats.jump += 0.3;
                    setTimeout(() => {
                        if (this.stats) {
                            this.stats.speed = oldStats.speed;
                            this.stats.power = oldStats.power;
                            this.stats.jump = oldStats.jump;
                            this.jackRisingBoost = false;
                        }
                    }, 240);
                }
                this.cd = 50;
                return;
            }
        }
        if (!u && !d && !l && !r) {
            this.box = {
                relX: -30,
                relY: 0,
                w: 110,
                h: 50,
                act: !0,
                own: this.id,
                kbx: 10 * s.power,
                kby: -8 * s.power,
                dmg: 8 * s.power,
                f: 5
            };
            return;
        }
        if (d) {
            this.box = {
                relX: -40,
                relY: 20,
                w: 130,
                h: 40,
                act: !0,
                own: this.id,
                kbx: 12 * s.power,
                kby: 5 * s.power,
                dmg: 10 * s.power,
                f: 8
            };
            return;
        }
        if (u) {
            this.vy = -12 * s.jump;
            this.box = {
                relX: -20,
                relY: -50,
                w: 90,
                h: 60,
                act: !0,
                own: this.id,
                kbx: 5 * s.power,
                kby: -15 * s.power,
                dmg: 10 * s.power,
                f: 5
            };
            return;
        }
        if (l || r) {
            this.vx = (this.dir ? 1 : -1) * 5;
            dmg = 12;
            kbx = 15;
            this.box = {
                relX: ox,
                relY: 0,
                w: 60,
                h: 50,
                act: !0,
                own: this.id,
                kbx: kbx * s.power,
                kby: kby * s.power,
                dmg: dmg * s.power,
                f: 5
            };
            return;
        }
    }
    hit(kbx, kby, d) {
        if (this.autoParryNext && Math.random() < 0.2) {
            let attacker = players.find(p => p.box && p.box.act && p.id !== this.id);
            if (attacker) {
                attacker.stun = 120;
            }
            this.autoParryNext = false;
            sfx.play('shield');
            this.box = {
                relX: -25,
                relY: -25,
                w: 100,
                h: 100,
                act: !0,
                own: this.id,
                kbx: 20,
                kby: -20,
                dmg: 25,
                f: 5
            };
            return;
        }
        if (this.isParrying && this.parryTimer > 0) {
            let attacker = players.find(p => p.box && p.box.act && p.id !== this.id);
            if (attacker) {
                attacker.stun = 120;
                // Jack's Parry Combo bonus: 50% chance for permanent stat buff
                if (this.stats.id === 'jack' && this.jackParryBonus) {
                    const statChoices = ['speed', 'power', 'jump'];
                    const buffStat = statChoices[Math.floor(Math.random() * 3)];
                    this.stats[buffStat] += 0.5;
                    console.log(`Jack parry buff! +0.5 ${buffStat}`);
                    // Visual effect
                    for (let i = 0; i < 10; i++) {
                        particles.push({
                            x: this.x + this.w / 2,
                            y: this.y + this.h / 2,
                            vx: (Math.random() - 0.5) * 12,
                            vy: (Math.random() - 0.5) * 12,
                            size: 8,
                            life: 40,
                            color: '#FFD700'
                        });
                    }
                }
            }
            this.parryTimer = 0;
            this.isParrying = !1;
            sfx.play('shield');
            this.box = {
                relX: -25,
                relY: -25,
                w: 100,
                h: 100,
                act: !0,
                own: this.id,
                kbx: 20,
                kby: -20,
                dmg: 25,
                f: 5
            };
            return;
        }
        if (this.inv > 0 || (this.rolling && this.inv > 0)) return;
        if (this.gamblingFeverActive && Math.random() < 0.1) {
            d *= 1.5;
        }
        if (this.shielding) {
            this.shieldHP -= d * 2;
            sfx.play('shield');
            this.vx = kbx * 0.5;
            if (this.shieldHP <= 0) {
                sfx.play('break');
                this.shielding = !1;
                this.stun = 180;
                this.vy = -15;
            }
            return;
        }
        shake = Math.min(10, d * 0.5);
        particles.push({
            x: this.x + this.w / 2,
            y: this.y,
            text: `+${Math.floor(d)}%`,
            life: 60,
            vy: -2
        });
        {
            const sparks = window.EFFECTS_LOW ? 2 : 5;
            for (let i = 0; i < sparks; i++) {
                particles.push({
                    x: this.x + this.w / 2,
                    y: this.y + this.h / 2,
                    vx: (Math.random() - 0.5) * 5 + kbx * 0.1,
                    vy: (Math.random() - 0.5) * 5 + kby * 0.1,
                    size: Math.random() * 5 + 2,
                    life: 30,
                    color: 'white'
                });
            }
        }
        this.pct += d;
        this.ult = Math.min(100, this.ult + d);
        let sc = 0.5 + (this.pct * 0.025),
            wm = 1.0 / this.stats.weight;
        if (kbx !== 0) {
            let o = players.find(p => p.id !== this.id);
            this.vx = (this.x < (o ? o.x : 0) ? -1 : 1) * Math.abs(kbx * sc * wm);
        } else this.vx = (Math.random() - 0.5) * Math.abs(kbx * sc * wm);
        this.vy = kby * sc * wm;
        this.inv = 10;
        sfx.play(d > 15 ? 'hit' : 'hit');
        hitStop = 5;
        updateHUD();
    }
    phys() {
        let gv = 0.6;
        if (worldFlipped) gv = -0.6;
        if (!this.isParrying) {
            this.vy += gv;
            if (!worldFlipped && this.vy > 25) this.vy = 25;
            if (worldFlipped && this.vy < -25) this.vy = -25;
            this.x += this.vx;
            this.y += this.vy;
            this.grounded = !1;
        }
        if (isMemeBall) {
            if (this.id === 1) {
                this.x = Math.min(this.x, -10 - this.w);
            }
            if (this.id === 2) {
                this.x = Math.max(this.x, 10);
            }
        }
        for (let p of platforms) {
            if (p.t === 'lava') {
                if (this.y > p.y && this.y < p.y + p.h && this.x > p.x && this.x < p.x + p.w) {
                    this.hit(0, -20, 15);
                    this.y = p.y - 50;
                }
                continue;
            }
            if (p.t.startsWith('machine')) {
                let dx = (this.x + this.w / 2) - p.pivotX;
                let pStart = p.x;
                let pEnd = p.x + p.w;
                let pCenterX = this.x + this.w / 2;
                if (pCenterX >= pStart && pCenterX <= pEnd) {
                    let floorY = p.pivotY + (pCenterX - p.pivotX) * Math.tan(p.angle);
                    if (this.vy >= 0 && this.y + this.h >= floorY - 15 && this.y + this.h <= floorY + 15) {
                        this.y = floorY - this.h;
                        this.vy = 0;
                        this.grounded = !0;
                        this.jumps = 2;
                    }
                }
                continue;
            }
            let pt = p.y,
                ft = this.y + this.h;
            if (this.vy >= 0 && ft >= pt && ft <= pt + Math.max(25, this.vy + 10) && this.x + this.w > p.x && this.x < p.x + p.w) {
                this.y = p.y - this.h;
                this.vy = 0;
                this.grounded = !0;
                this.jumps = 2;
                if (p.vx) this.x += p.vx;
                if (p.vy) this.y += p.vy;
            }
            if (p.t === 'solid' && this.vy < 0 && this.x + this.w > p.x && this.x < p.x + p.w && this.y < p.y + p.h && ft > p.y + p.h) {
                this.y = p.y + p.h;
                this.vy = 0;
            }
        }
        if (this.y > 800 || this.y < -800) this.die();
    }
    die() {
        sfx.play('ko');
        this.stocks--;
        this.pct = 0;
        this.ult = 0;
        const deathBurst = window.EFFECTS_LOW ? 8 : 20;
        for (let i = 0; i < deathBurst; i++) {
            particles.push({
                x: this.x + this.w / 2,
                y: this.y + this.h / 2,
                vx: (Math.random() - 0.5) * 15,
                vy: (Math.random() - 0.5) * 15 - 5,
                size: Math.random() * 8 + 3,
                life: 60,
                color: 'var(--ult)'
            });
        }
        if (this.stocks > 0) {
            this.x = 0;
            this.y = -200;
            this.vx = 0;
            this.vy = 0;
            shake = 20;
        }
        if (isSurvival) {
            let humanPlayers = players.filter(p => !p.cpu);
            let livingHumans = humanPlayers.filter(p => p.stocks > 0);
            if (livingHumans.length === 0 && gameState === 'GAME') {
                endGame(1);
            }
        } else if (this.stocks <= 0) {
            // Jack Of All Trades passive: Killer gains stats when Jack dies
            const killer = players.find(p => p.id !== this.id && p.stocks > 0);
            if (killer && killer.stats.id === 'jack') {
                if (!killer.jackKills) killer.jackKills = 0;
                if (!killer.jackBuffs) killer.jackBuffs = { speed: 0, power: 0, jump: 0 };
                killer.jackKills++;
                // Random stat gets +3
                const statChoices = ['speed', 'power', 'jump'];
                const buffStat = statChoices[Math.floor(Math.random() * 3)];
                killer.jackBuffs[buffStat] += 3;
                killer.stats[buffStat] += 3;
                killer.stats.weight += 0.1; // Weight increases each kill
                console.log(`Jack gained +3 ${buffStat}, weight now ${killer.stats.weight.toFixed(1)}`);
            }
            if (gameState === 'GAME') endGame(this.id === 1 ? 2 : 1);
        }
        updateHUD();
    }
    chkItm() {
        items.forEach(i => {
            if (i.active && this.x < i.x + i.w && this.x + this.w > i.x && this.y < i.y + i.h && this.y + this.h > i.y) {
                if (i.type === 'hammer') {
                    this.hasHammer = !0;
                    i.active = !1;
                    sfx.play('coin');
                } else if (i.type === 'landmine') {
                    this.hasLandmine = !0;
                    i.active = !1;
                    sfx.play('coin');
                } else if (i.type === 'potion') {
                    this.alpha = 0.1;
                    this.inv = 600;
                    i.active = !1;
                    sfx.play('coin');
                } else if (i.type === 'tomato') {
                    this.friction = 0.99;
                    this.pct = Math.max(0, this.pct - 10);
                    i.active = !1;
                    sfx.play('coin');
                } else if (i.type === 'coin') {
                    if (this.id === 1 || !players.find(p => p.id === 1)) {
                        earnCoins(50);
                        sfx.play('coin');
                    }
                    i.active = !1;
                } else if (i.type === 'mega') {
                    if (this.id === 1 || !players.find(p => p.id === 1)) {
                        earnCoins(500);
                        sfx.play('ult');
                    }
                    i.active = !1;
                } else if (i.type === 'nyan') {
                    this.hit(20 * (i.vx > 0 ? 1 : -1), -10, 15);
                    i.active = !1;
                }
            }
        });
    }
    draw() {
        if (this.stocks <= 0) return;
        ctx.save();
        ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
        if (this.isBoss) ctx.scale(2.5, 2.5);
        // Base sprites face right; flip when facing left
        if (!this.dir) ctx.scale(-1, 1);
        if (this.confused > 0) {
            ctx.font = "20px Arial";
            ctx.fillText("â“", 0, -40);
        }
        ctx.globalAlpha = this.alpha;
        ctx.font = "50px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const sprite = characterSprites[this.stats.id];
        if (saveData.goldMode && this.id === 1) {
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 15;
        } else {
            ctx.shadowBlur = 0;
        }
        if (this.stun > 0) {
            this.setAnimation("idle");
            ctx.fillText("ðŸ’«", 0, -10);
        } else if (this.rolling) {
            ctx.globalAlpha = 0.5;
            ctx.rotate(Date.now() / 50);
        }
        if (this.isParrying && this.parryTimer > 0) {
            ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 50) * 0.5;
        }
        if (sprite && sprite.idle) {
            const anim = sprite[this.animation] || sprite["idle"];
            if (anim) {
                this.frameTimer += this.animSpeed;
                if (this.frameTimer >= 1) {
                    this.frameTimer = 0;
                    this.frame = (this.frame + 1) % anim.length;
                    if (this.stats.id === 'brokeboy') {
                        console.log(`[ANIM] brokeboy ${this.animation} frame=${this.frame}/${anim.length}`);
                    }
                }
                const currentFrameSprite = anim[this.frame];
                if (currentFrameSprite) ctx.drawImage(currentFrameSprite, -this.w / 2, -this.h / 2, this.w, this.h);
            }
        } else if (sprite) {
            ctx.drawImage(sprite, -this.w / 2, -this.h / 2, this.w, this.h);
        } else {
            ctx.fillText(this.stats.icon, 0, 5);
        }
        if (saveData.goldMode && this.id === 1) {
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 15;
            if (sprite && sprite.idle) {
                const anim = sprite[this.animation] || sprite["idle"];
                if (anim) ctx.drawImage(anim[this.frame], -this.w / 2, -this.h / 2, this.w, this.h);
            } else if (sprite) {
                ctx.drawImage(sprite, -this.w / 2, -this.h / 2, this.w, this.h);
            }
        }
        ctx.shadowBlur = 0;
        if (this.hasHammer) {
            ctx.font = "20px Arial";
            ctx.fillText('ðŸ”¨', 25, -25);
        }
        if (this.hasLandmine) {
            ctx.font = "20px Arial";
            ctx.fillText('ðŸ’£', 25, -25);
        }
        if (this.id === 1 && equippedCosmetic) {
            ctx.font = "30px Arial";
            if (equippedCosmetic === 'tophat') ctx.fillText('ðŸŽ©', 0, -30);
            if (equippedCosmetic === 'shades') ctx.fillText('ðŸ•¶ï¸', 5, 0);
            if (equippedCosmetic === 'crown') ctx.fillText('ðŸ‘‘', 0, -35);
        }
        if (this.shielding) {
            ctx.beginPath();
            ctx.arc(0, 0, 40 * (this.shieldHP / 100), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${255 - this.shieldHP * 2.55},${this.shieldHP * 2.55},0,0.5)`;
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        ctx.restore();
        if (this.box && this.box.act && showHitboxes) {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillRect(this.x + this.box.relX, this.y + this.box.relY, this.box.w, this.box.h);
        }
        ctx.fillStyle = this.id === 1 ? '#3498db' : (this.isCpu ? '#9b59b6' : '#e74c3c');
        ctx.font = "bold 12px sans-serif";
        ctx.fillText(this.isCpu ? `CPU` : `P${this.id}`, this.x + 15, this.y - 10);
    }
}

