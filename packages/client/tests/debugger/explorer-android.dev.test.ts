import type {
	NativeCancelablePromise,
	NativeJavaBatchOperation,
	NativeJavaClassDescription,
	NativeJavaReference,
	NativeJavaValue,
} from '@unbound-app/types';
import { describe, expect, test } from 'bun:test';

import {
	createAndroidExplorer,
	describeMembers,
	displayType,
	pageMembers,
} from '~/debugger/explorer-android.dev';
import {
	createObjectRegistry,
	isJavaHandle,
	type ExplorerHandle,
} from '~/debugger/explorer-objects.dev';
import { explorerFailure } from '~/debugger/explorer-errors.dev';

const TEXT_VIEW: NativeJavaClassDescription = {
	name: 'android.widget.TextView',
	superclass: 'android.view.View',
	interfaces: ['android.view.ViewTreeObserver$OnPreDrawListener'],
	constructors: [['android.content.Context'], []],
	methods: [
		{
			name: 'setText',
			parameters: ['java.lang.CharSequence'],
			returnType: 'void',
			static: false,
		},
		{ name: 'getText', parameters: [], returnType: 'java.lang.CharSequence', static: false },
		{ name: 'obtain', parameters: ['[I'], returnType: 'android.widget.TextView', static: true },
	],
	fields: [
		{ name: 'mText', type: 'java.lang.CharSequence', static: false },
		{ name: 'mMaxWidth', type: 'int', static: false },
		{ name: 'sLastCutCopyOrTextChangedTime', type: 'long', static: true },
	],
};
const CLASSES: Record<string, NativeJavaClassDescription> = {
	[TEXT_VIEW.name]: TEXT_VIEW,
	'android.view.View': {
		name: 'android.view.View',
		superclass: 'java.lang.Object',
		interfaces: [],
		constructors: [],
		methods: [],
		fields: [{ name: 'mTags', type: '[Ljava.lang.Object;', static: false }],
	},
	'java.lang.Object': {
		name: 'java.lang.Object',
		superclass: null,
		interfaces: [],
		constructors: [[]],
		methods: [],
		fields: [],
	},
};
const FIELDS: Record<string, NativeJavaValue> = {
	mText: { type: 'handle', value: 'java-9' },
	mMaxWidth: { type: 'int', value: 120 },
	mTags: { type: 'array', componentType: 'java.lang.Object', value: [1, 2] },
	mHint: { type: 'null' },
};

const cancellable = <T>(promise: Promise<T>): NativeCancelablePromise<T> =>
	Object.assign(promise, { cancel: () => {} });

function fakeJava() {
	const described: string[] = [];
	const batches: NativeJavaBatchOperation[][] = [];

	function run(operation: NativeJavaBatchOperation): NativeJavaValue {
		if (operation.op === 'invoke') {
			return { type: 'string', value: 'TextView{1a2b}' };
		}

		const value = FIELDS[operation.name];

		if (!value) {
			throw new Error(`No field ${operation.name} on android.widget.TextView`);
		}

		return value;
	}

	return {
		described,
		batches,
		java: {
			describe(name: string) {
				described.push(name);

				const found = CLASSES[name];

				if (!found) {
					throw new Error(`java.lang.ClassNotFoundException: ${name}`);
				}

				return found;
			},
			className(handle: NativeJavaReference): NativeJavaValue {
				const value = 'value' in handle ? handle.value : '';

				return {
					type: 'string',
					value: value === 'java-1' ? TEXT_VIEW.name : 'java.lang.String',
				};
			},
			batchAsync(operations: NativeJavaBatchOperation[]) {
				batches.push(operations);

				try {
					return cancellable(Promise.resolve(operations.map(run)));
				} catch (error) {
					return cancellable(Promise.reject(error));
				}
			},
		},
	};
}

function setup() {
	const fake = fakeJava();
	const objects = createObjectRegistry<ExplorerHandle>({
		epoch: 'e',
		key: (handle) => (isJavaHandle(handle) ? handle.value : handle),
	});
	const view: ExplorerHandle = { type: 'handle', value: 'java-1' };
	const explorer = createAndroidExplorer(fake.java, {
		objects,
		nodeHandle: (node) => (node === '5' ? view : undefined),
	});

	return { ...fake, objects, explorer };
}

const page = { offset: 0, limit: 100 };

describe('displayType', () => {
	test('shortens class names and decodes arrays', () => {
		expect(displayType('java.lang.String')).toBe('String');
		expect(displayType('int')).toBe('int');
		expect(displayType('[I')).toBe('int[]');
		expect(displayType('[[Ljava.lang.Object;')).toBe('Object[][]');
		expect(displayType('android.view.View$OnClickListener')).toBe('View$OnClickListener');
	});
});

