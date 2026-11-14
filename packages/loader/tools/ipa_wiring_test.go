package main

import (
	"archive/zip"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func infoPlist(values map[string]string) string {
	var body strings.Builder
	for key, value := range values {
		body.WriteString("<key>" + key + "</key><string>" + value + "</string>")
	}
	return `<?xml version="1.0"?><plist version="1.0"><dict>` + body.String() + `</dict></plist>`
}

func writeIPA(t *testing.T, files map[string]string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "Discord.ipa")
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	archive := zip.NewWriter(file)
	for name, contents := range files {
		writer, err := archive.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := writer.Write([]byte(contents)); err != nil {
			t.Fatal(err)
		}
	}
	if err := archive.Close(); err != nil {
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}
	return path
}

func entitlementsPlist(groups []string) string {
	var array strings.Builder
	for _, group := range groups {
		array.WriteString("<string>" + group + "</string>")
	}
	return `<?xml version="1.0"?><plist version="1.0"><dict><key>` + appGroupsEntitlement + `</key><array>` + array.String() + `</array></dict></plist>`
}

func signWithGroups(t *testing.T, binary string, groups []string) {
	t.Helper()
	entitlements := binary + ".entitlements"
	if err := os.WriteFile(entitlements, []byte(entitlementsPlist(groups)), 0o644); err != nil {
		t.Fatal(err)
	}
	if output, err := exec.Command("codesign", "-f", "-s", "-", "--entitlements", entitlements, binary).CombinedOutput(); err != nil {
		t.Skipf("codesign unavailable: %v %s", err, output)
	}
}

func extensionBinary(t *testing.T, withRemap bool, groups ...string) string {
	t.Helper()
	if runtime.GOOS != "darwin" {
		t.Skip("needs clang")
	}
	dir := t.TempDir()
	source := filepath.Join(dir, "main.c")
	binary := filepath.Join(dir, "Share")
	if err := os.WriteFile(source, []byte("int main(void) { return 0; }\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if output, err := exec.Command("xcrun", "clang", "-arch", "arm64", "-Wl,-headerpad,0x100", "-o", binary, source).CombinedOutput(); err != nil {
		t.Skipf("clang unavailable: %v %s", err, output)
	}
	if groups != nil {
		signWithGroups(t, binary, groups)
	}
	if withRemap {
		if err := addWeakDylib(binary, groupRemapInstall); err != nil {
			t.Fatal(err)
		}
	}
	data, err := os.ReadFile(binary)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func wiredIPA(shareID, binary string, appBinary ...string) map[string]string {
	app := "Payload/Discord.app/"
	files := map[string]string{
		app + "Info.plist": infoPlist(map[string]string{
			"CFBundleIdentifier": "com.hammerandchisel.discord",
			"CFBundleExecutable": "Discord",
		}),
		app + groupRemapFramework:              "dylib",
		app + "PlugIns/Share.appex/Info.plist": infoPlist(map[string]string{"CFBundleIdentifier": shareID}),
		app + "PlugIns/Share.appex/Share":      binary,
		app + "PlugIns/OpenInDiscord.appex/Info.plist": infoPlist(map[string]string{
			"CFBundleIdentifier": "com.hammerandchisel.discord.OpenInDiscord",
		}),
	}
	if len(appBinary) > 0 {
		files[app+"Discord"] = appBinary[0]
	}
	return files
}

func TestValidateIPAExtensionWiring(t *testing.T) {
	const group = "group.com.hammerandchisel.discord"
	loaded := extensionBinary(t, true)
	plain := extensionBinary(t, false)
	grouped := extensionBinary(t, true, group)
	otherGroup := extensionBinary(t, true, "group.com.example.other")
	app := extensionBinary(t, false, group)
	for _, test := range []struct {
		name    string
		files   map[string]string
		wantErr string
	}{
		{"wired", wiredIPA("com.hammerandchisel.discord.Share", loaded), ""},
		{"foreign bundle id", wiredIPA("com.example.Share", loaded), "bundle identifier"},
		{"no group remap", wiredIPA("com.hammerandchisel.discord.Share", plain), "UnboundGroups"},
		{"shared app group", wiredIPA("com.hammerandchisel.discord.Share", grouped, app), ""},
		{"app group the app lacks", wiredIPA("com.hammerandchisel.discord.Share", otherGroup, app), "group.com.example.other"},
	} {
		t.Run(test.name, func(t *testing.T) {
			err := validateIPAExtensionWiring(writeIPA(t, test.files))
			if test.wantErr == "" && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if test.wantErr != "" && (err == nil || !strings.Contains(err.Error(), test.wantErr)) {
				t.Fatalf("want an error about %q, got %v", test.wantErr, err)
			}
		})
	}
}
