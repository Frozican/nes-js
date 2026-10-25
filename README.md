# NES-JS

A modular, browser-based Nintendo Entertainment System (NES) emulator core written in plain JavaScript. It runs directly in the browser and is hosted on GitHub Pages; no server or build step is required.

**Live demo:** https://frozican.github.io/nes-js/

## Features

- 6502-family CPU core with the official instruction set
- NES bus, controller input, PPU framebuffer and scanline rendering
- iNES 1.0 ROM loading
- Cartridge mappers: NROM (0), UxROM (2), and CNROM (3)
- Browser UI with keyboard controls
- ES modules; no runtime dependencies

## Run

1. Open the [live demo](https://frozican.github.io/nes-js/).
2. Choose a legally obtained `.nes` ROM,.
3. Select **Start emulation** if it is not already running.
4. Use the keyboard controls shown below the screen.

You can also serve the repository root with any static HTTP server. ES modules may not load correctly when opening `index.html` directly as a `file://` URL.

## Controls

| Key | NES input |
|---|---|
| Arrow keys | D-pad |
| X | A |
| Z | B |
| Enter | Start |
| Right Shift | Select |

## Project structure

- `src/core/` — CPU, bus, controller, shared constants and top-level NES system
- `src/cartridge/` — iNES parser and mapper implementations
- `src/ppu/` — PPU registers, memory mapping, scanline renderer and framebuffer
- `src/ui/` — browser frontend and styling
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — detailed module boundaries, data flow and implementation notes

## Scope and limitations

This is an **early-stage emulator core**, not a cycle-accurate or compatibility-complete emulator. Rendering and timing are simplified, and only the listed mappers are implemented. Some games may fail to boot, render incorrectly, or behave differently from hardware. Audio emulation is not currently implemented.

No test ROM is bundled with this project. Load your own legally obtained `.nes` file to try the emulator.

ROM files are selected locally and are not uploaded by this page. No commercial ROMs or BIOS files are included.

## License

MIT. See [LICENSE](LICENSE).
