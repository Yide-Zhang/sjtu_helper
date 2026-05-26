declare module 'upng-js' {
  const UPNG: {
    decode(buffer: ArrayBuffer): {
      width: number;
      height: number;
      data: Uint8Array;
      tabs: Record<string, any>;
      frames: any[];
      ctype: number;
      depth: number;
    };
    toRGBA8(out: any): ArrayBuffer[];
    encode(
      bufs: ArrayBuffer[],
      w: number,
      h: number,
      ps?: number,
      dels?: number[],
      forbidPlte?: boolean
    ): ArrayBuffer;
  };
  export default UPNG;
}
