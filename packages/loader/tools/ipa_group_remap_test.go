package main

import "testing"

func TestStockExtensionExecutable(t *testing.T) {
	app := "Payload/Discord.app/"
	for name, want := range map[string]bool{
		app + "PlugIns/BroadcastUpload.appex/BroadcastUpload":         true,
		app + "PlugIns/NotificationService.appex/NotificationService": true,
		app + "PlugIns/Share.appex/Share":                             false,
		app + "PlugIns/OpenInDiscord.appex/OpenInDiscord":             false,
		app + "PlugIns/BroadcastUpload.appex/Info.plist":              false,
		app + "Discord": false,
	} {
		if got := stockExtensionExecutable(name, app); got != want {
			t.Errorf("%s: want %v, got %v", name, want, got)
		}
	}
}
