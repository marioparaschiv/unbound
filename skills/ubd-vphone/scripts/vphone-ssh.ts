// Answers the scripts' vphone actions over SSH. Screen actions and installs need the hub's tool: here they fail.
import { basename } from 'node:path';

import type { Json } from './json.ts';

import {
	DISCORD,
	HubError,
	resultText,
	type CallResult,
	type ToolArgs,
	type Vphone,
} from './vphone.ts';

type Run = { code: number; out: string };

const META = '.com.apple.mobile_container_manager.metadata.plist';
const BUNDLES = '/var/containers/Bundle/Application';
const CRASHES = '/var/mobile/Library/Logs/CrashReporter';
const ACTIONS = `vphone over SSH (VPHONE_SSH=${process.env.VPHONE_SSH ?? ''}). Actions:
  shell command=<sh> [root=true]   runs in the real root; a /rootfs prefix is dropped
  app_info bundle_id=<id>          version, bundle_path, data_path, documents_path
  rpc method=processes.list        pid, bundle_id and start_time of each process
  launch bundle_id=<id>            uiopen --bundleid
  terminate bundle_id=<id>         SIGTERM to the app's processes
  crashes bundle_id=<id> | path=<report>   list the app's crash reports, or read one
Screen actions (screenshot, ui, wait, tap, tap_text, swipe, type), logs and installs need the tailnet hub's tool.`;

const quote = (value: string) => `'${value.replaceAll("'", `'"'"'`)}'`;

function stringArg(args: ToolArgs, key: string, fallback = ''): string {
	const value = args[key];

	return typeof value === 'string' ? value : fallback;
}
const ok = (text: string): CallResult => ({ content: [{ type: 'text', text }], isError: false });
const fail = (text: string): CallResult => ({ content: [{ type: 'text', text }], isError: true });

/** Seconds from `ps -o etime`, `[[dd-]hh:]mm:ss`. */
function elapsedSeconds(etime: string): number {
	const [days, clock] = etime.includes('-') ? etime.split('-') : ['0', etime];
	const parts = clock.split(':').map(Number);

	while (parts.length < 3) {
		parts.unshift(0);
	}

	return Number(days) * 86_400 + parts[0] * 3600 + parts[1] * 60 + parts[2];
}

/** One SSH connection target, `VPHONE_SSH` (a host alias or `user@host`, with `VPHONE_SSH_PORT`). */
export class SshVphone implements Vphone {
	private readonly target: string;
	private readonly port = process.env.VPHONE_SSH_PORT;
	// `sudo` on the vphone asks for the mobile user's password; unused when sudo needs none.
	private readonly password = process.env.VPHONE_SUDO_PASSWORD ?? 'alpine';
	private readonly bundles = new Set([DISCORD]);
	// Whether the login shell is a jailbreak's bootstrap root (roothide), with the real root at `/rootfs`.
	private rootfs: boolean | undefined;

	constructor(target = process.env.VPHONE_SSH) {
		if (!target) {
			throw new HubError(
				'VPHONE_SSH is unset: an SSH host for the vphone, such as mobile@<ip>.',
			);
		}

		this.target = target;
	}

	private async run(script: string, root = false, timeoutMs = 120_000): Promise<Run> {
		this.rootfs ??= (
			await this.exec('[ -d /rootfs/private ] && echo rootfs', false)
		).out.startsWith('rootfs');

		// `$R` prefixes real-root paths; `ps` lives in the real root's /bin under a bootstrap root.
		const prelude = this.rootfs ? 'R=/rootfs; PATH=$PATH:/rootfs/bin' : 'R=';
		const body = this.rootfs ? script : script.replaceAll(/\/rootfs(?=\/)/g, '');

		return this.exec(`${prelude}\n${body}`, root, timeoutMs);
	}

