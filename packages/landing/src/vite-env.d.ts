/// <reference types="vite/client" />

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
