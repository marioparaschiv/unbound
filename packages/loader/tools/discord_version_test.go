package main

import "testing"

func TestAndroidCodeForDiscordVersion(t *testing.T) {
	for _, test := range []struct {
		version string
		code    int
	}{
		{version: "350.8", code: 350008},
		{version: "350.8.0", code: 350008},
		{version: "350.8_12345", code: 350008},
	} {
		code, err := androidCodeForDiscordVersion(test.version)
		if err != nil {
			t.Fatalf("version %q failed: %v", test.version, err)
		}
		if code != test.code {
			t.Fatalf("version %q mapped to %d, want %d", test.version, code, test.code)
		}
	}
}

func TestAndroidCodeForDiscordVersionRejectsInvalidVersions(t *testing.T) {
	for _, version := range []string{"", "350", "0.8", "350.1000", "abc.8"} {
		if _, err := androidCodeForDiscordVersion(version); err == nil {
			t.Fatalf("version %q was accepted", version)
		}
	}
}

func TestDiscordVersionForAndroidCode(t *testing.T) {
	version, err := discordVersionForAndroidCode(350008)
	if err != nil {
		t.Fatal(err)
	}
	if version != "350.8" {
		t.Fatalf("version code mapped to %q, want %q", version, "350.8")
	}
}

func TestDiscordVersionForAndroidCodeRejectsInvalidCode(t *testing.T) {
	if _, err := discordVersionForAndroidCode(999); err == nil {
		t.Fatal("invalid Android version code was accepted")
	}
}
