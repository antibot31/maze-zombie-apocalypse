/*
 * game.js — ties everything together: game state, the update step, rendering,
 * and the main loop. Depends on Config, Maze, Sound and Input (loaded first).
 */
(() => {
  const { TILE, ROWS, COLS, W, H, UPGRADES } = Config;

  // --- DOM -----------------------------------------------------------------
  const canvas  = document.getElementById('game');
  const ctx     = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('startBtn');
  canvas.width = W; canvas.height = H;

  // --- Game state ----------------------------------------------------------
  let player, bullets, zombies, chests, particles, floaters;
  let kills, wave, level, xp, xpToNext;
  let running, shootCooldown, reloading, reloadTimer, chestTimer;

  // ========================================================================
  //  Setup / spawning
  // ========================================================================
  function reset() {
    player = { x: TILE * 1.5, y: TILE * 1.5, angle: 0, ...Config.PLAYER };
    player.ammo = player.magSize;

    bullets = []; zombies = []; chests = []; particles = []; floaters = [];
    kills = 0; wave = 1; xp = 0; xpToNext = 5; level = 1;
    shootCooldown = 0; reloading = false; reloadTimer = 0;
    chestTimer = Config.CHEST.firstDelayMs;
    Input.mouse.x = W / 2; Input.mouse.y = H / 2;

    running = true;
    spawnWave();
    updateHud();
  }

  function spawnWave() {
    const { baseCount, countPerWave, spawnSafeRadius } = Config.WAVE;
    const count = baseCount + wave * countPerWave;
    for (let i = 0; i < count; i++) {
      const pos = Maze.findOpenCell();
      if (Math.hypot(pos.x - player.x, pos.y - player.y) < TILE * spawnSafeRadius) { i--; continue; }
      const hp = Config.zombieHp(wave);
      zombies.push({ x: pos.x, y: pos.y, r: 13, hp, maxHp: hp,
                     speed: Config.zombieSpeed(wave), dmg: 8, hitCd: 0, angle: 0 });
    }
  }

  function spawnChest() {
    if (chests.length >= Config.CHEST.max) return;
    let pos;
    for (let tries = 0; tries < 30; tries++) {
      pos = Maze.findOpenCell();
      if (Math.hypot(pos.x - player.x, pos.y - player.y) > TILE * Config.CHEST.safeRadius) break;
    }
    chests.push({ x: pos.x, y: pos.y, r: 15, bob: 0 });
  }

  function openChest(chest) {
    const up = UPGRADES[Math.floor(Math.random() * UPGRADES.length)];
    up.apply(player);
    addFloater(up.name, chest.x, chest.y, up.color);
    Sound.sfx.pickup();
    updateHud();
  }

  // ========================================================================
  //  Particles & floating text
  // ========================================================================
  function spark(x, y, dir, color, spread) {
    const a = dir + (Math.random() - 0.5) * spread * 2;
    const s = 1 + Math.random() * 3;
    return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 14 + Math.random() * 10, color };
  }
  function bloodBurst(x, y) {
    for (let i = 0; i < 8; i++) particles.push(spark(x, y, Math.random() * Math.PI * 2, '#8b1a1a', 3));
  }
  function addFloater(text, x, y, color) {
    floaters.push({ text, x, y, color, life: 90 });
  }

  // ========================================================================
  //  Player actions
  // ========================================================================
  function startReload() {
    if (reloading || player.ammo === player.magSize) return;
    reloading = true; reloadTimer = Config.RELOAD_MS;
    Sound.sfx.reload();
  }

  function shoot() {
    if (reloading || shootCooldown > 0) return;
    if (player.ammo <= 0) { Sound.sfx.empty(); startReload(); return; }
    player.ammo--;
    shootCooldown = player.fireRate;
    Sound.sfx.shoot();

    // Multi-shot fires `pellets` bullets fanned across a spread.
    const spread = player.pellets > 1 ? 0.22 : 0.06;
    for (let p = 0; p < player.pellets; p++) {
      const offset = player.pellets > 1
        ? (p / (player.pellets - 1) - 0.5) * spread
        : (Math.random() - 0.5) * spread;
      const a = player.angle + offset;
      bullets.push({
        x: player.x + Math.cos(a) * player.r,
        y: player.y + Math.sin(a) * player.r,
        vx: Math.cos(a) * player.bulletSpeed, vy: Math.sin(a) * player.bulletSpeed,
        life: 90, dmg: player.dmg, pierce: player.pierce, hit: [],
      });
    }
    // muzzle flash
    const mx = player.x + Math.cos(player.angle) * player.r;
    const my = player.y + Math.sin(player.angle) * player.r;
    for (let i = 0; i < 4; i++) particles.push(spark(mx, my, player.angle, '#ffd166', 1));
    updateHud();
  }

  function gainXp(n) {
    xp += n;
    while (xp >= xpToNext) {
      xp -= xpToNext; level++;
      xpToNext = Math.round(xpToNext * 1.5);
      player.maxHp += 15; player.hp = player.maxHp;
      player.dmg += 6; player.fireRate = Math.max(90, player.fireRate - 12);
      Sound.sfx.levelUp();
    }
  }

  // ========================================================================
  //  Update
  // ========================================================================
  function update(dt) {
    if (!running) return;
    updatePlayer(dt);
    updateBullets();
    updateZombies(dt);
    cullDead();
    updateChests(dt);
    updateParticles();

    if (zombies.length === 0) { // wave cleared
      wave++; spawnWave(); updateHud();
      Sound.sfx.wave();
      spawnChest(); // reward
    }
  }

  function updatePlayer(dt) {
    const { keys, mouse } = Input;
    let mx = (keys['d'] ? 1 : 0) - (keys['a'] ? 1 : 0);
    let my = (keys['s'] ? 1 : 0) - (keys['w'] ? 1 : 0);
    if (mx || my) {
      const len = Math.hypot(mx, my); mx /= len; my /= len;
      const nx = player.x + mx * player.speed;
      const ny = player.y + my * player.speed;
      if (!Maze.collides(nx, player.y, player.r)) player.x = nx;
      if (!Maze.collides(player.x, ny, player.r)) player.y = ny;
    }
    player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);

    if (shootCooldown > 0) shootCooldown -= dt;
    if (mouse.down) shoot();
    if (reloading) {
      reloadTimer -= dt;
      if (reloadTimer <= 0) { reloading = false; player.ammo = player.magSize; updateHud(); }
    }
  }

  function updateBullets() {
    for (const b of bullets) {
      b.x += b.vx; b.y += b.vy; b.life--;
      if (Maze.isWall(b.x, b.y)) {
        b.life = 0;
        for (let i = 0; i < 3; i++) particles.push(spark(b.x, b.y, Math.atan2(-b.vy, -b.vx), '#888', 1.2));
      }
    }
    bullets = bullets.filter(b => b.life > 0);
  }

  function updateZombies(dt) {
    for (const z of zombies) {
      // chase the player
      const ang = Math.atan2(player.y - z.y, player.x - z.x);
      const nx = z.x + Math.cos(ang) * z.speed;
      const ny = z.y + Math.sin(ang) * z.speed;
      if (!Maze.collides(nx, z.y, z.r)) z.x = nx;
      if (!Maze.collides(z.x, ny, z.r)) z.y = ny;
      z.angle = ang;
      if (z.hitCd > 0) z.hitCd -= dt;

      // claw the player (on a per-zombie cooldown)
      if (Math.hypot(player.x - z.x, player.y - z.y) < player.r + z.r && z.hitCd <= 0) {
        player.hp -= z.dmg; z.hitCd = 600;
        bloodBurst(player.x, player.y);
        Sound.sfx.hurt();
        updateHud();
        if (player.hp <= 0) { player.hp = 0; gameOver(); }
      }

      // take bullet damage (piercing rounds pass through; never hit the same zombie twice)
      for (const b of bullets) {
        if (b.life > 0 && !b.hit.includes(z) && Math.hypot(b.x - z.x, b.y - z.y) < z.r) {
          z.hp -= b.dmg; bloodBurst(b.x, b.y); Sound.sfx.hit();
          b.hit.push(z);
          if (b.pierce > 0) b.pierce--; else b.life = 0;
        }
      }
    }
  }

  function cullDead() {
    for (let i = zombies.length - 1; i >= 0; i--) {
      if (zombies[i].hp <= 0) {
        bloodBurst(zombies[i].x, zombies[i].y);
        zombies.splice(i, 1);
        kills++; gainXp(1); updateHud();
        Sound.sfx.zombieDead();
      }
    }
  }

  function updateChests(dt) {
    chestTimer -= dt;
    if (chestTimer <= 0) {
      spawnChest();
      const { minDelayMs, maxDelayMs } = Config.CHEST;
      chestTimer = minDelayMs + Math.random() * (maxDelayMs - minDelayMs);
    }
    for (let i = chests.length - 1; i >= 0; i--) {
      const c = chests[i];
      c.bob += dt * 0.005;
      if (Math.hypot(player.x - c.x, player.y - c.y) < player.r + c.r) {
        openChest(c);
        chests.splice(i, 1);
      }
    }
  }

  function updateParticles() {
    for (const f of floaters) { f.y -= 0.5; f.life--; }
    floaters = floaters.filter(f => f.life > 0);
    for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vx *= 0.92; p.vy *= 0.92; p.life--; }
    particles = particles.filter(p => p.life > 0);
  }

  // ========================================================================
  //  Render
  // ========================================================================
  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (!player) return; // menu showing, nothing to draw yet

    drawMaze();
    drawParticles();
    drawChests();
    drawBullets();
    drawZombies();
    drawPlayer();
    drawLighting();   // darkness everywhere except the bubble around the player
    drawFloaters();   // upgrade labels, drawn above the darkness
    drawReloadText();
  }

  function drawMaze() {
    const { MAZE } = Config;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (MAZE[r][c] === '1') {
          ctx.fillStyle = '#46566a';
          ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
          ctx.strokeStyle = '#5a6e85';
          ctx.strokeRect(c * TILE + 0.5, r * TILE + 0.5, TILE - 1, TILE - 1);
        } else {
          ctx.fillStyle = ((r + c) % 2) ? '#26323f' : '#2b3845';
          ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
        }
      }
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / 20);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  function drawChests() {
    for (const c of chests) {
      const bob = Math.sin(c.bob) * 2;
      ctx.save(); ctx.translate(c.x, c.y + bob);
      ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 16;
      ctx.fillStyle = '#7a4a1e';                              // crate body
      ctx.fillRect(-c.r, -c.r * 0.7, c.r * 2, c.r * 1.4);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#caa15a';                              // lid band
      ctx.fillRect(-c.r, -c.r * 0.7, c.r * 2, c.r * 0.5);
      ctx.fillStyle = '#ffd166';                              // lock
      ctx.fillRect(-3, -c.r * 0.35, 6, 7);
      ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 2;
      ctx.strokeRect(-c.r, -c.r * 0.7, c.r * 2, c.r * 1.4);
      ctx.restore();
    }
  }

  function drawBullets() {
    ctx.fillStyle = '#fff3b0';
    for (const b of bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2); ctx.fill(); }
  }

  function drawZombies() {
    for (const z of zombies) {
      ctx.save(); ctx.translate(z.x, z.y);
      ctx.fillStyle = '#5b8c2a';
      ctx.beginPath(); ctx.arc(0, 0, z.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3f6420';
      ctx.beginPath(); ctx.arc(Math.cos(z.angle) * 4, Math.sin(z.angle) * 4, z.r * 0.5, 0, Math.PI * 2); ctx.fill();
      // hp bar
      const w = z.r * 2;
      ctx.fillStyle = '#300'; ctx.fillRect(-w / 2, -z.r - 7, w, 3);
      ctx.fillStyle = '#e34'; ctx.fillRect(-w / 2, -z.r - 7, w * (z.hp / z.maxHp), 3);
      ctx.restore();
    }
  }

  function drawPlayer() {
    ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(player.angle);
    ctx.shadowColor = '#7fd1ff'; ctx.shadowBlur = 18;        // glow so it never blends in
    ctx.fillStyle = '#9fe0ff';                               // body
    ctx.beginPath(); ctx.arc(0, 0, player.r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff';          // outline
    ctx.beginPath(); ctx.arc(0, 0, player.r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffffff';                               // facing arrow
    ctx.beginPath();
    ctx.moveTo(player.r + 10, 0);
    ctx.lineTo(player.r - 2, -6);
    ctx.lineTo(player.r - 2, 6);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#22303c';                               // gun barrel
    ctx.fillRect(player.r - 4, -3, 14, 6);
    ctx.restore();
  }

  function drawLighting() {
    const lr = player.lightRadius;
    const fog = ctx.createRadialGradient(player.x, player.y, lr * 0.35, player.x, player.y, lr);
    fog.addColorStop(0, 'rgba(4,6,9,0)');
    fog.addColorStop(0.75, 'rgba(4,6,9,0.55)');
    fog.addColorStop(1, 'rgba(3,4,7,0.97)');
    ctx.fillStyle = fog; ctx.fillRect(0, 0, W, H);

    const warm = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, lr * 0.5);
    warm.addColorStop(0, 'rgba(255,224,150,0.10)');
    warm.addColorStop(1, 'rgba(255,224,150,0)');
    ctx.fillStyle = warm; ctx.fillRect(0, 0, W, H);
  }

  function drawFloaters() {
    ctx.font = 'bold 15px "Courier New"'; ctx.textAlign = 'center';
    for (const f of floaters) {
      ctx.globalAlpha = Math.min(1, f.life / 30);
      ctx.fillStyle = '#000'; ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawReloadText() {
    if (!reloading) return;
    ctx.fillStyle = '#ffd166'; ctx.font = '12px "Courier New"'; ctx.textAlign = 'center';
    ctx.fillText('RELOADING…', player.x, player.y - player.r - 10);
  }

  // ========================================================================
  //  HUD / overlay
  // ========================================================================
  function setText(id, value) { document.getElementById(id).textContent = value; }

  function updateHud() {
    setText('hp', Math.ceil(player.hp));
    setText('ammo', reloading ? '…' : player.ammo + '/' + player.magSize);
    setText('kills', kills);
    setText('wave', wave);
    setText('level', level);
    setText('xp', xp + '/' + xpToNext);
  }

  function gameOver() {
    running = false;
    Sound.sfx.gameOver();
    overlay.classList.remove('hidden');
    const title = overlay.querySelector('h1');
    title.textContent = 'YOU DIED'; title.style.color = '#ff6b6b';
    overlay.querySelectorAll('p')[0].innerHTML =
      `You reached <b>wave ${wave}</b> · <b>${kills} kills</b> · <b>level ${level}</b>.`;
    startBtn.textContent = 'TRY AGAIN';
  }

  // ========================================================================
  //  Main loop & wiring
  // ========================================================================
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(now - last, 50); last = now;
    try { update(dt); draw(); }
    catch (err) { console.error('Loop error:', err); } // never let one error kill the loop
    requestAnimationFrame(loop);
  }

  // One-shot key presses (held movement keys are read in updatePlayer).
  function onKeyDown(k) {
    if (k === 'r') startReload();
    if (k === 'm') setText('snd', Sound.toggleMute() ? 'OFF' : 'ON');
  }

  Input.init(canvas, onKeyDown);
  startBtn.addEventListener('click', () => {
    Sound.init();                 // must happen inside a user gesture
    Sound.startMusic();           // cave ambience (no-op if already playing)
    overlay.classList.add('hidden');
    reset();
  });
  requestAnimationFrame(loop);
})();
