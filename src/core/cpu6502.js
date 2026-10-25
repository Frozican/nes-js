import { FLAGS } from "./constants.js";

export class CPU6502 {
  constructor(bus) { this.bus = bus; this.reset(); }
  reset() {
    this.a = 0; this.x = 0; this.y = 0; this.sp = 0xfd; this.p = FLAGS.I | FLAGS.U;
    this.pc = this.bus.read16(0xfffc); this.cycles = 7; this.instructions = 0; this.nmiPending = false; this.irqPending = false; this.pageCrossed = false;
  }
  read(address) { return this.bus.read(address & 0xffff); }
  write(address, value) { this.bus.write(address & 0xffff, value & 0xff); }
  fetch() { const value = this.read(this.pc); this.pc = (this.pc + 1) & 0xffff; return value; }
  fetch16() { const lo = this.fetch(); return lo | (this.fetch() << 8); }
  flag(mask) { return (this.p & mask) !== 0; }
  setFlag(mask, value) { this.p = value ? (this.p | mask) : (this.p & ~mask); this.p = (this.p | FLAGS.U) & 0xff; }
  setZN(value) { value &= 0xff; this.setFlag(FLAGS.Z, value === 0); this.setFlag(FLAGS.N, value & 0x80); return value; }
  push(value) { this.write(0x100 | this.sp, value); this.sp = (this.sp - 1) & 0xff; }
  pull() { this.sp = (this.sp + 1) & 0xff; return this.read(0x100 | this.sp); }
  branch(condition) { const offset = this.fetch(); if (condition) { const old = this.pc; this.pc = (this.pc + (offset < 0x80 ? offset : offset - 0x100)) & 0xffff; return 3 + ((old & 0xff00) !== (this.pc & 0xff00) ? 1 : 0); } return 2; }
  readZeroPageX() { return (this.fetch() + this.x) & 0xff; }
  readZeroPageY() { return (this.fetch() + this.y) & 0xff; }
  readIndirectX() { const zp = (this.fetch() + this.x) & 0xff; return this.read(zp) | (this.read((zp + 1) & 0xff) << 8); }
  indexedAddress(base, index) { const address = (base + index) & 0xffff; this.pageCrossed = (base & 0xff00) !== (address & 0xff00); return address; }
  readIndirectY() { const zp = this.fetch(); const base = this.read(zp) | (this.read((zp + 1) & 0xff) << 8); return this.indexedAddress(base, this.y); }
  shiftLeft(value) { this.setFlag(FLAGS.C, value & 0x80); return this.setZN(value << 1); }
  shiftRight(value) { this.setFlag(FLAGS.C, value & 1); return this.setZN(value >>> 1); }
  rotateLeft(value) { const carry = this.flag(FLAGS.C) ? 1 : 0; this.setFlag(FLAGS.C, value & 0x80); return this.setZN((value << 1) | carry); }
  rotateRight(value) { const carry = this.flag(FLAGS.C) ? 0x80 : 0; this.setFlag(FLAGS.C, value & 1); return this.setZN((value >>> 1) | carry); }
  adc(value) { const old = this.a; const sum = old + value + (this.flag(FLAGS.C) ? 1 : 0); this.setFlag(FLAGS.C, sum > 0xff); this.setFlag(FLAGS.V, (~(old ^ value) & (old ^ sum) & 0x80) !== 0); this.a = this.setZN(sum); }
  sbc(value) { this.adc(value ^ 0xff); }
  requestNMI() { this.nmiPending = true; }
  requestIRQ() { this.irqPending = true; }
  addStallCycles(count) { this.cycles += count; }
  serviceNMI() {
    this.push(this.pc >> 8); this.push(this.pc & 0xff);
    this.push((this.p & ~FLAGS.B) | FLAGS.U);
    this.setFlag(FLAGS.I, true);
    this.pc = this.read(0xfffa) | (this.read(0xfffb) << 8);
    this.cycles += 7; this.nmiPending = false;
  }
  serviceIRQ() {
    this.push(this.pc >> 8); this.push(this.pc & 0xff);
    this.push((this.p & ~FLAGS.B) | FLAGS.U);
    this.setFlag(FLAGS.I, true);
    this.pc = this.read(0xfffe) | (this.read(0xffff) << 8);
    this.cycles += 7; this.irqPending = false;
  }
  step() {
    if (this.nmiPending) { this.serviceNMI(); return 7; }
    if (this.irqPending && !this.flag(FLAGS.I)) { this.serviceIRQ(); return 7; }
    this.pageCrossed = false;
    const op = this.fetch(); let c = 2, addr, value;
    switch (op) {
      case 0x00: this.pc = (this.pc + 1) & 0xffff; this.push(this.pc >> 8); this.push(this.pc & 0xff); this.push(this.p | FLAGS.B | FLAGS.U); this.setFlag(FLAGS.I,true); this.pc=this.read(0xfffe)|(this.read(0xffff)<<8); c=7; break;
      case 0xea: case 0x1a: case 0x3a: case 0x5a: case 0x7a: case 0xda: case 0xfa: c=2; break;
      // Unofficial 6502 NOPs used by commercial NES games, including Super Mario Bros. 3.
      case 0x80: case 0x82: case 0x89: case 0xc2: case 0xe2: this.fetch(); c=2; break;
      case 0x04: case 0x44: case 0x64: this.fetch(); c=3; break;
      case 0x14: case 0x34: case 0x54: case 0x74: case 0xd4: case 0xf4: this.readZeroPageX(); c=4; break;
      case 0x0c: this.fetch16(); c=4; break;
      case 0x1c: case 0x3c: case 0x5c: case 0x7c: case 0xdc: case 0xfc:
        addr=this.indexedAddress(this.fetch16(),this.x); c=4+(this.pageCrossed?1:0); break;
      case 0xa9: this.a=this.setZN(this.fetch()); c=2; break;
      case 0xa5: this.a=this.setZN(this.read(this.fetch())); c=3; break;
      case 0xad: this.a=this.setZN(this.read(this.fetch16())); c=4; break;
      case 0xbd: addr=this.indexedAddress(this.fetch16(),this.x); this.a=this.setZN(this.read(addr)); c=4+(this.pageCrossed?1:0); break;
      case 0xb9: addr=this.indexedAddress(this.fetch16(),this.y); this.a=this.setZN(this.read(addr)); c=4+(this.pageCrossed?1:0); break;
      case 0xa2: this.x=this.setZN(this.fetch()); c=2; break;
      case 0xa6: this.x=this.setZN(this.read(this.fetch())); c=3; break;
      case 0xae: this.x=this.setZN(this.read(this.fetch16())); c=4; break;
      case 0xa0: this.y=this.setZN(this.fetch()); c=2; break;
      case 0xa4: this.y=this.setZN(this.read(this.fetch())); c=3; break;
      case 0xac: this.y=this.setZN(this.read(this.fetch16())); c=4; break;
      case 0x85: this.write(this.fetch(),this.a); c=3; break;
      case 0x8d: this.write(this.fetch16(),this.a); c=4; break;
      case 0x95: this.write((this.fetch()+this.x)&0xff,this.a); c=4; break;
      case 0x9d: this.write((this.fetch16()+this.x)&0xffff,this.a); c=5; break;
      case 0x99: this.write((this.fetch16()+this.y)&0xffff,this.a); c=5; break;
      case 0x86: this.write(this.fetch(),this.x); c=3; break;
      case 0x8e: this.write(this.fetch16(),this.x); c=4; break;
      case 0x84: this.write(this.fetch(),this.y); c=3; break;
      case 0x8c: this.write(this.fetch16(),this.y); c=4; break;
      case 0xaa: this.x=this.setZN(this.a); c=2; break;
      case 0x8a: this.a=this.setZN(this.x); c=2; break;
      case 0xa8: this.y=this.setZN(this.a); c=2; break;
      case 0x98: this.a=this.setZN(this.y); c=2; break;
      case 0xe8: this.x=this.setZN(this.x+1); c=2; break;
      case 0xca: this.x=this.setZN(this.x-1); c=2; break;
      case 0xc8: this.y=this.setZN(this.y+1); c=2; break;
      case 0x88: this.y=this.setZN(this.y-1); c=2; break;
      case 0x69: this.adc(this.fetch()); c=2; break;
      case 0xe9: case 0xeb: this.sbc(this.fetch()); c=2; break;
      case 0x24: value=this.read(this.fetch()); this.setFlag(FLAGS.Z,(this.a & value)===0); this.setFlag(FLAGS.V,value & 0x40); this.setFlag(FLAGS.N,value & 0x80); c=3; break;
      case 0x2c: value=this.read(this.fetch16()); this.setFlag(FLAGS.Z,(this.a & value)===0); this.setFlag(FLAGS.V,value & 0x40); this.setFlag(FLAGS.N,value & 0x80); c=4; break;
      case 0x29: this.a=this.setZN(this.a&this.fetch()); c=2; break;
      case 0x09: this.a=this.setZN(this.a|this.fetch()); c=2; break;
      case 0x49: this.a=this.setZN(this.a^this.fetch()); c=2; break;
      case 0xc9: value=this.fetch(); this.compare(this.a,value); c=2; break;
      case 0xe0: this.compare(this.x,this.fetch()); c=2; break;
      case 0xc0: this.compare(this.y,this.fetch()); c=2; break;
      case 0x18: this.setFlag(FLAGS.C,false); c=2; break;
      case 0x38: this.setFlag(FLAGS.C,true); c=2; break;
      case 0x58: this.setFlag(FLAGS.I,false); c=2; break;
      case 0x78: this.setFlag(FLAGS.I,true); c=2; break;
      case 0xd8: this.setFlag(FLAGS.D,false); c=2; break;
      case 0xf8: this.setFlag(FLAGS.D,true); c=2; break;
      case 0xb8: this.setFlag(FLAGS.V,false); c=2; break;
      case 0x4c: this.pc=this.fetch16(); c=3; break;
      case 0x6c: addr=this.fetch16(); this.pc=this.read(addr)|(this.read((addr&0xff00)|((addr+1)&0xff))<<8); c=5; break;
      case 0x20: addr=this.fetch16(); this.push((this.pc-1)>>8); this.push((this.pc-1)&0xff); this.pc=addr; c=6; break;
      case 0x60: this.pc=((this.pull()|(this.pull()<<8))+1)&0xffff; c=6; break;
      case 0x40: this.p=(this.pull()&~FLAGS.B)|FLAGS.U; this.pc=this.pull()|(this.pull()<<8); c=6; break;
      case 0x48: this.push(this.a); c=3; break;
      case 0x68: this.a=this.setZN(this.pull()); c=4; break;
      case 0x08: this.push(this.p|FLAGS.B|FLAGS.U); c=3; break;
      case 0x28: this.p=(this.pull()&~FLAGS.B)|FLAGS.U; c=4; break;
      case 0xd0: c=this.branch(!this.flag(FLAGS.Z)); break;
      case 0xf0: c=this.branch(this.flag(FLAGS.Z)); break;
      case 0x10: c=this.branch(!this.flag(FLAGS.N)); break;
      case 0x30: c=this.branch(this.flag(FLAGS.N)); break;
      case 0x90: c=this.branch(!this.flag(FLAGS.C)); break;
      case 0xb0: c=this.branch(this.flag(FLAGS.C)); break;
      case 0x50: c=this.branch(!this.flag(FLAGS.V)); break;
      case 0x70: c=this.branch(this.flag(FLAGS.V)); break;
      case 0xa1: this.a=this.setZN(this.read(this.readIndirectX())); c=6; break;
      case 0xb1: this.a=this.setZN(this.read(this.readIndirectY())); c=5+(this.pageCrossed?1:0); break;
      case 0xb5: this.a=this.setZN(this.read(this.readZeroPageX())); c=4; break;
      case 0x81: this.write(this.readIndirectX(),this.a); c=6; break;
      case 0x91: this.write(this.readIndirectY(),this.a); c=6; break;
      case 0x96: this.write(this.readZeroPageY(),this.x); c=4; break;
      case 0x94: this.write(this.readZeroPageX(),this.y); c=4; break;
      case 0xbe: this.x=this.setZN(this.read(this.indexedAddress(this.fetch16(),this.y))); c=4+(this.pageCrossed?1:0); break;
      case 0xbc: this.y=this.setZN(this.read(this.indexedAddress(this.fetch16(),this.x))); c=4+(this.pageCrossed?1:0); break;
      case 0xb6: this.x=this.setZN(this.read(this.readZeroPageY())); c=4; break;
      case 0xb4: this.y=this.setZN(this.read(this.readZeroPageX())); c=4; break;
      case 0x65: this.adc(this.read(this.fetch())); c=3; break;
      case 0x75: this.adc(this.read(this.readZeroPageX())); c=4; break;
      case 0x6d: this.adc(this.read(this.fetch16())); c=4; break;
      case 0x7d: this.adc(this.read(this.indexedAddress(this.fetch16(),this.x))); c=4+(this.pageCrossed?1:0); break;
      case 0x79: this.adc(this.read(this.indexedAddress(this.fetch16(),this.y))); c=4+(this.pageCrossed?1:0); break;
      case 0x61: this.adc(this.read(this.readIndirectX())); c=6; break;
      case 0x71: this.adc(this.read(this.readIndirectY())); c=5+(this.pageCrossed?1:0); break;
      case 0xe5: this.sbc(this.read(this.fetch())); c=3; break;
      case 0xf5: this.sbc(this.read(this.readZeroPageX())); c=4; break;
      case 0xed: this.sbc(this.read(this.fetch16())); c=4; break;
      case 0xfd: this.sbc(this.read(this.indexedAddress(this.fetch16(),this.x))); c=4+(this.pageCrossed?1:0); break;
      case 0xf9: this.sbc(this.read(this.indexedAddress(this.fetch16(),this.y))); c=4+(this.pageCrossed?1:0); break;
      case 0xe1: this.sbc(this.read(this.readIndirectX())); c=6; break;
      case 0xf1: this.sbc(this.read(this.readIndirectY())); c=5+(this.pageCrossed?1:0); break;
      case 0x25: this.a=this.setZN(this.a & this.read(this.fetch())); c=3; break;
      case 0x35: this.a=this.setZN(this.a & this.read(this.readZeroPageX())); c=4; break;
      case 0x2d: this.a=this.setZN(this.a & this.read(this.fetch16())); c=4; break;
      case 0x3d: this.a=this.setZN(this.a & this.read(this.indexedAddress(this.fetch16(),this.x))); c=4+(this.pageCrossed?1:0); break;
      case 0x39: this.a=this.setZN(this.a & this.read(this.indexedAddress(this.fetch16(),this.y))); c=4+(this.pageCrossed?1:0); break;
      case 0x21: this.a=this.setZN(this.a & this.read(this.readIndirectX())); c=6; break;
      case 0x31: this.a=this.setZN(this.a & this.read(this.readIndirectY())); c=5+(this.pageCrossed?1:0); break;
      case 0x05: this.a=this.setZN(this.a | this.read(this.fetch())); c=3; break;
      case 0x15: this.a=this.setZN(this.a | this.read(this.readZeroPageX())); c=4; break;
      case 0x0d: this.a=this.setZN(this.a | this.read(this.fetch16())); c=4; break;
      case 0x1d: this.a=this.setZN(this.a | this.read(this.indexedAddress(this.fetch16(),this.x))); c=4+(this.pageCrossed?1:0); break;
      case 0x19: this.a=this.setZN(this.a | this.read(this.indexedAddress(this.fetch16(),this.y))); c=4+(this.pageCrossed?1:0); break;
      case 0x01: this.a=this.setZN(this.a | this.read(this.readIndirectX())); c=6; break;
      case 0x11: this.a=this.setZN(this.a | this.read(this.readIndirectY())); c=5+(this.pageCrossed?1:0); break;
      case 0x45: this.a=this.setZN(this.a ^ this.read(this.fetch())); c=3; break;
      case 0x55: this.a=this.setZN(this.a ^ this.read(this.readZeroPageX())); c=4; break;
      case 0x4d: this.a=this.setZN(this.a ^ this.read(this.fetch16())); c=4; break;
      case 0x5d: this.a=this.setZN(this.a ^ this.read(this.indexedAddress(this.fetch16(),this.x))); c=4+(this.pageCrossed?1:0); break;
      case 0x59: this.a=this.setZN(this.a ^ this.read(this.indexedAddress(this.fetch16(),this.y))); c=4+(this.pageCrossed?1:0); break;
      case 0x41: this.a=this.setZN(this.a ^ this.read(this.readIndirectX())); c=6; break;
      case 0x51: this.a=this.setZN(this.a ^ this.read(this.readIndirectY())); c=5+(this.pageCrossed?1:0); break;
      case 0xc5: this.compare(this.a,this.read(this.fetch())); c=3; break;
      case 0xd5: this.compare(this.a,this.read(this.readZeroPageX())); c=4; break;
      case 0xcd: this.compare(this.a,this.read(this.fetch16())); c=4; break;
      case 0xdd: this.compare(this.a,this.read(this.indexedAddress(this.fetch16(),this.x))); c=4+(this.pageCrossed?1:0); break;
      case 0xd9: this.compare(this.a,this.read(this.indexedAddress(this.fetch16(),this.y))); c=4+(this.pageCrossed?1:0); break;
      case 0xc1: this.compare(this.a,this.read(this.readIndirectX())); c=6; break;
      case 0xd1: this.compare(this.a,this.read(this.readIndirectY())); c=5+(this.pageCrossed?1:0); break;
      case 0xe4: this.compare(this.x,this.read(this.fetch())); c=3; break;
      case 0xec: this.compare(this.x,this.read(this.fetch16())); c=4; break;
      case 0xc4: this.compare(this.y,this.read(this.fetch())); c=3; break;
      case 0xcc: this.compare(this.y,this.read(this.fetch16())); c=4; break;
      case 0xc6: addr=this.fetch(); value=(this.read(addr)-1)&0xff; this.write(addr,value); this.setZN(value); c=5; break;
      case 0xd6: addr=this.readZeroPageX(); value=(this.read(addr)-1)&0xff; this.write(addr,value); this.setZN(value); c=6; break;
      case 0xce: addr=this.fetch16(); value=(this.read(addr)-1)&0xff; this.write(addr,value); this.setZN(value); c=6; break;
      case 0xde: addr=(this.fetch16()+this.x)&0xffff; value=(this.read(addr)-1)&0xff; this.write(addr,value); this.setZN(value); c=7; break;
      case 0xe6: addr=this.fetch(); value=(this.read(addr)+1)&0xff; this.write(addr,value); this.setZN(value); c=5; break;
      case 0xf6: addr=this.readZeroPageX(); value=(this.read(addr)+1)&0xff; this.write(addr,value); this.setZN(value); c=6; break;
      case 0xee: addr=this.fetch16(); value=(this.read(addr)+1)&0xff; this.write(addr,value); this.setZN(value); c=6; break;
      case 0xfe: addr=(this.fetch16()+this.x)&0xffff; value=(this.read(addr)+1)&0xff; this.write(addr,value); this.setZN(value); c=7; break;
      case 0x0a: this.a=this.shiftLeft(this.a); c=2; break;
      case 0x06: addr=this.fetch(); this.write(addr,this.shiftLeft(this.read(addr))); c=5; break;
      case 0x16: addr=this.readZeroPageX(); this.write(addr,this.shiftLeft(this.read(addr))); c=6; break;
      case 0x0e: addr=this.fetch16(); this.write(addr,this.shiftLeft(this.read(addr))); c=6; break;
      case 0x1e: addr=(this.fetch16()+this.x)&0xffff; this.write(addr,this.shiftLeft(this.read(addr))); c=7; break;
      case 0x4a: this.a=this.shiftRight(this.a); c=2; break;
      case 0x46: addr=this.fetch(); this.write(addr,this.shiftRight(this.read(addr))); c=5; break;
      case 0x56: addr=this.readZeroPageX(); this.write(addr,this.shiftRight(this.read(addr))); c=6; break;
      case 0x4e: addr=this.fetch16(); this.write(addr,this.shiftRight(this.read(addr))); c=6; break;
      case 0x5e: addr=(this.fetch16()+this.x)&0xffff; this.write(addr,this.shiftRight(this.read(addr))); c=7; break;
      case 0x2a: this.a=this.rotateLeft(this.a); c=2; break;
      case 0x26: addr=this.fetch(); this.write(addr,this.rotateLeft(this.read(addr))); c=5; break;
      case 0x36: addr=this.readZeroPageX(); this.write(addr,this.rotateLeft(this.read(addr))); c=6; break;
      case 0x2e: addr=this.fetch16(); this.write(addr,this.rotateLeft(this.read(addr))); c=6; break;
      case 0x3e: addr=(this.fetch16()+this.x)&0xffff; this.write(addr,this.rotateLeft(this.read(addr))); c=7; break;
      case 0x6a: this.a=this.rotateRight(this.a); c=2; break;
      case 0x66: addr=this.fetch(); this.write(addr,this.rotateRight(this.read(addr))); c=5; break;
      case 0x76: addr=this.readZeroPageX(); this.write(addr,this.rotateRight(this.read(addr))); c=6; break;
      case 0x6e: addr=this.fetch16(); this.write(addr,this.rotateRight(this.read(addr))); c=6; break;
      case 0x7e: addr=(this.fetch16()+this.x)&0xffff; this.write(addr,this.rotateRight(this.read(addr))); c=7; break;
      case 0x9a: this.sp=this.x; c=2; break;
      case 0xba: this.x=this.setZN(this.sp); c=2; break;
      case 0xa7: this.x=this.a=this.setZN(this.read(this.fetch())); c=3; break;
      case 0xa3: this.x=this.a=this.setZN(this.read(this.readIndirectX())); c=6; break;
      case 0xb3: this.x=this.a=this.setZN(this.read(this.readIndirectY())); c=5; break;
      case 0xb7: this.x=this.a=this.setZN(this.read(this.readZeroPageY())); c=4; break;
      case 0xaf: this.x=this.a=this.setZN(this.read(this.fetch16())); c=4; break;
      case 0xbf: this.x=this.a=this.setZN(this.read(this.indexedAddress(this.fetch16(),this.y))); c=4+(this.pageCrossed?1:0); break;

      default: throw new Error(`Unsupported CPU opcode ${op.toString(16).padStart(2,"0").toUpperCase()} at ${((this.pc-1)&0xffff).toString(16).padStart(4,"0").toUpperCase()}`);
    }
    this.p |= FLAGS.U; this.cycles += c; this.instructions++; return c;
  }
  compare(register,value) { const result=(register-value)&0x1ff; this.setFlag(FLAGS.C,register>=value); this.setZN(result); }
}
