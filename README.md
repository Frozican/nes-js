# NES-JS

A modular browser-based NES emulator written in plain JavaScript. Static hosting on GitHub Pages; no server or build step.

**Live demo:** https://frozican.github.io/nes-js/

## Features
- 6502-family CPU core, PPU renderer and Web Audio output
- iNES 1.0 and NES 2.0 header parsing (supported mapper IDs remain limited)
- Mapper support: NROM (0), MMC1 (1), UxROM (2), CNROM (3), MMC3 (4), AxROM (7)
- APU pulse, triangle, noise and DMC channel state; envelopes, pulse sweep, frame sequencer and IRQ flags
- Local ROM selection; ROM files are not uploaded or bundled

## Run
1. Open the live demo.
2. Choose a legally obtained `.nes` ROM.
3. Press **Start emulation**. Audio starts after this user gesture.
4. Controls: arrows = D-pad, X = A, Z = B, Enter = Start, Right Shift = Select.

## Accuracy and compatibility
This is still an experimental emulator, not a cycle-accurate implementation. The APU now models envelope decay, pulse sweep, quarter/half-frame clocks, DMC output state and frame/DMC IRQ flags, with nonlinear pulse/TND-style mixing. However, DMC sample bytes are currently placeholder-fed rather than fetched through a timed CPU bus DMA, so sampled audio is not faithful yet. IRQ timing is instruction-clocked. The PPU remains scanline-oriented and does not model all per-dot PPU address transitions; sprite-zero hit is approximate. MMC3 IRQs still use rendered scanline boundaries rather than PPU A12 edges. Mapper 1/3/7 boards are basic implementations, not exhaustive board emulation. NES 2.0 sizes/submapper metadata are parsed, but extended console types, miscellaneous ROM data and all RAM/NVRAM semantics are not fully implemented. Games can still fail due to unsupported mappers, CPU opcode gaps, DMA timing and other hardware edge cases.

No commercial ROMs are included. ROM files are selected locally and are not sent to a server.

## License
MIT. See [LICENSE](LICENSE).
