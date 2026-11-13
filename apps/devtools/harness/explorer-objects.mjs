// Objects the spoof's controller can open, by ref, and their spoofed `explorer-values-result` reads.
// Refs are `<epoch>:<n>` with an epoch new each harness run, like a JS reload on a device.
import { ExplorerFailure, ROOT, classNamed, ios } from './explorer-classes.mjs';
import { detailsOf } from './view-details.mjs';
import { listedView, platform } from './views.mjs';

const VALUES_LIMIT = 50;
const STRING_LIMIT = 500;
const VALUE_KINDS = ios ? ['properties', 'ivars'] : ['fields'];

const epoch = Math.random().toString(36).slice(2, 6);
const objects = new Map();
const nodeRefs = new WeakMap();
const childRefs = new Map();
let nextRef = 0;

function register(className, values = {}) {
	const n = ++nextRef;
	const ref = `${epoch}:${n}`;
	const address = (0x10a8c4000 + n * 0x230).toString(16);
	objects.set(ref, { ref, className, address, values });

	return ref;
}

/** The object's `description` (iOS) or `toString()` (Android). */
export function describe({ className, address, values }) {
	if (!ios) {
		return values.mLeft
			? `${className}{${address.slice(-7)} V.ED..... ........ ${values.mLeft},${values.mTop}-${values.mRight},${values.mBottom}}`
			: `${className}@${address.slice(-7)}`;
	}

	return values.frame
		? `<${className}: 0x${address}; frame = ${values.frame}; layer = <CALayer: 0x6000${address.slice(-8)}>>`
		: `<${className}: 0x${address}>`;
}

function nodeValues(node) {
	const { x, y, width, height } = node.frame;

	if (!ios) {
		return {
			mLeft: String(x),
			mTop: String(y),
			mRight: String(x + width),
			mBottom: String(y + height),
			mAlpha: (node.alpha ?? 1).toFixed(1),
			mContentDescription: node.text ?? null,
		};
	}

	return {
		frame: `{{${x}, ${y}}, {${width}, ${height}}}`,
		bounds: `{{0, 0}, {${width}, ${height}}}`,
		center: `{${x + width / 2}, ${y + height / 2}}`,
		alpha: String(node.alpha ?? 1),
		hidden: (node.visibility ?? 'visible') === 'visible' ? 'NO' : 'YES',
		accessibilityIdentifier: node.resourceName ?? null,
	};
}

/**
 * The object behind a listed view; the same view keeps its ref.
 * @param {string} id a View Tree node id
 */
export function nodeObject(id) {
	const node = listedView(id);
	if (!node) throw new ExplorerFailure('stale', `Failed to find view ${id}; refresh the tree.`);

	// The device knows the view's real superclasses; register any the spoof only knows by name.
	const names = [...new Set([...detailsOf(node, platform).classChain, ROOT])];
	names.forEach((name, index) => classNamed(name, names[index + 1]));

	if (!nodeRefs.has(node)) nodeRefs.set(node, register(node.className, nodeValues(node)));

	return objects.get(nodeRefs.get(node));
}

/**
 * An object by ref; an unknown ref (`dead:1`, or one from an earlier run) fails as `stale`.
 * @param {string} ref
 */
export function objectOf(ref) {
	const object = objects.get(ref);

	if (!object) {
		throw new ExplorerFailure(
			'stale',
			`Failed to find object ${ref}; it was released or Discord reloaded.`,
		);
	}

	return object;
}

// Fixed reads by member name, before the type's default.
const IOS_VALUES = {
	_backgroundColorSystemColorName: { kind: 'string', text: 'systemBackgroundColor' },
	_nativeId: { kind: 'string', text: `chat-input-${'x'.repeat(600)}` },
	_viewDelegate: { kind: 'nil', text: 'nil' },
	_traitChangeRegistry: {
		kind: 'error',
		text: 'Failed to read _traitChangeRegistry: NSInvalidArgumentException',
	},
	userInteractionEnabled: { kind: 'bool', text: 'YES' },
	transform: { kind: 'struct', text: '[1, 0, 0, 1, 0, 0]' },
	safeAreaInsets: { kind: 'struct', text: '{0, 0, 0, 0}' },
	cornerRadius: { kind: 'number', text: '20' },
};
const ANDROID_VALUES = {
	VISIBLE: { kind: 'number', text: '0' },
	INVISIBLE: { kind: 'number', text: '4' },
	GONE: { kind: 'number', text: '8' },
	TAG: { kind: 'string', text: 'View' },
	mTag: { kind: 'nil', text: 'null' },
	mListenerInfo: {
		kind: 'error',
		text: 'Failed to read field mListenerInfo: java.lang.IllegalAccessException',
	},
};
// The runtime class a Java field's declared type holds here.
const ANDROID_RUNTIME_CLASSES = {
	'android.view.ViewParent': 'com.facebook.react.views.view.ReactViewGroup',
	'android.content.Context': 'com.discord.main.MainActivity',
	'android.graphics.drawable.Drawable': 'android.graphics.drawable.ColorDrawable',
};

