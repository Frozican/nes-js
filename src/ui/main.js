import { NES } from "../core/nes.js";

const $ = id => document.getElementById(id);
const canvas = $("screen");
const ctx = canvas.getContext("2d", { alpha: false });
const imageData = ctx.createImageData(256, 240);
const nes = new NES();

let loaded = false;
let running = false;
let raf = 0;
let lastTime = 0;
let accumulator = 0;

const keys = {
  ArrowUp: 4, ArrowDown: 5, ArrowLeft: 6, ArrowRight: 7,
  KeyX: 0, KeyZ: 1, Enter: 3, ShiftRight: 2
};

function status(message) { $("status").textContent = message; }

function paintPixels(pixels) {
  for (let i = 0; i < pixels.length; i++) {
    const pixel = pixels[i] >>> 0;
    imageData.data[i * 4] = (pixel >> 16) & 255;
    imageData.data[i * 4 + 1] = (pixel >> 8) & 255;
    imageData.data[i * 4 + 2] = pixel & 255;
    imageData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
}

function draw() { paintPixels(nes.renderFrame()); }

function stop(message) {
  running = false;
  cancelAnimationFrame(raf);
  $("start").disabled = !loaded;
  $("pause").disabled = true;
  if (message) status(message);
}

function loop(time) {
  if (!running) return;
  if (!lastTime) lastTime = time;
  accumulator += Math.min(time - lastTime, 100);
  lastTime = time;
  let guard = 0;
  while (accumulator >= 1000 / 60 && guard++ < 3) {
    try {
      nes.runFrame();
      draw();
    } catch (error) {
      stop(`Execution stopped: ${error.message}`);
      return;
    }
    accumulator -= 1000 / 60;
  }
  raf = requestAnimationFrame(loop);
}

function start() {
  if (!loaded || running) return;
  running = true;
  lastTime = 0;
  accumulator = 0;
  $("start").disabled = true;
  $("pause").disabled = false;
  status("Emulation running.");
  raf = requestAnimationFrame(loop);
}

$("rom-file").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  stop();
  try {
    const info = nes.loadROM(await file.arrayBuffer());
    loaded = true;
    $("start").disabled = false;
    $("pause").disabled = true;
    $("reset").disabled = false;
    status(`Loaded ${file.name} · PRG ${info.prgSize / 1024} KiB · ${info.chrRam ? "CHR RAM" : "CHR ROM"} · Mapper ${info.mapper}`);
    draw();
  } catch (error) {
    loaded = false;
    $("start").disabled = true;
    $("pause").disabled = true;
    $("reset").disabled = true;
    status(`Could not load ROM: ${error.message}`);
  }
});

$("start").addEventListener("click", start);
$("pause").addEventListener("click", () => stop("Emulation paused."));
$("reset").addEventListener("click", () => {
  if (!loaded) return;
  stop();
  nes.reset();
  draw();
  $("start").disabled = false;
  $("pause").disabled = true;
  status("Emulator reset.");
});

window.addEventListener("keydown", event => {
  if (keys[event.code] !== undefined) {
    event.preventDefault();
    nes.controller.setButton(keys[event.code], true);
  }
});
window.addEventListener("keyup", event => {
  if (keys[event.code] !== undefined) {
    event.preventDefault();
    nes.controller.setButton(keys[event.code], false);
  }
});

