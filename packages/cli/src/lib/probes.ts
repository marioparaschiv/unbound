import type {
	NativeJavaHandleValue,
	NativeJavaValue,
	NativeObjectHandle,
	NativePluginCapability,
	PluginContext,
} from '@unbound-app/api/native';
import type { UnboundGlobal } from '@unbound-app/api/global';

type PluginEntity = { started?: boolean; context?: PluginContext };
type PluginEntities = Map<string, PluginEntity>;
type PluginManager = { entities: PluginEntities };
type ModuleRecord = {
	isInitialized?: boolean;
	__filePath?: string;
	publicModule?: { exports?: object };
};
type ModuleRegistry = Map<number, ModuleRecord>;
type TracedModule = Record<string, (...args: never[]) => void>;
type ViewLine = { depth: number; line: string; match: boolean };
type Summarized =
	| { [key: string]: Summarized }
	| Summarized[]
	| string
	| number
	| boolean
	| null
	| undefined;

/**
 * @description Prints the native view tree: Android views from the current activity's decor view, iOS views from every visible window. Runs on the device through `toDeviceCode`, so it only uses its parameters and the device's globals, and borrows the native bridge of a running plugin that holds the needed capability.
 * @param unbound Unbound's global on the device.
 * @param filter A class name substring; matching views and their ancestors are kept. Empty keeps every view.
 * @param maxDepth How deep to walk.
 * @param maxNodes How many views to visit at most.
 * @returns One indented line per view.
 */
export async function viewTree(
	unbound: UnboundGlobal,
	filter: string,
	maxDepth: number,
	maxNodes: number,
): Promise<string> {
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
	const android = holder('android', [
		'native.java.classes',
		'native.java.fields',
		'native.java.invoke',
	]);
	const ios = holder('ios', ['native.objc.snapshot']);

	if (android) {
		const { java } = android.native;
		const handle = (value: NativeJavaValue): NativeJavaHandleValue | null =>
			value.type === 'handle' ? value : null;
		const isTrue = (value: NativeJavaValue) => 'value' in value && value.value === true;
		const number = (value: NativeJavaValue) =>
			'value' in value && typeof value.value === 'number' ? value.value : 0;
		const string = (value: NativeJavaValue) => (value.type === 'string' ? value.value : '');
		const tracker = handle(
			java.getField(java.getClass('app.unbound.android.ActivityTracker'), 'INSTANCE'),
		);
		const activity = tracker ? handle(java.invoke(tracker, 'currentActivity')) : null;
		const window = activity ? handle(java.invoke(activity, 'getWindow')) : null;
		const decor = window ? handle(java.invoke(window, 'getDecorView')) : null;

		if (!decor) {
			return 'No Android activity is resumed.';
		}

		const group = java.getClass('android.view.ViewGroup');
		const textView = java.getClass('android.widget.TextView');
		const lines: ViewLine[] = [];
		let visited = 0;

		function describeText(view: NativeJavaHandleValue): string {
			if (!isTrue(java.invoke(textView, 'isInstance', [view]))) {
				return '';
			}

			const value = java.invoke(view, 'getText');
			const text = handle(value);
			const content = text ? string(java.invoke(text, 'toString')) : string(value);

			return content ? ` "${content.slice(0, 48).replaceAll('\n', '\\n')}"` : '';
		}

		function walk(view: NativeJavaHandleValue, depth: number) {
			if (depth > maxDepth || visited >= maxNodes) return;

			visited++;

			const name = string(java.className(view));
			const size = `${number(java.invoke(view, 'getWidth'))}x${number(java.invoke(view, 'getHeight'))}`;
			const visibility = ['', ' invisible', ' gone'][
				number(java.invoke(view, 'getVisibility')) / 4
			];

			lines.push({
				depth,
				line: `${'  '.repeat(depth)}${name.replace(/^com\.discord\./, '~')} ${size}${visibility ?? ''} [${view.value}]${describeText(view)}`,
				match: !filter || name.includes(filter),
			});

			if (!isTrue(java.invoke(group, 'isInstance', [view]))) return;

			const count = number(java.invoke(view, 'getChildCount'));

			for (let index = 0; index < count; index++) {
				const child = handle(
					java.invoke(view, 'getChildAt', [{ type: 'int', value: index }]),
				);

				if (child) {
					walk(child, depth + 1);
				}
			}
		}

		walk(decor, 0);

		const kept = new Set<number>();

		for (const [index, entry] of lines.entries()) {
			if (!entry.match) {
				continue;
			}

			kept.add(index);

			let depth = entry.depth;

			for (let parent = index - 1; parent >= 0 && depth > 0; parent--) {
				if (lines[parent]!.depth < depth) {
					kept.add(parent);
					depth = lines[parent]!.depth;
				}
			}
		}

		const output = lines.filter((_, index) => kept.has(index)).map((entry) => entry.line);

		return `${output.join('\n')}\n(${visited} views visited${visited >= maxNodes ? ', limit reached' : ''})`;
	}

	if (ios) {
		const { objc } = ios.native;
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
			return 'No visible window is available.';
		}

		const roots: NativeObjectHandle[] = [];

		for (const window of windows) {
			if (!filter) {
				roots.push(window);
				continue;
			}

			const search = {
				maxDepth: 40,
				maxVisited: 2048,
				maxResults: 8,
				attachedOnly: true,
				stopAtMatch: true,
			};
			const direct = await objc.findViews(window, filter, search);

			if (direct.length) {
				roots.push(...direct);
				continue;
			}

			for (const list of await objc.findViews(window, 'UIScrollView', search)) {
				roots.push(...(await objc.findViews(list, filter, search)));
			}
		}

		if (!roots.length) {
			return `No ${filter} view is in a visible window.`;
		}

		const sections: string[] = [];

		for (const root of roots) {
			const nodes = await objc.snapshot(root, {
				maxDepth: Math.min(maxDepth, 12),
				maxNodes: Math.min(Math.max(maxNodes, 1), 256),
			});
			const lines = nodes.map((node) => {
				const { width, height } = node.frame;
				const text = node.text
					? ` "${node.text.slice(0, 48).replaceAll('\n', '\\n')}"`
					: '';

				return `${'  '.repeat(node.depth)}${node.className} ${Math.round(width)}x${Math.round(height)}${node.visible ? '' : ' hidden'}${text}`;
			});

			sections.push(lines.join('\n'));
		}

		return sections.join('\n\n');
	}

	return 'No running plugin can read native views. Enable a plugin with native view access, such as Shiki Codeblocks, then retry.';
}

