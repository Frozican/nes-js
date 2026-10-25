import { SCREEN_WIDTH, SCREEN_HEIGHT, NES_PALETTE } from "../core/constants.js";

const FRAME_MASK = 0x3fff;

export class PPU {
  constructor() {
    this.cartridge = null;
    this.vram = new Uint8Array(4096);
    this.palette = new Uint8Array(32);
    this.oam = new Uint8Array(256);
    this.framebuffer = new Uint32Array(SCREEN_WIDTH * SCREEN_HEIGHT);
    this.frame = 0;
    this.control = 0;
    this.mask = 0;
    this.status = 0;
    this.oamAddr = 0;
    this.v = 0;
    this.t = 0;
    this.fineX = 0;
    this.writeToggle = 0;
    this.readBuffer = 0;
    this.ioLatch = 0;
    this.scanline = 261;
    this.dot = 0;
    this.renderedX = 0;
    this.nmiCallback = null;
    this.lastPpuAddress = 0;
    this.ppuAddressLowDots = 0;
  }

  setCartridge(cart) { this.cartridge = cart; }
  setNMICallback(callback) { this.nmiCallback = callback; }
  tick(dots) {
    // Advance directly between PPU events rather than iterating every dot.
    // The old per-dot loop performed roughly 90,000 iterations per frame.
    while (dots > 0) {
      let nextEvent = 341;
      if (this.scanline >= 0 && this.scanline < SCREEN_HEIGHT && this.dot < 256) {
        nextEvent = Math.min(nextEvent, 256);
      }
      if (this.scanline === 241 && this.dot < 2) nextEvent = Math.min(nextEvent, 2);
      if (this.scanline === 261 && this.dot < 2) nextEvent = Math.min(nextEvent, 2);
      const step = Math.min(dots, nextEvent - this.dot);
      this.dot += step;
      dots -= step;

      if (this.scanline >= 0 && this.scanline < SCREEN_HEIGHT && this.dot === 256) {
        this.renderScanline(this.scanline);
      }
      // MMC3 scanline IRQs are clocked at the end of each visible scanline.
      // Rendering pixels in a batch must not fabricate dozens of PPU A12
      // edges at one dot; that made IRQ split-screen effects fire unpredictably.
      if (this.scanline >= 0 && this.scanline < SCREEN_HEIGHT && this.dot === 260) {
        this.cartridge?.clockScanline?.();
      }
      if (this.scanline === 241 && this.dot === 2) {
        this.status |= 0x80;
        if (this.control & 0x80) this.nmiCallback?.();
      }
      if (this.scanline === 261 && this.dot === 2) this.status &= 0x1f;
      if (this.dot >= 341) {
        this.dot = 0;
        this.scanline = (this.scanline + 1) % 262;
        this.renderedX = 0;
      }
    }
  }

  mirrorNameTable(address) {
    const index = (address - 0x2000) & 0x0fff;
    const table = index >> 10;
    const offset = index & 0x03ff;
    const mirroring = this.cartridge?.mirroring;
    if (mirroring === "four-screen") return index;
    const mapped = mirroring === "vertical" ? (table & 1) : (table >> 1);
    return mapped * 0x400 + offset;
  }

  paletteIndex(address) {
    let index = (address - 0x3f00) & 0x1f;
    if (index === 0x10 || index === 0x14 || index === 0x18 || index === 0x1c) index -= 0x10;
    return index;
  }

  ppuRead(address) {
    address &= FRAME_MASK;
    if (address < 0x2000) return this.cartridge ? this.cartridge.ppuRead(address) : 0;
    if (address < 0x3f00) {
      if (address >= 0x3000) address -= 0x1000;
      return this.vram[this.mirrorNameTable(address)];
    }
    return this.palette[this.paletteIndex(address)] & 0x3f;
  }

  ppuWrite(address, value) {
    address &= FRAME_MASK;
    value &= 0xff;
    if (address < 0x2000) {
      this.cartridge?.ppuWrite(address, value);
    } else if (address < 0x3f00) {
      if (address >= 0x3000) address -= 0x1000;
      const index = this.mirrorNameTable(address);
      if (index < this.vram.length) this.vram[index] = value;
    } else {
      this.palette[this.paletteIndex(address)] = value & 0x3f;
    }
  }

