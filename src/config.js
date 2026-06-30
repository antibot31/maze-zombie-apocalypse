/*
 * config.js — all the data and tuning knobs for the game.
 * Tweak balance here; the rest of the code reads from `Config`.
 */
const Config = {
  TILE: 48,

  // Maze layout: '1' = wall, '0' = open floor.
  MAZE: [
    "1111111111111111111",
    "1000000001000000001",
    "1011111101011111101",
    "1010000001000000101",
    "1010111111111110101",
    "1010100000000010101",
    "1000100111110010001",
    "1110100100010011101",
    "1000000100010000001",
    "1011110100011110101",
    "1010000000000010101",
    "1010111111111010101",
    "1000100000010000001",
    "1110101111010111011",
    "1000100000010000001",
    "1011111101011111101",
    "1000000001000000001",
    "1111111111111111111",
  ],

  // Starting stats for a fresh player (cloned on each new game).
  PLAYER: {
    r: 16, hp: 100, maxHp: 100, speed: 2.6, fireRate: 220,
    dmg: 25, magSize: 12, lightRadius: 200, pellets: 1, pierce: 0, bulletSpeed: 9,
  },

  // Wave / zombie tuning.
  WAVE: {
    baseCount: 3,           // zombies = baseCount + wave * countPerWave
    countPerWave: 2,
    spawnSafeRadius: 3,     // (in tiles) don't spawn zombies this close to player
  },

  // Chest tuning.
  CHEST: {
    max: 3,                 // most chests allowed on the map at once
    firstDelayMs: 6000,     // delay before the first chest appears
    minDelayMs: 9000,       // random respawn window after that
    maxDelayMs: 16000,
    safeRadius: 2.5,        // (in tiles) try not to spawn on top of the player
  },

  RELOAD_MS: 900,

  // Loot table: each chest grants one random upgrade. `apply` mutates the player.
  UPGRADES: [
    { name: '+DAMAGE',      color: '#ff7b7b', apply: p => { p.dmg += 10; } },
    { name: 'RAPID FIRE',   color: '#ffd166', apply: p => { p.fireRate = Math.max(70, p.fireRate - 35); } },
    { name: 'BIG MAG',      color: '#9fe0ff', apply: p => { p.magSize += 5; p.ammo = p.magSize; } },
    { name: 'MULTI-SHOT',   color: '#c08bff', apply: p => { p.pellets += 1; } },
    { name: 'PIERCING',     color: '#8affc1', apply: p => { p.pierce += 1; } },
    { name: 'FAST ROUNDS',  color: '#7fd1ff', apply: p => { p.bulletSpeed += 2.5; } },
    { name: 'BRIGHT LIGHT', color: '#fff1a8', apply: p => { p.lightRadius += 45; } },
    { name: '+MAX HP',      color: '#ff9bd0', apply: p => { p.maxHp += 25; p.hp = p.maxHp; } },
  ],
};

// Derived dimensions (computed once from the maze).
Config.ROWS = Config.MAZE.length;
Config.COLS = Config.MAZE[0].length;
Config.W = Config.COLS * Config.TILE;
Config.H = Config.ROWS * Config.TILE;

// Zombie HP grows each wave: tougher base + a steepening per-wave bonus.
Config.zombieHp = wave => Math.round(40 + (wave - 1) * 18 + Math.pow(wave, 1.4) * 3);
// Zombie speed ramps up with the wave, capped, with a little randomness.
Config.zombieSpeed = wave => 0.8 + Math.min(wave * 0.12, 1.6) + Math.random() * 0.3;
