import { findByProps } from '@metro';
import { Theme, StyleSheet, React, ReactNative as RN } from '@metro/common';
import { Forms, Redesign } from '@metro/components';

import type {
	RowIconProps,
	RowProps,
	SectionProps,
	SwitchRowProps
} from '@typings/ui/components/forms';

export const { endStyle } = StyleSheet.createThemedStyleSheet({
	endStyle: {
		backgroundColor: Theme.colors.CARD_PRIMARY_BG ?? Theme.colors.BACKGROUND_PRIMARY,
		borderBottomLeftRadius: 16,
		borderBottomRightRadius: 16
	}
});

export const Switch = findByProps('FormSwitch', { lazy: true, all: true }).find(x => !('FormTitle' in x));
export const TabsUIState = findByProps(
	'useInMainTabsExperiment',
	'isInMainTabsExperiment',
	{ lazy: true }
);

export const useEndStyle = () => {
	const tabsEnabled = TabsUIState.useInMainTabsExperiment();

	return tabsEnabled && endStyle;
};

export const Row = ({ icon, arrow, trailing, ...shared }: RowProps) => {
	const tabsEnabled = TabsUIState.useInMainTabsExperiment();

	return tabsEnabled ? (
		<Redesign.TableRow
			{...shared}
			icon={icon}
			arrow={arrow}
			trailing={trailing}
		/>
	) : (
		<>
			<Forms.FormRow
				{...shared}
				leading={icon}
				trailing={arrow ? Forms.FormArrow : trailing}
			/>
			<Forms.FormDivider />
		</>
	);
};

export const SwitchRow = ({ icon, trailing, value, onValueChange, ...shared }: SwitchRowProps) => {
	const tabsEnabled = TabsUIState.useInMainTabsExperiment();

	return tabsEnabled ? (
		<Redesign.TableRow
			{...shared}
			icon={icon}
			trailing={<RN.View
				style={{
					flexDirection: 'row',
					alignItems: 'center'
				}}
			>
				{trailing}
				<Switch.FormSwitch
					value={value}
					onValueChange={onValueChange}
				/>
			</RN.View>}
		/>
	) : (
		<Row
			{...shared}
			icon={icon}
			trailing={<RN.View
				style={{
					flexDirection: 'row',
					alignItems: 'center'
				}}
			>
				{trailing}
				<Forms.FormSwitch
					value={value}
					onValueChange={onValueChange}
				/>
			</RN.View>}
		/>
	);
};

export const RowIcon = (props: RowIconProps) => {
	const tabsEnabled = TabsUIState.useInMainTabsExperiment();

	return tabsEnabled ? (
		<Redesign.TableRowIcon {...props} />
	) : (
		<Forms.FormIcon {...props} />
	);
};

export const Section = ({ children, style, margin = true, ...props }: SectionProps) => {
	const tabsEnabled = TabsUIState.useInMainTabsExperiment();

	return <RN.ScrollView>
		{tabsEnabled ? (
			<RN.View
				style={[
					style,
					{
						marginHorizontal: 16,
						...margin ? { marginTop: 16 } : {}
					},
				]}
			>
				<Redesign.TableRowGroup {...props}>
					{children}
				</Redesign.TableRowGroup>
			</RN.View>
		) : (
			<Forms.FormSection
				sectionBodyStyle={style}
				{...props}
			>
				{children}
			</Forms.FormSection>
		)}
	</RN.ScrollView>;
};

export default {
	Section,
	Row,
	RowIcon,
	SwitchRow,
	TabsUIState,
	endStyle,
	useEndStyle
};