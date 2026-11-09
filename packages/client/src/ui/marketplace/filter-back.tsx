import { Discord } from '~/metro/components';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

type FilterBackProps = {
	onPress: () => void;
};

/** @description The back arrow that leads a filter sheet's sub-view, returning to its root. */
function FilterBack({ onPress }: FilterBackProps) {
	return (
		<Discord.IconButton
			icon={icons['ArrowLargeLeftIcon'] ?? 0}
			variant='tertiary'
			size='sm'
			accessibilityLabel={messages.UNBOUND_FILTER_BACK}
			onPress={onPress}
		/>
	);
}

export default FilterBack;
