import type {
	NativeFabricBridge,
	NativeFabricSurface,
	NativeJavaHandle,
	NativeJavaReference,
	NativeJavaValue,
} from '@unbound-app/api/native';
import {
	brand,
	createFakeJava,
	settled,
	withMissingMembers,
	type JavaPlain,
} from '@unbound-app/api/testing/fakes';

export const DRAWEE_TEXT_VIEW = 'com.facebook.drawee.span.SimpleDraweeSpanTextView';
export const MESSAGE_CONTENT_VIEW = 'com.discord.chat.presentation.message.view.MessageContentView';

const BUILDER = 'com.facebook.drawee.span.DraweeSpanStringBuilder';
const TEXT_REWRITES = 'app.unbound.android.TextRewrites';
const PADDING = 10;
const DENSITY = 2;

/** A call the plugin made on the loader's `TextRewrites`, with its plain arguments. */
export type RewriteCall = { method: string; args: JavaPlain[] };

class FakeSurface {
	readonly host: string;

	constructor(host: string) {
		this.host = host;
	}
}

function fieldsOf(self: NativeJavaHandle): Map<string, JavaPlain> {
	return Reflect.get(self, 'fields');
}

/**
 * @description Fakes the Android side of Discord's message text: drawee text views, message content views,
 * the loader's `TextRewrites` and a Fabric bridge that records mounts.
 * @param options Whether the loader has native text rewrites.
 * @returns The bridges and what drives and reads them.
 */
export function fakeMessageText({ rewrites = true } = {}) {
	const fake = createFakeJava();
	const calls: RewriteCall[] = [];
	const mounted: string[] = [];
	const unmounted: string[] = [];
	const notContent = new Set<string>();
	const record =
		(method: string, result: JavaPlain = null) =>
		(_self: NativeJavaHandle, ...args: JavaPlain[]) => {
			calls.push({ method, args });

			return result;
		};

	fake.registerClass(BUILDER);
	fake.registerClass('android.text.SpannableString', {
		methods: {
			toString: (self: NativeJavaHandle) => fieldsOf(self).get('string'),
			length: (self: NativeJavaHandle) => {
				const string = fieldsOf(self).get('string');

				return typeof string === 'string' ? string.length : 0;
			},
		},
	});
	fake.registerClass('android.util.DisplayMetrics', { fields: { density: DENSITY } });
	fake.registerClass('android.content.res.Resources', {
		methods: { getDisplayMetrics: () => fake.create('android.util.DisplayMetrics') },
	});
	fake.registerClass(DRAWEE_TEXT_VIEW, {
		methods: {
			setDraweeSpanStringBuilder: (self, text) => {
				fieldsOf(self).set('text', text);

				return null;
			},
			getText: (self) => fieldsOf(self).get('text'),
			getResources: () => fake.create('android.content.res.Resources'),
			getWidth: (self) => fieldsOf(self).get('width'),
			getTotalPaddingLeft: () => PADDING,
			getTotalPaddingRight: () => PADDING,
			isAttachedToWindow: () => true,
			getContext: () => null,
			onSizeChanged: () => null,
		},
		fields: { text: null, width: 0 },
		signatures: { setDraweeSpanStringBuilder: { parameters: [BUILDER] } },
	});
	fake.registerClass(MESSAGE_CONTENT_VIEW, {
		superclass: DRAWEE_TEXT_VIEW,
		staticMethods: {
			isInstance: (_self, view) => !notContent.has(String(Reflect.get(view as object, 'id'))),
		},
	});
	fake.registerClass('android.widget.FrameLayout', {
		methods: { getChildAt: () => null },
	});
	// No activity has resumed, so the startup scan finds nothing on screen.
	fake.registerClass('app.unbound.android.ActivityTracker', { staticFields: { INSTANCE: null } });

	if (rewrites) {
		const spec = {
			methods: {
				watch: record('watch'),
				put: record('put', true),
				remove: record('remove'),
				addHost: record('addHost'),
				updateAnchor: record('updateAnchor'),
				removeGroup: record('removeGroup'),
				reapply: record('reapply'),
				refresh: record('refresh'),
				refreshAll: record('refreshAll'),
			},
			staticFields: { INSTANCE: null as JavaPlain },
		};

		fake.registerClass(TEXT_REWRITES, spec);
		spec.staticFields.INSTANCE = fake.create(TEXT_REWRITES);
	}

	const java = fake.bridge;
	const fabric = withMissingMembers<NativeFabricBridge>('fabric', {
		mountAsync(host) {
			const key = String(Reflect.get(host, 'id'));

			mounted.push(key);

			return settled(() => brand<NativeFabricSurface>(new FakeSurface(key)));
		},
		unmountAsync(surface) {
			unmounted.push(String(Reflect.get(surface, 'host')));

			return settled(() => undefined);
		},
	});

	return {
		native: { java, hooks: fake.hooks, fabric },
		calls,
		mounted,
		unmounted,
		/** The calls made on `TextRewrites` with one method name, in order. */
		callsTo: (method: string) => calls.filter((call) => call.method === method),
		/** A message content view `width` pixels wide, before padding. */
		contentView(width = 500): NativeJavaReference {
			return fake.create(MESSAGE_CONTENT_VIEW, { width }) as NativeJavaReference;
		},
		/** A drawee text view outside the message content. */
		textView(width = 500): NativeJavaReference {
			const view = fake.create(DRAWEE_TEXT_VIEW, { width }) as NativeJavaReference;

			notContent.add(viewKey(view));

			return view;
		},
		/** Sets a text the way Discord does, through the drawee builder setter. */
		setText(view: NativeJavaReference, string: string) {
			java.invoke(view, 'setDraweeSpanStringBuilder', [
				fake.create('android.text.SpannableString', { string }),
			]);
		},
		resize(view: NativeJavaReference, width: number) {
			java.setField(view, 'width', { type: 'int', value: width });
			java.invoke(
				view,
				'onSizeChanged',
				[width, 1, 0, 0].map((value) => ({ type: 'int', value })),
			);
		},
	};
}

/**
 * @description Reads the handle id of a fake view, as the surfaces key it.
 * @param view The view.
 * @returns The id.
 */
export function viewKey(view: NativeJavaReference): string {
	return String((view as NativeJavaValue & { value: string }).value);
}

/**
 * @description Waits for the timers and awaits a text set starts to run out.
 * @returns A promise that resolves once they have.
 */
export function settle(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 10));
}
