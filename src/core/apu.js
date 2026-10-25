// NTSC NES APU: pulse, triangle, noise and DMC channels.
// The register/frame model is substantially more complete, but the renderer is still
// instruction-clocked and uses a browser sample queue rather than a cycle-exact mixer.
const LENGTH = [10,254,20,2,40,4,80,6,160,8,60,10,14,12,26,14,12,16,24,18,48,20,96,22,192,24,72,26,16,28,32,30];
const DUTY = [0b00000001,0b00000011,0b00001111,0b11111100];
const TRI = [15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
const NOISE_PERIOD = [4,8,16,32,64,96,128,160,202,254,380,508,762,1016,2034,4068];
const DMC_PERIOD = [428,380,340,320,286,254,226,214,190,160,142,128,106,85,72,54];
export class APU {
  constructor() {
    this.regs = new Uint8Array(0x18); this.sampleRate=44100; this.queue=[];
    this.samplePhase=0; this.cpuCycles=0; this.frameCycle=0; this.frameMode5=false; this.frameIRQInhibit=false; this.frameIRQ=false;
    this.enabled=0; this.irqCallback=()=>{};
    this.pulse=[this.makePulse(),this.makePulse()];
    this.triangle={timer:0,counter:0,step:0,length:0,linear:0,linearReload:0,reloadFlag:false};
    this.noise={timer:0,shift:1,length:0,envelope:0,envDivider:0,envStart:false};
    this.dmc={timer:0,remaining:0,address:0xc000,currentAddress:0xc000,sampleLength:1,buffer:null,shift:0,bits:8,silence:true,output:0,irq:false,loop:false,rate:0};
    this.audioContext=null;this.node=null;this.gain=null;
  }
  makePulse(){return {timer:0,phase:0,length:0,env:0,envDivider:0,envStart:false,sweepDivider:0,sweepReload:false};}
  unlock(){
    if(this.audioContext){if(this.audioContext.state==="suspended")this.audioContext.resume();return;}
    const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC)return;
    this.audioContext=new AC();this.sampleRate=this.audioContext.sampleRate;
    this.node=this.audioContext.createScriptProcessor(2048,0,1);this.gain=this.audioContext.createGain();this.gain.gain.value=.18;
    this.node.onaudioprocess=e=>{const out=e.outputBuffer.getChannelData(0);for(let i=0;i<out.length;i++)out[i]=this.queue.length?this.queue.shift():0;};
    this.node.connect(this.gain);this.gain.connect(this.audioContext.destination);this.audioContext.resume();
  }
  write(a,v){
    v&=255;if(a<0x4000||a>0x4017)return;
    if(a===0x4015){this.enabled=v&31;for(let i=0;i<2;i++)if(!(v&(1<<i)))this.pulse[i].length=0;if(!(v&4))this.triangle.length=0;if(!(v&8))this.noise.length=0;if(!(v&16))this.dmc.remaining=0;else if(!this.dmc.remaining)this.restartDMC();this.dmc.irq=false;return;}
    if(a===0x4017){this.frameMode5=!!(v&0x80);this.frameIRQInhibit=!!(v&0x40);if(this.frameIRQInhibit)this.frameIRQ=false;this.frameCycle=0;if(this.frameMode5)this.quarterFrame(),this.halfFrame();return;}
    this.regs[a-0x4000]=v;
    if(a<=0x4007){const i=a>=0x4004?1:0,r=a-(i?0x4004:0),p=this.pulse[i];if(r===0)p.envStart=true;if(r===1)p.sweepReload=true;if(r===2)p.timer=(p.timer&0x700)|v;if(r===3){p.timer=(p.timer&255)|((v&7)<<8);if(this.enabled&(1<<i))p.length=LENGTH[v>>3];p.phase=0;p.envStart=true;}}
    else if(a<=0x400b){if(a===0x4008)this.triangle.linearReload=v&127;if(a===0x400a)this.triangle.timer=(this.triangle.timer&0x700)|v;if(a===0x400b){this.triangle.timer=(this.triangle.timer&255)|((v&7)<<8);if(this.enabled&4)this.triangle.length=LENGTH[v>>3];this.triangle.reloadFlag=true;}}
    else if(a===0x400c)this.noise.envStart=true;
    else if(a===0x400e)this.noise.period=v&15,this.noise.mode=!!(v&0x80);
    else if(a===0x400f){if(this.enabled&8)this.noise.length=LENGTH[v>>3];this.noise.envStart=true;}
    else if(a===0x4010){this.dmc.rate=v&15;this.dmc.loop=!!(v&0x40);this.dmc.irqEnabled=!!(v&0x80);if(!this.dmc.irqEnabled)this.dmc.irq=false;}
    else if(a===0x4011)this.dmc.output=v&0x7f;
    else if(a===0x4012)this.dmc.address=0xc000+(v<<6);
    else if(a===0x4013)this.dmc.sampleLength=(v<<4)+1;
  }
  readStatus(){return (this.pulse[0].length?1:0)|(this.pulse[1].length?2:0)|(this.triangle.length?4:0)|(this.noise.length?8:0)|(this.dmc.remaining?16:0)|(this.frameIRQ?64:0)|(this.dmc.irq?128:0);}
  readStatusAndClear(){const v=this.readStatus();this.frameIRQ=false;return v;}
  quarterFrame(){
    for(let i=0;i<2;i++){const p=this.pulse[i],r=this.regs[i*4];if(p.envStart){p.env=15;p.envDivider=r&15;p.envStart=false;}else if(p.envDivider===0){p.envDivider=r&15;if(p.env)p.env--;else if(r&0x20)p.env=15;}else p.envDivider--;}
    const n=this.noise,r=this.regs[12];if(n.envStart){n.envelope=15;n.envDivider=r&15;n.envStart=false;}else if(n.envDivider===0){n.envDivider=r&15;if(n.envelope)n.envelope--;else if(r&0x20)n.envelope=15;}else n.envDivider--;
    const t=this.triangle;if(t.reloadFlag)t.linear=t.linearReload;else if(t.linear)t.linear--;if(!(this.regs[8]&0x80))t.reloadFlag=false;
  }
  halfFrame(){
    for(let i=0;i<2;i++){const p=this.pulse[i];if(p.length&&!(this.regs[i*4]&0x20))p.length--;this.clockSweep(i);}
    if(this.triangle.length&&!(this.regs[8]&0x80))this.triangle.length--;
    if(this.noise.length&&!(this.regs[12]&0x20))this.noise.length--;
  }
  clockSweep(i){const p=this.pulse[i],r=this.regs[i*4+1],period=(r>>4)&7,shift=r&7,change=p.timer>>shift,target=p.timer+((r&8)?-change-(i===0?1:0):change);if(p.sweepDivider===0&&(r&0x80)&&shift&&p.timer>=8&&target<=0x7ff)p.timer=target;if(p.sweepDivider===0||p.sweepReload){p.sweepDivider=period;p.sweepReload=false;}else p.sweepDivider--;}
  restartDMC(){const d=this.dmc;d.currentAddress=d.address;d.remaining=d.sampleLength;}
  clock(cycles=1){
    for(let n=0;n<cycles;n++){
      this.cpuCycles++;this.frameCycle++;
      // NTSC 4-step and 5-step sequencer events in CPU cycles.
      if(this.frameMode5){if([7457,14913,22371,37281].includes(this.frameCycle))this.quarterFrame();if([14913,37281].includes(this.frameCycle))this.halfFrame();if(this.frameCycle>=37282)this.frameCycle=0;}
      else {if([7457,14913,22371,29829].includes(this.frameCycle))this.quarterFrame();if([14913,29829].includes(this.frameCycle))this.halfFrame();if(this.frameCycle===29829&&!this.frameIRQInhibit)this.frameIRQ=true;if(this.frameCycle>=29830)this.frameCycle=0;}
      for(const p of this.pulse){if(--p.timer<=0){p.timer=(p.timer&0x7ff)+1;p.phase=(p.phase+1)&7;}}
      const t=this.triangle;if(--t.counter<=0){t.counter=Math.max(1,t.timer);if(t.length&&t.linear&&t.timer>1)t.step=(t.step+1)&31;}
      const no=this.noise;if(--no.timer<=0){no.timer=NOISE_PERIOD[this.regs[14]&15];const tap=(this.regs[14]&0x80)?6:1;no.shift=(no.shift>>1)|(((no.shift^(no.shift>>tap))&1)<<14);}
      this.clockDMC();
      this.samplePhase+=this.sampleRate/1789773;if(this.samplePhase>=1){this.samplePhase-=1;this.queue.push(this.mix());if(this.queue.length>this.sampleRate)this.queue.splice(0,this.queue.length-this.sampleRate);}
    }
  }
  clockDMC(){const d=this.dmc;if(--d.timer<=0){d.timer=DMC_PERIOD[d.rate];if(!d.silence){if(d.shift&1){if(d.output<=125)d.output+=2;}else if(d.output>=2)d.output-=2;d.shift>>=1;}if(--d.bits===0){d.bits=8;if(d.buffer===null)d.silence=true;else{d.silence=false;d.shift=d.buffer;d.buffer=null;}}}if(d.remaining&&d.buffer===null){d.buffer=0;d.currentAddress=(d.currentAddress+1)&0xffff;if(d.currentAddress===0)d.currentAddress=0x8000;if(--d.remaining===0){if(d.loop)this.restartDMC();else if(d.irqEnabled)d.irq=true;}}}
  mix(){
    let p=0;for(let i=0;i<2;i++){const r=i*4,c=this.pulse[i],period=c.timer,shift=this.regs[r+1]&7,target=period+((this.regs[r+1]&8)?-(period>>shift)-(i===0?1:0):(period>>shift));if(c.length&&period>=8&&target<=0x7ff&&(DUTY[this.regs[r]>>6]&(1<<c.phase)))p+=((this.regs[r]&16)?this.regs[r]&15:c.env)/15;}
    const t=this.triangle.length&&this.triangle.linear&&this.triangle.timer>1?TRI[this.triangle.step]/15:0;
    const n=this.noise.length&&!(this.noise.shift&1)?((this.regs[12]&16)?this.regs[12]&15:this.noise.envelope)/15:0;
    const d=this.dmc.output/127;
    // Standard nonlinear pulse/TND approximation, normalized for Web Audio.
    const pulseOut=p?95.88/(8128/p+100):0, tndIn=t/8227+n/12241+d/22638;
    const tndOut=tndIn?159.79/(1/tndIn+100):0;
    return Math.max(-1,Math.min(1,(pulseOut+tndOut)*2-0.35));
  }
  reset(){this.regs.fill(0);this.queue.length=0;this.samplePhase=0;this.cpuCycles=0;this.frameCycle=0;this.enabled=0;this.frameIRQ=false;this.dmc.irq=false;this.pulse=[this.makePulse(),this.makePulse()];Object.assign(this.triangle,{timer:0,counter:0,step:0,length:0,linear:0,linearReload:0,reloadFlag:false});Object.assign(this.noise,{timer:0,shift:1,length:0,envelope:0,envDivider:0,envStart:false});Object.assign(this.dmc,{timer:0,remaining:0,currentAddress:0xc000,buffer:null,shift:0,bits:8,silence:true,output:0,irq:false});}
}
