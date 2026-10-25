import {parseINES} from "../cartridge/ines.js";import {NROM} from "../cartridge/nrom.js";import {UxROM} from "../cartridge/uxrom.js";import {CNROM} from "../cartridge/cnrom.js";import {MMC1} from "../cartridge/mmc1.js";import {AxROM} from "../cartridge/axrom.js";import {Bus} from "./bus.js";import {CPU6502} from "./cpu6502.js";import {Controller} from "./controller.js";import {PPU} from "../ppu/ppu.js";import {APU} from "./apu.js";
export class NES{
 constructor(){this.bus=new Bus();this.ppu=new PPU();this.controller=new Controller();this.apu=new APU();this.bus.ppu=this.ppu;this.bus.controller=this.controller;this.bus.apu=this.apu;this.cpu=new CPU6502(this.bus);this.bus.cpu=this.cpu;this.ppu.setNMICallback(()=>this.cpu.requestNMI());this.cartridge=null;this.loaded=false;}
 loadROM(buffer){const image=parseINES(buffer);const constructors={0:NROM,1:MMC1,2:UxROM,3:CNROM,7:AxROM};this.cartridge=new constructors[image.mapper](image);this.bus.cartridge=this.cartridge;this.ppu.setCartridge(this.cartridge);this.bus.reset();this.ppu.reset();this.apu.reset();this.cpu.reset();this.loaded=true;return {mapper:image.mapper,prgSize:image.prgRom.length,chrSize:image.chrRam?8192:image.chrRom.length,chrRam:image.chrRam,mirroring:image.mirroring};}
 stepInstruction(){if(!this.loaded)throw new Error("Load a ROM first.");const before=this.cpu.cycles;const used=this.cpu.step();const elapsed=this.cpu.cycles-before;this.ppu.tick(elapsed*3);this.apu.clock(elapsed);return elapsed||used;}
 runInstructions(count=1000){for(let i=0;i<count;i++)this.stepInstruction();}
 runFrame(){if(!this.loaded)throw new Error("Load a ROM first.");const start=this.cpu.cycles;while(this.cpu.cycles-start<29781)this.stepInstruction();}
 renderFrame(){return this.ppu.renderFrame();}
 reset(){if(!this.loaded)return;this.bus.reset();this.ppu.reset();this.apu.reset();this.controller.reset();this.cpu.reset();}
}
