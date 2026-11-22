import Animated from 'react-native-reanimated';
import { View } from 'react-native';

import useCollapseMotion from '~/ui/hooks/use-collapse-motion';
import TintedIcon from '~/metro/fallbacks/tinted-icon';
import { messages, format } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { icons } from '~/assets/api';

type AddonGroupHeaderProps = {
	/** How many addons are installed. */
	count: number;
	/** How many addon updates are waiting. */
	pending: number;
	/** Whether the addon rows show under it. */
	expanded: boolean;
	onToggle: () => void;
};

/**
 * @description The Addons group's header row: the addon and update counts, opening or closing the rows the
 * page's list draws under it. It ends the group's card while closed.
 * Wrapped in a view: an open header draws its divider as a sibling, which the page's stack would space apart.
 */
function AddonGroupHeader({ count, pending, expanded, onToggle }: AddonGroupHeaderProps) {
	const { chevron } = useCollapseMotion(expanded);
	const addons = format('UNBOUND_UPDATES_ADDONS_COUNT', { count });

	return (
		<View>
			<Discord.TableRow
				label={messages.UNBOUND_UPDATES_ADDONS}
				subLabel={
					pending
						? `${addons} · ${format('UNBOUND_UPDATES_PENDING', { count: pending })}`
						: addons
				}
				icon={<Discord.TableRowIcon source={icons.PuzzlePieceIcon} />}
				trailing={
					<Animated.View style={chevron}>
						<TintedIcon source={icons.ChevronSmallDownIcon ?? 0} size={20} />
					</Animated.View>
				}
				start
				end={!expanded}
				onPress={onToggle}
			/>
		</View>
	);
}

export default AddonGroupHeader;
