/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FUJITRACE_PROXY_URL: string;
  readonly VITE_OPENAI_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
