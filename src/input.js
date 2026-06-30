/*
 * input.js — tracks keyboard and mouse state.
 * `keys` is a map of held keys; `mouse` holds canvas-space coords + button state.
 * Pass an `onKeyDown(key)` callback to react to one-shot presses (reload, mute).
 */
const Input = {
  keys: {},
  mouse: { x: 0, y: 0, down: false },

  init(canvas, onKeyDown) {
    window.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      this.keys[k] = true;
      if (onKeyDown) onKeyDown(k);
    });
    window.addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });

    // Translate page coords to the canvas's internal resolution.
    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
      this.mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
    });
    canvas.addEventListener('mousedown', () => { this.mouse.down = true; });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });
  },
};
