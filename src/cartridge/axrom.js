export class AxROM {
 constructor(image){this.prgRom=image.prgRom;this.chr=image.chrRom;this.chrRam=image.chrRam;this.mapper=7;this.bank=0;this.mirroring="single0";}
 cpuRead(a){if(a>=0x8000)return this.prgRom[(this.bank*0x8000+(a-0x8000))%this.prgRom.length];return null;}
 cpuWrite(a,v){if(a>=0x8000){this.bank=v&7;this.mirroring=(v&0x10)?"single1":"single0";return true;}return false;}
 ppuRead(a){return this.chr[a&0x1fff];}
 ppuWrite(a,v){if(this.chrRam)this.chr[a&0x1fff]=v&255;}
}
