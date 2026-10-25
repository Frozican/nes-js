import { parseINES } from "../cartridge/ines.js";
import { NROM } from "../cartridge/nrom.js";
import { UxROM } from "../cartridge/uxrom.js";
import { CNROM } from "../cartridge/cnrom.js";
import { Bus } from "./bus.js";
import { CPU6502 } from "./cpu6502.js";
import { Controller } from "./controller.js";
import { PPU } from "../ppu/ppu.js";

export class NES {
  constructor() {
    this.bus=new Bus(); this.ppu=new PPU(); this.controller=new Controller();
    this.bus.ppu=this.ppu; this.bus.controller=this.controller; this.cpu=new CPU6502(this.bus); this.bus.cpu=this.cpu; this.ppu.setNMICallback(() => this.cpu.requestNMI()); this.cartridge=null; this.loaded=false;
  }
  loadROM(buffer) {
    const image=parseINES(buffer); this.cartridge=image.mapper === 2 ? new UxROM(image) : image.mapper === 3 ? new CNROM(image) : new NROM(image); this.bus.cartridge=this.cartridge; this.ppu.setCartridge(this.cartridge);
    this.bus.reset(); this.ppu.reset(); this.cpu.reset(); this.loaded=true;
    return {mapper:image.mapper,prgSize:image.prgRom.length,chrSize:image.chrRam?8192:image.chrRom.length,chrRam:image.chrRam,mirroring:image.mirroring};
  }
  stepInstruction(){if(!this.loaded)throw new Error("Load a ROM first.");const before=this.cpu.cycles;const used=this.cpu.step();const elapsed=this.cpu.cycles-before;this.ppu.tick(elapsed*3);return elapsed || used;}
  runInstructions(count=1000){for(let i=0;i<count;i++)this.stepInstruction();}
  runFrame(){if(!this.loaded)throw new Error("Load a ROM first.");const startCycles=this.cpu.cycles;const targetCycles=29781;while(this.cpu.cycles-startCycles<targetCycles)this.stepInstruction();}
  renderFrame(){return this.ppu.renderFrame();}
  reset(){if(!this.loaded)return;this.bus.reset();this.ppu.reset();this.controller.reset();this.cpu.reset();}
}
