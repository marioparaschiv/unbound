import { Theme, StyleSheet, ReactNative as RN } from '@metro/common';
import { Redesign } from '@metro/components';

import type { SectionProps } from '@typings/ui/components/forms';
import { internalGetLazily } from '@metro/registry';

export const useFormStyles = StyleSheet.createStyles({
	endStyle: {
		backgroundColor: Theme.colors.CARD_PRIMARY_BG ?? Theme.colors.BACKGROUND_PRIMARY,
		borderBottomLeftRadius: 16,
		borderBottomRightRadius: 16
	},

	formText: {
		color: Theme.colors.TEXT_NORMAL,
		fontSize: 12
	},

	formHint: {
		color: Theme.colors.HEADER_PRIMARY,
		fontSize: 12,
		marginTop: 4,
		marginHorizontal: 16
	}
});

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