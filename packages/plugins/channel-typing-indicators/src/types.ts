export type Channel = { id: string; guild_id?: string };
export type User = { id: string; username?: string; globalName?: string };
export type ChannelRowProps = { channel?: Channel; muted?: boolean };
