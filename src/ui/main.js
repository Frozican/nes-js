import {NES} from "../core/nes.js";
const $=id=>document.getElementById(id),canvas=$("screen"),ctx=canvas.getContext("2d",{alpha:false}),imageData=ctx.createImageData(256,240),nes=new NES();
let loaded=false,running=false,raf=0,lastTime=0,accumulator=0;
const keys={ArrowUp:4,ArrowDown:5,ArrowLeft:6,ArrowRight:7,KeyX:0,KeyZ:1,Enter:3,ShiftRight:2};
function status(m){$("status").textContent=m;}
function paint(pixels){for(let i=0;i<pixels.length;i++){const p=pixels[i]>>>0;imageData.data[i*4]=(p>>16)&255;imageData.data[i*4+1]=(p>>8)&255;imageData.data[i*4+2]=p&255;imageData.data[i*4+3]=255;}ctx.putImageData(imageData,0,0);}
function draw(){paint(nes.renderFrame());}
function stop(message){running=false;cancelAnimationFrame(raf);$("start").disabled=!loaded;$("pause").disabled=true;if(message)status(message);}
function loop(t){if(!running)return;if(!lastTime)lastTime=t;accumulator+=Math.min(t-lastTime,100);lastTime=t;let guard=0;while(accumulator>=1000/60&&guard++<3){try{nes.runFrame();draw();}catch(e){stop("Execution stopped: "+e.message);return;}accumulator-=1000/60;}raf=requestAnimationFrame(loop);}
function start(){if(!loaded||running)return;nes.apu.unlock();running=true;lastTime=0;accumulator=0;$("start").disabled=true;$("pause").disabled=false;status("Emulation running. Audio enabled.");raf=requestAnimationFrame(loop);}
$("rom-file").addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;stop();try{const info=nes.loadROM(await file.arrayBuffer());loaded=true;$("start").disabled=false;$("pause").disabled=true;$("reset").disabled=false;status(`Loaded ${file.name} · PRG ${info.prgSize/1024} KiB · ${info.chrRam?"CHR RAM":"CHR ROM"} · Mapper ${info.mapper}`);draw();}catch(err){loaded=false;$("start").disabled=true;$("pause").disabled=true;$("reset").disabled=true;status("Could not load ROM: "+err.message);}});
$("start").addEventListener("click",start);$("pause").addEventListener("click",()=>stop("Emulation paused."));
$("reset").addEventListener("click",()=>{if(!loaded)return;stop();nes.reset();draw();$("start").disabled=false;$("pause").disabled=true;status("Emulator reset.");});
window.addEventListener("keydown",e=>{if(keys[e.code]!==undefined){e.preventDefault();nes.controller.setButton(keys[e.code],true);}});window.addEventListener("keyup",e=>{if(keys[e.code]!==undefined){e.preventDefault();nes.controller.setButton(keys[e.code],false);}});