/**
 * @description Prints the text and spans of Android text views whose text contains a match, the way span-based plugins see them. Runs on the device through `toDeviceCode`, so it only uses its parameters and the device's globals.
 * @param unbound Unbound's global on the device.
 * @param match The text to look for.
 * @param maxViews How many matching text views to print.
 * @returns Each matching view's escaped text and its spans with their ranges.
 */
export function textSpans(unbound: UnboundGlobal, match: string, maxViews: number): string {
	const manager = Reflect.get(unbound, 'plugins') as PluginManager;
	const context = [...manager.entities.values()].find(
		(entity) =>
			entity.started &&
			entity.context?.platform === 'android' &&
			['native.java.classes', 'native.java.fields', 'native.java.invoke'].every(
				(capability) =>
					entity.context?.capabilities.includes(capability as NativePluginCapability),
			),
	)?.context;

	if (!context) {
		return 'No running Android plugin holds native.java.fields and native.java.invoke. Spans can only be read on Android.';
	}

	const { java } = context.native;
	const handle = (value: NativeJavaValue): NativeJavaHandleValue | null =>
		value.type === 'handle' ? value : null;
	const number = (value: NativeJavaValue) =>
		'value' in value && typeof value.value === 'number' ? value.value : 0;
	const string = (value: NativeJavaValue) => (value.type === 'string' ? value.value : '');
	const int = (value: number): NativeJavaValue => ({ type: 'int', value });
	const isTrue = (value: NativeJavaValue) => 'value' in value && value.value === true;
	const tracker = handle(
		java.getField(java.getClass('app.unbound.android.ActivityTracker'), 'INSTANCE'),
	);
	const activity = tracker ? handle(java.invoke(tracker, 'currentActivity')) : null;
	const window = activity ? handle(java.invoke(activity, 'getWindow')) : null;
	const decor = window ? handle(java.invoke(window, 'getDecorView')) : null;

	if (!decor) {
		return 'No Android activity is resumed.';
	}

	const group = java.getClass('android.view.ViewGroup');
	const textView = java.getClass('android.widget.TextView');
	const array = java.getClass('java.lang.reflect.Array');
	const escape = (value: string) =>
		value.replace(/[^ -~]/gu, (character) => `<${character.codePointAt(0)!.toString(16)}>`);
	const output: string[] = [];
	const queue = [decor];

	while (queue.length && output.length < maxViews) {
		const view = queue.shift()!;

		if (isTrue(java.invoke(textView, 'isInstance', [view]))) {
			const value = java.invoke(view, 'getText');
			const text = handle(value);
			const content = text ? string(java.invoke(text, 'toString')) : string(value);

			if (content.includes(match)) {
				const lines = [
					`${string(java.className(view))} [${view.value}] ${number(java.invoke(view, 'getWidth'))}px`,
					`  text: ${escape(content)}`,
				];
				const spans = text
					? handle(
							java.invoke(text, 'getSpans', [
								int(0),
								int(content.length),
								java.getClass('java.lang.Object'),
							]),
						)
					: null;
				const count = spans ? number(java.invoke(array, 'getLength', [spans])) : 0;

				for (let index = 0; spans && text && index < count; index++) {
					const span = handle(java.invoke(array, 'get', [spans, int(index)]));

					if (!span) {
						continue;
					}

					lines.push(
						`  ${string(java.className(span)).split('.').pop()} ${number(java.invoke(text, 'getSpanStart', [span]))}-${number(java.invoke(text, 'getSpanEnd', [span]))}`,
					);
				}

				output.push(lines.join('\n'));
			}
		}

		if (!isTrue(java.invoke(group, 'isInstance', [view]))) {
			continue;
		}

		const count = number(java.invoke(view, 'getChildCount'));

		for (let index = 0; index < count; index++) {
			const child = handle(java.invoke(view, 'getChildAt', [int(index)]));

			if (child) {
				queue.push(child);
			}
		}
	}

	return output.length ? output.join('\n\n') : `No text view contains "${match}".`;
}

