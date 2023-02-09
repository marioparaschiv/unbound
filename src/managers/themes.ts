import { Addon, Manifest, Resolveable } from '@typings/managers';
import { Constants, StyleSheet } from '@metro/common';
import { Theme as ThemeStore } from '@metro/stores';
import { forceUpdateApp } from '@api/components';
import Manager, { ManagerType } from './base';
import Patcher from '@patcher';

class Themes extends Manager {
  public original: Record<any, any>;

  constructor() {
    super(ManagerType.Themes);

    this.initialize();
  }

  override start(addon: Resolveable) {
    const entity = this.resolve(addon);
    if (!entity) return;

    Object.assign(Constants.ThemeColorMap, entity.instance.main);
    Object.assign(Constants.Colors, entity.instance.native);
    Object.assign(Constants.UNSAFE_Colors, entity.instance.misc);

    this.emit('applied', entity);
    forceUpdateApp();

    this.logger.log(`${entity.id} started.`);
  }

  initialize() {
    this.entities.set('eternal.dark-discord', {
      started: false,
      instance: {
        main: {
          "KEYBOARD": [
            "#111111",
            "#FFFFFF"
          ],
          "HEADER_PRIMARY": [
            "#FBFBFB",
            "#060607"
          ],
          "HEADER_SECONDARY": [
            "#B6B6B6",
            "#4f5660"
          ],
          "TEXT_NORMAL": [
            "#FBFBFB",
            "#2e3338"
          ],
          "TEXT_MUTED": [
            "#B6B6B6",
            "#747f8d"
          ],
          "INTERACTIVE_NORMAL": [
            "#C8C8C8",
            "#4f5660"
          ],
          "INTERACTIVE_HOVER": [
            "#DCDDDE",
            "#2e3338"
          ],
          "INTERACTIVE_ACTIVE": [
            "#FFFFFF",
            "#060607"
          ],
          "INTERACTIVE_MUTED": [
            "#747474",
            "#c7ccd1"
          ],
          "BACKGROUND_PRIMARY": [
            "#141414",
            "#ffffff"
          ],
          "BACKGROUND_SECONDARY": [
            "#111111",
            "#f2f3f5"
          ],
          "BACKGROUND_SECONDARY_ALT": [
            "#0e0e0e",
            "#ebedef"
          ],
          "BACKGROUND_TERTIARY": [
            "#0E0E0E",
            "#e3e5e8"
          ],
          "BACKGROUND_ACCENT": [
            "#292929",
            "#747f8d"
          ],
          "BACKGROUND_FLOATING": [
            "#090909",
            "#FFFFFF"
          ],
          "BACKGROUND_MOBILE_PRIMARY": [
            "#141414",
            "#f8f9f9"
          ],
          "BACKGROUND_MOBILE_SECONDARY": [
            "#111111",
            "#ffffff"
          ],
          "BACKGROUND_NESTED_FLOATING": [
            "#111111",
            "#ffffff"
          ],
          "BACKGROUND_MESSAGE_HOVER": [
            "rgba(255, 255, 255, 0.02)",
            "#FFFFFF"
          ],
          "BACKGROUND_MODIFIER_HOVER": [
            "rgba(255, 255, 255, 0.02)",
            "hsla(214, 9.9%, 50.4%, 0.08)"
          ],
          "BACKGROUND_MODIFIER_ACTIVE": [
            "rgba(255, 255, 255, 0.03)",
            "hsla(214, 9.9%, 50.4%, 0.16)"
          ],
          "BACKGROUND_MODIFIER_SELECTED": [
            "rgba(255, 255, 255, 0.04)",
            "hsla(214, 9.9%, 50.4%, 0.24)"
          ],
          "BACKGROUND_MODIFIER_ACCENT": [
            "rgba(255, 255, 255, 0.06)",
            "hsla(240, 7.7%, 2.5%, 0.08)"
          ],
          "SCROLLBAR_THIN_THUMB": [
            "#292929",
            "hsla(217, 7.6%, 33.5%, 0.3)"
          ],
          "SCROLLBAR_THIN_TRACK": [
            "transparent",
            "hsla(0, 0%, 0%, 0)"
          ],
          "SCROLLBAR_AUTO_THUMB": [
            "#292929",
            "#cccccc"
          ],
          "SCROLLBAR_AUTO_TRACK": [
            "rgba(0, 0, 0, 0.1)",
            "#f2f2f2"
          ],
          "CHANNELTEXTAREA_BACKGROUND": [
            "transparent",
            "#ebedef"
          ],
          "CHANNEL_ICON": [
            "#B6B6B6",
            "#6a7480"
          ],
          "CHANNELS_DEFAULT": [
            "#B6B6B6",
            "#6a7480"
          ]
        },
        native: {
          "PRIMARY_DARK": "#747474",
          "PRIMARY_DARK_100": "#FFFFFF",
          "PRIMARY_DARK_200": "#FFFFFF",
          "PRIMARY_DARK_300": "#B6B6B6",
          "PRIMARY_DARK_360": "#C8C8C8",
          "PRIMARY_DARK_400": "#585858",
          "PRIMARY_DARK_500": "#292929",
          "PRIMARY_DARK_600": "#111111",
          "PRIMARY_DARK_630": "#1F1F1F",
          "PRIMARY_DARK_700": "#090909",
          "PRIMARY_DARK_800": "#090909",
          "PRIMARY_DARK_900": "#090909"
        },
        misc: {
          "CHAT_GREY": "#111111"
        }
      },
      id: 'eternal.dark-discord',
      failed: false,
      data: {
        "name": "Dark Discord",
        "id": "eternal.dark-discord",
        "description": "black",
        "version": "1.0.0",
        "bundle": "http://192.168.0.35:8080/theme/theme.json",
        "authors": [
          {
            "name": "eternal",
            "id": "263689920210534400"
          }
        ]
      }
    });

    this.original = {
      main: { ...Constants.ThemeColorMap },
      native: { ...Constants.Colors },
      misc: { ...Constants.UNSAFE_Colors }
    };

    Patcher.after('themes', StyleSheet, 'createThemedStyleSheet', (_, args, res) => {
      this.on('applied', () => {
        const { mergedDarkStyles, mergedLightStyles } = StyleSheet.getThemedStylesheet(...args);
        const theme = ThemeStore.theme;

        Object.assign(res, theme === 'dark' ? mergedDarkStyles : mergedLightStyles);
      });
    });
  }

  override handleBundle(bundle: string) {
    return JSON.parse(bundle);
  }
}

export default new Themes();