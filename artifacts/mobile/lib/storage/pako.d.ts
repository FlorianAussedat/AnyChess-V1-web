declare module 'pako' {
  const pako: {
    deflate(text: string): Uint8Array;
    Inflate: new (options: { to: 'string'; chunkSize: number }) => {
      onData: (chunk: string) => void;
      push(data: Uint8Array, end: boolean): void;
      err: number;
    };
  };
  export default pako;
}
