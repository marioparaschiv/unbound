package main

import (
	"os"
	"regexp"
	"testing"
)

func TestUnboundURLSchemeMatchesTheBundlePatcherAndTheClient(t *testing.T) {
	patcher, err := os.ReadFile("../ios/bundle-patcher/sources/main.m")
	if err != nil {
		t.Fatal(err)
	}
	for _, check := range []struct{ pattern, want string }{
		{`kURLScheme\s*=\s*@"([^"]*)"`, unboundURLScheme},
		{`kURLName\s*=\s*@"([^"]*)"`, unboundURLName},
		{`kIconId\s*=\s*@"([^"]*)"`, unboundAlternateIcon},
	} {
		match := regexp.MustCompile(check.pattern).FindSubmatch(patcher)
		if match == nil || string(match[1]) != check.want {
			t.Fatalf("the jailbreak bundle patcher must use %q (pattern %s)", check.want, check.pattern)
		}
	}

	source, err := os.ReadFile("../../contracts/src/links.ts")
	if err != nil {
		t.Fatal(err)
	}
	match := regexp.MustCompile(`export const UNBOUND_SCHEME = '([^']*)';`).FindSubmatch(source)
	if match == nil {
		t.Fatal("contracts/src/links.ts no longer declares UNBOUND_SCHEME")
	}
	if string(match[1]) != unboundURLScheme {
		t.Fatalf("UNBOUND_SCHEME is %q, the IPA patch registers %q", match[1], unboundURLScheme)
	}
}