/**
 * @description Lists Metro modules whose tracked file path or export names match a pattern, with whether they have loaded, so a plugin's lookups can be compared across platforms. Runs on the device through `toDeviceCode`, so it only uses its parameters and the device's globals.
 * @param unbound Unbound's global on the device.
 * @param pattern A case-insensitive regular expression.
 * @param maxResults How many modules to list.
 * @returns One line per module: id, state, path and export keys.
 */
export function searchModules(unbound: UnboundGlobal, pattern: string, maxResults: number): string {
	const expression = new RegExp(pattern, 'i');
	const modules = Reflect.get(globalThis, 'modules') as ModuleRegistry;
	const output: string[] = [];

	for (const [id, record] of modules) {
		if (output.length >= maxResults) {
			break;
		}

		const exports = record?.publicModule?.exports;
		let keys: string[] = [];

		try {
			keys = exports ? Object.keys(exports) : [];
		} catch {
			keys = [];
		}

		if (keys.length > 400) {
			keys = [];
		}

		const path = record?.__filePath ?? '';
		const matched = keys.filter((key) => expression.test(key));

		if (!expression.test(path) && !matched.length) {
			continue;
		}

		output.push(
			`${id} ${record?.isInitialized ? 'loaded' : 'not loaded'} ${path || '(no path)'} ${(matched.length ? matched : keys).slice(0, 8).join(',')}`,
		);
	}

	return output.length
		? output.join('\n')
		: `No module matches /${pattern}/i${unbound.metro ? '' : ' (Metro is unavailable)'}.`;
}

/**
 * @description Records calls to a native method for a while: an Android Java method by class, name and parameter types, or an iOS Objective-C method by class and selector. Runs on the device through `toDeviceCode`, so it only uses its parameters and the device's globals.
 * @param unbound Unbound's global on the device.
 * @param className The class that declares or inherits the method.
 * @param method The Java method name or Objective-C selector.
 * @param parameters The Java parameter type names; ignored on iOS.
 * @param duration How long to record, in milliseconds.
 * @param samples How many calls to describe.
 * @returns How many calls arrived and a description of the first ones.
 */
