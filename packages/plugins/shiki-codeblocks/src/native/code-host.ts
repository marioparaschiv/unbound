import type { NativeObjectHandle } from '@unbound-app/api/native';
import { readRect } from '@unbound-plugins/shared/native/rect';

import type { IconMode, LineOverflow } from '~/preferences';
import type { ThemeAppearance } from '~/highlighter';
import type { CodeBlockLayout } from '~/layout';
import { languageLabel } from '~/languages';
import { codeScrollHeight } from '~/layout';
import { Palette } from '~/constants';

import type { NativeUI } from './ui';

/** The views of one code card: a header with icon, language and Copy, above the code. */
export type CodeHost = {
	host: NativeObjectHandle;
	header: NativeObjectHandle;
	iconView: NativeObjectHandle | null;
	languageLabel: NativeObjectHandle;
	copyButton: NativeObjectHandle;
	/** A hidden view whose `setNeedsDisplay` the Copy button triggers, so a hook can observe taps. */
	copyTarget: NativeObjectHandle;
	codeLabel: NativeObjectHandle;
};

export type CodeHostOptions = {
	code: string;
	language: string;
	width: number;
	layout: CodeBlockLayout;
	light: boolean;
	opacity: number;
	overflow: LineOverflow;
	iconMode: IconMode;
};

/**
 * @description Builds a code card's views, colored from the theme guess until the theme loads.
 * @param ui The native helpers.
 * @param options The code, its language and the card's size and style.
 * @returns The card's views, or `null` when UIKit refused to build them.
 */
export function createCodeHost(ui: NativeUI, options: CodeHostOptions): CodeHost | null {
	const { code, language, width, layout, light, opacity, overflow, iconMode } = options;
	const { call, objc } = ui;
	const palette = Palette[light ? 'light' : 'dark'];

	try {
		const host = objc.alloc('UIView');

		call(host, 'setFrame:', ui.rect(0, 0, width, layout.height));
		call(host, 'setBackgroundColor:', ui.color(palette.background, opacity / 100));

		const layer = ui.view(host, 'layer');

		if (layer) {
			call(layer, 'setCornerRadius:', 8);
			call(layer, 'setMasksToBounds:', true);
		}

		const header = objc.alloc('UIView');

		call(header, 'setFrame:', ui.rect(0, 0, width, 34));
		call(header, 'setBackgroundColor:', ui.color(palette.header));
		call(host, 'addSubview:', header);

		const icon = iconMode === 'disabled' ? null : ui.devicon(language, iconMode);
		const iconView = icon ? objc.alloc('UIImageView') : null;

		if (iconView) {
			call(iconView, 'setFrame:', ui.rect(12, 9, 16, 16));
			call(iconView, 'setImage:', icon);
			call(iconView, 'setContentMode:', 1);

			if (iconMode === 'greyscale') {
				call(iconView, 'setTintColor:', ui.color(palette.foreground));
			}

			call(header, 'addSubview:', iconView);
		}

		const languageX = iconView ? 34 : 12;
		const title = objc.alloc('UILabel');

		call(title, 'setFrame:', ui.rect(languageX, 0, width - languageX - 76, 34));
		call(title, 'setText:', languageLabel(language));
		call(title, 'setTextColor:', ui.color(palette.foreground));
		call(title, 'setFont:', ui.font(11, 0.3, false));
		call(header, 'addSubview:', title);

		const copyButton = objc.alloc('UIButton');
		const copyTarget = objc.alloc('UIView');
		const copyTitle = ui.view(copyButton, 'titleLabel');

		call(copyButton, 'setFrame:', ui.rect(width - 70, 0, 58, 34));
		call(copyButton, 'setTitle:forState:', 'Copy', 0);
		call(copyButton, 'setTitleColor:forState:', ui.color(palette.foreground), 0);

		if (copyTitle) call(copyTitle, 'setFont:', ui.font(11, 0.2, false));

		// 64 is UIControlEventTouchUpInside.
		call(copyButton, 'addTarget:action:forControlEvents:', copyTarget, 'setNeedsDisplay', 64);
		call(header, 'addSubview:', copyButton);

		const codeLabel = objc.alloc('UILabel');
		const viewportWidth = width - 24;
		const viewportHeight = layout.height - 50;
		const scrolls = overflow === 'scroll' || layout.contentHeight > viewportHeight;
		const codeWidth = overflow === 'scroll' ? layout.contentWidth : viewportWidth;

		call(
			codeLabel,
			'setFrame:',
			scrolls
				? ui.rect(0, 0, codeWidth, layout.contentHeight)
				: ui.rect(12, 42, codeWidth, layout.contentHeight),
		);
		call(codeLabel, 'setNumberOfLines:', 0);
		// 2 is NSLineBreakByClipping, 0 is NSLineBreakByWordWrapping.
		call(codeLabel, 'setLineBreakMode:', overflow === 'scroll' ? 2 : 0);
		call(codeLabel, 'setTextColor:', ui.color(palette.foreground));
		call(codeLabel, 'setFont:', ui.font(12, 0, true));
		call(codeLabel, 'setText:', code);

		if (scrolls) {
			const scroll = objc.alloc('UIScrollView');

			call(scroll, 'setFrame:', ui.rect(12, 42, viewportWidth, viewportHeight));
			call(scroll, 'setContentSize:', ui.size(codeWidth, layout.contentHeight));
			call(scroll, 'setShowsHorizontalScrollIndicator:', overflow === 'scroll');
			call(scroll, 'setShowsVerticalScrollIndicator:', layout.contentHeight > viewportHeight);
			call(scroll, 'addSubview:', codeLabel);
			call(host, 'addSubview:', scroll);
			fitCodeContent(ui, codeLabel);
		} else {
			call(host, 'addSubview:', codeLabel);
		}

		return { host, header, iconView, languageLabel: title, copyButton, copyTarget, codeLabel };
	} catch {
		return null;
	}
}

