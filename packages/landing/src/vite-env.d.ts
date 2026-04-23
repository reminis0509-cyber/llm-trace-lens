/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LINE_LIFF_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'jszip' {
  interface JSZipInstance {
    file(name: string, data: string): JSZipInstance;
    generateAsync(options: { type: 'blob' }): Promise<Blob>;
  }
  interface JSZipConstructor {
    new (): JSZipInstance;
  }
  const JSZip: JSZipConstructor;
  export default JSZip;
}
