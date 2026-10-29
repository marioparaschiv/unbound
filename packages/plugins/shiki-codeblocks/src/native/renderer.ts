import { isCancellation } from '@unbound-plugins/shared/native/cancellation';
import type {
	NativeHookContext,
	NativeHookHandlers,
	NativeHookToken,
	NativeObjCBridge,
	NativeObjectHandle,
} from '@unbound-app/api/native';
import findVisibleCells from '@unbound-plugins/shared/native/visible-cells';
import {
	attributeRun,
	CODE_BLOCK_ATTRIBUTE,
	MESSAGE_TEXT_VIEW_CLASSES,
	ownedAttachments,
	textAttachmentBridge,
	textEngine,
} from '@unbound-plugins/shared/native/text-attachments';

import { CARD_SETTINGS, Limits, PLUGIN_ID, PLUGIN_NAME } from '~/constants';
import { locateCodeBlocks, parseFencedCodeBlocks, type CodeBlockPlacement } from '~/fences';
import { getLanguageMetadata, loadLanguageCatalog } from '~/catalog';
import { MessageStore, settings } from '~/modules';
import { createFlatRecovery } from '~/flat-recovery';
import { onAppForeground } from '~/foreground';
import { createHighlighter } from '~/highlighter';
import { readPreferences } from '~/preferences';
import { changesCardLayout } from '~/preferences';

import {
	adoptRenderedText,
	applyTheme,
	mountSurface,
	rebuildSurface,
	restoreSurface,
} from './surfaces';
import { detachSurface, surfaceMatchesCell, visibleChannelId } from './session';
import { cellForLabel, messageIdentity } from './cells';
import type { Session, Surface } from './session';
import { createNativeUI } from './ui';

type HookSpec = [className: string, selector: string, handlers: NativeHookHandlers];

function forgetLabel(session: Session, labelKey: string): void {
	const surface = session.surfaces.get(labelKey);

	if (surface) detachSurface(session, surface);
}

function expandToCodeRuns(
	session: Session,
	original: NativeObjectHandle,
	placements: CodeBlockPlacement[],
): CodeBlockPlacement[] {
	return placements.map((placement) => ({
		...placement,
		...attributeRun(session.text, original, placement, CODE_BLOCK_ATTRIBUTE),
	}));
}

function textViewClasses(objc: NativeObjCBridge): string[] {
	return MESSAGE_TEXT_VIEW_CLASSES.filter((name) => objc.getClass(name));
}

function renderLabel(session: Session, label: NativeObjectHandle, original: NativeObjectHandle) {
	const { ui, surfaces } = session;
	const labelKey = ui.key(label);

	if (session.applying.has(labelKey)) return;

	const rendered = ui.string(ui.call(original, 'string'));

	if (rendered === undefined) return;

	const cell = cellForLabel(ui, label);

	if (!cell) {
		forgetLabel(session, labelKey);

		return;
	}

	const identity = messageIdentity(ui, cell);
	const channelId = visibleChannelId();

	if (!identity || !channelId) return;

	const { messageId, sourceChannelId } = identity;
	const previous = surfaces.get(labelKey);

	if (previous && !surfaceMatchesCell(previous, channelId, messageId, ui.key(cell))) {
		detachSurface(session, previous);
	}

	// Our own cards coming back through `setAttributedText:` after a reuse.
	if (rendered === surfaces.get(labelKey)?.renderedText) return;

	const current = surfaces.get(labelKey);

	if (
		current &&
		adoptRenderedText(
			session,
			current,
			rendered,
			ownedAttachments(session.text, original, rendered, PLUGIN_ID),
		)
	) {
		return;
	}

	const content = MessageStore.getMessage(sourceChannelId ?? channelId, messageId)?.content;

	if (typeof content !== 'string') return;

	const engine = textEngine(session.text, label);
	const located = locateCodeBlocks(parseFencedCodeBlocks(content), rendered);
	const placements =
		engine === 'textkit' ? expandToCodeRuns(session, original, located) : located;

	if (
		!placements.length ||
		placements.some(({ block }) => block.code.length > Limits.codeLength)
	) {
		forgetLabel(session, labelKey);

		return;
	}

	mountSurface(session, { label, cell, engine, original, placements, channelId, messageId });
}

// Labels already on screen at start never call `setAttributedText:` again, so find them once.
async function renderVisibleLabels(session: Session): Promise<void> {
	const { objc } = session.ui;
	const channelId = visibleChannelId();

	if (!channelId) return;

	function isStale() {
		return session.signal.aborted || channelId !== visibleChannelId();
	}

	const labels: NativeObjectHandle[] = [];

	for (const className of textViewClasses(objc)) {
		labels.push(...(await findVisibleCells(objc, className, session.signal)));

		if (isStale()) return;
	}

	for (let index = 0; index < labels.length; index += 64) {
		const chunk = labels.slice(index, index + 64);
		const texts = await objc.batch(
			chunk.map((label) => ({ target: label, selector: 'attributedText', args: [] })),
		);

		if (isStale()) return;

		for (const [offset, label] of chunk.entries()) {
			const text = texts[offset] as NativeObjectHandle | null;

			if (text) renderLabel(session, label, text);
		}
	}
}

