import type { Plugin } from 'rolldown';

export default function iifeWrapper(preinit: Buffer | string): Plugin {
	return {
		name: 'iife-wrapper',
		renderChunk(code) {
			return `(() => {
				try {
					${preinit}
					${code}
				} catch(error) {
					alert('Unbound failed to initialize: ' + error.stack);
				}
			})();`;
		},
	};
}
