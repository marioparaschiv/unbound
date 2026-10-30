package main

import (
	"os"
	"regexp"
	"testing"
)

func TestAstralURLSchemeMatchesTheRelayAppAndTheClient(t *testing.T) {
	data, err := os.ReadFile("../ios/link-helper/Resources/Info.plist")
	if err != nil {
		t.Fatal(err)
	}
	info, err := readPlist(data)
	if err != nil {
		t.Fatal(err)
	}
	urlTypes := info.get("CFBundleURLTypes")
	if urlTypes == nil || len(urlTypes.values) != 1 {
		t.Fatal("the relay app must declare exactly one URL type")
	}
	schemes := urlTypes.values[0].get("CFBundleURLSchemes")
	if schemes == nil || len(schemes.values) != 1 || schemes.values[0].text != astralURLScheme {
		t.Fatalf("the relay app must claim only %q", astralURLScheme)
	}

	source, err := os.ReadFile("../../contracts/src/links.ts")
	if err != nil {
		t.Fatal(err)
	}
	match := regexp.MustCompile(`export const ASTRAL_SCHEME = '([^']*)';`).FindSubmatch(source)
	if match == nil {
		t.Fatal("contracts/src/links.ts no longer declares ASTRAL_SCHEME")
	}
	if string(match[1]) != astralURLScheme {
		t.Fatalf("ASTRAL_SCHEME is %q, the IPA patch registers %q", match[1], astralURLScheme)
	}
}
