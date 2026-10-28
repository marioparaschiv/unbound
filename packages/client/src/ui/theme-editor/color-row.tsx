import { memo, useMemo } from 'react';

import { applyPick, intToHex, isEdited, parseColor, resetTokens } from '~/lib/theme-draft';
import { ColorBlock, Discord, showColorPicker } from '~/api/metro/components';
import type { TokenWrite } from '~/lib/theme-draft';
import ThemeStore from '~/stores/themes';
import { Icons } from '~/api/assets';
import { format } from '~/api/i18n';

import { readTokenColor, readTokenOpacity } from './token-color';
import { BASIC_CATEGORIES } from './token-registry';
import useStyles from './color-row.style';

type ColorRowProps = {
	label: string;
	tokens: readonly [TokenWrite, ...TokenWrite[]];
	start?: boolean;
	end?: boolean;
};

const MAX_SUGGESTED = 8;

// The theme's own palette, so new picks can reuse colours it already has.
function suggestedColors(current: string | undefined): string[] {
	const colors = new Set(current ? [current] : []);

	for (const category of BASIC_CATEGORIES) {
		for (const row of category.rows) {
			const parsed = parseColor(readTokenColor(row.tokens[0].token));

			if (parsed) {
				colors.add(intToHex(parsed.rgb));
			}
		}
	}

	return [...colors].slice(0, MAX_SUGGESTED);
}

/**
 * @description A table row showing the colour Discord draws for a token; it opens the colour picker
 * and, once edited, offers a reset.
 */
function ColorRow({ label, tokens, start, end }: ColorRowProps) {
	const styles = useStyles();
	const names = useMemo(() => tokens.map(({ token }) => token), [tokens]);
	// Subscribing to the draft re-renders the row when any colour changes, so the swatch stays current.
	const preview = ThemeStore((state) => state.preview);
	const edited = preview ? isEdited(preview, names) : false;
	const value = readTokenColor(tokens[0].token);
	const parsed = parseColor(value);

	function pick() {
		const from = parsed?.rgb;

		showColorPicker({
			color: from ?? 0,
			suggestedColors: suggestedColors(from === undefined ? undefined : intToHex(from)),
			onSelect: (color) =>
				ThemeStore.getState().updatePreview((draft) =>
					applyPick(draft, tokens, from, color, readTokenOpacity),
				),
		});
	}

	function reset() {
		ThemeStore.getState().updatePreview((draft) => resetTokens(draft, names));
	}

	return (
		<Discord.TableRow
			label={label}
			subLabel={value}
			start={start}
			end={end}
			onPress={pick}
			trailing={
				<Discord.Stack direction='horizontal' align='center' spacing={8}>
					{edited ? (
						<Discord.IconButton
							icon={Icons.RetryIcon}
							variant='secondary'
							size='sm'
							accessibilityLabel={format('UNBOUND_RESET')}
							onPress={reset}
						/>
					) : null}
					{parsed ? (
						<ColorBlock color={parsed.rgb} style={styles.swatch} />
					) : (
						<Discord.TableRow.TrailingText
							text={format('UNBOUND_THEME_UNKNOWN_COLOR')}
						/>
					)}
				</Discord.Stack>
			}
		/>
	);
}

export default memo(ColorRow);
