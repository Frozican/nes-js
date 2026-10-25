export function parseINES(input){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
 if(bytes.length<16)throw new Error("ROM is too small to contain an iNES header.");
 if(bytes[0]!==0x4e||bytes[1]!==0x45||bytes[2]!==0x53||bytes[3]!==0x1a)throw new Error("Invalid iNES signature. Expected NES<EOF>.");
 const f6=bytes[6],f7=bytes[7];if(f7&0x0c)throw new Error("NES 2.0 images are not supported yet.");
 const mapper=(f6>>4)|(f7&0xf0);
 if(![0,1,2,3,4,7].includes(mapper))throw new Error(`Mapper ${mapper} is not supported. Supported: 0, 1, 2, 3, 4 and 7.`);
 const trainer=!!(f6&4),prgSize=bytes[4]*16384,chrSize=bytes[5]*8192;
 if(!prgSize)throw new Error("ROM has no PRG ROM.");
 if((mapper===0||mapper===3)&&(prgSize!==16384&&prgSize!==32768))throw new Error(`Mapper ${mapper} requires 16 or 32 KiB PRG ROM.`);
 if(mapper===2&&(prgSize<32768||prgSize%16384))throw new Error("Mapper 2 requires at least two 16 KiB PRG banks.");
 if(mapper===7&&prgSize%32768)throw new Error("Mapper 7 requires 32 KiB PRG banks.");
 if(mapper===4&&(prgSize<32768||prgSize%8192))throw new Error("Mapper 4 requires at least 32 KiB PRG ROM in 8 KiB banks.");
 const start=16+(trainer?512:0),chrStart=start+prgSize;
 if(bytes.length<chrStart+chrSize)throw new Error("ROM file is truncated.");
 return {mapper,mirroring:f6&8?"four-screen":f6&1?"vertical":"horizontal",battery:!!(f6&2),prgRom:bytes.slice(start,chrStart),chrRom:chrSize?bytes.slice(chrStart,chrStart+chrSize):new Uint8Array(8192),chrRam:chrSize===0};
}