function labelHooks(session: Session, timers: Set<ReturnType<typeof setTimeout>>): HookSpec[] {
	const { objc } = session.ui;

	function onMove(label: NativeObjectHandle) {
		const channelId = visibleChannelId();

		if (session.signal.aborted || !channelId) return;

		void objc
			.batch([
				{ target: label, selector: 'window', args: [] },
				{ target: label, selector: 'attributedText', args: [] },
			])
			.then(([window, text]) => {
				if (session.signal.aborted || channelId !== visibleChannelId()) return;

				if (window && text) renderLabel(session, label, text as NativeObjectHandle);
			})
			.catch(() => {
				// The label was deallocated before the batch ran.
			});
	}

	function onSetText({ self, args }: NativeHookContext) {
		const text = args[0] as NativeObjectHandle | undefined;

		if (text) renderLabel(session, self, text);
	}

	function onMoveToWindow({ self }: NativeHookContext) {
		const timer = setTimeout(() => {
			timers.delete(timer);
			onMove(self);
		}, 16);

		timers.add(timer);
	}

	function onReuse({ self }: NativeHookContext) {
		const cellKey = session.ui.key(self);

		for (const surface of [...session.surfaces.values()]) {
			if (surface.cellKey === cellKey) detachSurface(session, surface);
		}
	}

	const classes = textViewClasses(objc);

	return [
		...classes.map((name): HookSpec => [name, 'setAttributedText:', { after: onSetText }]),
		...classes.map((name): HookSpec => [name, 'didMoveToWindow', { after: onMoveToWindow }]),
		['DCDMessageTableViewCell', 'prepareForReuse', { after: onReuse }],
	];
}

function subscribeSettings(session: Session): () => void {
	return settings.addListener(
		({ key }) => CARD_SETTINGS.includes(key ?? ''),
		({ key }) => {
			const rebuild = changesCardLayout(key ?? '');

			for (const surface of [...session.surfaces.values()]) {
				if (rebuild) {
					rebuildSurface(session, surface);
				} else {
					applyTheme(session, surface);
				}
			}
		},
	);
}

function labelLanguages(session: Session): void {
	loadLanguageCatalog()
		.then(() => {
			for (const { parts } of session.surfaces.values()) {
				for (const { placement, host } of parts) {
					const name = getLanguageMetadata(placement.block.language)?.displayName;

					if (name) session.ui.call(host.languageLabel, 'setText:', name);
				}
			}
		})
		.catch((error) => {
			if (!isCancellation(error)) {
				console.error(`[${PLUGIN_NAME}] Failed to load the language catalog:`, error);
			}
		});
}

/**
 * @description Replaces code blocks in Discord's native message labels with highlighted code cards.
 * @param objc The plugin's scoped Objective-C bridge.
 * @returns A function that removes every hook, timer and card and restores Discord's text.
 * @throws When the label's `setAttributedText:` cannot be hooked.
 */
export function startRenderer(objc: NativeObjCBridge): () => void {
	const controller = new AbortController();
	const session: Session = {
		ui: createNativeUI(objc),
		text: textAttachmentBridge(objc),
		highlighter: createHighlighter(),
		recovery: createFlatRecovery<Surface>((surface) => {
			if (session.surfaces.get(surface.labelKey) === surface) {
				applyTheme(session, surface);
			} else {
				session.recovery.mark(surface, false);
			}
		}, onAppForeground),
		surfaces: new Map(),
		applying: new Set(),
		signal: controller.signal,
	};
	const timers = new Set<ReturnType<typeof setTimeout>>();

	session.highlighter.warm(readPreferences().theme);

	const [required, ...optional] = labelHooks(session, timers);
	const hooks: NativeHookToken[] = [objc.hook(...required)];

	for (const spec of optional) {
		try {
			hooks.push(objc.hook(...spec));
		} catch {
			// Cards still render through `setAttributedText:`; they only miss moves and cell reuse.
		}
	}

	const unsubscribe = subscribeSettings(session);

	labelLanguages(session);
	timers.add(setTimeout(() => void renderVisibleLabels(session).catch(() => undefined), 300));

	return () => {
		controller.abort();
		session.recovery.dispose();

		for (const hook of hooks) hook.remove();

		for (const timer of timers) clearTimeout(timer);

		unsubscribe();

		for (const surface of [...session.surfaces.values()]) restoreSurface(session, surface);
	};
}

export default { startRenderer };
