/*
 * maze.js — maze queries: wall tests, circle collision, and random open cells.
 * Reads the layout from Config.
 */
const Maze = {
  // Is the world point (px, py) inside a wall (or out of bounds)?
  isWall(px, py) {
    const { TILE, MAZE, ROWS, COLS } = Config;
    const c = Math.floor(px / TILE), r = Math.floor(py / TILE);
    if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return true;
    return MAZE[r][c] === '1';
  },

  // Does a circle of radius `rad` at (px, py) overlap any wall?
  // Samples 8 points around the rim plus the centre.
  collides(px, py, rad) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      if (this.isWall(px + Math.cos(a) * rad, py + Math.sin(a) * rad)) return true;
    }
    return this.isWall(px, py);
  },

  // Centre point of a random open (non-wall) tile.
  findOpenCell() {
    const { TILE, MAZE, ROWS, COLS } = Config;
    while (true) {
      const r = 1 + Math.floor(Math.random() * (ROWS - 2));
      const c = 1 + Math.floor(Math.random() * (COLS - 2));
      if (MAZE[r][c] === '0') {
        return { x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 };
      }
    }
  },
};
