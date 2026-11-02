import { Type, type Static } from './schema';

/** An icon the website shows for an addon: a Nucleo Micro Bold export name, such as `IconPlug`. */
export const addonIconSchema = Type.String({ pattern: /^Icon[A-Z][A-Za-z\d]*$/, maxLength: 64 });

export type AddonIcon = Static<typeof addonIconSchema>;

export default { addonIconSchema };