export async function captureNativeHook(
	unbound: UnboundGlobal,
	className: string,
	method: string,
	parameters: string[],
	duration: number,
	samples: number,
): Promise<string> {
	const manager = Reflect.get(unbound, 'plugins') as PluginManager;
	const holder = (platform: string, capability: NativePluginCapability) =>
		[...manager.entities.values()].find(
			(entity) =>
				entity.started &&
				entity.context?.platform === platform &&
				entity.context.capabilities.includes(capability),
		)?.context;
	const android = holder('android', 'native.java.hooks');
	const ios = holder('ios', 'native.objc.hooks');
	const calls: string[] = [];
	const started = Date.now();
	let count = 0;

	if (android) {
		const { hooks, java } = android.native;

		function describe(value: NativeJavaValue): string {
			if (value.type !== 'handle') {
				return `${value.type}:${JSON.stringify('value' in value ? value.value : null)}`.slice(
					0,
					80,
				);
			}

			const name = java.className(value);

			return `${(name.type === 'string' ? name.value : '?').split('.').pop()}[${value.value}]`;
		}
		const token = hooks.hook(
			className,
			method,
			parameters,
			{ notify: true },
			({ self, args }) => {
				count++;

				if (calls.length < samples) {
					calls.push(
						`+${Date.now() - started}ms ${describe(self)}(${args.map(describe).join(', ')})`,
					);
				}
			},
		);

		await new Promise((resolve) => setTimeout(resolve, duration));
		hooks.remove(token);
	} else if (ios) {
		const { objc } = ios.native;
		const token = objc.hook(className, method, {
			after: ({ self, args }) => {
				count++;

				if (calls.length < samples) {
					calls.push(
						`+${Date.now() - started}ms ${objc.className(self) ?? '?'}(${args.map(String).join(', ')})`,
					);
				}
			},
		});

		await new Promise((resolve) => setTimeout(resolve, duration));
		token.remove();
	} else {
		return 'No running plugin can hook native methods. Enable a plugin with native hooks, such as Shiki Codeblocks, then retry.';
	}

	return `${count} call${count === 1 ? '' : 's'} in ${duration}ms\n${calls.join('\n')}`;
}

/**
 * @description Records calls to a JavaScript function on a Metro module found by its props, such as `generateMessageRowData`, summarising the arguments and result. Runs on the device through `toDeviceCode`, so it only uses its parameters and the device's globals.
 * @param unbound Unbound's global on the device.
 * @param props The props that identify the module; the first is the function to trace.
 * @param duration How long to record, in milliseconds.
 * @param samples How many calls to describe.
 * @returns How many calls arrived and a description of the first ones.
 */
export async function traceFunction(
	unbound: UnboundGlobal,
	props: string[],
	duration: number,
	samples: number,
): Promise<string> {
	const name = props[0]!;
	const module = unbound.metro.findByProps(...props) as TracedModule | undefined;

	if (typeof module?.[name] !== 'function') {
		return `No loaded module exports ${props.join(', ')}.`;
	}

	function summarize(value: Summarized): string {
		if (value === null || typeof value !== 'object') {
			return (JSON.stringify(value) ?? String(value)).slice(0, 60);
		}

		const keys = Object.keys(value);

		return `{${keys.slice(0, 10).join(',')}${keys.length > 10 ? ',…' : ''}}`;
	}
	const patcher = unbound.patcher.createPatcher(`ubd-trace-${Date.now()}`);
	const calls: string[] = [];
	const started = Date.now();
	let count = 0;

	patcher.after(module, name, ({ args, result }) => {
		count++;

		if (calls.length < samples) {
			calls.push(
				`+${Date.now() - started}ms ${name}(${(args as Summarized[]).map(summarize).join(', ')}) -> ${summarize(result as Summarized)}`,
			);
		}
	});

	await new Promise((resolve) => setTimeout(resolve, duration));
	patcher.unpatchAll();

	return `${count} call${count === 1 ? '' : 's'} in ${duration}ms\n${calls.join('\n')}`;
}

/**
 * @description Measures how long a zero-delay timer and, on Android, a main-thread round trip take right now. Runs on the device through `toDeviceCode`, so it only uses its parameters and the device's globals.
 * @param unbound Unbound's global on the device.
 * @param rounds How many samples to take.
 * @returns The timer delay and main-thread round trip of each sample, in milliseconds.
 */
export async function measureTiming(unbound: UnboundGlobal, rounds: number): Promise<string> {
	const manager = Reflect.get(unbound, 'plugins') as PluginManager;
	const context = [...manager.entities.values()].find(
		(entity) =>
			entity.started &&
			entity.context?.platform === 'android' &&
			entity.context.capabilities.includes('native.java.invokeAsync'),
	)?.context;
	const lines: string[] = [];

	for (let round = 0; round < rounds; round++) {
		const timerStart = Date.now();

		await new Promise((resolve) => setTimeout(resolve, 0));

		const timer = Date.now() - timerStart;
		let main = 'n/a';

		if (context) {
			const { java } = context.native;
			const mainStart = Date.now();

			await java.invokeAsync(java.getClass('java.lang.System'), 'nanoTime');
			main = `${Date.now() - mainStart}ms`;
		}

		lines.push(`timer ${timer}ms, main round trip ${main}`);
	}

	return lines.join('\n');
}