  incrementVramAddress() {
    this.v = (this.v + ((this.control & 0x04) ? 32 : 1)) & 0x7fff;
  }

  cpuRead(address) {
    switch (address & 7) {
      case 2: {
        const value = (this.status & 0xe0) | (this.ioLatch & 0x1f);
        this.status &= 0x7f;
        this.writeToggle = 0;
        this.ioLatch = value;
        return value;
      }
      case 4:
        this.ioLatch = this.oam[this.oamAddr];
        return this.ioLatch;
      case 7: {
        const address = this.v & FRAME_MASK;
        let value = this.ppuRead(address);
        if (address < 0x3f00) {
          const buffered = this.readBuffer;
          this.readBuffer = value;
          value = buffered;
        } else {
          this.readBuffer = this.ppuRead((address - 0x1000) & FRAME_MASK);
        }
        this.incrementVramAddress();
        this.ioLatch = value;
        return value;
      }
      default:
        return this.ioLatch;
    }
  }

  flushVisiblePixels() {
    if (this.scanline < 0 || this.scanline >= SCREEN_HEIGHT) return;
    const endX = Math.min(256, Math.max(this.renderedX, this.dot));
    if (endX <= this.renderedX) return;
    this.currentY = this.scanline;
    const rowOffset = this.scanline * SCREEN_WIDTH;
    for (let x = this.renderedX; x < endX; x++) {
      const bg = this.backgroundPixel(x, this.scanline);
      this.framebuffer[rowOffset + x] = (0xff000000 | NES_PALETTE[bg.color]) >>> 0;
    }
    this.renderedX = endX;
    this.currentY = 0;
  }

  cpuWrite(address, value) {
    // Preserve pixels already elapsed before a scroll/mask/control write.
    this.flushVisiblePixels();
    value &= 0xff;
    this.ioLatch = value;
    switch (address & 7) {
      case 0: {
        const previouslyEnabled = (this.control & 0x80) !== 0;
        this.control = value;
        this.t = (this.t & 0xf3ff) | ((value & 3) << 10);
        if (!previouslyEnabled && (value & 0x80) && (this.status & 0x80)) this.nmiCallback?.();
        break;
      }
      case 1:
        this.mask = value;
        break;
      case 3:
        this.oamAddr = value;
        break;
      case 4:
        this.oam[this.oamAddr] = value;
        this.oamAddr = (this.oamAddr + 1) & 0xff;
        break;
      case 5:
        if (this.writeToggle === 0) {
          this.fineX = value & 7;
          this.t = (this.t & 0x7fe0) | (value >> 3);
        } else {
          this.t = (this.t & 0x0c1f) | ((value & 0xf8) << 2) | ((value & 7) << 12);
        }
        this.writeToggle ^= 1;
        break;
      case 6:
        if (this.writeToggle === 0) {
          this.t = (this.t & 0x00ff) | ((value & 0x3f) << 8);
        } else {
          this.t = (this.t & 0x7f00) | value;
          this.v = this.t;
        }
        this.writeToggle ^= 1;
        break;
      case 7:
        this.ppuWrite(this.v, value);
        this.incrementVramAddress();
        break;
    }
  }

  backgroundPixel(x, y) {
    if (!(this.mask & 0x08) || (x < 8 && !(this.mask & 0x02))) return { pixel: 0, color: this.ppuRead(0x3f00) & 0x3f };

    const baseX = ((this.t & 0x001f) * 8) + this.fineX;
    const baseY = (((this.t >> 5) & 0x1f) * 8) + ((this.t >> 12) & 7);
    const worldX = (x + baseX) % 512;
    const worldY = (y + baseY) % 480;
    const tableX = ((this.t >> 10) & 1) ^ (worldX >= 256 ? 1 : 0);
    const tableY = ((this.t >> 11) & 1) ^ (worldY >= 240 ? 1 : 0);
    const localX = worldX & 0xff;
    const localY = worldY % 240;
    const nametable = 0x2000 + tableY * 0x800 + tableX * 0x400;
    const tileX = localX >> 3;
    const tileY = localY >> 3;
    const tile = this.ppuRead(nametable + tileY * 32 + tileX);
    const patternBase = (this.control & 0x10) ? 0x1000 : 0;
    const row = localY & 7;
    const bit = 7 - (localX & 7);
    const patternAddress = patternBase + tile * 16 + row;
    const pixel = ((this.ppuRead(patternAddress) >> bit) & 1) |
      (((this.ppuRead(patternAddress + 8) >> bit) & 1) << 1);
    if (pixel === 0) return { pixel: 0, color: this.ppuRead(0x3f00) & 0x3f };

    const attribute = this.ppuRead(nametable + 0x3c0 + ((tileY >> 2) * 8) + (tileX >> 2));
    const quadrantShift = ((tileY & 2) << 1) | (tileX & 2);
    const palette = (attribute >> quadrantShift) & 3;
    return { pixel, color: this.ppuRead(0x3f00 + palette * 4 + pixel) & 0x3f };
  }