function objectValue(object, name, className) {
	const key = `${object.ref}/${name}`;

	if (!childRefs.has(key)) {
		classNamed(className);
		childRefs.set(key, register(className));
	}

	return {
		kind: 'object',
		text: describe(objects.get(childRefs.get(key))),
		object: childRefs.get(key),
		className,
	};
}

function iosValue(object, { name, type }) {
	const fixed = object.values[name.replace(/^_/, '')] ?? object.values[name];
	if (fixed === null) return { kind: 'nil', text: 'nil' };
	if (fixed !== undefined) {
		return /^[-{\d]/.test(fixed) && type !== 'BOOL'
			? { kind: /^\{/.test(fixed) ? 'struct' : 'number', text: fixed }
			: { kind: type === 'BOOL' ? 'bool' : 'string', text: fixed };
	}

	if (IOS_VALUES[name]) return IOS_VALUES[name];
	if (type === 'BOOL') return { kind: 'bool', text: 'NO' };
	if (/^(CGFloat|double|float|int|NS(U?Integer|TimeInterval))$/.test(type))
		return { kind: 'number', text: '0' };
	if (/^CG(Rect|Point|Size)|UIEdgeInsets$/.test(type)) return { kind: 'struct', text: '{0, 0}' };
	if (type === 'Class')
		return { kind: 'class', text: object.className, className: object.className };
	if (type === 'SEL') return { kind: 'selector', text: 'layoutSubviews' };
	if (/^void \*|Ref$/.test(type))
		return { kind: 'pointer', text: `0x6000${object.address.slice(-8)}` };
	if (type === 'id') return { kind: 'nil', text: 'nil' };
	if (type === 'NSString *') return { kind: 'string', text: name };
	if (type.endsWith(' *')) return objectValue(object, name, type.slice(0, -2));

	return { kind: 'other', text: type };
}

function androidValue(object, { name, type }) {
	const fixed = object.values[name];
	if (fixed === null) return { kind: 'nil', text: 'null' };
	if (fixed !== undefined)
		return { kind: /^-?[\d.]+$/.test(fixed) ? 'number' : 'string', text: fixed };

	if (ANDROID_VALUES[name]) return ANDROID_VALUES[name];
	if (type === 'boolean') return { kind: 'bool', text: 'false' };
	if (/^(int|long|short|byte)$/.test(type)) return { kind: 'number', text: '0' };
	if (/^(float|double)$/.test(type)) return { kind: 'number', text: '0.0' };
	if (type.endsWith('[]')) return { kind: 'other', text: `${type.replace('[]', '[0]')}` };
	if (/^java\.lang\.(String|CharSequence)$/.test(type)) return { kind: 'nil', text: 'null' };

	return objectValue(object, name, ANDROID_RUNTIME_CLASSES[type] ?? type);
}

function valueOf(object, member, invokeGetters) {
	if (member.read === 'never') return { kind: 'skipped', text: 'Unsafe to read' };
	if (member.read === 'manual' && !invokeGetters) {
		return { kind: 'skipped', text: 'Computed; read it to run the getter' };
	}

	try {
		const value = ios ? iosValue(object, member) : androidValue(object, member);

		return value.kind === 'string' && value.text.length > STRING_LIMIT
			? { ...value, text: `${value.text.slice(0, STRING_LIMIT)}…` }
			: value;
	} catch (error) {
		return { kind: 'error', text: `Failed to read ${member.name}: ${error.message}` };
	}
}

/**
 * Answers an `explorer-values-request`: one value per name, in order, each failing alone.
 * @param {{ object: string, className: string, kind: string, names: string[], invokeGetters?: boolean }} request
 */
export function answerValues(request) {
	const object = objectOf(request.object);

	if (!VALUE_KINDS.includes(request.kind)) {
		throw new ExplorerFailure(
			'failed',
			`Failed to read ${request.kind}: values are ${VALUE_KINDS.join(' or ')} only.`,
		);
	}

	if (request.names.length > VALUES_LIMIT) {
		throw new ExplorerFailure(
			'failed',
			`Failed to read ${request.names.length} values: at most ${VALUES_LIMIT} per request.`,
		);
	}

	const members = classNamed(request.className).members[request.kind] ?? [];
	const values = request.names.map((name) => {
		const member = members.find((candidate) => candidate.name === name);
		const value = member
			? valueOf(object, member, request.invokeGetters)
			: {
					kind: 'error',
					text: `Failed to find ${request.kind} ${name} on ${request.className}.`,
				};

		return { name, ...value };
	});

	return { values };
}
