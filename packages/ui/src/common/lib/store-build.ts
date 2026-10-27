declare const __VALUESCOUT_STORE__: boolean | undefined;

/** True only in the ValueScout Show-me Web Store build (VALUESCOUT_STORE=1, see wxt.config.ts). */
export const valuescoutStoreBuild = typeof __VALUESCOUT_STORE__ !== 'undefined' && __VALUESCOUT_STORE__ === true;
