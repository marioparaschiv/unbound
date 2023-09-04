import { ReactNative as RN, i18n } from '@metro/common';
import { Files, useSettingsStore } from '@api/storage';
import { getIDByName, packExists } from '@api/assets';
import type { Pack } from '@core/builtins/icon-pack';
import { Redesign } from '@metro/components';
import { chunkArray } from '@utilities';
import { Paths } from '@constants';

interface DownloadRowProps {
	pack: Pack,
	url: string,
	settings: ReturnType<typeof useSettingsStore>,
	controller: AbortController;
}

async function findFolder(tree: any[], paths: string[]) {
	const last = paths.pop();
	let result = tree;

	for (const component of paths) {
		const path = result.find(x => x.path === component);

		result = await fetch(path.url).then(x => x.json()).then(x => x.tree);
	}

	return `${result.find(x => x.path === last).url}?recursive=true`;
}

async function getAssetsForGitRepo(url: DownloadRowProps['url']) {
	const regex = /https:\/\/github\.com\/([^\/]*)\/([^\/]*)(?:\/tree\/([^\/]*))?\/?(.*)?/;
	const [, username, repo, branch, path] = url.match(regex) as string[];

	const res = {
		username,
		repo,
		branch,
		path,
		tree: [] as any[]
	};

	const treesApiUrl = `https://api.github.com/repos/${username}/${repo}/git/trees/${branch ?? 'main'}?recursive=${Boolean(path)}`;
	const { tree }: { tree: any[]; } = await fetch(treesApiUrl).then(x => x.json());

	if (!path) {
		res.tree = tree;
		return res;
	};

	const folder = await findFolder(tree, path.split('/'));
	const assets = await fetch(folder).then(x => x.json());

	res.tree = assets.tree;
	return res as typeof res;
}

export default ({ pack, url, settings, controller }: DownloadRowProps) => {
	const [text, setText] = React.useState<string>(null);
	const [installed, setInstalled] = React.useState(false);

	React.useEffect(() => {
		packExists(settings, pack, true).then(setInstalled);
	}, []);

	React.useLayoutEffect(() => {
		if (text !== null) {
			RN.LayoutAnimation.configureNext(RN.LayoutAnimation.Presets.spring);
		}
	}, [text]);

	return <Redesign.Button
		text={text}
		icon={getIDByName(installed ? 'ic_message_retry' : 'ic_download_24px')}
		variant={'primary'}
		size={'sm'}
		onPress={async () => {
			setText(i18n.Messages.UNBOUND_DOWNLOAD_PACK_FETCHING);

			try {
				const { username, repo, branch, path, tree } = await getAssetsForGitRepo(url);
				const assets = tree.filter(x => x.type === 'blob');
				const chunks = chunkArray(assets, 40);

				let completed = 0;

				for (let i = 0; i < chunks.length; i++) {
					await Promise.all(chunks[i].map(async (asset) => {
						const assetUrl = `https://raw.githubusercontent.com/${username}/${repo}/${branch ?? 'main'}/${path ? `${path}/` : ''}${asset.path}`;

						const res = await fetch(assetUrl, { signal: controller.signal });
						const blob = await res.blob();

						const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
							const reader = new FileReader();
							reader.onloadend = () => resolve(reader.result as ArrayBuffer);
							reader.onerror = reject;
							reader.readAsArrayBuffer(blob);
						});

						const data = Buffer.from(buf).toString('base64');

						await Files.writeFile(
							'documents',
							`${Paths.packs.local}/${pack}/${asset.path}`,
							data,
							'base64'
						);

						setText(`${completed++}/${assets.length}`);
					}));
				}

				const installed = await Files.fileExists(Files.DocumentsDirPath + `/${Paths.packs.local}/${pack}`);
				installed && settings.set('iconpack.installed', [...settings.get('iconpack.installed', ['default']), pack]);

				setInstalled(true);

				setText(i18n.Messages.UNBOUND_DOWNLOAD_PACK_DONE);
				setTimeout(() => setText(''), 1000);
			} catch (error) {
				console.error('Getting assets: ' + error.message ?? error);
				setText('');
			}
		}}
	/>;
};