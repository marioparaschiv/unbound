import { getIDByName } from "@api/assets";
import { Packs } from "@core/builtins/icon-pack";
import { Redesign } from "@metro/components";
import { chunkArray } from "@utilities";
import { ReactNative as RN } from "@metro/common";
import { Files, useSettingsStore } from "@api/storage";

interface DownloadRowProps {
    name: keyof typeof Packs,
    url: string;
}

async function findFolder(tree: any[], paths: string[]) {
    const last = paths.pop();
    let result = tree;

    for (const component of paths) {
        result = await fetch(result.find(x => x.path === component).url)
            .then(x => x.json())
            .then(x => x.tree)
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
    }

    const treesApiUrl = `https://api.github.com/repos/${username}/${repo}/git/trees/${branch ?? "main"}?recursive=${Boolean(path)}`
    const { tree }: { tree: any[] } = await fetch(treesApiUrl).then(x => x.json());

    if (!path) {
        res.tree = tree;
        return res;
    };

    const folder = await findFolder(tree, path.split("/"));
    const assets = await fetch(folder).then(x => x.json());

    res.tree = assets.tree;
    return res as typeof res;
}


export default ({ name, url }: DownloadRowProps) => {
    const [text, setText] = React.useState<string>(null);
    const settings = useSettingsStore('unbound');
    const controller = new AbortController();

    React.useLayoutEffect(() => {
        if (text) {
            RN.LayoutAnimation.configureNext(RN.LayoutAnimation.Presets.spring);
        }
        
        return () => controller.abort("Component was unmounted");
    }, [text]);

    return <Redesign.Button
        text={text}
        icon={getIDByName(settings.get('iconpack.installed', []).includes(name) ? 'ic_message_retry' : 'ic_download_24px')}
        variant={'primary'}
        size={'sm'}
        onPress={async () => {
            setText("Fetching...");

            try {
                const { username, repo, branch, path, tree } = await getAssetsForGitRepo(url);
                const assets = tree.filter(x => x.type === "blob");
            
                const concurrencyLimit = 20;
                const chunks = chunkArray(assets, concurrencyLimit);
            
                for (let i = 0; i < chunks.length; i++) {
                    await Promise.all(chunks[i].map(async (asset, j) => {
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
                            `Unbound/Packs/${name}/${asset.path}`,
                            data,
                            'base64'
                        );
                
                        // All chunks previously fetched + the current index of this chunk
                        setText(`${(i + 1) * 20 + (j + 1)} of ${assets.length}`);
                    }));
                }
            
                const installed = await Files.fileExists(Files.DocumentsDirPath + `/Unbound/Packs/${name}`);
                installed && settings.set('iconpack.installed', [ ...settings.get('iconpack.installed', []), name ]);

                setText(null);
            } catch (error) {
                console.error("Getting assets: " + error);
            }
        }}
    />
}