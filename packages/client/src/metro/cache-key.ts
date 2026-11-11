/** The symbol a metro filter stores its cache key under, so repeated lookups hit the module cache. */
export const CACHE_KEY = Symbol.for('metro.cache');
