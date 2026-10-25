# Architecture

## Goals
- Browser-only JavaScript ES modules; static hosting.
- NTSC-oriented NES baseline, 256 × 240 framebuffer.
- CPU instruction execution advances PPU at a nominal 3:1 ratio and clocks the APU by CPU cycles.
- This is an experimental emulator, not cycle accurate.

## Components
- `src/core/nes.js`: machine wiring, ROM loading and instruction/frame stepping.
- `src/core/cpu6502.js`: 6502-family CPU, interrupts and instruction execution.
- `src/core/bus.js`: CPU memory map, PPU/APU registers and cartridge routing.
- `src/core/apu.js`: pulse, triangle, noise, DMC state, envelopes, sweep, frame sequencer and IRQ flags.
- `src/ppu/ppu.js`: PPU registers, memory, framebuffer, scanline renderer and sprite handling.
- `src/cartridge/`: iNES/NES 2.0 header parser and mapper implementations.
- `src/ui/`: browser controls and canvas/audio startup.

## APU model
Pulse envelopes decay on quarter-frame clocks; length counters and sweep use half-frame clocks. Triangle linear counter and noise envelope are clocked by the frame sequencer. DMC rate/output/loop/length state is modeled, but the current DMC sample fetch is a placeholder rather than real bus DMA. Mixing uses a nonlinear pulse/TND approximation. Frame IRQ and DMC IRQ are exposed through status and requested by the CPU core, but exact IRQ edge timing and CPU/DMC bus arbitration are not modeled.

## PPU and mapper limitations
The PPU renders scanlines rather than emulating every dot and address transition. Sprite-zero hit is calculated during sprite composition and is not cycle-exact. MMC3 scanline IRQs are approximated at rendered scanline boundaries, not triggered from actual PPU A12 edges. Mapper support is limited to 0, 1, 2, 3, 4 and 7; submapper variants and board-specific RAM layouts are not comprehensive.

## ROM format
The parser recognizes iNES 1.0 and NES 2.0 headers and extracts mapper/submapper and PRG/CHR sizes. NES 2.0 support is partial: console types, miscellaneous data, and all volatile/nonvolatile RAM semantics are not implemented.
