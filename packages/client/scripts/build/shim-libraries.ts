import libraries from '../../src/core/shim-libraries.json' with { type: 'json' };

/** Each library in Discord's bundle the client shims, by package name, with the props that find its entry module. */
export default libraries satisfies Record<string, string[]>;
