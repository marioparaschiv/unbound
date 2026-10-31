import type { PendingUpdate } from '~/updates/addon-updates';
import { messages, format } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { Manager } from '~/addons/manager';
import { Screens } from '~/core/constants';

import { headline, kindIcon } from './format';
import UpdateButton from './update-button';
import Changelog from './changelog';

type UpdateRowProps = {
	entry: PendingUpdate;
};

/** A pending update: the version jump and what changed most recently; pressing it opens the changelog. */
function UpdateRow({ entry }: UpdateRowProps) {
	const navigation = Discord.useNavigation();
	const { update } = entry;
	const summary = headline(update.changelogs[0]?.changelog ?? update.changelog);
	const held = Manager.for(entry.kind).getHeldVersion(entry.id);
	const versions = `${entry.from} → ${update.version}`;
	const jump = held
		? `${versions} · ${format('UNBOUND_UPDATES_HELD', { version: held })}`
		: versions;

	return (
		<Discord.TableRow
			label={entry.name}
			subLabel={summary ? `${jump}\n${summary}` : jump}
			labelLineClamp={1}
			subLabelLineClamp={2}
			icon={<Discord.TableRowIcon source={kindIcon(entry.kind)} />}
			trailing={<UpdateButton id={entry.id} text={messages.UNBOUND_UPDATE} />}
			onPress={() =>
				navigation.push(Screens.Custom, {
					title: entry.name,
					render: () => (
						<Changelog
							name={entry.name}
							icon={kindIcon(entry.kind)}
							installed={entry.from}
							offered={update.version}
							changelogs={update.changelogs}
						>
							<UpdateButton
								id={entry.id}
								size='lg'
								grow
								text={format('UNBOUND_UPDATES_UPDATE_TO', {
									version: update.version,
								})}
								onUpdated={() => navigation.goBack()}
							/>
						</Changelog>
					),
				})
			}
		/>
	);
}

export default UpdateRow;
