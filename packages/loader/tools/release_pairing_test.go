package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestStableReleasesPairTheSameDiscordRelease(t *testing.T) {
	for _, test := range []struct {
		ios, requested string
		code           int
		version        string
		mismatch       string
	}{
		{ios: "351.0", code: 351011, version: "351.11"},
		{ios: "350.9", code: 350008, version: "350.8"},
		{ios: "351.0", requested: "351.0", code: 351011, version: "351.11"},
		{ios: "352.0", code: 351011, version: "351.11", mismatch: "iOS 352.0 and Android stable 351011 are different Discord releases"},
		{ios: "351.1", requested: "351.0", code: 351011, version: "351.11", mismatch: "The iOS IPA is 351.1 but the requested release is 351.0"},
	} {
		pairing, err := pairStableRelease(test.ios, test.requested, test.code)
		if err != nil {
			t.Fatal(err)
		}
		if pairing.AndroidVersion != test.version || pairing.AndroidCode != test.code || pairing.Mismatch != test.mismatch {
			t.Fatalf("pairing iOS %s with %d gave %+v", test.ios, test.code, pairing)
		}
	}
}

func TestReleasePairingFailsUnlessItIsADryRun(t *testing.T) {
	output := filepath.Join(t.TempDir(), "output")
	if err := runReleasePairing([]string{"--ios-version", "352.0", "--android-code", "351011", "--output", output}); err == nil {
		t.Fatal("a real release paired different Discord releases")
	}
	if err := runReleasePairing([]string{"--ios-version", "352.0", "--android-code", "351011", "--dry-run", "--output", output}); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(output)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), "android_code=351011\nandroid_version=351.11\n") {
		t.Fatalf("unexpected outputs %q", data)
	}
}
