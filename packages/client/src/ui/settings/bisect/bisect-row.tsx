import { useUnboundSettings } from '~/settings/unbound';
import { confirm, alert } from '~/dialogs/api';
import { startBisect } from '~/plugins/bisect';
import { Discord } from '~/metro/components';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

async function begin() {
	const confirmed = await confirm('UNBOUND_BISECT_START_TITLE', {
		body: 'UNBOUND_BISECT_START_DESC',
		confirm: 'UNBOUND_BISECT_START',
	});

	if (confirmed && !startBisect()) {
		void alert('UNBOUND_BISECT_NOTHING_ON');
	}
}

/**
 * @description A row that starts finding the plugin that causes a problem, by turning plugins off in halves. Hidden
 * while a bisect runs, since its card takes over.
 */
function BisectRow() {
	const settings = useUnboundSettings(({ key }) => key === 'plugins.bisect');

	if (settings.get('plugins.bisect')) return null;

	return (
		<Discord.TableRow
			label={messages.UNBOUND_BISECT_START_TITLE}
			subLabel={messages.UNBOUND_BISECT_ROW_DESC}
			icon={<Discord.TableRowIcon source={icons.MagnifyingGlassIcon ?? icons.WrenchIcon} />}
			arrow
			onPress={() => void begin()}
		/>
	);
}

export default BisectRow;
