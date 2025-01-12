/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NOTION_CLIENT_ID: string;
  readonly VITE_NOTION_REDIRECT_URI: string;
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