describe('describeMembers', () => {
	test('declares fields and methods, sorted, keeping full names for hooks', () => {
		expect(describeMembers(TEXT_VIEW, 'fields').map((member) => member.signature)).toEqual([
			'int mMaxWidth',
			'CharSequence mText',
			'static long sLastCutCopyOrTextChangedTime',
		]);
		expect(describeMembers(TEXT_VIEW, 'methods')).toContainEqual({
			name: 'obtain',
			kind: 'methods',
			type: 'android.widget.TextView',
			signature: 'static TextView obtain(int[])',
			returnType: 'android.widget.TextView',
			parameters: ['[I'],
			static: true,
			read: 'never',
		});
		expect(
			describeMembers(TEXT_VIEW, 'constructors').map((member) => member.signature),
		).toEqual(['TextView()', 'TextView(Context)']);
	});
});

describe('pageMembers', () => {
	test('filters by name ignoring case, then pages', () => {
		const fields = describeMembers(TEXT_VIEW, 'fields');

		expect(pageMembers(fields, { offset: 1, limit: 1 })).toEqual({
			members: [fields[1]],
			total: 3,
		});
		expect(pageMembers(fields, { offset: 0, limit: 10, filter: 'MTEXT' }).total).toBe(1);
	});
});

describe('createAndroidExplorer', () => {
	test('opens a listed view by node with a ref, its description and class chain', async () => {
		const { explorer, objects } = setup();
		const object = await explorer.object({ node: '5' });

		expect(object).toMatchObject({
			ref: 'e:1',
			className: TEXT_VIEW.name,
			description: 'TextView{1a2b}',
			platform: 'android',
		});
		expect(object.chain.map((klass) => klass.name)).toEqual([
			'android.widget.TextView',
			'android.view.View',
			'java.lang.Object',
		]);
		expect(object.chain[0]?.counts).toEqual({
			fields: 3,
			methods: 3,
			constructors: 2,
			interfaces: 1,
		});
		expect(objects.resolve('e:1')).toEqual({ type: 'handle', value: 'java-1' });
	});

	test('answers stale for a gone node or ref, and unknown-class for a missing class', async () => {
		const { explorer } = setup();
		const codeOf = (promise: Promise<unknown>) =>
			promise.then(
				() => 'resolved',
				(error) => explorerFailure(error).code,
			);

		expect(await codeOf(explorer.object({ node: '6' }))).toBe('stale');
		expect(await codeOf(explorer.object({ object: 'old:1' }))).toBe('stale');
		expect(await codeOf(explorer.object({ className: 'com.example.Missing' }))).toBe(
			'unknown-class',
		);
		expect(await codeOf(explorer.members(TEXT_VIEW.name, 'ivars', page))).toBe('unsupported');
		expect(await codeOf(explorer.classes(undefined, page))).toBe('unsupported');
	});

	test('describes each class once across member pages', async () => {
		const { explorer, described } = setup();

		await explorer.object({ className: TEXT_VIEW.name });
		await explorer.members(TEXT_VIEW.name, 'fields', page);
		const methods = await explorer.members(TEXT_VIEW.name, 'methods', { ...page, limit: 2 });

		expect(methods.total).toBe(3);
		expect(methods.members.map((member) => member.name)).toEqual(['getText', 'obtain']);
		expect(described).toEqual([
			'android.widget.TextView',
			'android.view.View',
			'java.lang.Object',
		]);
	});

	test('reads fields in one batch, registering object values', async () => {
		const { explorer, batches } = setup();
		const { ref } = await explorer.object({ node: '5' });

		batches.length = 0;

		const values = await explorer.values({
			type: 'explorer-values-request',
			id: 'v',
			object: ref ?? '',
			className: TEXT_VIEW.name,
			kind: 'fields',
			names: ['mText', 'mMaxWidth', 'mTags', 'mHint'],
		});

		expect(batches).toHaveLength(1);
		expect(values).toEqual([
			{
				name: 'mText',
				kind: 'object',
				text: 'java.lang.String',
				object: 'e:2',
				className: 'java.lang.String',
			},
			{ name: 'mMaxWidth', kind: 'number', text: '120' },
			{ name: 'mTags', kind: 'other', text: 'Object[2]' },
			{ name: 'mHint', kind: 'nil', text: 'null' },
		]);
	});

	test('reports a failing field on its own row instead of failing the batch', async () => {
		const { explorer } = setup();
		const { ref } = await explorer.object({ node: '5' });
		const values = await explorer.values({
			type: 'explorer-values-request',
			id: 'v',
			object: ref ?? '',
			className: TEXT_VIEW.name,
			kind: 'fields',
			names: ['mMaxWidth', 'mGone'],
		});

		expect(values).toEqual([
			{ name: 'mMaxWidth', kind: 'number', text: '120' },
			{ name: 'mGone', kind: 'error', text: 'No field mGone on android.widget.TextView' },
		]);
	});
});
