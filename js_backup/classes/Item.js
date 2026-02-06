class Ball {
    constructor() {
        this.x = 0;
        this.y = -200;
        this.vx = 0;
        this.vy = 0;
        this.r = 40;
        this.icon = 'ðŸ¥”';
        this.lastHit = 0;
        this.inPlay = false;
        this.hasCrossedNet = false;
    }
    reset(servingSide) {
        this.inPlay = false;
        this.lastHit = 0;
        this.hasCrossedNet = false;
        servingPlayer = servingSide || servingPlayer;
        isServing = true;
        serveCharge = 0;

        // Position ball with serving player
        const server = players.find(p => p.id === servingPlayer);
        if (server) {
            // Move server back to safe serving position
            const targetX = servingPlayer === 1 ? -250 : 250;
            server.x = targetX;
            server.y = 0;

            this.x = server.x;
            this.y = server.y - 80;
            this.vx = 0;
            this.vy = 0;
        } else {
            this.x = servingPlayer === 1 ? -200 : 200;
            this.y = -150;
            this.vx = 0;
            this.vy = 0;
        }
    }
    serve(power, side) {
        isServing = false;
        this.inPlay = true;
        this.lastHit = servingPlayer;
        this.hasCrossedNet = false;
        const direction = side === 1 ? 1 : -1;
        this.vx = direction * (8 + power * 0.15);
        this.vy = -5 - power * 0.1;
        this.serveTime = 60; // Grace period after serve (1 second)
        sfx.play('hit');
    }
    update() {
        // If serving, ball follows player
        if (isServing) {
            const server = players.find(p => p.id === servingPlayer);
            if (server) {
                this.x = server.x;
                this.y = server.y - 80;
            }
            return;
        }

        // Countdown serve grace period
        if (this.serveTime > 0) this.serveTime--;

        // Track if ball crosses net
        if (!this.hasCrossedNet && this.inPlay) {
            if ((servingPlayer === 1 && this.x > 0) || (servingPlayer === 2 && this.x < 0)) {
                this.hasCrossedNet = true;
            }
        }

        this.vy += 0.4;
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.99;
        players.forEach(p => {
            let dx = this.x - (p.x + p.w / 2);
            let dy = this.y - (p.y + p.h / 2);
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < this.r + p.w / 2 && this.lastHit !== p.id) {
                this.vx = (dx / dist) * 10;
                this.vy = (dy / dist) * 10 - 10;
                this.lastHit = p.id;
                sfx.play('hit');
            }
        });
        platforms.forEach(p => {
            if (p.w < 100) {
                if (this.x + this.r > p.x && this.x - this.r < p.x + p.w && this.y + this.r > p.y && this.y - this.r < p.y + p.h) {
                    if (this.y < p.y) {
                        this.y = p.y - this.r;
                        this.vy *= -0.8;
                    } else {
                        this.vx *= -0.8;
                    }
                }
            }
        });

        // Check for out of bounds (sides) - reset to center without scoring
        if (this.x < -600 || this.x > 600 || this.y > 800) {
            this.reset(servingPlayer);
            return;
        }

        // Score only when ball hits ground on a side (after crossing net)
        if (this.y + this.r > 200 && this.inPlay && this.hasCrossedNet) {
            let scorer = 0;
            if (this.x < 0) {
                p2Score++;
                scorer = 2;
            } else {
                p1Score++;
                scorer = 1;
            }
            document.getElementById('game-score-val').innerText = `${p1Score} - ${p2Score}`;
            if (p1Score >= 5) endGame(1);
            else if (p2Score >= 5) endGame(2);
            else this.reset(scorer);
        }
    }
    draw() {
        ctx.font = "80px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.icon, this.x, this.y);
    }
}
class Item {
    constructor(forceType) {
        if (forceType) {
            this.type = forceType;
        } else {
            this.type = Math.random() > 0.8 ? 'nyan' : (Math.random() > 0.5 ? 'hammer' : 'coin');
        }
        this.active = !0;
        this.w = 30;
        this.h = 30;
        if (this.type === 'mega') {
            this.w = 60;
            this.h = 60;
            this.x = (Math.random() * 200) - 100;
            this.y = -400;
            this.vx = 0;
            this.vy = 0;
            this.icon = 'ðŸ’°';
        } else if (this.type === 'nyan') {
            this.y = Math.random() * 400 - 200;
            this.vx = (Math.random() < 0.5 ? 1 : -1) * 12;
            this.x = this.vx > 0 ? -600 : 600;
            this.vy = 0;
            this.icon = 'ðŸŒˆ';
        } else {
            this.x = (Math.random() * 600) - 300;
            this.y = -400;
            this.vx = 0;
            this.vy = 0;
            if (this.type === 'hammer') this.icon = 'ðŸ”¨';
            else if (this.type === 'landmine') this.icon = 'ðŸ’£';
            else if (this.type === 'potion') this.icon = 'ðŸ§ª';
            else if (this.type === 'tomato') this.icon = 'ðŸ…';
            else this.icon = 'ðŸ’°';
        }
        this.placed = !1;
    }
    update() {
        if (!this.active) return;
        if (this.type === 'nyan') {
            this.x += this.vx;
            if (this.x < -1500 || this.x > 1500) this.active = !1;
        } else {
            this.vy += 0.5;
            if (worldFlipped) this.vy -= 1.0;
            this.y += this.vy;
            for (let p of platforms)
                if (p.t !== 'lava' && !p.t.startsWith('machine') && this.vy > 0 && this.y + this.h > p.y && this.y + this.h < p.y + 30 && this.x + this.w > p.x && this.x < p.x + p.w) {
                    this.y = p.y - this.h;
                    this.vy = 0;
                }
            if (this.y > 800) this.active = !1;
        }
        if (this.type === 'landmine' && this.placed) {
            players.forEach(p => {
                if (Math.abs(p.x - this.x) < 30 && Math.abs(p.y - this.y) < 30) {
                    p.hit(0, -20, 30);
                    ultEffects.push({
                        t: 'tear',
                        x: this.x,
                        y: this.y,
                        l: 10
                    });
                    this.active = !1;
                    sfx.play('break');
                }
            });
        }
    }
    draw() {
        if (!this.active) return;
        ctx.font = this.type === 'mega' ? "80px Arial" : "30px Arial";
        if (this.type === 'landmine' && this.placed) ctx.font = "20px Arial";
        ctx.fillText(this.icon, this.x, this.y + 30);
    }
}

