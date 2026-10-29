import type { NativeObjectHandle } from '@unbound-app/api/native';
import {
	placeAttachedViews,
	type TextEngine,
} from '@unbound-plugins/shared/native/text-attachments';

import type { CodeBlockPlacement } from '~/fences';
import { readPreferences } from '~/preferences';
import { codeBlockLayout } from '~/layout';
import { isLightTheme } from '~/themes';
import { copyCode } from '~/clipboard';
import { Limits, PLUGIN_NAME } from '~/constants';

import type { Session, Surface, SurfacePart } from './session';
import { detachSurface, isMounted, isOnScreen, surfaceMatchesCell } from './session';
import { createCodeHost, fitCodeContent, paintCodeHost } from './code-host';
import { highlightedCode, textWithCards } from './attributed-text';
import { scheduleRowCorrection, updateRow } from './rows';
import { measureCardWidth } from './cells';

export type MountTarget = {
	label: NativeObjectHandle;
	cell: NativeObjectHandle;
	engine: TextEngine;
	original: NativeObjectHandle;
	placements: CodeBlockPlacement[];
	channelId: string;
	messageId: string;
};

function copyText({ block }: CodeBlockPlacement): string {
	return block.originalCode ?? block.code;
}

function hasSameCards(surface: Surface, placements: CodeBlockPlacement[]): boolean {
	return (
		surface.parts.length === placements.length &&
		surface.parts.every(({ placement }, index) => {
			const next = placements[index];

			return (
				placement.block.code === next.block.code &&
				placement.block.language === next.block.language &&
				placement.start === next.start &&
				placement.end === next.end
			);
		})
	);
}

// Marks the label as written by the renderer, so its own `setAttributedText:` hook ignores the write.
function whileApplying<T>(session: Session, surface: Surface, write: () => T): T {
	session.applying.add(surface.labelKey);

	try {
		return write();
	} finally {
		session.applying.delete(surface.labelKey);
	}
}

function placeCards(session: Session, surface: Surface): void {
	if (surface.engine !== 'textkit' || surface.placing || !isMounted(session, surface)) return;

	surface.placing = true;

	const views = surface.parts.map((part) => ({
		view: part.host.host,
		index: part.attachmentIndex,
	}));

	void placeAttachedViews(session.text, surface.label, views)
		.catch(() => undefined)
		.finally(() => {
			surface.placing = false;

			if (!isMounted(session, surface)) detachSurface(session, surface);
		});
}

function applySurface(session: Session, surface: Surface, relayout: boolean = true): boolean {
	const { ui } = session;

	if (surface.parts.some((part) => part.height <= 0)) return false;

	const text = textWithCards(session, surface);

	if (!text) return false;

	surface.renderedText = ui.string(ui.call(text, 'string')) ?? null;

	return whileApplying(session, surface, () => {
		ui.call(surface.label, 'setAttributedText:', text);
		ui.call(surface.label, 'setNeedsLayout');

		if (relayout) updateRow(session, surface);

		placeCards(session, surface);

		return true;
	});
}

function paintSurface(session: Session, surface: Surface): void {
	const { theme, opacity, iconMode } = surface.preferences;
	const appearance = session.highlighter.appearance(theme);

	surface.lightTheme = appearance.light;

	for (const part of surface.parts) {
		paintCodeHost(session.ui, part.host, appearance, opacity, iconMode);
	}
}

/**
 * @description Recolors a surface for the current theme, then highlights its code once tokens are ready.
 * @param session The renderer session.
 * @param surface The surface.
 */
/**
 * @description Keeps a surface on a label whose text another plugin rewrote around the cards, re-placing the cards where they now sit.
 * @param session The running session.
 * @param surface The label's surface.
 * @param rendered The label's new text.
 * @param indices Where each of the surface's cards now sits in that text.
 * @returns `true` when the text still holds every card and the surface took it over.
 */
export function adoptRenderedText(
	session: Session,
	surface: Surface,
	rendered: string,
	indices: number[],
): boolean {
	if (!indices.length || indices.length !== surface.parts.length) return false;

	surface.renderedText = rendered;
	surface.parts.forEach((part, index) => {
		part.attachmentIndex = indices[index]!;
	});
	placeCards(session, surface);

	return true;
}

export function applyTheme(session: Session, surface: Surface): void {
	const { theme, opacity, hljs } = readPreferences();

	Object.assign(surface.preferences, { theme, opacity, hljs });
	paintSurface(session, surface);

	const pending = surface.parts.map(({ placement }) =>
		session.highlighter.tokenize(placement.block, theme, hljs).catch((error) => {
			console.error(
				`[${PLUGIN_NAME}] Failed to tokenize ${placement.block.language} code block:`,
				error,
			);

			return null;
		}),
	);

	void Promise.all(pending)
		.then((tokensByPart) => {
			if (!isMounted(session, surface) || surface.preferences.theme !== theme) return;

			if (!isOnScreen(session, surface)) return;

			paintSurface(session, surface);

			for (const [index, { host }] of surface.parts.entries()) {
				const tokens = tokensByPart[index];
				const code = tokens
					? highlightedCode(
							session.ui,
							tokens,
							surface.lightTheme,
							surface.preferences.overflow,
						)
					: null;

				if (!code) {
					continue;
				}

				session.ui.call(host.codeLabel, 'setAttributedText:', code);
				fitCodeContent(session.ui, host.codeLabel);
			}
		})
		.catch((error) => {
			console.error(
				`[${PLUGIN_NAME}] Failed to render code blocks after a theme change:`,
				error,
			);
		});
}

