import { memo } from 'react';

import { resetColor, setColor } from '~/themes/draft';
import ThemeEditorStore from '~/themes/editor-state';
import ColorRow from '~/ui/settings-kit/color-row';
import ThemeStore from '~/themes/state';
import { messages } from '~/i18n/api';

import { readTokenColor } from './token-colors';

type ThemeColorRowProps = {
	label: string;
	/** The tokens a pick writes; the first one is shown. */
	tokens: readonly string[];
};

const opacityOf = (token: string) => readTokenColor(token)?.alpha;

/**
 * @description A theme editor colour, drawn as a settings colour row: the colour Discord draws now, Discord's picker on
 * press, and a reset back to Discord's colour once edited.
 */
function ThemeColorRow({ label, tokens }: ThemeColorRowProps) {
	const draft = ThemeStore((state) => state.preview);
	const shown = readTokenColor(tokens[0])?.hex ?? '#000000';
	const edited = Boolean(draft && tokens.some((token) => token in draft.semantic));

	function change(color: string | undefined) {
		if (!draft) return;

		ThemeEditorStore.getState().edit(
			color ? setColor(draft, tokens, color, opacityOf) : resetColor(draft, tokens),
		);
	}

	return (
		<ColorRow
			label={label}
			color={edited ? shown : undefined}
			fallbackColor={shown}
			fallbackLabel={messages.UNBOUND_DEFAULT}
			onChange={change}
		/>
	);
}

export default memo(ThemeColorRow);
