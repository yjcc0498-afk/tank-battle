// Tank Battle - minimal but polished prototype

(function () {
    "use strict";

    // ---------- Config ----------
    const GAME_WIDTH = 960;
    const GAME_HEIGHT = 600;
    const WORLD_BOUNDS = { x: 0, y: 0, w: GAME_WIDTH, h: GAME_HEIGHT };

    const PLAYER = {
        radius: 18,
        speed: 220,
        rotationSpeed: Math.PI * 2,
        fireCooldown: 0.25,
        bulletSpeed: 520,
        maxLives: 3
    };

    const ENEMY = {
        radius: 16,
        speed: 140,
        spawnIntervalBase: 6.0,
        bulletSpeed: 440,
        fireCooldown: 1.2,
        // variants
        variants: {
            scout: { speed: 180, hp: 1, score: 10, color: "#f97316" },
            heavy: { speed: 90, hp: 3, score: 25, color: "#a855f7" },
            sniper: { speed: 120, hp: 1, score: 20, color: "#22d3ee", bulletSpeed: 560, fireCooldown: 1.6 }
        }
    };

    const BULLET = {
        radius: 4,
        lifetime: 2.2
    };

    const POWERUPS = {
        heal: { kind: "heal", color: "#34d399" },
        rapid: { kind: "rapid", color: "#f472b6" }
    };

    const COLORS = {
        bg: "#0b1220",
        grid: "#0f1930",
        playerBody: "#3b82f6",
        playerBarrel: "#93c5fd",
        enemyBody: "#ef4444",
        enemyBarrel: "#fecaca",
        bullet: "#fbbf24",
        wall: "#334155",
        textShadow: "#000000"
    };

    const THEMES = {
        grassland: {
            bgTop: "#0e1a10",
            bgBottom: "#102412",
            grid: "#14341a",
            wall: "#3b4d37"
        },
        space: {
            bgTop: "#070a14",
            bgBottom: "#0a1020",
            grid: "#0d1630",
            wall: "#273244"
        }
    };

    // ---------- Utilities ----------
    function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
    function length(x, y) { return Math.hypot(x, y); }
    function normalize(x, y) { const d = Math.hypot(x, y) || 1; return { x: x / d, y: y / d }; }
    function now() { return performance.now() / 1000; }

    function circleIntersectsRect(cx, cy, r, rx, ry, rw, rh) {
        const closestX = clamp(cx, rx, rx + rw);
        const closestY = clamp(cy, ry, ry + rh);
        const dx = cx - closestX;
        const dy = cy - closestY;
        return (dx * dx + dy * dy) <= r * r;
    }

    function circlesOverlap(ax, ay, ar, bx, by, br) {
        const dx = ax - bx; const dy = ay - by; const rr = ar + br; return dx * dx + dy * dy <= rr * rr;
    }

    function randomInRange(min, max) { return min + Math.random() * (max - min); }

    // ---------- Input ----------
    const input = {
        keys: new Set(),
        mouse: { x: 0, y: 0, down: false }
    };

    // ---------- World / Entities ----------
    const state = {
        isPaused: false,
        isGameOver: false,
        score: 0,
        lives: PLAYER.maxLives,
        wave: 1,
        lastSpawnAt: 0,
        nextSpawnDelay: ENEMY.spawnIntervalBase,
        lastUpdateTime: now(),
        player: null,
        enemies: [],
        bullets: [],
        walls: [],
        particles: [],
        theme: "grassland",
        stars: [],
        powerups: [],
        buff: { type: null, until: 0 }
    };

    function createPlayer() {
        return {
            x: GAME_WIDTH * 0.5,
            y: GAME_HEIGHT * 0.8,
            angle: -Math.PI / 2,
            cooldown: 0
        };
    }

    function chooseVariant() {
        // weighted by wave
        const w = state.wave;
        const pScout = clamp(0.5 + w * 0.01, 0.5, 0.7);
        const pHeavy = clamp(0.2 + w * 0.01, 0.2, 0.35);
        const r = Math.random();
        if (r < pScout) return "scout";
        if (r < pScout + pHeavy) return "heavy";
        return "sniper";
    }

    function createEnemy() {
        // spawn at top area away from player
        let x = randomInRange(40, GAME_WIDTH - 40);
        let y = randomInRange(40, GAME_HEIGHT * 0.3);
        const type = chooseVariant();
        const spec = ENEMY.variants[type];
        return { x, y, angle: Math.PI / 2, cooldown: randomInRange(0.2, ENEMY.fireCooldown), spawn: now(), type, hp: spec.hp };
    }

    function createBullet(x, y, dirX, dirY, speed, owner) {
        return { x, y, vx: dirX * speed, vy: dirY * speed, owner, born: now() };
    }

    function createPowerup(kind, x, y) {
        return { kind, x, y, r: 10, spawned: now(), pulse: 0 };
    }

    function resetGame() {
        state.isPaused = false;
        state.isGameOver = false;
        state.score = 0;
        state.lives = PLAYER.maxLives;
        state.wave = 1;
        state.enemies = [];
        state.bullets = [];
        state.walls = createMapWalls();
        state.player = createPlayer();
        state.lastSpawnAt = now();
        state.nextSpawnDelay = ENEMY.spawnIntervalBase;
        updateHUD();
    }

    function createMapWalls() {
        // simple symmetric walls
        const margin = 24;
        const w = [
            // borders
            { x: margin, y: margin, w: GAME_WIDTH - margin * 2, h: 12 },
            { x: margin, y: GAME_HEIGHT - margin - 12, w: GAME_WIDTH - margin * 2, h: 12 },
            { x: margin, y: margin, w: 12, h: GAME_HEIGHT - margin * 2 },
            { x: GAME_WIDTH - margin - 12, y: margin, w: 12, h: GAME_HEIGHT - margin * 2 },

            // inner blocks
            { x: 200, y: 180, w: 120, h: 18 },
            { x: GAME_WIDTH - 320, y: 180, w: 120, h: 18 },
            { x: 320, y: 320, w: 80, h: 18 },
            { x: GAME_WIDTH - 400, y: 320, w: 80, h: 18 }
        ];
        return w;
    }

    // ---------- Setup Canvas ----------
    const canvas = document.getElementById("game");
    const ctx = canvas.getContext("2d");

    // ---------- Audio ----------
    let audioCtx = null;
    function getAudio() {
        if (!audioCtx) {
            try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
        }
        return audioCtx;
    }
    function playBeep(freq, dur, type, gain = 0.05) {
        const ac = getAudio();
        if (!ac) return;
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = type || "sine";
        o.frequency.value = freq;
        g.gain.value = gain;
        o.connect(g); g.connect(ac.destination);
        const t = ac.currentTime;
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.start();
        o.stop(t + dur + 0.02);
    }
    function sfxShoot() { playBeep(740, 0.05, "square", 0.03); }
    function sfxExplosion() { playBeep(120, 0.2, "sawtooth", 0.06); }
    function sfxHit() { playBeep(300, 0.08, "triangle", 0.05); }

    // ---------- Rendering ----------
    function renderBackground() {
        ctx.save();
        const theme = THEMES[state.theme];
        const grad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
        grad.addColorStop(0, theme.bgTop);
        grad.addColorStop(1, theme.bgBottom);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        if (state.theme === "space") {
            if (state.stars.length === 0) {
                for (let i = 0; i < 120; i++) {
                    state.stars.push({ x: Math.random() * GAME_WIDTH, y: Math.random() * GAME_HEIGHT, r: Math.random() * 1.5 + 0.2, a: Math.random() * 0.6 + 0.2 });
                }
            }
            for (const s of state.stars) {
                ctx.globalAlpha = s.a;
                ctx.fillStyle = "#cfd9ff";
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        } else {
            ctx.strokeStyle = THEMES[state.theme].grid;
            ctx.lineWidth = 1;
            const step = 40;
            ctx.beginPath();
            for (let x = 0; x <= GAME_WIDTH; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, GAME_HEIGHT); }
            for (let y = 0; y <= GAME_HEIGHT; y += step) { ctx.moveTo(0, y); ctx.lineTo(GAME_WIDTH, y); }
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawTank(x, y, angle, isPlayer, type) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // body
        let bodyColor = COLORS.enemyBody;
        if (isPlayer) bodyColor = COLORS.playerBody; else if (type) {
            const v = ENEMY.variants[type];
            bodyColor = v && v.color ? v.color : COLORS.enemyBody;
        }
        ctx.fillStyle = bodyColor;
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, isPlayer ? PLAYER.radius : ENEMY.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // barrel
        ctx.strokeStyle = isPlayer ? COLORS.playerBarrel : COLORS.enemyBarrel;
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(isPlayer ? 26 : 22, 0);
        ctx.stroke();

        ctx.restore();
    }

    function drawWalls() {
        ctx.save();
        ctx.fillStyle = (state.theme === "space" ? THEMES.space.wall : THEMES.grassland.wall);
        for (const w of state.walls) { ctx.fillRect(w.x, w.y, w.w, w.h); }
        ctx.restore();
    }

    function drawParticles() {
        ctx.save();
        for (const p of state.particles) {
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    function drawBullets() {
        ctx.save();
        ctx.fillStyle = COLORS.bullet;
        for (const b of state.bullets) {
            ctx.beginPath();
            ctx.arc(b.x, b.y, BULLET.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    function drawPowerups() {
        ctx.save();
        for (const p of state.powerups) {
            const color = p.kind === "heal" ? POWERUPS.heal.color : POWERUPS.rapid.color;
            const pulse = 1 + Math.sin(p.pulse) * 0.15;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * pulse, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    function drawTextCentered(text, sub) {
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#e6edf3";
        ctx.strokeStyle = COLORS.textShadow;
        ctx.lineWidth = 4;
        ctx.font = "bold 32px Segoe UI, Roboto, system-ui";
        ctx.strokeText(text, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10);
        ctx.fillText(text, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10);
        if (sub) {
            ctx.font = "16px Segoe UI, Roboto, system-ui";
            ctx.strokeText(sub, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 22);
            ctx.fillText(sub, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 22);
        }
        ctx.restore();
    }

    // ---------- Update ----------
    function update(dt) {
        if (state.isPaused || state.isGameOver) return;

        // player aim and shoot
        const p = state.player;
        const aimDx = input.mouse.x - p.x;
        const aimDy = input.mouse.y - p.y;
        p.angle = Math.atan2(aimDy, aimDx);
        p.cooldown = Math.max(0, p.cooldown - dt);
        const fireCd = state.buff.type === "rapid" ? PLAYER.fireCooldown * 0.4 : PLAYER.fireCooldown;
        if (input.mouse.down && p.cooldown === 0) {
            const dir = normalize(aimDx, aimDy);
            const bx = p.x + dir.x * (PLAYER.radius + 8);
            const by = p.y + dir.y * (PLAYER.radius + 8);
            state.bullets.push(createBullet(bx, by, dir.x, dir.y, PLAYER.bulletSpeed, "player"));
            p.cooldown = fireCd;
            sfxShoot();
        }

        // player movement
        let mx = 0, my = 0;
        if (input.keys.has("KeyW") || input.keys.has("ArrowUp")) my -= 1;
        if (input.keys.has("KeyS") || input.keys.has("ArrowDown")) my += 1;
        if (input.keys.has("KeyA") || input.keys.has("ArrowLeft")) mx -= 1;
        if (input.keys.has("KeyD") || input.keys.has("ArrowRight")) mx += 1;
        if (mx !== 0 || my !== 0) {
            const dir = normalize(mx, my);
            const nx = p.x + dir.x * PLAYER.speed * dt;
            const ny = p.y + dir.y * PLAYER.speed * dt;
            const pr = PLAYER.radius;
            // collide with walls and bounds
            const tryX = { x: nx, y: p.y };
            const tryY = { x: p.x, y: ny };
            if (!collidesWithWalls(tryX.x, tryX.y, pr)) { p.x = clamp(tryX.x, WORLD_BOUNDS.x + pr, WORLD_BOUNDS.x + WORLD_BOUNDS.w - pr); }
            if (!collidesWithWalls(tryY.x, tryY.y, pr)) { p.y = clamp(tryY.y, WORLD_BOUNDS.y + pr, WORLD_BOUNDS.y + WORLD_BOUNDS.h - pr); }
        }

        // enemies
        for (const e of state.enemies) {
            // move towards player with simple steering
            const dx = state.player.x - e.x;
            const dy = state.player.y - e.y;
            const dir = normalize(dx, dy);
            const eSpeed = (e.type ? (ENEMY.variants[e.type].speed || ENEMY.speed) : ENEMY.speed);
            const ex = e.x + dir.x * eSpeed * dt;
            const ey = e.y + dir.y * eSpeed * dt;
            const er = ENEMY.radius;
            const tryX = { x: ex, y: e.y };
            const tryY = { x: e.x, y: ey };
            if (!collidesWithWalls(tryX.x, tryX.y, er)) e.x = clamp(tryX.x, WORLD_BOUNDS.x + er, WORLD_BOUNDS.x + WORLD_BOUNDS.w - er);
            if (!collidesWithWalls(tryY.x, tryY.y, er)) e.y = clamp(tryY.y, WORLD_BOUNDS.y + er, WORLD_BOUNDS.y + WORLD_BOUNDS.h - er);
            e.angle = Math.atan2(dy, dx);

            // shoot if roughly line-of-sight (no wall between)
            e.cooldown = Math.max(0, e.cooldown - dt);
            if (e.cooldown === 0 && hasLineOfSight(e.x, e.y, state.player.x, state.player.y)) {
                const bx = e.x + dir.x * (ENEMY.radius + 6);
                const by = e.y + dir.y * (ENEMY.radius + 6);
                const bSpeed = e.type && ENEMY.variants[e.type].bulletSpeed ? ENEMY.variants[e.type].bulletSpeed : ENEMY.bulletSpeed;
                const fcd = e.type && ENEMY.variants[e.type].fireCooldown ? ENEMY.variants[e.type].fireCooldown : ENEMY.fireCooldown;
                state.bullets.push(createBullet(bx, by, dir.x, dir.y, bSpeed, "enemy"));
                e.cooldown = fcd;
            }
        }

        // spawn logic
        const t = now();
        if (t - state.lastSpawnAt >= state.nextSpawnDelay) {
            spawnWave();
            state.lastSpawnAt = t;
            state.nextSpawnDelay = Math.max(2.0, ENEMY.spawnIntervalBase - state.wave * 0.35);
        }

        // powerup pulse
        for (const p of state.powerups) { p.pulse += dt * 6; }

        // bullets movement & collisions
        const aliveBullets = [];
        for (const b of state.bullets) {
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            let hit = false;
            // walls
            for (const w of state.walls) {
                if (circleIntersectsRect(b.x, b.y, BULLET.radius, w.x, w.y, w.w, w.h)) { hit = true; break; }
            }
            if (hit) continue;
            // bounds
            if (b.x < 0 || b.y < 0 || b.x > GAME_WIDTH || b.y > GAME_HEIGHT) continue;
            // lifetime
            if (t - b.born > BULLET.lifetime) continue;

            // hit player or enemies
            if (b.owner === "enemy" && circlesOverlap(b.x, b.y, BULLET.radius, state.player.x, state.player.y, PLAYER.radius)) {
                damagePlayer();
                continue;
            }
            if (b.owner === "player") {
                let killed = false;
                for (let i = 0; i < state.enemies.length; i++) {
                    const e = state.enemies[i];
                    if (circlesOverlap(b.x, b.y, BULLET.radius, e.x, e.y, ENEMY.radius)) {
                        e.hp = (e.hp || 1) - 1;
                        if (e.hp <= 0) {
                            const spec = e.type ? ENEMY.variants[e.type] : null;
                            const scoreGain = spec ? spec.score : 10;
                            state.enemies.splice(i, 1);
                            state.score += scoreGain;
                            spawnExplosion(e.x, e.y, COLORS.enemyBody);
                            sfxExplosion();
                            updateHUD();
                        }
                        spawnExplosion(e.x, e.y, COLORS.enemyBody);
                        killed = true;
                        break;
                    }
                }
                if (killed) continue;
            }

            aliveBullets.push(b);
        }
        state.bullets = aliveBullets;

        // particles
        const aliveParticles = [];
        for (const p of state.particles) {
            p.vx *= 0.99; p.vy *= 0.99;
            p.x += p.vx * dt; p.y += p.vy * dt;
            p.life -= dt; p.alpha = Math.max(0, p.life / p.maxLife);
            if (p.life > 0) aliveParticles.push(p);
        }
        state.particles = aliveParticles;

        // powerup pickup & lifetime
        const alivePowerups = [];
        for (const pu of state.powerups) {
            const picked = circlesOverlap(pu.x, pu.y, pu.r, state.player.x, state.player.y, PLAYER.radius);
            if (picked) {
                if (pu.kind === "heal") {
                    state.lives = Math.min(PLAYER.maxLives, state.lives + 1);
                    updateHUD();
                } else if (pu.kind === "rapid") {
                    state.buff.type = "rapid";
                    state.buff.until = now() + 6;
                }
                sfxHit();
                spawnExplosion(pu.x, pu.y, pu.kind === "heal" ? POWERUPS.heal.color : POWERUPS.rapid.color);
                continue;
            }
            if (now() - pu.spawned > 12) continue;
            alivePowerups.push(pu);
        }
        state.powerups = alivePowerups;

        // buff expiration
        if (state.buff.type && now() > state.buff.until) { state.buff.type = null; state.buff.until = 0; }
    }

    function spawnWave() {
        const count = 2 + Math.floor(state.wave * 1.2);
        for (let i = 0; i < count; i++) {
            state.enemies.push(createEnemy());
        }
        state.wave += 1;
        updateHUD();

        // chance to spawn a powerup after each wave
        const px = randomInRange(60, GAME_WIDTH - 60);
        const py = randomInRange(80, GAME_HEIGHT - 80);
        const kind = Math.random() < 0.5 ? POWERUPS.heal.kind : POWERUPS.rapid.kind;
        state.powerups.push(createPowerup(kind, px, py));
    }

    function damagePlayer() {
        state.lives -= 1;
        updateHUD();
        if (state.lives <= 0) {
            state.isGameOver = true;
            // persist leaderboard
            const hs = loadHighScore();
            const bw = loadBestWave();
            if (state.score > hs) saveHighScore(state.score);
            if (state.wave - 1 > bw) saveBestWave(state.wave - 1);
        } else {
            // brief invulnerability: clear enemy bullets to be fair
            state.bullets = state.bullets.filter(b => b.owner !== "enemy");
            state.player.x = GAME_WIDTH * 0.5;
            state.player.y = GAME_HEIGHT * 0.8;
        }
        spawnExplosion(state.player.x, state.player.y, COLORS.playerBody);
        sfxHit();
    }

    function spawnExplosion(x, y, color) {
        for (let i = 0; i < 18; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 80 + Math.random() * 160;
            state.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6 + Math.random() * 0.4, maxLife: 1.0, size: 2 + Math.random() * 3, alpha: 1, color });
        }
    }

    function collidesWithWalls(x, y, r) {
        for (const w of state.walls) {
            if (circleIntersectsRect(x, y, r, w.x, w.y, w.w, w.h)) return true;
        }
        return false;
    }

    function hasLineOfSight(x0, y0, x1, y1) {
        // simple discrete sampling along the segment
        const dx = x1 - x0; const dy = y1 - y0; const d = Math.hypot(dx, dy);
        const steps = Math.ceil(d / 8);
        const nx = dx / steps; const ny = dy / steps;
        let sx = x0, sy = y0;
        for (let i = 0; i < steps; i++) {
            for (const w of state.walls) {
                if (sx >= w.x && sx <= w.x + w.w && sy >= w.y && sy <= w.y + w.h) return false;
            }
            sx += nx; sy += ny;
        }
        return true;
    }

    // ---------- Loop ----------
    function tick() {
        const current = now();
        let dt = current - state.lastUpdateTime;
        state.lastUpdateTime = current;
        dt = Math.min(dt, 0.033);

        update(dt);
        render();
        requestAnimationFrame(tick);
    }

    function render() {
        renderBackground();
        drawWalls();
        drawParticles();
        drawBullets();
        drawPowerups();
        drawTank(state.player.x, state.player.y, state.player.angle, true);
        for (const e of state.enemies) drawTank(e.x, e.y, e.angle, false, e.type);

        if (state.isPaused) drawTextCentered("暂停中", "按 P 或 Esc 继续");
        if (state.isGameOver) drawTextCentered("游戏结束", "点击 重开 开始新游戏");
    }

    // ---------- HUD ----------
    const elScore = document.getElementById("score");
    const elHigh = document.getElementById("high");
    const elLives = document.getElementById("lives");
    const elWave = document.getElementById("wave");
    const elBest = document.getElementById("best");
    const elBuff = document.getElementById("buff");
    const btnPause = document.getElementById("btn-pause");
    const btnRestart = document.getElementById("btn-restart");
    const btnTheme = document.getElementById("btn-theme");
    const btnFire = document.getElementById("btn-fire");

    function updateHUD() {
        elScore.textContent = String(state.score);
        elLives.textContent = String(state.lives);
        elWave.textContent = String(state.wave);
        if (elBuff) elBuff.textContent = state.buff.type ? (state.buff.type === "rapid" ? "急射" : String(state.buff.type)) : "无";
        if (elHigh) elHigh.textContent = String(loadHighScore());
        if (elBest) elBest.textContent = String(loadBestWave());
    }

    function loadHighScore() { try { return Number(localStorage.getItem("tb_high") || 0); } catch { return 0; } }
    function saveHighScore(v) { try { localStorage.setItem("tb_high", String(v)); } catch {} }
    function loadBestWave() { try { return Number(localStorage.getItem("tb_best" ) || 1); } catch { return 1; } }
    function saveBestWave(v) { try { localStorage.setItem("tb_best", String(v)); } catch {} }

    btnPause.addEventListener("click", function () {
        if (state.isGameOver) return;
        state.isPaused = !state.isPaused;
        btnPause.textContent = state.isPaused ? "继续" : "暂停";
    });

    btnRestart.addEventListener("click", function () { resetGame(); });

    btnTheme && btnTheme.addEventListener("click", function () {
        state.theme = state.theme === "grassland" ? "space" : "grassland";
        document.documentElement.classList.toggle("space", state.theme === "space");
        document.documentElement.classList.toggle("grassland", state.theme === "grassland");
        if (btnTheme) btnTheme.textContent = "主题: " + (state.theme === "grassland" ? "草原" : "星际");
        if (state.theme === "space") state.stars = [];
    });

    btnFire && btnFire.addEventListener("touchstart", function (e) {
        e.preventDefault();
        input.mouse.down = true;
    });
    btnFire && btnFire.addEventListener("touchend", function (e) {
        e.preventDefault();
        input.mouse.down = false;
    });

    // ---------- Events ----------
    window.addEventListener("keydown", function (e) {
        if (e.code === "KeyP" || e.code === "Escape") {
            if (!state.isGameOver) {
                state.isPaused = !state.isPaused;
                btnPause.textContent = state.isPaused ? "继续" : "暂停";
            }
            return;
        }
        input.keys.add(e.code);
    });
    window.addEventListener("keyup", function (e) { input.keys.delete(e.code); });

    canvas.addEventListener("mousemove", function (e) {
        const rect = canvas.getBoundingClientRect();
        input.mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
        input.mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
    });
    canvas.addEventListener("mousedown", function () { input.mouse.down = true; sfxShoot(); });
    window.addEventListener("mouseup", function () { input.mouse.down = false; });

    // Touch joystick
    const joy = document.getElementById("joystick");
    const stick = document.getElementById("stick");
    const touchState = { active: false, dx: 0, dy: 0 };
    function handleJoy(e) {
        const rect = joy.getBoundingClientRect();
        const t = e.touches ? e.touches[0] : e;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = t.clientX - cx;
        let dy = t.clientY - cy;
        const max = rect.width * 0.5 - 6;
        const d = Math.hypot(dx, dy);
        if (d > max) { dx = dx / d * max; dy = dy / d * max; }
        stick.style.transform = `translate(${dx}px, ${dy}px)`;
        touchState.active = true;
        const n = normalize(dx, dy);
        touchState.dx = n.x;
        touchState.dy = n.y;
    }
    function resetTouch() {
        touchState.active = false;
        touchState.dx = 0;
        touchState.dy = 0;
        if (stick) stick.style.transform = "translate(0px, 0px)";
    }
    if (joy) {
        joy.addEventListener("touchstart", function (e) { e.preventDefault(); handleJoy(e); }, { passive: false });
        joy.addEventListener("touchmove", function (e) { e.preventDefault(); handleJoy(e); }, { passive: false });
        joy.addEventListener("touchend", function (e) { e.preventDefault(); resetTouch(); }, { passive: false });
        joy.addEventListener("touchcancel", function (e) { e.preventDefault(); resetTouch(); }, { passive: false });
    }

    // Clear inputs on blur/visibility change to avoid stuck movement
    function clearInputs() {
        input.keys.clear();
        input.mouse.down = false;
        resetTouch();
    }
    window.addEventListener("blur", clearInputs);
    document.addEventListener("visibilitychange", function () { if (document.hidden) clearInputs(); });

    // ---------- Init ----------
    resetGame();
    requestAnimationFrame(tick);
})();


