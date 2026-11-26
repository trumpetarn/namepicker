// Loads the namepicker's plain (non-module) browser scripts into one shared global
// scope, the way a page's <script> tags do, and returns that scope.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const SITE = fileURLToPath(new URL('../', import.meta.url));

export function loadScripts(files, globals = {}) {
  const context = vm.createContext({
    crypto, TextEncoder, TextDecoder, btoa, atob, Uint8Array, Uint32Array,
    ...globals,
  });
  for (const file of files) {
    vm.runInContext(readFileSync(SITE + file, 'utf8'), context, { filename: file });
  }
  return context;
}

// An in-memory localStorage for scripts that read it on load.
export function fakeLocalStorage(items = {}) {
  const store = new Map(Object.entries(items));
  return {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key),
  };
}
