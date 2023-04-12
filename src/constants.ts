export const Invite = 'enmity' as const;

export const Links = {
  GitHub: 'https://github.com/enmity-mod',
  Twitter: 'https://twitter.com/EnmityApp'
} as const;

export const Screens = {
  General: 'ENMITY_GENERAL',
  Plugins: 'ENMITY_PLUGINS',
  Themes: 'ENMITY_THEMES',
  Updater: 'ENMITY_UPDATER',
  Custom: 'CUSTOM'
} as const;

export const Regex = {
  SemanticVersioning: /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/i
} as const;