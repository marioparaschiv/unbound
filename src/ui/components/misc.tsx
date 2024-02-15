import { Theme, StyleSheet, ReactNative as RN, Constants } from '@metro/common';
import type { IconProps, SectionProps } from '@typings/ui/components/forms';
import { internalGetLazily } from '@metro/registry';
import { Redesign } from '@metro/components';

export const useFormStyles = StyleSheet.createStyles(({ size = 24 } = { size: 24 }) => ({
	endStyle: {
		backgroundColor: Theme.colors.CARD_PRIMARY_BG ?? Theme.colors.BACKGROUND_PRIMARY,
		borderBottomLeftRadius: 16,
		borderBottomRightRadius: 16
	},

	formText: {
		fontFamily: Constants.Fonts.PRIMARY_NORMAL,
		color: Theme.colors.TEXT_NORMAL,
		fontSize: 12
	},

	formHint: {
		fontFamily: Constants.Fonts.PRIMARY_NORMAL,
		color: Theme.colors.HEADER_PRIMARY,
		fontSize: 12,
		marginTop: 4,
		marginHorizontal: 16
	},

	iconTint: {
		width: size,
		height: size,
		tintColor: Theme.colors.INTERACTIVE_NORMAL
	}
}));

export const TintedIcon = ({ source, size, style }: IconProps) => {
	const styles = useFormStyles({ size });

	return <RN.Image source={source} style={[styles.iconTint, style]} />;
};

export const Switch = internalGetLazily('FormSwitch', x => !('FormTitle' in x));
export const Checkbox = internalGetLazily('FormCheckbox', x => !('FormTitle' in x));
export const Section = ({ children, style, margin = true, ...props }: SectionProps) => {
	return (
		<RN.ScrollView scrollEnabled={false}>
			<RN.View
				style={[
					style,
					{
						marginHorizontal: 16,
						...(margin ? { marginTop: 16 } : {})
					},
				]}
			>
				<Redesign.TableRowGroup {...props}>
					{children}
				</Redesign.TableRowGroup>
			</RN.View>
		</RN.ScrollView>
	);
};

export default {
	Section,
	Switch,
	Checkbox
};