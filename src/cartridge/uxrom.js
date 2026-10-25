export class UxROM {
  constructor(image) {
    this.prgRom = image.prgRom;
    this.chr = image.chrRom;
    this.chrRam = image.chrRam;
    this.mirroring = image.mirroring;
    this.mapper = 2;
    this.bankCount = this.prgRom.length / 0x4000;
    this.bankSelect = 0;
  }

  cpuRead(address) {
    if (address >= 0x8000 && address < 0xc000) return this.prgRom[this.bankSelect * 0x4000 + (address - 0x8000)];
    if (address >= 0xc000) return this.prgRom[(this.bankCount - 1) * 0x4000 + (address - 0xc000)];
    return null;
  }

  cpuWrite(address, value) {
    if (address >= 0x8000) { this.bankSelect = (value & 0xff) % this.bankCount; return true; }
    return false;
  }

  ppuRead(address) { return this.chr[address & 0x1fff]; }
  ppuWrite(address, value) { if (this.chrRam) this.chr[address & 0x1fff] = value & 0xff; }
}
