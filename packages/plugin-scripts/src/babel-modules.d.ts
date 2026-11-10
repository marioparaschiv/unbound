// `@unbound-app/cli/hermes-code` imports these untyped Babel packages; the CLI builds with `noImplicitAny` off, this package does not.
declare module '@babel/core';
declare module '@babel/plugin-transform-block-scoping';
