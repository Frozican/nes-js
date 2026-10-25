export function parseINES(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 16) throw new Error("ROM is too small to contain an iNES header.");
  if (bytes[0] !== 0x4e || bytes[1] !== 0x45 || bytes[2] !== 0x53 || bytes[3] !== 0x1a) {
    throw new Error("Invalid iNES signature. Expected NES<EOF>.");
  }
  const flags6 = bytes[6], flags7 = bytes[7];
  if (flags7 & 0x0c) throw new Error("NES 2.0 images are not supported yet.");
  const mapper = (flags6 >> 4) | (flags7 & 0xf0);
  if (mapper !== 0 && mapper !== 2 && mapper !== 3) throw new Error(`Mapper ${mapper} is not supported yet. This build supports Mapper 0 (NROM), Mapper 2 (UxROM), and Mapper 3 (CNROM).`);
  if (flags6 & 0x04) throw new Error("Trainer data is not supported by this early build.");
  const prgSize = bytes[4] * 16384;
  const chrSize = bytes[5] * 8192;
  if ((mapper === 0 || mapper === 3) && prgSize !== 16384 && prgSize !== 32768) throw new Error(`Mapper ${mapper} requires 16 KiB or 32 KiB of PRG ROM.`);
  if (mapper === 2 && (prgSize < 32768 || prgSize % 16384 !== 0)) throw new Error("Mapper 2 requires at least two 16 KiB PRG banks.");
  if (mapper === 3 && chrSize === 0) throw new Error("Mapper 3 requires CHR ROM; CHR RAM-only CNROM images are not supported.");
  const prgStart = 16, chrStart = prgStart + prgSize;
  if (bytes.length < chrStart + chrSize) throw new Error("ROM file is truncated.");
  return {
    mapper, mirroring: flags6 & 1 ? "vertical" : "horizontal",
    battery: Boolean(flags6 & 2),
    prgRom: bytes.slice(prgStart, chrStart),
    chrRom: chrSize ? bytes.slice(chrStart, chrStart + chrSize) : new Uint8Array(8192),
    chrRam: chrSize === 0
  };
}
