package main

import (
	"errors"
	"strings"
)

// discordVersionKey keeps Discord's own short version in a sideloaded IPA's Info.plist. The loader puts it back
// in memory before Discord reads its version, so Discord's OTA updates and the version it reports stay right.
const discordVersionKey = "UnboundDiscordVersion"

// setSideloadVersion gives the IPA a short version naming both Discord and the loader, such as 353.0_1.5.0.
// AltStore, SideStore and Feather show and compare that string, so a loader-only rebuild reads as a new version.
func setSideloadVersion(info, merge *plistNode, loader string) error {
	discord := info.get("CFBundleShortVersionString")
	if discord == nil || discord.text == "" {
		return errors.New("Info.plist has no CFBundleShortVersionString")
	}

	if strings.Contains(discord.text, "_") {
		return errors.New("Info.plist already carries a loader version: " + discord.text)
	}

	merge.set("CFBundleShortVersionString", plistText(discord.text+"_"+loader))
	merge.set(discordVersionKey, plistText(discord.text))

	return nil
}
