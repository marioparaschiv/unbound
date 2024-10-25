import { createTimeoutSignal } from '@utilities';
import { ManagerKind } from '@constants';
import Manager from '@managers/base';


class Sources extends Manager {
	constructor() {
		super(ManagerKind.SOURCES);
	}

	async initialize() {
		const repositories = this.settings.get('repositories', []).map(r => new URL(r));

		// Load repositories in parallel.
		const promises = repositories.map(this.load);
		await Promise.allSettled(promises);

		this.initialized = true;
	}

	override async load(url: URL) {
		const metadata = await this.getRepositoryMetadata(url);
		if (!metadata) { }
	}

	validateRepositoryMetadata() {

	}

	async getRepositoryMetadata(url: URL) {
		const response: Response | Error = await fetch(url, {
			signal: createTimeoutSignal()
		}).catch((error) => error);

		if (response instanceof Error) {
			this.errors.set(url.toString(), response);
			this.emit('error', { url });
			return null;
		}

		if (!response.ok) {
			const error = new Error(`Got unexpected status ${response.status} while fetching source.`);
			this.errors.set(url.toString(), error);
			this.emit('error', { url });
			return null;
		}

		try {
			return await response.json();
		} catch (error) {
			this.errors.set(url.toString(), error);
			this.emit('error', { url });
			return null;
		}
	}
}

export default new Sources();