/**
 * @description Puts Discord's own text back in a surface's label when the label still shows the cards, then forgets it.
 * @param session The renderer session.
 * @param surface The surface.
 */
export function restoreSurface(session: Session, surface: Surface): void {
	const { ui } = session;

	if (isOnScreen(session, surface)) {
		const current = ui.view(surface.label, 'attributedText');

		if (current && ui.string(ui.call(current, 'string')) === surface.renderedText) {
			whileApplying(session, surface, () =>
				ui.call(surface.label, 'setAttributedText:', surface.original),
			);
			updateRow(session, surface);
		}
	}

	detachSurface(session, surface);
}

function createParts(session: Session, surface: Surface, placements: CodeBlockPlacement[]) {
	const { overflow, opacity, iconMode } = surface.preferences;
	const parts: SurfacePart[] = [];

	for (const placement of placements) {
		const { code, language, sourceLanguage } = placement.block;
		const layout = codeBlockLayout(code, surface.width, overflow);
		const host = createCodeHost(session.ui, {
			code,
			language: sourceLanguage ?? language,
			width: surface.width,
			layout,
			light: surface.lightTheme,
			opacity,
			overflow,
			iconMode,
		});

		if (!host) return null;

		parts.push({ placement, host, height: layout.height, copyHook: null, attachmentIndex: 0 });
	}

	return parts;
}

function hookSurface(session: Session, surface: Surface): void {
	const { objc } = session.ui;

	try {
		surface.cellHook = objc.hook(
			'DCDMessageTableViewCell',
			'layoutSubviews',
			{
				after: () => {
					scheduleRowCorrection(session, surface);
					placeCards(session, surface);
				},
			},
			{ instance: surface.cell },
		);
	} catch {
		// Without it the settle timers still correct the row.
	}

	for (const part of surface.parts) {
		try {
			part.copyHook = objc.hook(
				'UIView',
				'setNeedsDisplay',
				{
					after: () => {
						if (isMounted(session, surface)) void copyCode(copyText(part.placement));
					},
				},
				{ instance: part.host.copyTarget },
			);
		} catch {
			session.ui.call(part.host.copyButton, 'setHidden:', true);
		}
	}
}

/**
 * @description Replaces the code blocks in a message label with code cards, reusing the label's surface when nothing changed.
 * @param session The renderer session.
 * @param target The label, its cell, Discord's text and where each block sits in it.
 */
export function mountSurface(session: Session, target: MountTarget): void {
	const { ui, surfaces } = session;
	const { label, cell, engine, original, placements, channelId, messageId } = target;
	const labelKey = ui.key(label);
	const cellKey = ui.key(cell);
	const previous = surfaces.get(labelKey);
	const width = measureCardWidth(ui, cell, label);
	const preferences = readPreferences();

	if (
		previous &&
		surfaceMatchesCell(previous, channelId, messageId, cellKey) &&
		hasSameCards(previous, placements) &&
		previous.width === width &&
		previous.preferences.overflow === preferences.overflow &&
		previous.preferences.iconMode === preferences.iconMode
	) {
		previous.original = original;
		previous.cell = cell;

		for (const [index, part] of previous.parts.entries()) part.placement = placements[index];

		applySurface(session, previous, false);

		return;
	}

	if (previous) detachSurface(session, previous);

	if (width < 80) return;

	const surface: Surface = {
		label,
		labelKey,
		cell,
		cellKey,
		engine,
		channelId,
		messageId,
		original,
		renderedText: null,
		parts: [],
		preferences,
		lightTheme: isLightTheme(preferences.theme),
		width,
		cellHook: null,
		table: null,
		rowRetries: 0,
		rowCorrectionPending: false,
		rowTimer: null,
		settleTimers: [],
		placing: false,
	};
	const parts = createParts(session, surface, placements);

	if (!parts) return;

	surface.parts = parts;
	surfaces.set(labelKey, surface);
	hookSurface(session, surface);

	if (surfaces.size > Limits.surfaces) {
		const [oldest] = surfaces.values();

		if (oldest !== surface) detachSurface(session, oldest);
	}

	if (!applySurface(session, surface)) {
		detachSurface(session, surface);

		return;
	}

	for (const delay of [160, 700, 1800]) {
		surface.settleTimers.push(
			setTimeout(() => scheduleRowCorrection(session, surface, 0), delay),
		);
	}

	applyTheme(session, surface);
}

/**
 * @description Builds a surface again from scratch, for settings that change card geometry.
 * @param session The renderer session.
 * @param surface The surface to replace.
 */
export function rebuildSurface(session: Session, surface: Surface): void {
	detachSurface(session, surface);
	mountSurface(session, {
		label: surface.label,
		cell: surface.cell,
		engine: surface.engine,
		original: surface.original,
		placements: surface.parts.map((part) => part.placement),
		channelId: surface.channelId,
		messageId: surface.messageId,
	});
}

export default { applyTheme, restoreSurface, mountSurface, rebuildSurface };
