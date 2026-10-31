import blockScoping from '@babel/plugin-transform-block-scoping';
import { transformSync } from '@babel/core';

/**
 * @description Lowers `let` and `const` to `var` the way plugin builds do, since Hermes shares one binding across a loop's iterations, so a closure made in a loop would see the last value.
 * @param code The JavaScript to evaluate on the device.
 * @returns The lowered code, or the code unchanged when it does not parse, so the device reports the error.
 */
export function lowerForHermes(code: string): string {
	try {
		return (
			transformSync(code, {
				babelrc: false,
				configFile: false,
				sourceType: 'script',
				parserOpts: { allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true },
				plugins: [blockScoping],
				retainLines: true,
			})?.code ?? code
		);
	} catch {
		return code;
	}
}

export default { lowerForHermes };