	private async exec(script: string, root: boolean, timeoutMs = 120_000): Promise<Run> {
		const encoded = Buffer.from(script).toString('base64');
		const shell = `sh -c "$(printf %s ${encoded} | base64 -d)"`;
		const remote = root ? `sudo -S -p '' ${shell}` : shell;
		const ssh = Bun.spawn(
			[
				'ssh',
				'-o',
				'BatchMode=yes',
				'-o',
				'ConnectTimeout=10',
				...(this.port ? ['-p', this.port] : []),
				this.target,
				remote,
			],
			{ stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' },
		);
		const timer = setTimeout(() => ssh.kill(), timeoutMs);

		ssh.stdin.write(root ? `${this.password}\n` : '');
		ssh.stdin.end();

		const [out, err, code] = await Promise.all([
			new Response(ssh.stdout).text(),
			new Response(ssh.stderr).text(),
			ssh.exited,
		]);

		clearTimeout(timer);

		// ssh itself exits 255 when it cannot connect or authenticate.
		if (code === 255) {
			throw new HubError(
				`Failed to reach the vphone over SSH (${this.target}): ${err.trim()}`,
			);
		}

		return { code, out: code === 0 ? out : `${out}${err}` };
	}

	private async shell(script: string, root = false, timeoutMs?: number): Promise<CallResult> {
		const { code, out } = await this.run(script, root, timeoutMs);

		return code === 0 ? ok(out) : fail(out.trim() || `exit ${code}`);
	}

	private async appInfo(id: string): Promise<CallResult> {
		const script = [
			`data=$(grep -lF ${quote(id)} "$R"/var/mobile/Containers/Data/Application/*/${META} 2>/dev/null | head -n 1)`,
			`meta=$(grep -lF ${quote(id)} "$R"${BUNDLES}/*/${META} 2>/dev/null | head -n 1)`,
			`[ -n "$meta" ] || { echo ${quote(`${id} is not installed`)}; exit 1; }`,
			'app=$(ls -d "${meta%/*}"/*.app | head -n 1)',
			'version=$(plutil -key CFBundleShortVersionString "$app/Info.plist" 2>/dev/null)',
			'data=${data%/*}',
			'printf "%s\\n%s\\n%s\\n" "${app#$R}" "${data#$R}" "$version"',
		].join('\n');
		const result = await this.run(script, true);

		if (result.code !== 0) {
			return fail(result.out.trim());
		}

		const [app = '', data = '', version = ''] = result.out.split('\n');

		return ok(
			JSON.stringify({
				version,
				bundle_path: app,
				data_path: data,
				documents_path: data && `${data}/Documents`,
			}),
		);
	}

	private async processes(): Promise<{ pid: number; bundle_id?: string; start_time: number }[]> {
		const ids = [...this.bundles].map(quote).join(' ');
		const script = [
			'date +%s',
			`for id in ${ids}; do for m in $(grep -lF "$id" "$R"${BUNDLES}/*/${META} 2>/dev/null); do m=\${m%/*}; echo "app $id \${m#$R}/"; done; done`,
			'ps -axo pid=,etime=,comm=',
		].join('\n');
		const { code, out } = await this.run(script, true);

		if (code !== 0) {
			throw new HubError(`Failed to list the vphone's processes: ${out.trim()}`);
		}

		const [now = '0', ...lines] = out.split('\n');
		const apps = lines
			.filter((line) => line.startsWith('app '))
			.map((line) => line.split(' ').slice(1) as [string, string]);

		return lines.flatMap((line) => {
			const match = /^\s*(\d+)\s+(\S+)\s+(.+)$/.exec(line);

			if (!match || line.startsWith('app ')) {
				return [];
			}

			const path = match[3].replace(/^\/private/, '');
			// The app's main executable only: its extensions (`PlugIns/*.appex`) share the container.
			const app = apps.find(
				([, folder]) =>
					path.startsWith(folder) &&
					/^[^/]+\.app\/[^/]+$/.test(path.slice(folder.length)),
			);

			return [
				{
					pid: Number(match[1]),
					bundle_id: app?.[0],
					start_time: Number(now) - elapsedSeconds(match[2]),
				},
			];
		});
	}

	private async pids(id: string): Promise<number[]> {
		this.bundles.add(id);

		return (await this.processes())
			.filter((entry) => entry.bundle_id === id)
			.map((entry) => entry.pid);
	}

	private async crashes(args: ToolArgs): Promise<CallResult> {
		if (typeof args.path === 'string') {
			const read = await this.run(`cat "$R"${quote(args.path)}`, true);

			return read.code === 0 ? ok(JSON.stringify({ content: read.out })) : fail(read.out);
		}

		const info = await this.appInfo(stringArg(args, 'bundle_id', DISCORD));
		const app = info.isError
			? ''
			: String(JSON.parse(resultText('app_info', info)).bundle_path);
		const name = quote(basename(app, '.app'));
		const script = `cd "$R"${CRASHES} 2>/dev/null || exit 0; for f in ${name}-*.ips ${name}.*.ips; do [ -f "$f" ] && echo "$(date -r "$f" +%s) $f"; done; true`;
		const list = await this.run(script, true);
		const crashes: Json[] = list.out
			.split('\n')
			.filter(Boolean)
			.map((line) => {
				const [mtime, file] = [
					line.slice(0, line.indexOf(' ')),
					line.slice(line.indexOf(' ') + 1),
				];

				return { path: `${CRASHES}/${file}`, name: file, mtime: Number(mtime) };
			});

		return ok(JSON.stringify({ crashes }));
	}

	async describe(): Promise<string> {
		return ACTIONS;
	}

	async call(action: string, args: ToolArgs = {}, timeoutMs?: number): Promise<CallResult> {
		const id = stringArg(args, 'bundle_id', DISCORD);

		switch (action) {
			case 'shell':
				return this.shell(stringArg(args, 'command'), args.root === true, timeoutMs);
			case 'app_info':
				this.bundles.add(id);

				return this.appInfo(id);
			case 'rpc':
				return args.method === 'processes.list'
					? ok(JSON.stringify({ processes: await this.processes() }))
					: fail(`rpc ${stringArg(args, 'method')} needs the tailnet hub's vphone tool`);
			case 'launch':
				return this.shell(
					`uiopen --bundleid ${quote(id)} >/dev/null 2>&1 </dev/null && echo launched`,
				);
			case 'terminate': {
				const pids = await this.pids(id);

				return pids.length ? this.shell(`kill ${pids.join(' ')}`, true) : ok('not running');
			}
			case 'crashes':
				return this.crashes(args);
			default:
				return fail(
					`${action} needs the tailnet hub's vphone tool; over SSH, check state with ubd eval`,
				);
		}
	}

	async text(action: string, args: ToolArgs = {}, timeoutMs?: number): Promise<string> {
		return resultText(action, await this.call(action, args, timeoutMs));
	}

	close() {
		// Each action is its own ssh process: nothing stays open.
	}
}
