export class Controller {
  constructor() { this.buttons = new Uint8Array(8); this.strobe = 0; this.index = 0; }
  setButton(button, pressed) { if (button >= 0 && button < 8) this.buttons[button] = pressed ? 1 : 0; }
  write(value) { this.strobe = value & 1; if (this.strobe) this.index = 0; }
  read() {
    if (this.index >= 8) return 1;
    const value = this.buttons[this.index] || 0;
    if (!this.strobe) this.index++;
    return value;
  }
  reset() { this.buttons.fill(0); this.strobe = 0; this.index = 0; }
}
