import type { LoaderUpdate } from '@unbound-app/contracts/loader';
import type { ButtonSize } from '@unbound-app/types';

import { Discord } from '~/api/metro/components';
import { Messages, format } from '~/api/i18n';
import { Linking } from '~/api/metro/api';
import { Screens } from '~/lib/constants';
import { Icons } from '~/api/assets';

import Changelog from './changelog';
import { headline } from './format';

type LoaderUpdateRowProps = {
	update: LoaderUpdate;
};

type DownloadButtonProps = {
	url: string;
	text: string;
	size?: ButtonSize;
	grow?: boolean;
};

// A native build cannot install itself, so the user is sent to where the release is published.
function DownloadButton({ url, text, size = 'sm', grow }: DownloadButtonProps) {
	return (
		<Discord.Button
			size={size}
			grow={grow}
			variant='primary'
			text={text}
			onPress={() => void Linking.openURL(url)}
		/>
	);
}

/** A newer native loader release: the version jump and what changed; pressing it opens the changelog. */
function LoaderUpdateRow({ update }: LoaderUpdateRowProps) {
	const navigation = Discord.useNavigation();
	const from = globalThis.UNBOUND_LOADER.version;
	const summary = headline(update.changelogs[0]?.changelog ?? update.changelog);
	const jump = `${from} → ${update.version}`;
	const icon = Icons.WrenchIcon;

	return (
		<Discord.TableRow
			label={Messages.UNBOUND_UPDATES_LOADER}
			subLabel={summary ? `${jump}\n${summary}` : jump}
			labelLineClamp={1}
			subLabelLineClamp={2}
			icon={<Discord.TableRowIcon source={icon} />}
			trailing={<DownloadButton url={update.url} text={Messages.UNBOUND_UPDATES_DOWNLOAD} />}
			onPress={() =>
				navigation.push(Screens.Custom, {
					title: Messages.UNBOUND_UPDATES_LOADER,
					render: () => (
						<Changelog
							name={Messages.UNBOUND_UPDATES_LOADER}
							icon={icon}
							from={from}
							to={update.version}
							changelogs={update.changelogs}
						>
							<DownloadButton
								url={update.url}
								size='lg'
								grow
								text={format('UNBOUND_UPDATES_DOWNLOAD_VERSION', {
									version: update.version,
								})}
							/>
						</Changelog>
					),
				})
			}
		/>
	);
}

export default LoaderUpdateRow;
