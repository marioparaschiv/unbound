// Usage: bun fake-discord.ts <port> <guild id>, run by launch.sh. Serves the Unbound guild's members
// with the seeded team roles, and `/users/{id}` for them.
import { serveDiscord, type FakeDiscordUser } from '../../../../apps/web/tests/helpers/discord';

import { GUILD_MEMBERS } from './team';

const port = Number(process.argv[2]);
const guildId = process.argv[3];

if (!Number.isInteger(port) || port <= 0 || !guildId) {
	throw new Error('Pass the port to serve the fake Discord on and the guild id it serves.');
}

const users: Record<string, FakeDiscordUser> = {};
const members: Record<string, string[]> = {};

for (const seed of GUILD_MEMBERS) {
	users[seed.id] = { username: seed.username, global_name: seed.globalName };
	members[seed.id] = seed.roleIds;
}

const discord = serveDiscord(users, { guilds: { [guildId]: members }, port });

async function stop() {
	await discord.stop();
	process.exit(0);
}

process.on('SIGTERM', () => void stop());
process.on('SIGHUP', () => void stop());

console.log(
	`fake Discord serving ${GUILD_MEMBERS.length} members of ${guildId} on ${discord.apiUrl}`,
);
