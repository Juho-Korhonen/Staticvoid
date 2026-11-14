/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Python API (mariadb/server). Default: http://127.0.0.1:8000 */
  readonly VITE_API_URL?: string;
}