  drawSprites() {
    if (!(this.mask & 0x10)) return;
    const height = (this.control & 0x20) ? 16 : 8;
    const patternTable = (this.control & 0x08) ? 0x1000 : 0;
    const spriteLine = new Int16Array(SCREEN_WIDTH);
    spriteLine.fill(-1);
    let spritesOnLine = 0;

    for (let i = 0; i < 64; i++) {
      const base = i * 4;
      const top = this.oam[base] + 1;
      const tile = this.oam[base + 1];
      const attributes = this.oam[base + 2];
      const left = this.oam[base + 3];
      const rowOnSprite = this.currentY - top;
      if (rowOnSprite < 0 || rowOnSprite >= height) continue;
      spritesOnLine++;
      if (spritesOnLine > 8) {
        this.status |= 0x20;
        break;
      }

      let row = (attributes & 0x80) ? height - 1 - rowOnSprite : rowOnSprite;
      let address;
      if (height === 16) {
        const table = (tile & 1) ? 0x1000 : 0;
        const tileNumber = (tile & 0xfe) + (row >= 8 ? 1 : 0);
        row &= 7;
        address = table + tileNumber * 16 + row;
      } else {
        address = patternTable + tile * 16 + row;
      }
      const low = this.ppuRead(address);
      const high = this.ppuRead(address + 8);
      for (let column = 0; column < 8; column++) {
        const x = left + column;
        if (x < 0 || x >= SCREEN_WIDTH || spriteLine[x] !== -1) continue;
        if (x < 8 && !(this.mask & 0x04)) continue;
        const bit = (attributes & 0x40) ? column : 7 - column;
        const pixel = ((low >> bit) & 1) | (((high >> bit) & 1) << 1);
        if (!pixel) continue;
        spriteLine[x] = i;
        const offset = this.currentY * SCREEN_WIDTH + x;
        const bg = this.backgroundPixel(x, this.currentY);
        if (i === 0 && bg.pixel && x !== 255 && (this.mask & 0x08)) this.status |= 0x40;
        if ((attributes & 0x20) && bg.pixel) continue;
        const paletteAddress = 0x3f10 + (attributes & 3) * 4 + pixel;
        this.framebuffer[offset] = (0xff000000 | NES_PALETTE[this.ppuRead(paletteAddress) & 0x3f]) >>> 0;
      }
    }
  }

  renderScanline(y) {
    this.currentY = y;
    const rowOffset = y * SCREEN_WIDTH;
    for (let x = this.renderedX; x < SCREEN_WIDTH; x++) {
      const bg = this.backgroundPixel(x, y);
      this.framebuffer[rowOffset + x] = (0xff000000 | NES_PALETTE[bg.color]) >>> 0;
    }
    this.renderedX = SCREEN_WIDTH;
    this.drawSprites();
    this.currentY = 0;
  }

  renderFrame() {
    this.frame++;
    return this.framebuffer;
  }

  reset() {
    this.frame = 0;
    this.scanline = 261;
    this.dot = 0;
    this.renderedX = 0;
    this.status = 0;
    this.control = 0;
    this.mask = 0;
    this.oamAddr = 0;
    this.v = 0;
    this.t = 0;
    this.fineX = 0;
    this.writeToggle = 0;
    this.readBuffer = 0;
    this.ioLatch = 0;
    this.lastPpuAddress = 0;
    this.ppuAddressLowDots = 0;
    this.vram.fill(0);
    this.palette.fill(0);
    this.oam.fill(0);
    this.framebuffer.fill(0xff000000);
  }
}
