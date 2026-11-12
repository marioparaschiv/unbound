import type {
	NativeCancelablePromise,
	NativeInspectKind,
	NativeInspectPage,
	NativeInspectedClass,
	NativeInspectedValue,
	NativeObjCResult,
	NativeObjectHandle,
} from '@unbound-app/types';
import { describe, expect, test } from 'bun:test';

import { createObjectRegistry, type ExplorerHandle } from '~/debugger/explorer-objects.dev';
import { createIosExplorer, toExplorerMember } from '~/debugger/explorer-ios.dev';
import { explorerFailure } from '~/debugger/explorer-errors.dev';

const cancellable = <T>(promise: Promise<T>): NativeCancelablePromise<T> =>
	Object.assign(promise, { cancel: () => {} });

const LABEL: NativeInspectedClass = {
	name: 'UILabel',
	superclass: 'UIView',
	image: '/System/Library/PrivateFrameworks/UIKitCore.framework/UIKitCore',
	instanceSize: 720,
	counts: { properties: 64, ivars: 31, methods: 310, classMethods: 12, protocols: 3 },
};

function setup() {
	const label: NativeObjectHandle = Object.create(null);
	const color: NativeObjectHandle = Object.create(null);
	const pages: NativeInspectPage[] = [];
	const objects = createObjectRegistry<ExplorerHandle>({ epoch: 'e' });
	const inspector = {
		className: () => 'UILabel',
		invokeAsync: () =>
			cancellable(Promise.resolve<NativeObjCResult>("<UILabel: 0x1; text = 'General'>")),
		inspectClass(target: NativeObjectHandle | string) {
			if (target === 'Missing') {
				throw Object.assign(new Error('No class named Missing'), {
					code: 'INSPECTOR_UNKNOWN_CLASS',
				});
			}

			return [LABEL];
		},
		inspectMembers(_className: string, _kind: NativeInspectKind, page?: NativeInspectPage) {
			pages.push(page ?? {});

			return { total: 0, members: [] };
		},
		inspectValues(
			_object: NativeObjectHandle,
			_className: string,
			_kind: 'properties' | 'ivars',
			names: string[],
		) {
			const values: NativeInspectedValue[] = names.map((name) =>
				name === 'textColor'
					? { name, kind: 'object', text: 'UIColor', object: color, className: 'UIColor' }
					: { name, kind: 'skipped', text: 'Computed' },
			);

			return cancellable(Promise.resolve(values));
		},
		inspectImages: () => ({ total: 0, images: [] }),
		inspectClasses: (_path: string, page?: NativeInspectPage) => {
			pages.push(page ?? {});

			return { total: 1, classes: ['UILabel'] };
		},
	};
	const explorer = createIosExplorer(inspector, {
		objects,
		nodeHandle: (node) => (node === '5' ? label : undefined),
	});

	return { explorer, objects, pages, label, color };
}

const codeOf = (promise: Promise<unknown>) =>
	promise.then(
		() => 'resolved',
		(error) => explorerFailure(error).code,
	);

describe('toExplorerMember', () => {
	test('keeps the fields the protocol has and marks class methods static', () => {
		expect(
			toExplorerMember({
				name: 'textColor',
				kind: 'properties',
				type: 'UIColor *',
				signature: '@property (nonatomic, strong) UIColor *textColor',
				encoding: '@"UIColor"',
				attributes: ['nonatomic', 'strong'],
				getter: 'textColor',
				ivar: '_textColor',
				read: 'auto',
			}),
		).toEqual({
			name: 'textColor',
			kind: 'properties',
			type: 'UIColor *',
			signature: '@property (nonatomic, strong) UIColor *textColor',
			attributes: ['nonatomic', 'strong'],
			read: 'auto',
		});
		expect(
			toExplorerMember({
				name: 'layerClass',
				kind: 'classMethods',
				returnType: 'Class',
				read: 'never',
			}),
		).toEqual({
			name: 'layerClass',
			kind: 'classMethods',
			type: 'Class',
			signature: null,
			returnType: 'Class',
			static: true,
			read: 'never',
		});
	});
});

describe('createIosExplorer', () => {
	test('opens a listed view by node with a ref, its description and class chain', async () => {
		const { explorer, objects, label } = setup();
		const object = await explorer.object({ node: '5' });

		expect(object).toEqual({
			ref: 'e:1',
			className: 'UILabel',
			description: "<UILabel: 0x1; text = 'General'>",
			platform: 'ios',
			chain: [
				{
					name: 'UILabel',
					image: LABEL.image,
					instanceSize: 720,
					counts: LABEL.counts,
				},
			],
		});
		expect(objects.resolve('e:1')).toBe(label);
	});

	test('registers object values so they open by ref', async () => {
		const { explorer, objects, color } = setup();
		const { ref } = await explorer.object({ node: '5' });
		const values = await explorer.values({
			type: 'explorer-values-request',
			id: 'v',
			object: ref ?? '',
			className: 'UILabel',
			kind: 'properties',
			names: ['textColor', 'text'],
		});

		expect(values).toEqual([
			{
				name: 'textColor',
				kind: 'object',
				text: 'UIColor',
				object: 'e:2',
				className: 'UIColor',
			},
			{ name: 'text', kind: 'skipped', text: 'Computed' },
		]);
		expect(objects.resolve('e:2')).toBe(color);
	});

	test('passes the page and filter through to the inspector', async () => {
		const { explorer, pages } = setup();

		await explorer.members('UILabel', 'methods', { offset: 100, limit: 100, filter: 'text' });
		await explorer.classes('/UIKitCore', { offset: 0, limit: 200 });

		expect(pages).toEqual([
			{ offset: 100, limit: 100, filter: 'text' },
			{ offset: 0, limit: 200 },
		]);
	});

	test('answers stale, unknown-class and unsupported with their codes', async () => {
		const { explorer } = setup();
		const values = {
			type: 'explorer-values-request',
			id: 'v',
			className: 'UILabel',
			names: ['text'],
		} as const;

		expect(await codeOf(explorer.object({ node: '6' }))).toBe('stale');
		expect(
			await codeOf(explorer.values({ ...values, object: 'old:1', kind: 'ivars', names: [] })),
		).toBe('stale');
		expect(await codeOf(explorer.object({ className: 'Missing' }))).toBe('unknown-class');
		expect(await codeOf(explorer.members('UILabel', 'fields', { offset: 0, limit: 1 }))).toBe(
			'unsupported',
		);
	});

	test('answers unsupported on a loader without the inspector', async () => {
		const explorer = createIosExplorer(
			{
				className: () => null,
				invokeAsync: () => cancellable(Promise.resolve<NativeObjCResult>(undefined)),
			},
			{ objects: createObjectRegistry(), nodeHandle: () => undefined },
		);

		expect(await codeOf(explorer.object({ className: 'UIView' }))).toBe('unsupported');
	});
});
