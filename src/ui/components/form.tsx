import type { FormSwitchProps, RowIconProps, RowProps, SectionProps, SwitchRowProps } from '@typings/ui/components/forms';
import { Theme, StyleSheet, React, ReactNative as RN } from '@metro/common';
import type { PropertyRecordOrArray } from '@typings/api/metro';
import { Forms, Redesign } from '@metro/components';
import type { ViewProps } from 'react-native';
import { findByProps } from '@metro';

export const useStyles = StyleSheet.createStyles({
	endStyle: {
		backgroundColor: Theme.colors.CARD_PRIMARY_BG ?? Theme.colors.BACKGROUND_PRIMARY,
		borderBottomLeftRadius: 16,
		borderBottomRightRadius: 16
	}
});

// Improve speeds a small amount by lazily loading these
// These use .find right after findByProps which negates the lazy primitive, so caching them is best.
const internalGetLazily = <TName extends string, TFormatted extends `Form${TName}`>(name: TName) => {
	let cache: PropertyRecordOrArray<TFormatted[], TFormatted>;

	return new Proxy({ __LAZY__: true }, {
		get(_, prop, receiver) {
			cache ??= findByProps(`Form${name}`, { all: true }).find(x => !('FormTitle' in x));
			return Reflect.get(cache, prop, receiver);
		}
	}) as unknown as PropertyRecordOrArray<TFormatted[], TFormatted>;
};

export const Switch = internalGetLazily('Switch');
export const Checkbox = internalGetLazily('Checkbox');
export const TabsUIState = findByProps('useInMainTabsExperiment', 'isInMainTabsExperiment', { lazy: true });

export const useEndStyle = () => {
	const tabs = TabsUIState.useInMainTabsExperiment?.() ?? true;
	const { endStyle } = useStyles();

	return tabs && endStyle;
};

export const Row = ({ icon, arrow, trailing, ...shared }: RowProps) => {
	const tabs = TabsUIState.useInMainTabsExperiment?.() ?? true;

	return tabs ? (
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

export const Form = (props: React.PropsWithChildren<ViewProps>) => {
	return <Forms.Form {...props}>
		{props.children}
	</Forms.Form>;
};

export const SwitchRow = ({ icon, trailing, value, onValueChange, ...shared }: SwitchRowProps) => {
	return <Row
		{...shared}
		icon={icon}
		trailing={<RN.View
			style={{
				flexDirection: 'row',
				alignItems: 'center'
			}}
		>
			{trailing}
			<RowSwitch
				value={value}
				onValueChange={onValueChange}
			/>
		</RN.View>}
	/>;
};

export const RowIcon = (props: RowIconProps) => {
	const tabs = TabsUIState.useInMainTabsExperiment?.() ?? true;

	return tabs ? (
		<Redesign.TableRowIcon {...props} />
	) : (
		<Forms.FormIcon {...props} />
	);
};

export const RowSwitch = (props: FormSwitchProps) => {
	const tabs = TabsUIState.useInMainTabsExperiment?.() ?? true;

	return tabs ? (
		<Switch.FormSwitch {...props} />
	) : (
		<Forms.FormSwitch {...props} />
	);
};

export const Section = ({ children, style, margin = true, ...props }: SectionProps) => {
	const tabs = TabsUIState.useInMainTabsExperiment?.() ?? true;

	return <RN.ScrollView>
		{tabs ? (
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
	useEndStyle,
	Switch,
	Checkbox
};