/**
 * @description Resizes a scrolling code label and its scroll view's content to the text UIKit measured.
 * @param ui The native helpers.
 * @param codeLabel The code label; nothing happens unless it sits in a scroll view.
 */
export function fitCodeContent(ui: NativeUI, codeLabel: NativeObjectHandle): void {
	const scroll = ui.view(codeLabel, 'superview');

	if (!scroll || !ui.objc.respondsTo(scroll, 'setContentSize:')) return;

	const frame = ui.frameOf(codeLabel);
	const fitted = ui.call(codeLabel, 'sizeThatFits:', ui.size(frame.width, 10000));
	const height = codeScrollHeight(
		fitted ? readRect(fitted).height : frame.height,
		ui.frameOf(scroll).height,
	);

	ui.call(codeLabel, 'setFrame:', ui.rect(0, 0, frame.width, height));
	ui.call(scroll, 'setContentSize:', ui.size(frame.width, height));
}

/**
 * @description Recolors a code card for a theme.
 * @param ui The native helpers.
 * @param host The card's views.
 * @param appearance The theme's colors.
 * @param opacity The background opacity, 0 to 100.
 * @param iconMode The icon mode; only a greyscale icon takes the foreground tint.
 */
export function paintCodeHost(
	ui: NativeUI,
	host: CodeHost,
	appearance: ThemeAppearance,
	opacity: number,
	iconMode: IconMode,
): void {
	const background = ui.color(appearance.background, opacity / 100);
	const foreground = ui.color(appearance.foreground);

	ui.call(host.host, 'setBackgroundColor:', background);
	ui.call(host.header, 'setBackgroundColor:', background);
	ui.call(host.languageLabel, 'setTextColor:', foreground);
	ui.call(host.codeLabel, 'setTextColor:', foreground);
	ui.call(host.copyButton, 'setTitleColor:forState:', foreground, 0);

	if (iconMode === 'greyscale' && host.iconView) {
		ui.call(host.iconView, 'setTintColor:', foreground);
	}
}

export default { createCodeHost, fitCodeContent, paintCodeHost };
