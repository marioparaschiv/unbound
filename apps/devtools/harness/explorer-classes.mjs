// The spoof's class registry for `explorer.mjs`: the platform's known classes, plus classes made up
// on first use for names a device would know (listed in an image, in a view's chain, or a Java name).
import { ANDROID_CLASSES, synthesizeAndroid } from './explorer-android.mjs';
import { IOS_CLASSES, IOS_IMAGES, synthesizeIos } from './explorer-ios.mjs';
import { platform } from './views.mjs';

const CHAIN_LIMIT = 64;

export const ios = platform === 'ios';
export const KINDS = ios
	? ['properties', 'ivars', 'methods', 'classMethods', 'protocols']
	: ['fields', 'methods', 'constructors', 'interfaces'];
export const ROOT = ios ? 'NSObject' : 'java.lang.Object';

const classes = new Map(ios ? IOS_CLASSES : ANDROID_CLASSES);
const imageOf = new Map(
	IOS_IMAGES.flatMap((image) => image.classes.map((name) => [name, image.path])),
);

/** A failure answered as `{ ok: false, error, code }`. */
export class ExplorerFailure extends Error {
	constructor(code, message) {
		super(message);
		this.code = code;
	}
}

function guessSuperclass(name) {
	if (ios) return /(View|Window|Label)$/.test(name) && name !== 'UIView' ? 'UIView' : ROOT;

	return /View$/.test(name) ? 'android.view.View' : ROOT;
}

/**
 * A class by name. `DisabledProbe` fails as `disabled`, a name the device would not know as `unknown-class`.
 * @param {string} name
 * @param {string} [superclass] the real superclass, when a view's chain names it
 */
export function classNamed(name, superclass) {
	if (name === 'DisabledProbe') {
		throw new ExplorerFailure(
			'disabled',
			'Turn on developer mode or the debugger to inspect native classes.',
		);
	}

	const known = classes.get(name);
	if (known) return known;

	const exists = ios ? imageOf.has(name) || superclass : /^[a-z]\w*(\.[\w$]+)+$/.test(name);
	if (!exists) throw new ExplorerFailure('unknown-class', `Failed to find class ${name}.`);

	const parent = superclass ?? guessSuperclass(name);
	const cls = ios
		? synthesizeIos(name, parent, imageOf.get(name))
		: synthesizeAndroid(name, parent);
	classes.set(name, cls);

	return cls;
}

/**
 * The class and its superclasses as `ExplorerClass` rows, own class first.
 * @param {string} name
 */
export function chainOf(name) {
	const chain = [];

	for (let cls = classNamed(name); cls && chain.length < CHAIN_LIMIT;) {
		chain.push({
			name: cls.name,
			image: cls.image,
			instanceSize: cls.instanceSize,
			counts: Object.fromEntries(KINDS.map((kind) => [kind, cls.members[kind]?.length ?? 0])),
		});
		cls = cls.superclass ? classNamed(cls.superclass) : undefined;
	}

	return chain;
}
