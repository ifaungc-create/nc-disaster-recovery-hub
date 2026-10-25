// Data adapter switch (build time, VITE_DATA_ADAPTER; vite.config.js picks remote on Netlify).
//   local : everything stays in this browser's localStorage. Dev/offline demos, no server.
//   remote: talks to netlify/functions/api.js (HMAC session tokens, encrypted storage on Netlify Blobs).
// Both adapters implement the same async interface, documented in ./local.js.
import { local } from './local.js';
import { remote } from './remote.js';
export const ADAPTER = import.meta.env.VITE_DATA_ADAPTER === 'remote' ? 'remote' : 'local';
export const api = ADAPTER === 'remote' ? remote : local;
