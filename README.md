# NES-JS

A modular browser-based NES emulator written in plain JavaScript. It runs in the browser and can be hosted on GitHub Pages without a server or build step.

**Live demo:** https://frozican.github.io/nes-js/

## Features
- 6502-family CPU core and NES PPU renderer
- iNES 1.0 ROM loading, including trainer offsets
- Mapper support: NROM (0), MMC1 (1), UxROM (2), CNROM (3), MMC3 (4), AxROM (7)
- Initial browser APU synthesis for pulse, triangle and noise channels using Web Audio
- Keyboard controller; no bundled ROMs and no runtime dependencies

## Run
1. Open the live demo.
2. Choose a legally obtained `.nes` ROM.
3. Press **Start emulation**. Audio starts after this user gesture.
4. Controls: arrows = D-pad, X = A, Z = B, Enter = Start, Right Shift = Select.

You can also serve the repository root with any static HTTP server. ES modules may not load correctly when opening `index.html` directly as a `file://` URL.

## Project structure
- `src/core/` — CPU, bus, APU, controller and NES system
- `src/cartridge/` — iNES parser and mapper implementations
- `src/ppu/` — PPU registers, memory mapping and framebuffer
- `src/ui/` — browser frontend
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — module boundaries and data flow

## Compatibility notes
This remains an early-stage emulator, not a cycle-accurate or compatibility-complete implementation. Audio is an initial synthesis approximation; envelope, sweep, frame sequencing, DMC, IRQ behavior and accurate mixing are incomplete. Mapper 1, mapper 3 and mapper 7 support is preliminary. MMC3 scanline IRQs are approximated at rendered scanline boundaries because this PPU does not model per-dot pattern-table address transitions. Many commercial games may still fail because mapper coverage, CPU/PPU timing, sprite behavior, interrupts and NES 2.0 support are incomplete. No test ROM is bundled. ROM files are selected locally and are not uploaded.

## License
MIT. See [LICENSE](LICENSE).
