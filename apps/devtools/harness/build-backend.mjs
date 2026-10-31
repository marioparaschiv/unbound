// Rebuilds packages/loader/bootstrap/devtools.js from react-devtools-core's backend, lowered to ES5
// so Hermes can evaluate it as source. The loader runs it before Discord's bundle, so `initialize()`
// installs the hook before React does; Unbound DevTools then calls `DevTools.connect` over the bridge.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { transformSync } from '@swc/core';

const require = createRequire(import.meta.url);
const pkg = require('react-devtools-core/package.json');
const backend = readFileSync(require.resolve('react-devtools-core/dist/backend.js'), 'utf8');
const out = new URL('../../../packages/loader/bootstrap/devtools.js', import.meta.url);

const source = `const window = this;
var self = window;
(function () {
var module = { exports: {} };
var exports = module.exports;
${backend}
var backend = module.exports;
backend.initialize();
window.DevTools = { version: ${JSON.stringify(pkg.version)}, connect: backend.connectToDevTools };
})();
`;

const { code } = transformSync(source, {
	jsc: {
		target: 'es5',
		parser: { syntax: 'ecmascript' },
		minify: { compress: true, mangle: true },
	},
	minify: true,
	isModule: false,
});

writeFileSync(out, code);
console.log(`wrote ${out.pathname} from react-devtools-core ${pkg.version} (${code.length} bytes)`);
