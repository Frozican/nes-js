# Architecture

## 1. Goals and boundaries

- Platform: modern browser, plain JavaScript ES modules, static hosting.
- Runtime: no server, bundler, transpiler or third-party runtime dependency.
- System model: NES / Famicom NTSC-oriented baseline.
- Input image: iNES 1.0 `.nes` files.
- Output: 256 × 240 RGBA-compatible pixel framebuffer.
- Implemented mapper IDs: 0 (NROM), 2 (UxROM), 3 (CNROM).
- Explicitly incomplete: accurate per-dot timing, full mapper coverage, complete PPU edge cases, APU/audio, PAL/Dendy behavior and full compatibility.

## 2. Runtime composition

```text
index.html
  └─ src/ui/main.js
       └─ NES (src/core/nes.js)
            ├─ Bus (src/core/bus.js)
            │    ├─ CPU6502 (src/core/cpu6502.js)
            │    ├─ Controller (src/core/controller.js)
            │    └─ Cartridge mapper
            └─ PPU (src/ppu/ppu.js)
```

The UI owns file selection, animation scheduling, keyboard events and canvas presentation. The core owns emulated machine state. The core does not depend on DOM APIs.

## 3. Modules

### `src/core/nes.js` — system coordinator

- Constructs and connects the bus, CPU, controller and PPU.
- Parses and installs a cartridge through `parseINES` and a mapper class.
- Provides `loadROM(buffer)`, `stepInstruction()`, `runInstructions(count)`, `runFrame()`, `renderFrame()` and `reset()`.
- Advances the PPU at three dots per CPU cycle.
- Runs a nominal frame budget of 29,781 CPU cycles.
- Wires PPU NMI requests to the CPU.

### `src/core/cpu6502.js` — CPU

- Models the 6502-derived CPU registers, status flags, stack and program counter.
- Fetches instructions through the bus.
- Resolves addressing modes and executes opcodes.
- Tracks CPU cycles and exposes reset / interrupt entry points.
- The implementation targets the official instruction set; undocumented opcodes and every hardware timing nuance are not guaranteed.

### `src/core/bus.js` — CPU address space

- Connects CPU reads and writes to RAM, PPU registers, controller ports and cartridge memory.
- Handles mirrored address ranges used by the NES.
- Provides the CPU-facing interface used by instruction execution.

### `src/core/controller.js` — controller input

- Stores the eight standard controller buttons.
- Exposes button state to the bus in NES serial-read order.
- The UI maps keyboard events to button indices.

### `src/core/constants.js` — shared constants

- Screen dimensions and palette data.
- Shared hardware constants used across core modules.

### `src/ppu/ppu.js` — picture processing unit

- Holds PPU registers, VRAM, palette RAM, OAM and the framebuffer.
- Implements CPU-facing PPU register access.
- Maps nametable and palette addresses.
- Advances scanline/dot state and triggers vblank/NMI events.
- Renders background pixels and sprites into a 256 × 240 framebuffer.
- Includes basic sprite priority, sprite-zero hit and overflow behavior, but these features are not hardware-perfect.
- Rendering is scanline-oriented and simplified; it is not a fully cycle-accurate PPU.

### `src/cartridge/ines.js` — ROM parser

- Validates the iNES header and extracts PRG/CHR ROM or CHR RAM configuration.
- Reads mapper number and mirroring mode.
- Rejects unsupported or malformed ROM layouts rather than silently treating every image as valid.

### Mapper implementations

| File | Mapper | Mapping model |
|---|---:|---|
| `nrom.js` | 0 | Fixed PRG mapping; 16 KiB PRG mirrored or 32 KiB PRG |
| `uxrom.js` | 2 | Switchable lower PRG bank and fixed upper bank |
| `cnrom.js` | 3 | NROM-like PRG with switchable CHR bank |

Mapper support is selected in `NES.loadROM()`. Additional boards require their own bank-switching, mirroring and any board-specific behavior.

### `src/ui/main.js` — browser frontend

- Reads a user-selected ROM into an `ArrayBuffer`.
- Calls the core to load, start, pause and reset emulation.
- Schedules frames with `requestAnimationFrame` and an elapsed-time accumulator.
- Maps keyboard events to controller buttons.
- Converts packed framebuffer pixels to `ImageData` and paints the canvas.
- Loads a built-in iNES test ROM through the emulator core; the test program configures the PPU and runs through CPU instructions.

