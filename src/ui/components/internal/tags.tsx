import { Constants, ReactNative as RN, StyleSheet, Theme } from '@metro/common';
import type { Source } from '@ui/settings/sources/addons';
import { TintedIcon } from '@ui/components/misc';
import { Strings } from '@api/i18n';
import { Icons } from '@api/assets';

const useStyles = StyleSheet.createStyles({
	description: {
		color: Theme.colors.HEADER_PRIMARY,
		fontSize: 16,
		fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD,
		marginBottom: 0
	},

	tagBackground: {
		backgroundColor: Theme.colors.BG_BASE_SECONDARY,
		borderRadius: 10,
		marginRight: 2
	},

	tag: {
		color: Theme.colors.TEXT_NORMAL,
		fontFamily: Constants.Fonts.PRIMARY_BOLD,
		paddingHorizontal: 10,
		paddingVertical: 4
	}
});

export function Tags({ source }: { source: Source }) {
	const styles = useStyles();

	return <RN.View style={{ marginLeft: 8, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
		<TintedIcon
			source={Icons['ic_tag']}
			size={16}
		/>
		<RN.Text style={[styles.description, { marginHorizontal: 4 }]}>
			{Strings.UNBOUND_TAGS}
		</RN.Text>
		{source.data.tags.map(tag => (
			<RN.View style={styles.tagBackground} key={tag}>
				<RN.Text style={[styles.description, styles.tag]}>
					{tag}
				</RN.Text>
			</RN.View>
		))}
	</RN.View>;
}