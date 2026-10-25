# Architecture

## Goals
- Browser-only JavaScript ES modules with static GitHub Pages hosting; no backend is required.
- NTSC-oriented NES baseline with a 256 × 240 framebuffer.
- CPU execution advances the PPU at a nominal 3:1 ratio and clocks the APU from CPU cycles.
- The emulator is experimental and is not cycle-accurate.

## Components
- `src/core/nes.js`: machine wiring, ROM loading, reset and instruction/frame stepping.
- `src/core/cpu6502.js`: 6502-family CPU execution and interrupt handling.
- `src/core/bus.js`: CPU memory map and routing for PPU/APU registers and cartridge access.
- `src/core/apu.js`: pulse, triangle, noise and DMC state; envelopes, sweep, frame sequencer and IRQ flags.
- `src/ppu/ppu.js`: PPU registers and memory, framebuffer, scanline renderer, background/sprite composition and visible-pixel flushing.
- `src/cartridge/`: iNES/NES 2.0 header parsing and mapper implementations.
- `src/cartridge/mmc3.js`: MMC3 PRG/CHR bank mapping, PRG RAM controls, mirroring, CHR RAM support and approximate IRQ counter.
- `src/ui/`: browser controls, canvas rendering, ROM selection and audio startup.

## CPU and APU
CPU instructions are executed as units rather than as a fully cycle-stepped bus. The APU models pulse envelopes, length counters, sweep, triangle linear counter, noise envelope, DMC output state and frame/DMC IRQ flags. Audio uses a nonlinear pulse/TND-style mix. DMC sample fetch is currently placeholder-fed: timed sample reads, DMA stalls and accurate CPU/DMC bus arbitration are not implemented. IRQ timing is therefore not hardware-accurate.

## PPU rendering
The PPU advances between significant scanline events rather than iterating through every dot. Visible scanlines are rendered in batches. Before a CPU write changes PPU state, elapsed visible pixels are flushed so a mid-scanline write does not retroactively alter pixels already passed. This improves deterministic rendering but is not a replacement for a dot-by-dot PPU pipeline. Sprite-zero hit and sprite overflow are approximate.

## MMC3 status and limitations
Mapper 4 supports PRG and CHR bank selection, PRG RAM enable/write protection, mirroring control and the IRQ latch/reload/enable registers. CHR RAM is backed by writable memory when a cartridge has no CHR ROM.

**MMC3 is not currently reliable for games that depend on accurate IRQ timing.** The renderer does not produce real-time PPU address bus transitions, so MMC3 IRQs are clocked at a visible scanline boundary rather than on qualified PPU A12 rising edges. This approximation is insufficient for *Super Mario Bros. 3* and other games using split-screen or raster effects; the game may show incorrect graphics even though mapper 4 banking is implemented. Accurate compatibility requires PPU A12 edge tracking integrated with real PPU memory accesses and more precise timing.

## ROM format and mapper coverage
The parser recognizes iNES 1.0 and NES 2.0 headers and extracts mapper/submapper and PRG/CHR sizes. Supported mapper IDs are 0, 1, 2, 3, 4 and 7, but mapper variants and board-specific RAM layouts are not comprehensive. NES 2.0 console types, miscellaneous ROM data and all volatile/nonvolatile RAM semantics remain partial.
