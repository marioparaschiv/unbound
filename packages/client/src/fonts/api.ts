import { fonts } from '~/fonts/manager';

/** Lists every installed font face. */
export const getAll = fonts.getEntities.bind(fonts);
/** Reads one installed face by id. */
export const get = fonts.getEntity.bind(fonts);
/** Installs a font by family name or link, optionally only some weights and styles. */
export const install = fonts.install.bind(fonts);
/** Removes an installed face by id. */
export const uninstall = fonts.delete.bind(fonts);
/** Points a Discord family, or a group such as `PRIMARY`, at an installed face. */
export const setOverride = fonts.setOverride.bind(fonts);
/** Gives a Discord family, or a group, back its own font. */
export const clearOverride = fonts.clearOverride.bind(fonts);
/** Lists the saved font presets. */
export const getPresets = fonts.getPresets.bind(fonts);
/** Applies a saved preset, downloading the faces it lacks. */
export const applyPreset = fonts.applyPreset.bind(fonts);
