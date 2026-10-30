import type {
	NativeJavaHandleValue,
	NativeJavaReference,
	NativeJavaValue,
	NativeObjectHandle,
	NativePluginCapability,
} from '@unbound-app/api/native';
import type { UnboundGlobal } from '@unbound-app/api/global';

import type { InspectReport, ViewRecord } from '~/lib/inspect-report';
import type { PluginManager } from '~/lib/probes';

export type InspectRequest =
	| { kind: 'class'; name: string }
	| { kind: 'views'; className: string; maxDepth: number; maxNodes: number; chunk: number }
	| { kind: 'find'; className: string; maxResults: number; maxNodes: number; chunk: number };

/**
 * @description Answers one `ubd inspect` request on the device: a Java class description, the current activity's view tree, or the attached views of a class on Android, and the same through the Objective-C bridge on iOS where it allows. It borrows the native bridge of a running plugin that holds the needed capabilities, and yields to the JavaScript thread between chunks of a view walk. Runs on the device through `toDeviceCode`, so it only uses its parameters and the device's globals.
 * @param unbound Unbound's global on the device.
 * @param request What to inspect, with the walk's limits.
 * @returns The raw report, which the CLI formats.
 */
export async function inspectNative(
	unbound: UnboundGlobal,
	request: InspectRequest,
): Promise<InspectReport> {
	const manager = Reflect.get(unbound, 'plugins') as PluginManager;
	const holder = (platform: string, capabilities: NativePluginCapability[]) =>
		[...manager.entities.values()].find(
			(entity) =>
				entity.started &&
				entity.context?.platform === platform &&
				capabilities.every((capability) =>
					entity.context?.capabilities.includes(capability),
				),
		)?.context;
	const yieldToJs = () => new Promise((resolve) => setTimeout(resolve, 0));
	const snippet = (text: string | null | undefined) =>
		text ? text.slice(0, 60).replaceAll('\n', '\\n') : null;
	const android = holder(
		'android',
		request.kind === 'class'
			? ['native.java.classes', 'native.java.invoke']
			: ['native.java.classes', 'native.java.fields', 'native.java.invoke'],
	);
	const ios = holder(
		'ios',
		request.kind === 'class'
			? ['native.objc.classes', 'native.objc.invoke']
			: ['native.objc.classes', 'native.objc.invoke', 'native.objc.snapshot'],
	);

	if (android) {
		const { java } = android.native;
		const handle = (value: NativeJavaValue): NativeJavaHandleValue | null =>
			value.type === 'handle' ? value : null;
		const isTrue = (value: NativeJavaValue) => 'value' in value && value.value === true;
		const number = (value: NativeJavaValue) =>
			'value' in value && typeof value.value === 'number' ? value.value : 0;
		const string = (value: NativeJavaValue) => (value.type === 'string' ? value.value : '');
		const int = (value: number): NativeJavaValue => ({ type: 'int', value });

		if (request.kind === 'class') {
			const candidates = request.name.includes('.')
				? [request.name]
				: ['android.widget.', 'android.view.', 'android.app.', 'java.lang.'].map(
						(prefix) => prefix + request.name,
					);

			for (const candidate of candidates) {
				let description;

				try {
					description = java.describe(candidate);
				} catch {
					continue;
				}

				const superclasses: string[] = [];
				let parent = description.superclass;

				for (let depth = 0; parent && depth < 32; depth++) {
					superclasses.push(parent);

					const parentClass = handle(java.invoke(java.getClass(parent), 'getSuperclass'));

					parent = parentClass ? string(java.invoke(parentClass, 'getName')) : null;
				}

				return {
					platform: 'android',
					name: description.name,
					superclasses,
					interfaces: description.interfaces,
					constructors: description.constructors,
					methods: description.methods,
					fields: description.fields,
					members: true,
				};
			}

			return { error: `No Java class is named ${candidates.join(' or ')}.` };
		}

		const tracker = handle(
			java.getField(java.getClass('app.unbound.android.ActivityTracker'), 'INSTANCE'),
		);
		const activity = tracker ? handle(java.invoke(tracker, 'currentActivity')) : null;
		const window = activity ? handle(java.invoke(activity, 'getWindow')) : null;
		const decor = window ? handle(java.invoke(window, 'getDecorView')) : null;

		if (!decor) {
			return { error: 'No Android activity is resumed.' };
		}

		const { chunk, maxNodes } = request;
		const group = java.getClass('android.view.ViewGroup');
		const textView = java.getClass('android.widget.TextView');
		const resources = handle(java.invoke(decor, 'getResources'));
		const idNames = new Map<number, string | null>();
		let target: NativeJavaReference | null = null;
		let visited = 0;
		let truncated = false;

		if (request.className) {
			try {
				target = java.getClass(request.className);
			} catch {
				return { error: `No Java class is named ${request.className}.` };
			}
		}

		function children(view: NativeJavaHandleValue): NativeJavaHandleValue[] {
			if (!isTrue(java.invoke(group, 'isInstance', [view]))) {
				return [];
			}

			const count = number(java.invoke(view, 'getChildCount'));
			const found: NativeJavaHandleValue[] = [];

			for (let index = 0; index < count; index++) {
				const child = handle(java.invoke(view, 'getChildAt', [int(index)]));

				if (child) {
					found.push(child);
				}
			}

			return found;
		}

		function idName(view: NativeJavaHandleValue): string | null {
			const id = number(java.invoke(view, 'getId'));

			if (id <= 0) return null;

			if (!idNames.has(id)) {
				let name: string | null = `0x${id.toString(16)}`;

				try {
					name = resources
						? string(java.invoke(resources, 'getResourceEntryName', [int(id)])) || name
						: name;
				} catch {
					name = `0x${id.toString(16)}`;
				}

				idNames.set(id, name);
			}

			return idNames.get(id) ?? null;
		}

		function record(view: NativeJavaHandleValue, depth: number): ViewRecord {
			let text: string | null = null;

			if (isTrue(java.invoke(textView, 'isInstance', [view]))) {
				const value = java.invoke(view, 'getText');
				const content = handle(value);

				text = snippet(content ? string(java.invoke(content, 'toString')) : string(value));
			}

			return {
				depth,
				className: string(java.className(view)),
				id: idName(view),
				width: number(java.invoke(view, 'getWidth')),
				height: number(java.invoke(view, 'getHeight')),
				visibility:
					(['visible', 'invisible', 'gone'] as const)[
						number(java.invoke(view, 'getVisibility')) / 4
					] ?? 'visible',
				text,
				handle: view.value,
			};
		}

		async function visit() {
			visited++;

			if (visited % chunk === 0) {
				await yieldToJs();
			}

			if (visited >= maxNodes) {
				truncated = true;
			}
		}

		async function walk(root: NativeJavaHandleValue): Promise<ViewRecord[]> {
			const lines: ViewRecord[] = [];
			const stack: [NativeJavaHandleValue, number][] = [[root, 0]];

			while (stack.length && !truncated) {
				const [view, depth] = stack.pop()!;

				await visit();
				lines.push(record(view, depth));

				if (request.kind === 'views' && depth < request.maxDepth) {
					stack.push(
						...children(view)
							.reverse()
							.map((child): [NativeJavaHandleValue, number] => [child, depth + 1]),
					);
				}
			}

			return lines;
		}

		async function search(): Promise<NativeJavaHandleValue[]> {
			const found: NativeJavaHandleValue[] = [];
			const queue: NativeJavaHandleValue[] = [decor!];
			const limit = request.kind === 'find' ? request.maxResults : 64;

			while (queue.length && !truncated && found.length < limit) {
				const view = queue.shift()!;

				await visit();

				if (
					target &&
					isTrue(java.invoke(target, 'isInstance', [view])) &&
					isTrue(java.invoke(view, 'isAttachedToWindow'))
				) {
					found.push(view);

					if (request.kind === 'views') {
						continue;
					}
				}

				queue.push(...children(view));
			}

			return found;
		}

		if (request.kind === 'find') {
			const found = await search();

			return {
				platform: 'android',
				roots: [found.map((view) => record(view, 0))],
				visited,
				truncated,
			};
		}

		const roots = target ? await search() : [decor];
		const trees: ViewRecord[][] = [];

		for (const root of roots) {
			trees.push(await walk(root));
		}

		return { platform: 'android', roots: trees, visited, truncated };
	}

	if (ios) {
		const { objc } = ios.native;

		if (request.kind === 'class') {
			const found = objc.getClass(request.name);

			if (!found) {
				return { error: `No Objective-C class is named ${request.name}.` };
			}

			const superclasses: string[] = [];
			let parent = objc.call(found, 'superclass') as NativeObjectHandle | null;

			for (let depth = 0; parent && depth < 32; depth++) {
				superclasses.push(objc.className(parent) ?? '?');
				parent = objc.call(parent, 'superclass') as NativeObjectHandle | null;
			}

			return {
				platform: 'ios',
				name: objc.className(found) ?? request.name,
				superclasses,
				interfaces: [],
				constructors: [],
				methods: [],
				fields: [],
				members: false,
			};
		}

		const application = objc.getClass('UIApplication');
		const shared = application
			? (objc.call(application, 'sharedApplication') as NativeObjectHandle | null)
			: null;
		const list = shared ? objc.call(shared, 'windows') : null;
		const windows = (
			Array.isArray(list)
				? (list as NativeObjectHandle[])
				: list
					? (objc.array(list as NativeObjectHandle) as NativeObjectHandle[])
					: []
		).filter((window) => objc.call(window, 'isHidden') !== true);

		if (!windows.length) {
			return { error: 'No visible window is available.' };
		}

		if (request.className && !objc.getClass(request.className)) {
			return { error: `No Objective-C class is named ${request.className}.` };
		}

		const { chunk } = request;
		const nodeCap = Math.min(Math.max(request.maxNodes, 1), 256);
		const trees: ViewRecord[][] = [];
		let visited = 0;
		let truncated = false;

		async function snapshotOf(root: NativeObjectHandle, maxDepth: number) {
			const nodes = await objc.snapshot(root, { maxDepth, maxNodes: nodeCap });

			visited += nodes.length;
			truncated ||= nodes.length >= nodeCap;

			const records: ViewRecord[] = [];
			const childrenOf = new Map<number, number[]>();

			for (const [index, node] of nodes.entries()) {
				childrenOf.set(node.parent, [...(childrenOf.get(node.parent) ?? []), index]);
			}

			const order: [number, number][] = [];
			const pending: [number, number][] = nodes
				.flatMap((node, index) =>
					nodes[node.parent] ? [] : [[index, 0] as [number, number]],
				)
				.reverse();

			while (pending.length) {
				const [index, depth] = pending.pop()!;

				order.push([index, depth]);
				pending.push(
					...(childrenOf.get(index) ?? [])
						.map((child): [number, number] => [child, depth + 1])
						.reverse(),
				);
			}

			for (const [position, [index, depth]] of order.entries()) {
				const node = nodes[index]!;

				if (position > 0 && position % chunk === 0) {
					await yieldToJs();
				}

				const identifier = objc.call(node.view, 'accessibilityIdentifier');

				records.push({
					depth,
					className: node.className,
					id: typeof identifier === 'string' && identifier ? identifier : null,
					width: Math.round(node.frame.width),
					height: Math.round(node.frame.height),
					visibility: node.visible ? 'visible' : 'hidden',
					text: snippet(node.text),
					handle: null,
				});
			}

			return records;
		}

		const search = {
			maxDepth: 64,
			maxVisited: 4096,
			maxResults: request.kind === 'find' ? request.maxResults : 16,
			attachedOnly: true,
			stopAtMatch: request.kind === 'views',
		};

		if (request.kind === 'find') {
			const found: ViewRecord[] = [];

			for (const window of windows) {
				for (const view of await objc.findViews(window, request.className, search)) {
					found.push(...(await snapshotOf(view, 0)).slice(0, 1));
				}
			}

			return { platform: 'ios', roots: [found], visited: null, truncated: false };
		}

		for (const window of windows) {
			const roots = request.className
				? await objc.findViews(window, request.className, search)
				: [window];

			for (const root of roots) {
				trees.push(await snapshotOf(root, Math.min(request.maxDepth, 40)));
			}
		}

		return { platform: 'ios', roots: trees, visited, truncated };
	}

	return {
		error:
			request.kind === 'class'
				? 'No running plugin can read native classes. Enable a native plugin, such as Shiki Codeblocks, then retry.'
				: 'No running plugin can read native views. Enable a plugin with native view access, such as Shiki Codeblocks, then retry.',
	};
}
