package main

import (
	"archive/zip"
	"os"
	"path/filepath"
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

func wiredIPA(shareID, scheme, binary string) map[string]string {
	return map[string]string{
		"Payload/Discord.app/Info.plist": infoPlist(map[string]string{"CFBundleIdentifier": "com.hammerandchisel.discord"}),
		"Payload/Discord.app/PlugIns/Share.appex/Info.plist": infoPlist(map[string]string{
			"CFBundleIdentifier": shareID,
			"CFBundleExecutable": "Share",
			"URLScheme":          scheme,
		}),
		"Payload/Discord.app/PlugIns/Share.appex/Share": binary,
		"Payload/Discord.app/PlugIns/OpenInDiscord.appex/Info.plist": infoPlist(map[string]string{
			"CFBundleIdentifier": "com.hammerandchisel.discord.OpenInDiscord",
		}),
	}
}

func TestValidateIPAExtensionWiring(t *testing.T) {
	signed := "macho" + shareAppGroup + "signature"
	for _, test := range []struct {
		name    string
		files   map[string]string
		wantErr string
	}{
		{"wired", wiredIPA("com.hammerandchisel.discord.Share", "unbound", signed), ""},
		{"foreign bundle id", wiredIPA("com.example.Share", "unbound", signed), "bundle identifier"},
		{"no scheme", wiredIPA("com.hammerandchisel.discord.Share", "", signed), "URL scheme"},
		{"no app group", wiredIPA("com.hammerandchisel.discord.Share", "unbound", "macho"), "app group"},
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
