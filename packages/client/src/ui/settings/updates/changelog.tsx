import type { VersionChangelog } from '@unbound-app/contracts/updates';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Discord } from '~/api/metro/components';
import { Page } from '~/ui/components';
import { Messages } from '~/api/i18n';
import { Icons } from '~/api/assets';

import { shortDate } from './format';

type ChangelogProps = {
	name: string;
	icon: number | undefined;
	/** The installed version. */
	from: string;
	/** The offered version. */
	to: string;
	/** Each version the update skips over, newest first. */
	changelogs: VersionChangelog[];
	/** The action under the changelog, such as an update button. */
	children: ReactNode;
};

/** One pending update: the version jump, every skipped version's changelog, and its action. */
function Changelog({ name, icon, from, to, changelogs, children }: ChangelogProps) {
	return (
		<Page>
			<Discord.TableRowGroup>
				<Discord.TableRow
					label={name}
					subLabel={`${from} → ${to}`}
					icon={<Discord.TableRowIcon source={icon} />}
				/>
			</Discord.TableRowGroup>

			<Discord.TableRowGroup title={Messages.UNBOUND_UPDATES_CHANGELOG}>
				{changelogs.map((version) => (
					<Discord.TableRow
						key={version.version}
						label={version.version}
						subLabel={version.changelog ?? Messages.UNBOUND_UPDATES_NO_CHANGELOG}
						icon={<Discord.TableRowIcon source={Icons.TagIcon} />}
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
