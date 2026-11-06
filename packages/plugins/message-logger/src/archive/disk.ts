import { emptyArchive, parseArchive, type Archive } from './core';
export interface Files {
	exists(path: string): Promise<boolean>;
	readFile(path: string): Promise<string>;
	writeFile(path: string, content: string): Promise<unknown>;
}
export const paths = ['persistent-message-logger-v1-a.json', 'persistent-message-logger-v1-b.json'];
export class Disk {
	private tail: Promise<void> = Promise.resolve();
	private pending?: {
		data: string;
		waiters: { resolve: () => void; reject: (error: unknown) => void }[];
	};
	private running = false;
	constructor(private files: Files) {}
	async load(): Promise<{ archive: Archive; recovered: boolean }> {
		const slots = await Promise.all(
			paths.map(async (path) => {
				if (!(await this.files.exists(path))) return { exists: false };
				try {
					return { exists: true, archive: parseArchive(await this.files.readFile(path)) };
				} catch {
					return { exists: true };
				}
			}),
		);
		const valid = slots
			.flatMap((s) => (s.archive ? [s.archive] : []))
			.sort((a, b) => b.generation - a.generation);
		if (!valid.length && slots.some((s) => s.exists))
			throw new Error('Archive unreadable. Capture paused; files preserved.');
		return {
			archive: valid[0] ?? emptyArchive(),
			recovered: slots.some((s) => s.exists && !s.archive),
		};
	}
	save(a: Archive): Promise<void> {
		a.generation++;
		const data = JSON.stringify(a);
		// Keep only the newest pending snapshot under event bursts. Replaced callers await its result.
		const waiters = this.pending?.waiters ?? [];
		const operation = new Promise<void>((resolve, reject) => {
			waiters.push({ resolve, reject });
			this.pending = { data, waiters };
		});
		this.tail = operation;
		if (!this.running) void this.drain();
		return operation;
	}
	private async drain(): Promise<void> {
		this.running = true;
		while (this.pending) {
			const job = this.pending;
			this.pending = undefined;
			try {
				await this.files.writeFile(paths[0]!, job.data);
				await this.files.writeFile(paths[1]!, job.data);
				job.waiters.forEach((w) => w.resolve());
			} catch (error) {
				job.waiters.forEach((w) => w.reject(error));
			}
		}
		this.running = false;
	}
	flush(): Promise<void> {
		return this.tail;
	}
}
