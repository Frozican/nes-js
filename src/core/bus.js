export class Bus {
  constructor() {
    this.ram = new Uint8Array(2048);
    this.cartridge = null;
    this.ppu = null;
    this.controller = null;
    this.cpu = null;
  }
  read(address) {
    address &= 0xffff;
    if (address < 0x2000) return this.ram[address & 0x7ff];
    if (address < 0x4000) return this.ppu ? this.ppu.cpuRead(0x2000 | (address & 7)) : 0;
    if (address === 0x4016) return this.controller ? this.controller.read() : 1;
    if (address >= 0x4020 && this.cartridge) {
      const value = this.cartridge.cpuRead(address);
      if (value !== null && value !== undefined) return value;
    }
    return 0;
  }
  write(address, value) {
    address &= 0xffff; value &= 0xff;
    if (address < 0x2000) this.ram[address & 0x7ff] = value;
    else if (address < 0x4000) { if (this.ppu) this.ppu.cpuWrite(0x2000 | (address & 7), value); }
    else if (address === 0x4014) {
      if (this.ppu) {
        const start = value << 8;
        for (let i = 0; i < 256; i++) this.ppu.oam[(this.ppu.oamAddr + i) & 0xff] = this.read(start + i);
      }
      if (this.cpu) this.cpu.addStallCycles(513 + (this.cpu.cycles & 1));
    }
    else if (address === 0x4016) { if (this.controller) this.controller.write(value); }
    else if (address >= 0x4020 && this.cartridge) this.cartridge.cpuWrite(address, value);
  }
  read16(address) { return this.read(address) | (this.read((address + 1) & 0xffff) << 8); }
  reset() { this.ram.fill(0); }
}
