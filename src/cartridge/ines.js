export function parseINES(input){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
 if(bytes.length<16)throw new Error("ROM is too small to contain an iNES header.");
 if(bytes[0]!==0x4e||bytes[1]!==0x45||bytes[2]!==0x53||bytes[3]!==0x1a)throw new Error("Invalid iNES signature. Expected NES<EOF>.");
 const f6=bytes[6],f7=bytes[7],nes2=(f7&0x0c)===0x08;
 if(!nes2&&(f7&0x0c))throw new Error("Unsupported reserved iNES header format.");
 const mapper=(f6>>4)|(f7&0xf0)|(nes2?((bytes[8]&0x0f)<<8):0);
 if(![0,1,2,3,4,7].includes(mapper))throw new Error(`Mapper ${mapper} is not supported. Supported: 0, 1, 2, 3, 4 and 7.`);
 const trainer=!!(f6&4),offset=16+(trainer?512:0);
 let prgSize,chrSize,submapper=0;
 if(nes2){
   submapper=bytes[8]>>4;
   const pMsb=bytes[9]&15,cMsb=bytes[9]>>4;
   const decode=(lsb,msb,unit)=>msb===15?((2**(lsb>>2))*(((lsb&3)*2)+1)):(((msb<<8)|lsb)*unit);
   prgSize=decode(bytes[4],pMsb,16384);chrSize=decode(bytes[5],cMsb,8192);
 }else{prgSize=bytes[4]*16384;chrSize=bytes[5]*8192;}
 if(!prgSize)throw new Error("ROM has no PRG ROM.");
 if(prgSize>64*1024*1024||chrSize>64*1024*1024)throw new Error("ROM declares an unsupported memory size.");
 if((mapper===0||mapper===3)&&(prgSize!==16384&&prgSize!==32768))throw new Error(`Mapper ${mapper} requires 16 or 32 KiB PRG ROM.`);
 if(mapper===2&&(prgSize<32768||prgSize%16384))throw new Error("Mapper 2 requires at least two 16 KiB PRG banks.");
 if(mapper===7&&prgSize%32768)throw new Error("Mapper 7 requires 32 KiB PRG banks.");
 if(mapper===4&&(prgSize<32768||prgSize%8192))throw new Error("Mapper 4 requires at least 32 KiB PRG ROM in 8 KiB banks.");
 const chrRam=chrSize===0;if(chrRam)chrSize=8192;
 const chrRamSize=nes2?((bytes[11]&15)?64*(2**(bytes[11]&15)):0):0;
 const start=offset,chrStart=start+prgSize;
 if(bytes.length<chrStart+(chrRam?0:chrSize))throw new Error("ROM file is truncated.");
 const mirroring=(f6&8)?"four-screen":(f6&1)?"vertical":"horizontal";
 return {mapper,submapper,nes2,mirroring,battery:!!(f6&2),prgRom:bytes.slice(start,chrStart),chrRom:chrRam?new Uint8Array(Math.max(8192,chrRamSize)):bytes.slice(chrStart,chrStart+chrSize),chrRam,prgRamSize:nes2?((bytes[10]&15)?64*(2**(bytes[10]&15)):8192):8192,chrRamSize};
}
