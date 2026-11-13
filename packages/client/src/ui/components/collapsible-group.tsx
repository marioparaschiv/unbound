import { Children, Fragment, useState } from 'react';
import Animated from 'react-native-reanimated';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Discord, TableRowDividers } from '~/metro/components';
import useCollapseMotion from '~/ui/hooks/use-collapse-motion';
import TintedIcon from '~/metro/fallbacks/tinted-icon';
import { icons } from '~/assets/api';

import useStyles from './collapsible-group.style';

type CollapsibleGroupProps = {
	label: string;
	subLabel?: string;
	icon?: ReactNode;
	/** Whether the rows show until the header is first pressed; followed as it changes until then. */
	defaultExpanded: boolean;
	helperText?: string;
	/** Called with the new state each time the header is pressed. */
	onToggle?: (expanded: boolean) => void;
	children?: ReactNode;
};

/**
 * @description A row group whose header row opens or closes the rows under it, animating their height
 * and turning its chevron. The rows render only while open or animating, so a closed group costs its header alone.
 */
function CollapsibleGroup({
	label,
	subLabel,
	icon,
	defaultExpanded,
	helperText,
	onToggle,
	children,
}: CollapsibleGroupProps) {
	const styles = useStyles();
	const [toggled, setToggled] = useState<boolean | undefined>(undefined);
	const expanded = toggled ?? defaultExpanded;
	const motion = useCollapseMotion(expanded);
	const Divider = TableRowDividers.TableRowDivider;

	// One fragment child, so the group draws no divider of its own: one outside the body would show while
	// collapsed. The body draws a divider above each row instead, which the group would miss in a wrapper.
	return (
		<Discord.TableRowGroup helperText={helperText}>
			<>
				<Discord.TableRow
					label={label}
					subLabel={subLabel}
					icon={icon}
					trailing={
						<Animated.View style={motion.chevron}>
							<TintedIcon source={icons.ChevronSmallDownIcon ?? 0} size={20} />
						</Animated.View>
					}
					onPress={() => {
						setToggled(!expanded);
						onToggle?.(!expanded);
					}}
				/>
				<Animated.View
					style={[styles.body, motion.body]}
					pointerEvents={expanded ? 'auto' : 'none'}
				>
					{motion.mounted ? (
						<View style={styles.rows} onLayout={motion.measure}>
							{Children.toArray(children).map((row, index) => (
								<Fragment key={index}>
									{Divider ? <Divider /> : null}
									{row}
								</Fragment>
							))}
						</View>
					) : null}
				</Animated.View>
			</>
		</Discord.TableRowGroup>
	);
}

export default CollapsibleGroup;
