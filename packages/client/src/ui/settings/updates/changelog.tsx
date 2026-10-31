import type { VersionChangelog } from '@unbound-app/contracts/updates';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Discord } from '~/metro/components';
import Page from '~/ui/components/page';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

import { shortDate } from './format';

/** What an addon's and a loader release's skipped versions share. */
type ChangelogEntry = Pick<VersionChangelog, 'version' | 'changelog' | 'publishedAt'>;

type ChangelogProps = {
	name: string;
	icon: number | undefined;
	installed: string;
	offered: string;
	changelogs: ChangelogEntry[];
	children: ReactNode;
};

/** One pending update: the version jump, every skipped version's changelog, and its action. */
function Changelog({ name, icon, installed, offered, changelogs, children }: ChangelogProps) {
	return (
		<Page>
			<Discord.TableRowGroup>
				<Discord.TableRow
					label={name}
					subLabel={`${installed} → ${offered}`}
					icon={<Discord.TableRowIcon source={icon} />}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title={messages.UNBOUND_UPDATES_CHANGELOG}>
				{changelogs.map((version) => (
					<Discord.TableRow
						key={version.version}
						label={version.version}
						subLabel={version.changelog ?? messages.UNBOUND_UPDATES_NO_CHANGELOG}
						icon={<Discord.TableRowIcon source={icons.TagIcon} />}
						trailing={
							<Discord.TableRow.TrailingText text={shortDate(version.publishedAt)} />
						}
					/>
				))}
			</Discord.TableRowGroup>

			<View>{children}</View>
		</Page>
	);
}

export default Changelog;
