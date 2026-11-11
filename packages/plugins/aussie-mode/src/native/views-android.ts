import { Keyboard } from 'react-native';
import type {
	NativeJavaBridge,
	NativeJavaReference,
	NativePluginBridge,
	NativeRuntimeEventToken,
} from '@unbound-app/api/native';
import {
	javaFlag,
	javaFloat,
	javaInt,
	javaNumber,
	javaReference,
	sameJavaReference,
} from '@unbound-plugins/shared/native/android/java-values';
import { currentDecorView } from '@unbound-plugins/shared/native/android/views';

import { keyboardRotationOffset } from '~/lib/keyboard-layout-android';

const CHAT_INPUT = 'com.discord.chat.input.views.DCDChatInput';
const CHAT_INPUT_SEARCH = { maxDepth: 128, maxVisited: 8192, maxResults: 16, attachedOnly: true };
const KEYBOARD_LAYOUT_SETTLE_MS = 200;

type RotationSession = {
	java: NativeJavaBridge;
	content: NativeJavaReference;
	bounds: NativeJavaReference;
	baselineTop?: number;
	baselinePromise?: Promise<number | undefined>;
	originalTranslationY: number;
	offsetY: number;
	generation: number;
	subscriptions: ReturnType<typeof Keyboard.addListener>[];
	runtimeToken?: NativeRuntimeEventToken;
};

let activeSession: RotationSession | undefined;

async function composerTop(
	java: NativeJavaBridge,
	root: NativeJavaReference,
	bounds: NativeJavaReference,
): Promise<number | undefined> {
	const [value] = await java.findViews(root, CHAT_INPUT, CHAT_INPUT_SEARCH);
	const input = javaReference(value);

	if (!input) return;

	const visible = javaFlag(await java.invokeAsync(input, 'getGlobalVisibleRect', [bounds]));

	if (!visible) return;

	const top = javaNumber(java.getField(bounds, 'top'));

	return top !== undefined && Number.isFinite(top) ? top : undefined;
}

function captureBaseline(session: RotationSession): Promise<number | undefined> {
	if (session.baselineTop !== undefined) return Promise.resolve(session.baselineTop);
	if (session.baselinePromise) return session.baselinePromise;

	const generation = session.generation;
	let pending: Promise<number | undefined>;
	pending = composerTop(session.java, session.content, session.bounds)
		.then((top) => {
			if (
				activeSession === session &&
				session.generation === generation &&
				top !== undefined
			) {
				session.baselineTop = top;
			}

			return top;
		})
		.finally(() => {
			if (session.baselinePromise === pending) session.baselinePromise = undefined;
		});
	session.baselinePromise = pending;

	return pending;
}

function applyTranslation(session: RotationSession, offsetY: number): Promise<unknown> {
	session.offsetY = offsetY;

	return session.java.invokeAsync(session.content, 'setTranslationY', [
		javaFloat(session.originalTranslationY + offsetY),
	]);
}

function reportKeyboardFailure(operation: string, error: unknown): void {
	logger.error(`Failed to ${operation}:`, error);
}

function stopKeyboardTracking(session: RotationSession): void {
	for (const subscription of session.subscriptions) subscription.remove();
	session.runtimeToken?.remove();
	if (activeSession === session) activeSession = undefined;
}

function startKeyboardTracking(
	native: NativePluginBridge,
	java: NativeJavaBridge,
	content: NativeJavaReference,
	originalTranslationY: number,
): RotationSession {
	const session: RotationSession = {
		java,
		content,
		bounds: java.construct('android.graphics.Rect'),
		originalTranslationY,
		offsetY: 0,
		generation: 0,
		subscriptions: [],
	};
	activeSession = session;
	session.runtimeToken = native.runtime.subscribe('channel.changed', () => {
		if (session.baselineTop === undefined) {
			void captureBaseline(session).catch((error: unknown) => {
				reportKeyboardFailure('capture the chat input after a channel change', error);
			});
		}
	});
	session.subscriptions = [
		Keyboard.addListener('keyboardDidShow', async () => {
			const generation = ++session.generation;

			try {
				await new Promise<void>((resolve) =>
					setTimeout(resolve, KEYBOARD_LAYOUT_SETTLE_MS),
				);
				if (activeSession !== session || session.generation !== generation) return;

				const top = await composerTop(java, content, session.bounds);
				if (activeSession !== session || session.generation !== generation) return;

				const offsetY = keyboardRotationOffset(session.baselineTop, top);

				if (offsetY !== undefined) await applyTranslation(session, offsetY);
			} catch (error) {
				reportKeyboardFailure('keep the rotated chat input above the keyboard', error);
			}
		}),
		Keyboard.addListener('keyboardDidHide', async () => {
			++session.generation;

			try {
				await applyTranslation(session, 0);
			} catch (error) {
				reportKeyboardFailure(
					'restore the rotated chat input after the keyboard closes',
					error,
				);
			}
		}),
	];

	return session;
}

async function contentView(java: NativeJavaBridge): Promise<NativeJavaReference | null> {
	const decorView = currentDecorView(java);

	return decorView
		? javaReference(await java.invokeAsync(decorView, 'getChildAt', [javaInt(0)]))
		: null;
}

async function rotateSession(
	session: RotationSession,
	degrees: number,
	offsetY = session.offsetY,
): Promise<void> {
	await session.java.invokeAsync(session.content, 'setRotation', [javaFloat(degrees)]);
	await applyTranslation(session, offsetY);
}

/**
 * @description Sets the rotation of the content inside the decor view of Discord's current activity.
 * The decor view's child is rotated rather than the decor view itself, because Android maps a touch
 * through a view's rotation only in its parent, and the decor view has none. So scrolling and taps
 * follow the finger on the rotated screen.
 * @param native The plugin's native bridge.
 * @param degrees The rotation, 180 for upside down and 0 to restore it.
 * @returns Whether the content view was found and rotated.
 */
export async function rotateScreen(native: NativePluginBridge, degrees: number): Promise<boolean> {
	const { java } = native;

	if (degrees === 0 && activeSession) {
		const session = activeSession;
		stopKeyboardTracking(session);
		await rotateSession(session, degrees, 0);
		return true;
	}

	const content = await contentView(java);

	if (!content) return false;

	if (activeSession && sameJavaReference(activeSession.content, content)) {
		await rotateSession(activeSession, degrees);
		if (degrees !== 0 && activeSession.baselineTop === undefined) {
			await captureBaseline(activeSession);
		}
		return true;
	}

	if (activeSession) {
		const previous = activeSession;
		stopKeyboardTracking(previous);
		await rotateSession(previous, 0, 0);
	}

	if (degrees === 0) {
		await java.invokeAsync(content, 'setRotation', [javaFloat(0)]);
		return true;
	}

	const originalTranslationY =
		javaNumber(await java.invokeAsync(content, 'getTranslationY', [])) ?? 0;
	const session = startKeyboardTracking(native, java, content, originalTranslationY);
	await rotateSession(session, degrees, 0);
	await captureBaseline(session);

	return true;
}
