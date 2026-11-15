import { ApplicationFlags, Routes, type APIApplication, type REST } from 'discord.js';
import { createLogger } from '@unbound-app/logger';

const logger = createLogger('Bot', 'Intents');
const MEMBERS_FLAGS =
	ApplicationFlags.GatewayGuildMembers | ApplicationFlags.GatewayGuildMembersLimited;

/**
 * @description Reads whether the developer portal allows the bot the privileged members intent.
 * @param rest A REST client with the bot's token.
 * @returns Whether it is allowed; false when the application cannot be read.
 */
export async function hasMembersIntent(rest: REST): Promise<boolean> {
	try {
		const application = (await rest.get(Routes.currentApplication())) as APIApplication;

		return Boolean((application.flags ?? 0) & MEMBERS_FLAGS);
	} catch (error) {
		logger.warn('Failed to read the application flags:', error);

		return false;
	}
}

export default { hasMembersIntent };
