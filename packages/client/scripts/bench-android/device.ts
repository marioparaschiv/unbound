import { createHash } from 'node:crypto';

const PACKAGE = 'com.discord';
const ACTIVITY = 'com.discord/.main.MainDefault';
const UNBOUND_DIR = `/data/data/${PACKAGE}/files/Unbound`;
const SETTINGS = `${UNBOUND_DIR}/settings.json`;
const BUNDLE = `${UNBOUND_DIR}/unbound.bundle`;
const CLOCK_TICKS_PER_SECOND = 100;

/** Memory Android reports for Discord's process, in KB. */
export type MemInfo = {
	pss: number;
	rss: number;
	javaHeap: number;
	nativeHeap: number;
	code: number;
};

/** A rooted Android device or emulator reached over adb. */
export type Device = ReturnType<typeof createDevice>;

/**
 * @description Wraps adb for one device serial; every shell command runs as root.
 * @param adb The adb binary.
 * @param serial The device serial, such as `emulator-5554`.
 * @returns The device's operations.
 */
export function createDevice(adb: string, serial: string) {
	async function shell(command: string, input?: string): Promise<string> {
		const child = Bun.spawn([adb, '-s', serial, 'shell', command], {
			stdin: input === undefined ? 'ignore' : new Blob([input]),
			stdout: 'pipe',
			stderr: 'pipe',
		});
		const [out, err, code] = await Promise.all([
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
			child.exited,
		]);

		if (code !== 0) {
			throw new Error(
				`Failed to run \`${command}\` on ${serial} (exit ${code}): ${err || out}`,
			);
		}

		return out.replaceAll('\r', '');
	}

	async function pid(): Promise<number | undefined> {
		const out = await shell(`pidof ${PACKAGE} || true`);
		const value = Number(out.trim().split(/\s+/)[0]);

		return Number.isFinite(value) && value > 0 ? value : void 0;
	}

	return {
		shell,
		pid,
		async isRoot() {
			return (await shell('id -u')).trim() === '0';
		},
		async stop() {
			await shell(`am force-stop ${PACKAGE}`);
		},
		async launch() {
			await shell(`am start -n ${ACTIVITY} >/dev/null`);
		},
		async readSettings(): Promise<string> {
			return shell(`cat ${SETTINGS}`);
		},
		/** Writes settings.json with Discord's owner and SELinux label. Discord must be stopped: it rewrites the file. */
		async writeSettings(text: string) {
			await shell(`cat > ${SETTINGS}`, text);
			await shell(
				`chown $(stat -c %u:%g /data/data/${PACKAGE}) ${SETTINGS} && restorecon ${SETTINGS}`,
			);
		},
		/** Deletes the saved bundle, so the next launch waits for the download and runs it at once. */
		async clearBundle() {
			await shell(
				`rm -f ${BUNDLE} ${BUNDLE}.trust ${BUNDLE}.candidate ${BUNDLE}.candidate.trust`,
			);
		},
		async bundleSha256(): Promise<string | undefined> {
			const out = await shell(`sha256sum ${BUNDLE} 2>/dev/null || true`);

			return out.trim().split(/\s+/)[0] || void 0;
		},
		/** When a process started, in device epoch milliseconds, from its start tick and the boot clock (10 ms steps); undefined once it has exited. */
		async processStartEpoch(processId: number): Promise<number | undefined> {
			const out = await shell(
				`cut -d' ' -f22 /proc/${processId}/stat; cut -d' ' -f1 /proc/uptime; echo $EPOCHREALTIME`,
			);
			const [ticks, uptime, now] = out.trim().split('\n').map(Number);

			if (!ticks || !uptime || !now) return;

			return Math.round((now - uptime + ticks / CLOCK_TICKS_PER_SECOND) * 1000);
		},
		async memInfo(): Promise<MemInfo | undefined> {
			const out = await shell(`dumpsys meminfo ${PACKAGE}`);
			const read = (pattern: RegExp) => Number(pattern.exec(out)?.[1] ?? NaN);
			const info = {
				pss: read(/TOTAL PSS:\s+(\d+)/),
				rss: read(/TOTAL RSS:\s+(\d+)/),
				javaHeap: read(/Java Heap:\s+(\d+)/),
				nativeHeap: read(/Native Heap:\s+(\d+)/),
				code: read(/ Code:\s+(\d+)/),
			};

			return Number.isNaN(info.pss) ? void 0 : info;
		},
	};
}

/**
 * @description Hashes a file the way the device's `sha256sum` does.
 * @param data The file's bytes.
 * @returns The hex digest.
 */
export function sha256(data: Uint8Array): string {
	return createHash('sha256').update(data).digest('hex');
}
