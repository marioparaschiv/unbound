package main

import (
	"archive/zip"
	"os"
	"path/filepath"
	"testing"
)

const discordInfoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleIdentifier</key>
	<string>com.hammerandchisel.discord</string>
	<key>CFBundleIcons</key>
	<dict>
		<key>CFBundlePrimaryIcon</key>
		<dict>
			<key>CFBundleIconName</key>
			<string>AppIcon</string>
		</dict>
		<key>CFBundleAlternateIcons</key>
		<dict>
			<key>AngryIcon</key>
			<dict>
				<key>CFBundleIconFiles</key>
				<array>
					<string>AngryIcon</string>
				</array>
			</dict>
		</dict>
	</dict>
	<key>CFBundleIcons~ipad</key>
	<dict>
		<key>CFBundlePrimaryIcon</key>
		<dict>
			<key>CFBundleIconName</key>
			<string>AppIcon</string>
		</dict>
	</dict>
	<key>CFBundleURLTypes</key>
	<array>
		<dict>
			<key>CFBundleURLSchemes</key>
			<array>
				<string>discord</string>
			</array>
		</dict>
	</array>
</dict>
</plist>
`

func writeTestIPA(t *testing.T, info string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "Discord.ipa")
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	writer := zip.NewWriter(file)
	entry, err := writer.Create("Payload/Discord.app/Info.plist")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := entry.Write([]byte(info)); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestCyanInputsKeepDiscordsIconsAndSchemes(t *testing.T) {
	dir := t.TempDir()
	args, icons, err := cyanInputs(writeTestIPA(t, discordInfoPlist), dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(args) != 4 || args[0] != "-l" || args[2] != "-n" || args[3] != unboundAppName {
		t.Fatalf("unexpected cyan arguments %v", args)
	}
	if len(icons) == 0 {
		t.Fatal("no alternate icon images were written")
	}
	data, err := os.ReadFile(args[1])
	if err != nil {
		t.Fatal(err)
	}
	merge, err := readPlist(data)
	if err != nil {
		t.Fatal(err)
	}
	if len(merge.keys) != 5 {
		t.Fatalf("merge plist must hold only the icon, URL and local network keys, has %v", merge.keys)
	}
	services := merge.get("NSBonjourServices").valuesOrNil()
	if len(services) != 1 || services[0].text != unboundBonjourService {
		t.Fatalf("NSBonjourServices %v must declare %q", services, unboundBonjourService)
	}
	if merge.get("NSLocalNetworkUsageDescription").text != unboundLocalNetworkUsage {
		t.Fatal("the Local Network prompt needs a usage description")
	}
	alternates := merge.get("CFBundleIcons").get("CFBundleAlternateIcons")
	if alternates.get("AngryIcon") == nil || alternates.get(unboundAlternateIcon) == nil {
		t.Fatal("cyan replaces CFBundleIcons whole, so Discord's own alternates must stay beside Unbound's")
	}
	if merge.get("CFBundleIcons").get("CFBundlePrimaryIcon") == nil {
		t.Fatal("the primary icon must survive the merge")
	}
	if merge.get("CFBundleIcons~ipad").get("CFBundleAlternateIcons").get(unboundAlternateIcon) == nil {
		t.Fatal("the iPad alternate icon is missing")
	}
	schemes := map[string]bool{}
	for _, entry := range merge.get("CFBundleURLTypes").values {
		for _, scheme := range entry.get("CFBundleURLSchemes").valuesOrNil() {
			schemes[scheme.text] = true
		}
	}
	if !schemes["discord"] || !schemes[unboundURLScheme] {
		t.Fatalf("URL schemes %v must keep Discord's and add %q", schemes, unboundURLScheme)
	}
}

func TestCyanInputsKeepDiscordsLocalNetworkDeclarations(t *testing.T) {
	info, err := readPlist([]byte(discordInfoPlist))
	if err != nil {
		t.Fatal(err)
	}
	info.set("NSBonjourServices", plistStrings("_googlecast._tcp", unboundBonjourService))
	info.set("NSLocalNetworkUsageDescription", plistText("Discord's own text"))
	data, err := writePlist(info)
	if err != nil {
		t.Fatal(err)
	}
	merged, err := mergePlist(data)
	if err != nil {
		t.Fatal(err)
	}
	merge, err := readPlist(merged)
	if err != nil {
		t.Fatal(err)
	}
	services := merge.get("NSBonjourServices").valuesOrNil()
	if len(services) != 2 || services[0].text != "_googlecast._tcp" || services[1].text != unboundBonjourService {
		t.Fatalf("cyan replaces NSBonjourServices whole, so Discord's types must stay and Unbound's appear once: %v", services)
	}
	if merge.get("NSLocalNetworkUsageDescription").text != "Discord's own text" {
		t.Fatal("Discord's usage description must win over Unbound's")
	}
}

func TestCyanInputsRejectArchivesWithoutAnApp(t *testing.T) {
	path := filepath.Join(t.TempDir(), "empty.ipa")
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := zip.NewWriter(file).Close(); err != nil {
		t.Fatal(err)
	}
	file.Close()
	if _, _, err := cyanInputs(path, t.TempDir()); err == nil {
		t.Fatal("an archive without an app was accepted")
	}
}
