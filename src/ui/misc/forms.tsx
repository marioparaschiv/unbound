import type { IconProps, SectionProps, SvgIconProps } from '@typings/ui/forms';
import { Text, View, ScrollView, Image, type TextStyle } from 'react-native';
import { Design } from '@api/metro/components';
import { Icons } from '@api/assets';
import { find } from '@api/metro';

import useStyles from './forms.style';

export const useFormStyles = useStyles;

export const TintedIcon = ({ source, size = 24, style, defaultSource = Icons['MoreHorizontalIcon'] }: IconProps) => {
	const styles = useStyles({ size });

	return <Image
		defaultSource={defaultSource}
		source={source}
		style={[
			styles.iconTint,
			{ width: size, height: size },
			style
		]}
	/>;
};

export const TintedSvgIcon = ({ size = 24, style, icon: Icon }: SvgIconProps) => {
	const styles = useStyles({ size });

	return <Icon
		style={[
			styles.iconTint,
			{ width: size, height: size },
			style
		]}
	/>;
};

export const TrailingText = ({ children, style }: { children: any, style?: TextStyle; }) => {
	const styles = useStyles();

	return <Text style={[styles.formText, style]}>
		{children}
	</Text>;
};

export const Switch = find(m => m.FormSwitch && !m.FormTitle, { lazy: true });
export const Checkbox = find(m => m.FormCheckbox && !m.FormTitle, { lazy: true });
export const Section = ({ children, style, margin = true, ...props }: SectionProps) => {
	const styles = useStyles();

	return <ScrollView scrollEnabled={false}>
		<View style={[style, styles.sectionWrapper, { ...(margin ? { marginTop: 16 } : {}) }]}>
			<Design.TableRowGroup {...props}>
				{children}
			</Design.TableRowGroup>
		</View>
	</ScrollView>;
};

export default {
	Section,
	Switch,
	Checkbox
};