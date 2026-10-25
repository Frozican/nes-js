export class CNROM {
  constructor(image) {
    this.prgRom = image.prgRom;
    this.chr = image.chrRom;
    this.chrRam = image.chrRam;
    this.mirroring = image.mirroring;
    this.mapper = 3;
    this.chrBankCount = Math.floor(this.chr.length / 0x2000);
    this.chrBankSelect = 0;
  }

  cpuRead(address) {
    if (address >= 0x8000) return this.prgRom[(address - 0x8000) % this.prgRom.length];
    return null;
  }

  cpuWrite(address, value) {
    if (address >= 0x8000) {
      if (!this.chrRam && this.chrBankCount > 0) {
        this.chrBankSelect = (value & 0x03) % this.chrBankCount;
      }
      return true;
    }
    return false;
  }

  ppuRead(address) {
    const offset = this.chrBankSelect * 0x2000 + (address & 0x1fff);
    return this.chr[offset];
  }

  ppuWrite(address, value) {
    if (this.chrRam) this.chr[address & 0x1fff] = value & 0xff;
  }
}
