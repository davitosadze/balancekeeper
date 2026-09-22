require('../scripts/register-typescript.cjs');
const Module = require('node:module');
const memory = new Map();
const storageControl = { failWrites: false };
const load = Module._load;
Module._load = function(request, ...args) {
  if (request === '@react-native-async-storage/async-storage') return {
    getItem: async key => memory.get(key) ?? null,
    setItem: async (key, value) => { if (storageControl.failWrites) throw new Error('Storage unavailable'); memory.set(key, value); },
    removeItem: async key => { memory.delete(key); },
  };
  return load.call(this, request, ...args);
};
module.exports = { memory, storageControl };
