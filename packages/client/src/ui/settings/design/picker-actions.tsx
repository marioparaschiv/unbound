import { StyleSheet, View } from 'react-native';
import { useState } from 'react';

import AddonOverflow from '~/ui/addons/addon-overflow';
import InstallMenu from '~/ui/addons/install-menu';
import { SafeArea } from '~/metro/components';
import type { Addon } from '~/addons/addon';

import type { PickerKind } from './picker-report';

import useStyles from './picker-actions.style';
import PopIn from './pop-in';

type PickerActionsProps = {
	kind: PickerKind;
	/** The previewed addon the options menu acts on. */
	addon: Addon | undefined;
};

/**
 * @description The picker page's actions in its bottom corners, swiping with the page: the previewed addon's options menu
 * on the left, and a menu for installing another of its kind on the right. Both pop in, and the options menu pops out
 * when no addon is previewed.
 */
function PickerActions({ kind, addon }: PickerActionsProps) {
	const styles = useStyles();
	// The menu keeps showing the last addon while it pops out.
	const [lastAddon, setLastAddon] = useState(addon);

	if (addon && addon !== lastAddon) {
		setLastAddon(addon);
	}

	const shownAddon = addon ?? lastAddon;

	return (
		<SafeArea.SafeAreaPaddingView
			bottom
			style={StyleSheet.absoluteFill}
			pointerEvents='box-none'
		>
			<View style={styles.spacer} pointerEvents='box-none' />
			<View pointerEvents='box-none' style={styles.bar}>
				<PopIn visible={Boolean(addon)}>
					{shownAddon ? (
						<AddonOverflow addon={shownAddon} kind={kind} variant='floating' />
					) : null}
				</PopIn>
				<PopIn visible>
					<InstallMenu kind={kind} />
				</PopIn>
			</View>
		</SafeArea.SafeAreaPaddingView>
	);
}

export default PickerActions;
