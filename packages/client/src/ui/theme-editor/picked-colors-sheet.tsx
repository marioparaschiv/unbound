import { View } from 'react-native';

import { BottomSheets, GorhomSheet, Discord } from '~/metro/components';
import { messages } from '~/i18n/api';

import type { PickedColor } from './token-matches';

import { sectionPicked, sectionTitle } from './picked-sections';
import { openThemeColor } from './open-theme-editor';
import useStyles from './picked-colors-sheet.style';
import { tokenLabel } from './token-groups';

type PickedColorsSheetProps = {
	colors: PickedColor[];
	onClose: () => void;
};

// `#rrggbbaa` as `#RRGGBB`, plus the opacity when it is not solid.
function describe(color: string): string {
	const hex = color.slice(0, 7).toUpperCase();
	const alpha = Number.parseInt(color.slice(7), 16);

	return alpha === 255 ? hex : `${hex} · ${Math.round((alpha / 255) * 100)}%`;
}

/**
 * @description The tokens that could draw a tapped element's colours, in one section per name prefix. A row shows the
 * token's theme.json name and its colour, and pressing it opens the theme editor on that token.
 */
function PickedColorsSheet({ colors, onClose }: PickedColorsSheetProps) {
	const styles = useStyles();
	const { ActionSheet, BottomSheetTitleHeader } = BottomSheets;
	const { BottomSheetScrollView: ScrollView } = GorhomSheet;
	const { sections, unmatched } = sectionPicked(colors);

	const swatch = (color: string) => <View style={[styles.swatch, { backgroundColor: color }]} />;

	function edit(token: string) {
		onClose();
		void openThemeColor(token);
	}

	return (
		<ActionSheet scrollable>
			<BottomSheetTitleHeader title={messages.UNBOUND_THEME_PICKED} />
			<ScrollView contentContainerStyle={styles.body}>
				{sections.map(({ key, tokens }) => {
					const title = sectionTitle(key);

					return (
						<Discord.TableRowGroup
							key={key}
							title={title ? messages[title] : undefined}
						>
							{tokens.map(({ token, color }) => (
								<Discord.TableRow
									key={token}
									label={tokenLabel(token)}
									subLabel={token}
									trailing={swatch(color)}
									onPress={() => edit(token)}
								/>
							))}
						</Discord.TableRowGroup>
					);
				})}
				{unmatched.length ? (
					<Discord.TableRowGroup title={messages.UNBOUND_THEME_PICK_UNMATCHED}>
						{unmatched.map((color) => (
							<Discord.TableRow
								key={color}
								label={describe(color)}
								trailing={swatch(color)}
							/>
						))}
					</Discord.TableRowGroup>
				) : null}
			</ScrollView>
		</ActionSheet>
	);
}

export default PickedColorsSheet;
