import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	isSnapshotName,
	listSnapshots,
	pullInParts,
	pushInParts,
	resetDevice,
	resetScript,
	restoreScript,
	saveScript,
	snapshotDirectory,
} from '~/lib/device-state';
import type { CommandRunner } from '~/lib/run-command';

const target = {
	parentScript: "parent='/data/data/com.discord/files'",
	stopScript: 'am force-stop com.discord',
	ownerScript: 'chown -R 1:1 "$parent/Unbound"',
	packCommand: (archive: string) => `tar -czf '${archive}' -C "$parent" Unbound`,
	unpackCommand: (archive: string) => `tar -xzf '${archive}' -C "$parent"`,
};

describe('device state scripts', () => {
	test('reset moves the folder aside instead of deleting it', () => {
		const script = resetScript(target);

		expect(script).toContain('mv "$parent/Unbound" "$parent/Unbound.reset-$stamp"');
		expect(script).not.toMatch(/\brm\b/);
		expect(script.indexOf('am force-stop')).toBeLessThan(script.indexOf('mv '));
	});

	test('save archives the Unbound folder', () => {
		const archive = '/data/local/tmp/a.tar.gz';
		const script = saveScript(target, archive);

		expect(script).toContain(target.packCommand(archive));
		expect(script).toContain(`UBD_RESULT=${archive}`);
	});

	test('restore keeps the replaced folder and hands the files back to the app', () => {
		const script = restoreScript(target, '/data/local/tmp/a.tar.gz');

		expect(script).toContain('"$parent/Unbound.before-restore-$stamp"');
		expect(script).toContain(`tar -xzf '/data/local/tmp/a.tar.gz' -C "$parent"`);
		expect(script).toContain('chown -R 1:1 "$parent/Unbound"');
		expect(script).not.toContain('rm -rf');
	});

	test('snapshot names stay safe file names', () => {
		expect(isSnapshotName('before-update.1')).toBe(true);
		expect(isSnapshotName('../escape')).toBe(false);
		expect(isSnapshotName('')).toBe(false);
		expect(isSnapshotName('has space')).toBe(false);
		expect(snapshotDirectory('ios', 'a/b', '/root')).toBe('/root/ios-a_b');
	});
});

describe('device state commands', () => {
	test('reset reports where the old folder went', async () => {
		const calls: string[][] = [];
		const run: CommandRunner = async (command, args) => {
			calls.push([command, ...args]);

			if (args.includes('get-state')) {
				return { ok: true, stdout: 'device' };
			}

			if (args.at(-1) === 'id -u') {
				return { ok: true, stdout: '0\n' };
			}

			return {
				ok: true,
				stdout: 'UBD_RESULT=/data/data/com.discord/files/Unbound.reset-1\n',
			};
		};
		const result = await resetDevice({ serial: 'emulator-5554', run });

		expect(result).toEqual({
			ok: true,
			text: "Moved Unbound's folder to /data/data/com.discord/files/Unbound.reset-1. Launch Discord to load it.",
		});
		expect(calls.at(-1)?.slice(0, 4)).toEqual(['adb', '-s', 'emulator-5554', 'shell']);
	});

	test('reset refuses an Android serial together with an iPhone', async () => {
		const result = await resetDevice({
			serial: 'x',
			ios: true,
			run: async () => ({ ok: true, stdout: '' }),
		});

		expect(result.ok).toBe(false);
	});

	test('lists saved snapshots per device', () => {
		const root = mkdtempSync(join(tmpdir(), 'ubd-snapshots-'));

		try {
			expect(listSnapshots(root).text).toBe('No device snapshots are saved yet.');

			const directory = snapshotDirectory('android', 'emulator-5554', root);

			mkdirSync(directory, { recursive: true });
			writeFileSync(join(directory, 'clean.tar.gz'), 'x');

			expect(listSnapshots(root).text).toContain('android-emulator-5554  clean  0.0 MB');
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});

describe('transfers in parts', () => {
	test('pull joins every part in order', async () => {
		const directory = mkdtempSync(join(tmpdir(), 'ubd-parts-'));
		const local = join(directory, 'joined');
		const parts: Record<string, string> = {
			'/tmp/a.part-aa': 'first-',
			'/tmp/a.part-ab': 'second',
		};

		try {
			const result = await pullInParts(
				'/tmp/a',
				local,
				async (_direction, source, destination) => {
					writeFileSync(destination, parts[source] ?? '');

					return { ok: true, stdout: '' };
				},
				async (script) => ({
					ok: true,
					value: script.startsWith('rm') ? 'removed' : '/tmp/a.part-ab /tmp/a.part-aa',
				}),
			);

			expect(result.ok).toBe(true);
			expect(readFileSync(local, 'utf8')).toBe('first-second');
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	test('push sends parts and joins them on the device', async () => {
		const directory = mkdtempSync(join(tmpdir(), 'ubd-parts-'));
		const local = join(directory, 'archive');
		const sent: string[] = [];
		let joinScript = '';

		writeFileSync(local, Buffer.alloc(5 * 1024 * 1024, 1));

		try {
			const result = await pushInParts(
				local,
				'/var/tmp/a.tar.gz',
				async (_direction, _source, destination) => {
					sent.push(destination);

					return { ok: true, stdout: '' };
				},
				async (script) => {
					joinScript = script;

					return { ok: true, value: '/var/tmp/a.tar.gz' };
				},
			);

			expect(result.ok).toBe(true);
			expect(sent.length).toBeGreaterThan(1);

			const names = Array.from(
				{ length: sent.length },
				(_, index) => `/var/tmp/a.tar.gz.part-${String(index).padStart(4, '0')}`,
			);

			expect(sent).toEqual(names);
			expect(joinScript).toStartWith(
				`cat ${sent.map((part) => `'${part}'`).join(' ')} > '/var/tmp/a.tar.gz'`,
			);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
});
