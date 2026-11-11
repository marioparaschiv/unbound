import hermes from '@unbound-app/rollup-plugin-hermes';
import type { Plugin } from 'rolldown';

/**
 * @description Compiles the bundle with hermesc for exactly the bytecode versions the client ships, so a
 * newly published hermesc never displaces one.
 * @param versions The bytecode versions the client ships.
 * @param flags Extra hermesc flags.
 * @returns The rolldown plugin.
 */
export default function hermesVersions(versions: number[], flags: string[]): Plugin {
	const compiler = hermes({ versions, flags });

	return {
		name: 'hermes-versions',
		async generateBundle(options, bundle, isWrite) {
			await compiler.generateBundle.call(this, options, bundle, isWrite);
		},
		async buildEnd() {
			await compiler.buildEnd.call(this);
		},
	};
}
