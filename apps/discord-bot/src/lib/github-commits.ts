import { Type, safeParse } from '@unbound-app/contracts/schema';
import { createLogger } from '@unbound-app/logger';

import { GITHUB_API, REQUEST_TIMEOUT_MS, type Fetch } from '~/lib/github-contributors';
import { REPOSITORY } from '~/lib/release-message';

/** Reads a commit's subject line; `undefined` when GitHub cannot say. Never throws. */
export type CommitSubjects = (sha: string) => Promise<string | undefined>;

export type CommitSubjectsOptions = {
	fetch?: Fetch;
	token?: string;
};

const logger = createLogger('Bot', 'Commits');

const commitSchema = Type.Object({ commit: Type.Object({ message: Type.String() }) });

/**
 * @description Creates a reader of commit subjects from the repository on GitHub.
 * @param options The fetch to use and an optional token, which raises the rate limit.
 * @returns The reader.
 */
export function createCommitSubjects(options: CommitSubjectsOptions = {}): CommitSubjects {
	const { fetch = globalThis.fetch, token } = options;
	const headers: Record<string, string> = {
		accept: 'application/vnd.github+json',
		...(token ? { authorization: `Bearer ${token}` } : {}),
	};

	return async (sha) => {
		const url = `${GITHUB_API}/repos/${REPOSITORY}/commits/${encodeURIComponent(sha)}`;

		try {
			const response = await fetch(url, {
				headers,
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			});

			if (!response.ok) {
				logger.warn(`Failed to read commit ${sha}: GitHub responded ${response.status}.`);

				return undefined;
			}

			const parsed = safeParse(commitSchema, await response.json());

			return parsed.success ? parsed.data.commit.message.split('\n', 1)[0] : undefined;
		} catch (error) {
			logger.warn(`Failed to read commit ${sha}:`, error);

			return undefined;
		}
	};
}

export default { createCommitSubjects };
