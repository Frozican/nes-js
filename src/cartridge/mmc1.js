export class MMC1 {
  constructor(image){this.prgRom=image.prgRom;this.chr=image.chrRom;this.chrRam=image.chrRam;this.mirroring=image.mirroring;this.mapper=1;this.shift=0x10;this.control=0x0c;this.chrBank0=0;this.chrBank1=0;this.prgBank=0;this.prgRam=new Uint8Array(8192);}
  cpuRead(a){if(a>=0x6000&&a<0x8000)return this.prgRam[a&0x1fff];if(a<0x8000)return null;const banks=this.prgRom.length/0x4000;let bank;if((this.control&8)===0)bank=(this.prgBank&0x0e)+(a>=0xc000?1:0);else if(this.control&4)bank=a<0xc000?this.prgBank%banks:banks-1;else bank=a<0xc000?0:(this.prgBank%banks);return this.prgRom[((bank%banks)*0x4000+(a&0x3fff))%this.prgRom.length];}
  cpuWrite(a,v){if(a>=0x6000&&a<0x8000){this.prgRam[a&0x1fff]=v;return true;}if(a<0x8000)return false;if(v&0x80){this.shift=0x10;this.control|=0x0c;return true;}const done=this.shift&1;this.shift=(this.shift>>1)|((v&1)<<4);if(done){const val=this.shift;if(a<0xa000)this.control=val;else if(a<0xc000)this.chrBank0=val;else if(a<0xe000)this.chrBank1=val;else this.prgBank=val&15;this.shift=0x10;}return true;}
  ppuRead(a){const bankSize=(this.control&0x10)?0x1000:0x2000;const bank=(this.control&0x10)?(a<0x1000?this.chrBank0:this.chrBank1):(this.chrBank0&0x1e);return this.chr[((bank*(bankSize===0x1000?0x1000:0x1000)+(a&(bankSize-1)))%this.chr.length)];}
  ppuWrite(a,v){if(this.chrRam)this.chr[a&0x1fff]=v&255;}
}
