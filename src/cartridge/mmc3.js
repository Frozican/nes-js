export class MMC3 {
  constructor(image, requestIRQ = () => {}) {
    this.prgRom = image.prgRom;
    // CHR-less cartridges use 8 KiB of writable CHR RAM. Keeping an empty
    // CHR-ROM array here makes every PPU pattern read return undefined/0,
    // which produces repeated garbage tiles instead of real graphics.
    // parseINES exposes chrRam as a boolean and may provide a zero-filled
    // chrRom buffer for the RAM-backed pattern table. Keep a writable backing
    // store and never mistake that boolean for the CHR memory itself.
    const hasChrRom = !!image.chrRom && image.chrRom.length > 0 && !image.chrRam;
    this.chrRam = image.chrRam
      ? (image.chrRom && image.chrRom.length ? image.chrRom : new Uint8Array(image.chrRamSize || 8192))
      : null;
    this.chr = hasChrRom ? image.chrRom : (this.chrRam || new Uint8Array(8192));
    this.mapper = 4;
    this.mirroring = image.mirroring;
    this.fourScreen = image.mirroring === "four-screen";
    this.prgRam = new Uint8Array(8192);
    this.bankSelect = 0;
    this.bankRegs = new Uint8Array(8);
    this.ramEnabled = true;
    this.ramWriteProtected = false;
    this.irqLatch = 0;
    this.irqCounter = 0;
    this.irqReload = false;
    this.irqEnabled = false;
    this.requestIRQ = requestIRQ;
    this.lastA12 = false;
    this.a12LowSince = 0;
    this.ppuTimestamp = 0;
  }
  cpuRead(a) {
    if (a >= 0x6000 && a < 0x8000) return this.ramEnabled ? this.prgRam[a & 0x1fff] : 0;
    if (a < 0x8000) return null;
    const slots = this.prgSlots();
    const slot = (a - 0x8000) >> 13;
    if (!this.prgRom || this.prgRom.length === 0) return 0;
    return this.prgRom[(slots[slot] * 0x2000 + (a & 0x1fff)) % this.prgRom.length] ?? 0;
  }
  prgSlots() {
    const count = Math.max(1, this.prgRom.length >> 13);
    const last = count - 1, penultimate = Math.max(0, count - 2);
    const r6 = this.bankRegs[6] % count, r7 = this.bankRegs[7] % count;
    return (this.bankSelect & 0x40) ? [penultimate, r7, r6, last] : [r6, r7, penultimate, last];
  }
  cpuWrite(a, v) {
    v &= 0xff;
    if (a >= 0x6000 && a < 0x8000) {
      if (this.ramEnabled && !this.ramWriteProtected) this.prgRam[a & 0x1fff] = v;
      return true;
    }
    if (a < 0x8000) return false;
    switch (a & 0xe001) {
      case 0x8000: this.bankSelect = v; break;
      case 0x8001: this.bankRegs[this.bankSelect & 7] = (this.bankSelect & 7) < 2 ? (v & 0xfe) : v; break;
      case 0xa000: if (!this.fourScreen) this.mirroring = (v & 1) ? "horizontal" : "vertical"; break;
      case 0xa001: this.ramEnabled = !!(v & 0x80); this.ramWriteProtected = !!(v & 0x40); break;
      case 0xc000: this.irqLatch = v; break;
      case 0xc001: this.irqReload = true; break;
      case 0xe000: this.irqEnabled = false; break;
      case 0xe001: this.irqEnabled = true; break;
    }
    return true;
  }
  chrSlots() {
    const r = this.bankRegs;
    const pair0 = r[0] & 0xfe, pair1 = r[1] & 0xfe;
    const normal = [pair0, pair0 + 1, pair1, pair1 + 1, r[2], r[3], r[4], r[5]];
    return (this.bankSelect & 0x80) ? [...normal.slice(4), ...normal.slice(0, 4)] : normal;
  }
  ppuRead(a) {
    if (!this.chr || this.chr.length === 0) return 0;
    const bankCount = Math.max(1, this.chr.length >> 10);
    const bank = this.chrSlots()[a >> 10] % bankCount;
    return this.chr[bank * 0x400 + (a & 0x3ff)] ?? 0;
  }
  ppuWrite(a, v) {
    if (!this.chrRam || !this.chr || this.chr.length === 0) return;
    const bankCount = Math.max(1, this.chr.length >> 10);
    const bank = this.chrSlots()[a >> 10] % bankCount;
    this.chr[bank * 0x400 + (a & 0x3ff)] = v & 0xff;
  }
  clockPpuAddress(address, dot = 0) {
    // Retained for compatibility with callers that model real PPU bus edges.
    // The current renderer batches pixels, so its memory reads are not real-time
    // bus activity and must not drive MMC3 IRQs.
  }
  clockScanline() {
    // Approximate the MMC3 IRQ counter at a stable point near the end of each
    // visible scanline. This is much more deterministic than counting batched
    // renderer reads as A12 transitions, especially for SMB3's split-screen.
    if (this.irqCounter === 0 || this.irqReload) {
      this.irqCounter = this.irqLatch;
      this.irqReload = false;
    } else {
      this.irqCounter = (this.irqCounter - 1) & 0xff;
    }
    if (this.irqCounter === 0 && this.irqEnabled) this.requestIRQ();
  }
}