### `src/ui/style.css` and `index.html`

- Provide the static interface, responsive layout, canvas and control elements.
- No framework is used.

## 4. Data flow

### ROM loading

1. The browser receives a local `.nes` file from the file picker.
2. `main.js` reads it as an `ArrayBuffer`.
3. `NES.loadROM()` calls `parseINES()`.
4. The mapper is instantiated and attached to the bus and PPU.
5. Bus, PPU and CPU state are reset.
6. The UI displays the first available framebuffer and enables the controls.

### Frame execution

1. The UI accumulator decides when another emulated frame should run.
2. `NES.runFrame()` repeatedly executes CPU instructions until the nominal cycle budget is reached.
3. `stepInstruction()` measures consumed CPU cycles.
4. The PPU advances by three dots per consumed CPU cycle.
5. PPU events update status flags, request NMI and render visible scanlines.
6. `NES.renderFrame()` returns the current framebuffer.
7. The UI converts each pixel to canvas image data.

### Controller input

1. Keyboard down/up events are translated to button indices.
2. `Controller` stores the pressed state.
3. CPU reads of the controller port are handled by the bus/controller interface.

## 5. Memory and rendering model

- CPU-visible memory routing is centralized in `Bus`.
- PPU-visible pattern-table accesses are delegated to the cartridge mapper when applicable.
- Nametable and palette memory are handled by the PPU.
- Sprite attribute memory is represented by OAM.
- The framebuffer stores packed 32-bit pixels; the UI converts these into browser `ImageData`.
- Mirroring and bank switching are mapper-dependent.
- Current rendering favors a straightforward scanline renderer over precise pixel-pipeline simulation.

## 6. Timing and interrupt model

- CPU instruction execution updates the CPU cycle counter.
- The top-level core advances the PPU at a nominal 3:1 PPU-to-CPU clock ratio.
- Frame pacing is browser-driven, not a hardware clock.
- Vblank and NMI are approximated through PPU scanline/dot events.
- DMA stalls, odd-frame timing, exact interrupt races and all mid-scanline effects are not fully modeled.

These simplifications can cause visual or gameplay differences even when a ROM loads successfully.

## 7. Public core API

```js
import { NES } from "./src/core/nes.js";

const nes = new NES();
const cartridgeInfo = nes.loadROM(arrayBuffer);
nes.runFrame();
const pixels = nes.renderFrame();
nes.controller.setButton(0, true);  // A
nes.controller.setButton(0, false);
nes.reset();
```

- `loadROM(buffer)` returns mapper, PRG/CHR size, CHR RAM flag and mirroring metadata.
- `runFrame()` advances CPU/PPU execution; call only after a ROM is loaded.
- `renderFrame()` returns the PPU framebuffer; it does not itself execute a frame.
- `stepInstruction()` advances one CPU instruction and the associated PPU time.
- `reset()` resets the loaded machine state.

The exact internal classes and fields are implementation details unless explicitly exported.

## 8. Extending the core

### Adding a mapper

1. Add a mapper module under `src/cartridge/`.
2. Implement CPU PRG reads/writes and PPU CHR reads/writes needed by that board.
3. Preserve the cartridge metadata contract from `parseINES()`.
4. Select the mapper in `NES.loadROM()`.
5. Document mapper-specific mirroring, RAM and bank-switching behavior.

### Improving PPU accuracy

1. Keep register access and address mirroring centralized in `PPU`.
2. Separate timing changes from pixel output changes.
3. Avoid assuming a whole scanline can be rendered at once when implementing mid-scanline effects.
4. Update sprite evaluation, vblank/NMI timing and scroll behavior together where required.

### Adding audio

- Implement APU channels and frame sequencer.
- Model CPU-visible APU registers and timing.
- Integrate buffered audio output through the browser Web Audio API without coupling the core to DOM UI state.

## 9. Error handling and constraints

- Invalid or unsupported ROMs should produce a readable load error.
- The frontend reports runtime exceptions in the status line.
- ROM data stays in the browser; it is not sent to a server.
- No game images, commercial ROMs or BIOS files are shipped with the repository.
- The project is experimental; a successful ROM load is not a guarantee of correct emulation.

## 10. License

The project is distributed under the MIT License. See `LICENSE`.
