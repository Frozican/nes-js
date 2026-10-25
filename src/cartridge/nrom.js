export class NROM {
  constructor(image) {
    this.prgRom = image.prgRom;
    this.chr = image.chrRom;
    this.chrRam = image.chrRam;
    this.mirroring = image.mirroring;
    this.mapper = 0;
  }
  cpuRead(address) {
    if (address >= 0x8000) return this.prgRom[(address - 0x8000) % this.prgRom.length];
    return null;
  }
  cpuWrite(address, value) {
    if (address >= 0x8000) return true;
    return false;
  }
  ppuRead(address) { return this.chr[address & 0x1fff]; }
  ppuWrite(address, value) {
    if (this.chrRam) this.chr[address & 0x1fff] = value & 0xff;
  }
}
