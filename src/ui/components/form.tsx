import { Theme, StyleSheet, React, ReactNative as RN } from '@metro/common';
import { Redesign } from '@metro/components';
import { findByProps } from '@metro';

import type { SectionProps } from '@typings/ui/components/forms';
import type { PropertyRecordOrArray } from '@typings/api/metro';

export const useFormStyles = StyleSheet.createStyles({
	endStyle: {
		backgroundColor: Theme.colors.CARD_PRIMARY_BG ?? Theme.colors.BACKGROUND_PRIMARY,
		borderBottomLeftRadius: 16,
		borderBottomRightRadius: 16
	},

	formText: {
		color: Theme.colors.TEXT_NORMAL,
		fontSize: 16
	},

	formHint: {
		color: Theme.colors.HEADER_PRIMARY,
		fontSize: 12,
		marginTop: 4,
		marginHorizontal: 16
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
export const Section = ({ children, style, margin = true, ...props }: SectionProps) => {
	return <RN.ScrollView scrollEnabled={false}>
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
	</RN.ScrollView>;
};

export default {
	Section,
	Switch,
	Checkbox
};