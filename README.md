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

**Known limitation: MMC3 is not working reliably yet.** Although mapper 4 banking and an approximate scanline IRQ counter are implemented, IRQs are currently clocked at rendered scanline boundaries instead of actual PPU A12 rising edges. This is not accurate enough for games that rely on MMC3 IRQ timing, including *Super Mario Bros. 3*; graphics or split-screen effects may render incorrectly. Treat MMC3 game compatibility as experimental.

This is still an experimental emulator, not a cycle-accurate implementation. The PPU renders in scanline batches and does not model every per-dot PPU address transition; sprite-zero hit is approximate. Mid-scanline PPU writes flush already elapsed visible pixels, but that does not replace dot-level timing. APU envelopes, pulse sweep, quarter/half-frame clocks, DMC output state and frame/DMC IRQ flags are modeled, with nonlinear pulse/TND-style mixing. DMC sample bytes are currently placeholder-fed rather than fetched through timed CPU bus DMA, so sampled audio is not faithful yet. IRQ timing is instruction-clocked. Mapper 1/3/7 boards are basic implementations, not exhaustive board emulation. NES 2.0 sizes/submapper metadata are parsed, but extended console types, miscellaneous ROM data and all RAM/NVRAM semantics are not fully implemented. Games can still fail due to unsupported mappers, CPU opcode gaps, DMA timing and other hardware edge cases.

No commercial ROMs are included. ROM files are selected locally and are not sent to a server.

## License
MIT. See [LICENSE](LICENSE).
