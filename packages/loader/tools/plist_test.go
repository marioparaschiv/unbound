package main

import (
	"strings"
	"testing"
)

const samplePlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleName</key>
	<string>Discord &amp; Friends</string>
	<key>LSRequiresIPhoneOS</key>
	<true/>
	<key>UIStatusBarHidden</key>
	<false/>
	<key>MinimumOSVersion</key>
	<integer>15</integer>
	<key>UIScale</key>
	<real>1.0</real>
	<key>Built</key>
	<date>2026-10-25T12:00:00Z</date>
	<key>Token</key>
	<data>AAEC</data>
	<key>UISupportedDevices</key>
	<array>
		<string>iPhone10,1</string>
	</array>
	<key>Empty</key>
	<dict/>
</dict>
</plist>
`

func TestPlistRoundTripKeepsOrderAndTypes(t *testing.T) {
	root, err := readPlist([]byte(samplePlist))
	if err != nil {
		t.Fatal(err)
	}
	output, err := writePlist(root)
	if err != nil {
		t.Fatal(err)
	}
	if string(output) != samplePlist {
		t.Fatalf("round trip changed the plist:\n%s", output)
	}
}

func TestPlistEdits(t *testing.T) {
	root, err := readPlist([]byte(samplePlist))
	if err != nil {
		t.Fatal(err)
	}
	if got := root.get("CFBundleName").text; got != "Discord & Friends" {
		t.Fatalf("unexpected name %q", got)
	}
	root.remove("UISupportedDevices")
	root.set("CFBundleName", plistText("astral"))
	root.dict("CFBundleIcons").dict("CFBundleAlternateIcons").set("AstralIcon", plistStrings("A", "B"))

	output, err := writePlist(root)
	if err != nil {
		t.Fatal(err)
	}
	text := string(output)
	for _, want := range []string{"<string>astral</string>", "<key>CFBundleAlternateIcons</key>", "<string>B</string>"} {
		if !strings.Contains(text, want) {
			t.Fatalf("missing %s in:\n%s", want, text)
		}
	}
	if strings.Contains(text, "UISupportedDevices") {
		t.Fatalf("removed key is still present:\n%s", text)
	}
}

func TestReadPlistRejectsUnbalancedDict(t *testing.T) {
	if _, err := readPlist([]byte(`<plist><dict><key>A</key><key>B</key><string>x</string></dict></plist>`)); err == nil {
		t.Fatal("expected an error for a key without a value")
	}
}
