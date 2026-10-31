package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const discordInfoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
	<key>CFBundleName</key>
	<string>Discord</string>
	<key>CFBundleDisplayName</key>
	<string>Discord</string>
	<key>CFBundleIcons</key>
	<dict>
		<key>CFBundlePrimaryIcon</key>
		<dict/>
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
	<key>UISupportedDevices</key>
	<array>
		<string>iPhone10,1</string>
	</array>
</dict>
</plist>
`

func writeTestIPA(t *testing.T, entries map[string]string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "Discord.ipa")
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	archive := zip.NewWriter(file)
	for name, content := range entries {
		writer, err := archive.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := writer.Write([]byte(content)); err != nil {
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

func readTestIPA(t *testing.T, path string) map[string]string {
	t.Helper()
	archive, err := zip.OpenReader(path)
	if err != nil {
		t.Fatal(err)
	}
	defer archive.Close()
	entries := map[string]string{}
	for _, file := range archive.File {
		reader, err := file.Open()
		if err != nil {
			t.Fatal(err)
		}
		data, err := io.ReadAll(reader)
		reader.Close()
		if err != nil {
			t.Fatal(err)
		}
		entries[file.Name] = string(data)
	}
	return entries
}

func TestPatchIPA(t *testing.T) {
	app := "Payload/Discord.app/"
	modules := app + pnpmModules
	input := writeTestIPA(t, map[string]string{
		app + "Info.plist":    discordInfoPlist,
		app + "Discord":       "binary",
		app + "manifest.json": `{"metadata":{"build":"1"},"hashes":{"assets/_node_modules/.pnpm/@react-navigation+elements@2.0.0/x.png":"abc","other.png":"def"},"extra":true}`,
		modules + "@react-navigation+elements@2.0.0/node_modules/x.png": "x",
		modules + "react@19.0.0/index.js":                               "react",
	})
	output := filepath.Join(t.TempDir(), "out", "Patched.ipa")
	if err := patchIPA(input, output); err != nil {
		t.Fatal(err)
	}
	entries := readTestIPA(t, output)

	if entries[app+"Discord"] != "binary" || entries[modules+"react@19.0.0/index.js"] != "react" {
		t.Fatal("unchanged entries were not copied")
	}
	if entries[modules+patchedReactNavigation+"/node_modules/x.png"] != "x" {
		t.Fatalf("React Navigation module was not renamed: %v", keys(entries))
	}
	for _, icon := range []string{"UnboundIcon60x60@2x.png", "UnboundIcon76x76@2x~ipad.png"} {
		if entries[app+icon] == "" {
			t.Fatalf("missing icon %s", icon)
		}
	}

	var manifest map[string]any
	if err := json.Unmarshal([]byte(entries[app+"manifest.json"]), &manifest); err != nil {
		t.Fatal(err)
	}
	hashes := manifest["hashes"].(map[string]any)
	if hashes["assets/_node_modules/.pnpm/"+patchedReactNavigation+"/x.png"] != "abc" || hashes["other.png"] != "def" {
		t.Fatalf("manifest hashes were not renamed: %v", hashes)
	}
	if manifest["extra"] != true {
		t.Fatal("manifest lost fields it does not patch")
	}

	info, err := readPlist([]byte(entries[app+"Info.plist"]))
	if err != nil {
		t.Fatal(err)
	}
	if info.get("UISupportedDevices") != nil {
		t.Fatal("supported devices were kept")
	}
	if info.get("CFBundleName").text != unboundAppName || info.get("CFBundleDisplayName").text != unboundAppName {
		t.Fatal("app name was not set")
	}
	if info.get("UIFileSharingEnabled").kind != plistTrueKind || info.get("UISupportsDocumentBrowser").kind != plistTrueKind {
		t.Fatal("file access was not enabled")
	}
	phone := info.get("CFBundleIcons").get("CFBundleAlternateIcons").get(unboundAlternateIcon).get("CFBundleIconFiles")
	pad := info.get("CFBundleIcons~ipad").get("CFBundleAlternateIcons").get(unboundAlternateIcon).get("CFBundleIconFiles")
	if len(phone.values) != 1 || len(pad.values) != 2 {
		t.Fatal("alternate icons were not added")
	}
	if info.get("CFBundleIcons").get("CFBundlePrimaryIcon") == nil {
		t.Fatal("existing icon entries were dropped")
	}
	urlTypes := info.get("CFBundleURLTypes").values
	if len(urlTypes) != 2 || urlTypes[1].get("CFBundleURLSchemes").values[0].text != unboundURLScheme {
		t.Fatal("URL scheme was not appended")
	}
}

func TestPatchIPAKeepsOnlyThePayload(t *testing.T) {
	input := writeTestIPA(t, map[string]string{
		"Payload/Discord.app/Info.plist":       discordInfoPlist,
		"iTunesMetadata.plist":                 "purchaser",
		"META-INF/com.apple.ZipMetadata.plist": "metadata",
	})
	output := filepath.Join(t.TempDir(), "out.ipa")
	if err := patchIPA(input, output); err != nil {
		t.Fatal(err)
	}
	for name := range readTestIPA(t, output) {
		if !strings.HasPrefix(name, "Payload/") {
			t.Fatalf("kept %s outside the payload", name)
		}
	}
}

func TestPatchIPAIsIdempotent(t *testing.T) {
	app := "Payload/Discord.app/"
	input := writeTestIPA(t, map[string]string{app + "Info.plist": discordInfoPlist})
	once := filepath.Join(t.TempDir(), "once.ipa")
	twice := filepath.Join(t.TempDir(), "twice.ipa")
	if err := patchIPA(input, once); err != nil {
		t.Fatal(err)
	}
	if err := patchIPA(once, twice); err != nil {
		t.Fatal(err)
	}
	first := readTestIPA(t, once)
	second := readTestIPA(t, twice)
	if first[app+"Info.plist"] != second[app+"Info.plist"] {
		t.Fatal("patching twice changed Info.plist again")
	}
	if len(first) != len(second) {
		t.Fatalf("patching twice changed the entry count: %d != %d", len(first), len(second))
	}
}

func TestPatchIPARejectsArchivesWithoutAnApp(t *testing.T) {
	input := writeTestIPA(t, map[string]string{"README": "not an ipa"})
	err := patchIPA(input, filepath.Join(t.TempDir(), "out.ipa"))
	if err == nil || !strings.Contains(err.Error(), "Info.plist") {
		t.Fatalf("expected a missing Info.plist error, got %v", err)
	}
}

func TestPatchIPAKeepsCompressedDirectoryEntries(t *testing.T) {
	input := writeTestIPA(t, map[string]string{
		"Payload/Resources":              "",
		"Payload/Discord.app/Info.plist": discordInfoPlist,
	})
	data, err := os.ReadFile(input)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(input, bytes.ReplaceAll(data, []byte("Payload/Resources"), []byte("Payload/Resource/")), 0o644); err != nil {
		t.Fatal(err)
	}
	output := filepath.Join(t.TempDir(), "out.ipa")
	if err := patchIPA(input, output); err != nil {
		t.Fatal(err)
	}
	archive, err := zip.OpenReader(output)
	if err != nil {
		t.Fatal(err)
	}
	defer archive.Close()
	for _, file := range archive.File {
		if file.Name == "Payload/Resource/" {
			if !file.Mode().IsDir() && file.UncompressedSize64 != 0 {
				t.Fatalf("directory entry was not kept as a directory: %v", file.Mode())
			}
			return
		}
	}
	t.Fatal("directory entry was dropped")
}

func TestRenamePnpmModule(t *testing.T) {
	modules := "Payload/Discord.app/" + pnpmModules
	cases := map[string]string{
		modules + "@react-navigation+elements@2.0.0/":        modules + patchedReactNavigation + "/",
		modules + "@react-navigation+elements@2.0.0/a/b.js":  modules + patchedReactNavigation + "/a/b.js",
		modules + "@react-navigation+native@7.0.0/a.js":      modules + "@react-navigation+native@7.0.0/a.js",
		"Payload/Discord.app/@react-navigation+elements.txt": "Payload/Discord.app/@react-navigation+elements.txt",
	}
	for input, want := range cases {
		if got := renamePnpmModule(input, modules); got != want {
			t.Fatalf("renamePnpmModule(%q) = %q, want %q", input, got, want)
		}
	}
}

func keys(entries map[string]string) []string {
	names := make([]string, 0, len(entries))
	for name := range entries {
		names = append(names, name)
	}
	return names
}
