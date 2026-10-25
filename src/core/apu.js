// Browser-friendly NES APU approximation: pulse, triangle and noise channels.
// Timing and nonlinear mixing are simplified; this is not cycle-accurate audio.
export class APU {
  constructor() {
    this.regs = new Uint8Array(0x18);
    this.sampleRate = 44100;
    this.sampleBuffer = [];
    this.samplePhase = 0;
    this.frameCycle = 0;
    this.frameStep = 0;
    this.enabled = 0;
    this.pulse = [{timer:0,phase:0,length:0,envelope:0,envStart:false},{timer:0,phase:0,length:0,envelope:0,envStart:false}];
    this.triangle = {timer:0,phase:0,length:0,linear:0,linearReload:false};
    this.noise = {timer:0,shift:1,length:0,envelope:0,envStart:false};
    this.audioContext = null; this.node = null; this.gain = null; this.queue = [];
  }
  unlock() {
    if (this.audioContext) { if (this.audioContext.state === "suspended") this.audioContext.resume(); return; }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    this.audioContext = new AC();
    this.sampleRate = this.audioContext.sampleRate;
    this.node = this.audioContext.createScriptProcessor(2048, 0, 1);
    this.gain = this.audioContext.createGain(); this.gain.gain.value = 0.18;
    this.node.onaudioprocess = e => {
      const out = e.outputBuffer.getChannelData(0);
      for (let i=0;i<out.length;i++) out[i] = this.queue.length ? this.queue.shift() : 0;
    };
    this.node.connect(this.gain); this.gain.connect(this.audioContext.destination);
    this.audioContext.resume();
  }
  write(address,value) {
    value &= 255;
    if (address < 0x4000 || address > 0x4017) return;
    if (address === 0x4015) {
      this.enabled=value&31;
      for(let i=0;i<2;i++) if(!(value&(1<<i))) this.pulse[i].length=0;
      if(!(value&4)) this.triangle.length=0;
      if(!(value&8)) this.noise.length=0;
      return;
    }
    if(address===0x4017){this.frameCycle=0;this.frameStep=0;return;}
    this.regs[address-0x4000]=value;
    if(address>=0x4000&&address<=0x4007){
      const i=address>=0x4004?1:0, r=address-(i?0x4004:0x4000), c=this.pulse[i];
      if(r===0)c.envStart=true;
      if(r===2)c.timer=(c.timer&0x700)|value;
      if(r===3){c.timer=(c.timer&255)|((value&7)<<8);if(this.enabled&(1<<i))c.length=LEN[value>>3];c.phase=0;c.envStart=true;}
    } else if(address>=0x4008&&address<=0x400b){
      if(address===0x4008)this.triangle.linearReload=value&127;
      if(address===0x400a)this.triangle.timer=(this.triangle.timer&0x700)|value;
      if(address===0x400b){this.triangle.timer=(this.triangle.timer&255)|((value&7)<<8);if(this.enabled&4)this.triangle.length=LEN[value>>3];this.triangle.linearReloadFlag=true;}
    } else if(address===0x400c)this.noise.envStart=true;
    else if(address===0x400e)this.noise.period=value&15, this.noise.mode=value&128;
    else if(address===0x400f){if(this.enabled&8)this.noise.length=LEN[value>>3];this.noise.envStart=true;}
  }
  readStatus(){return (this.pulse[0].length?1:0)|(this.pulse[1].length?2:0)|(this.triangle.length?4:0)|(this.noise.length?8:0);}
  clock(cycles=1){
    for(let n=0;n<cycles;n++){
      this.frameCycle++;
      if(this.frameCycle%7457===0){
        this.frameStep++;
        if(this.frameStep===4)this.frameStep=0;
        if(this.frameStep===0||this.frameStep===2){
          for(const p of this.pulse) if(p.length&&!(p.dutyHalt))p.length--;
          if(this.triangle.length)this.triangle.length--;
          if(this.noise.length)this.noise.length--;
        }
        for(let i=0;i<2;i++){const p=this.pulse[i];if(p.envStart){p.envelope=15;p.envStart=false;}else if(p.envelope)p.envelope--;else if(this.regs[i*4]&32)p.envelope=15;}
        if(this.noise.envStart){this.noise.envelope=15;this.noise.envStart=false;}else if(this.noise.envelope)this.noise.envelope--;
        if(this.triangle.linearReloadFlag){this.triangle.linear=this.triangle.linearReload;this.triangle.linearReloadFlag=false;}else if(this.triangle.linear)this.triangle.linear--;
      }
      for(let i=0;i<2;i++){const p=this.pulse[i],base=i*4,period=this.regs[base+2]|((this.regs[base+3]&7)<<8);if(--p.timer<=0){p.timer=Math.max(1,period+1);p.phase=(p.phase+1)&7;}}
      if(--this.triangle.timer<=0){this.triangle.timer=((this.regs[10]|((this.regs[11]&7)<<8))||1);this.triangle.phase=(this.triangle.phase+1)&31;}
      const np=NOISE_PERIOD[this.noise.period||0]; if(--this.noise.timer<=0){this.noise.timer=np;const tap=this.noise.mode?6:1;this.noise.shift=(this.noise.shift>>1)|(((this.noise.shift^(this.noise.shift>>tap))&1)<<14);}
      this.samplePhase+=this.sampleRate/1789773;
      if(this.samplePhase>=1){this.samplePhase-=1;this.queue.push(this.mix());if(this.queue.length>this.sampleRate)this.queue.splice(0,this.queue.length-this.sampleRate);}
    }
  }
  mix(){
    const duty=[0.125,0.25,0.5,0.75];
    let p=0;
    for(let i=0;i<2;i++){const r=i*4,c=this.pulse[i],period=this.regs[r+2]|((this.regs[r+3]&7)<<8),vol=(this.regs[r]&16)?(this.regs[r]&15):c.envelope;if(c.length&&period>=8&&c.phase<8&&c.phase/8<duty[this.regs[r]>>6])p+=vol/15;}
    const tri=this.triangle.length&&this.triangle.linear&&this.triangle.timer>1?(this.triangle.phase<16?this.triangle.phase:31-this.triangle.phase)/15:0;
    const nv=this.noise.length&&!(this.noise.shift&1)?((this.regs[12]&16)?this.regs[12]&15:this.noise.envelope)/15:0;
    const sample=(p*0.12+tri*0.06+nv*0.04);
    return Math.max(-1,Math.min(1,sample*2-0.08));
  }
  reset(){this.regs.fill(0);this.enabled=0;this.sampleBuffer.length=0;this.queue.length=0;this.frameCycle=0;this.frameStep=0;this.pulse.forEach(p=>Object.assign(p,{timer:0,phase:0,length:0,envelope:0,envStart:false}));Object.assign(this.triangle,{timer:0,phase:0,length:0,linear:0});Object.assign(this.noise,{timer:0,shift:1,length:0,envelope:0});}
}
const LEN=[10,254,20,2,40,4,80,6,160,8,60,10,14,12,26,14,12,16,24,18,48,20,96,22,192,24,72,26,16,28,32,30];
const NOISE_PERIOD=[4,8,16,32,64,96,128,160,202,254,380,508,762,1016,2034,4068];
