import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type Pgbouncer = {
	/** `target`'s database through the pgbouncer, as `target`'s user with no password. */
	url: string;
	stop: () => Promise<void>;
};

const READY_TIMEOUT_MS = 10_000;

/** The pgbouncer binary on PATH, or undefined where it is not installed (CI). */
export const PGBOUNCER = Bun.which('pgbouncer') ?? undefined;

function freePort() {
	const probe = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: { data() {} } });
	const { port } = probe;

	probe.stop(true);

	return port;
}

async function waitForPort(port: number) {
	const deadline = Date.now() + READY_TIMEOUT_MS;

	while (true) {
		try {
			const socket = await Bun.connect({
				hostname: '127.0.0.1',
				port,
				socket: { data() {} },
			});

			socket.end();

			return;
		} catch (error) {
			if (Date.now() > deadline) {
				throw error;
			}

			await Bun.sleep(50);
		}
	}
}

/**
 * @description Starts a private pgbouncer in transaction mode in front of one database, as production runs it.
 * @param target A direct url to the database; its credentials log pgbouncer in to Postgres.
 * @param poolSize Server connections pgbouncer may open to the database.
 * @returns The pooled url and `stop()`, which kills pgbouncer and removes its files.
 */
export async function startPgbouncer(target: string, poolSize: number): Promise<Pgbouncer> {
	if (!PGBOUNCER) {
		throw new Error('pgbouncer is not on PATH.');
	}

	const server = new URL(target);
	const user = decodeURIComponent(server.username);
	const password = decodeURIComponent(server.password);
	const database = server.pathname.slice(1);
	const dir = mkdtempSync(join(tmpdir(), 'unbound-bot-pgbouncer-'));
	const port = freePort();
	const ini = join(dir, 'pgbouncer.ini');

	writeFileSync(join(dir, 'userlist.txt'), `"${user}" ""\n`);
	writeFileSync(
		ini,
		[
			'[databases]',
			`${database} = host=${server.hostname} port=${server.port || 5432} dbname=${database} user=${user} password=${password} pool_size=${poolSize}`,
			'[pgbouncer]',
			'listen_addr = 127.0.0.1',
			`listen_port = ${port}`,
			'unix_socket_dir =',
			'auth_type = trust',
			`auth_file = ${join(dir, 'userlist.txt')}`,
			'pool_mode = transaction',
			// Off, so the bot's client works without pgbouncer tracking prepared statements for it.
			'max_prepared_statements = 0',
			`logfile = ${join(dir, 'pgbouncer.log')}`,
			'',
		].join('\n'),
	);

	const child = Bun.spawn([PGBOUNCER, ini], { stdout: 'ignore', stderr: 'ignore' });

	try {
		await waitForPort(port);
	} catch (error) {
		child.kill();
		rmSync(dir, { recursive: true, force: true });
		throw error;
	}

	return {
		url: `postgres://${encodeURIComponent(user)}@127.0.0.1:${port}/${database}`,
		async stop() {
			child.kill();
			await child.exited;
			rmSync(dir, { recursive: true, force: true });
		},
	};
}
