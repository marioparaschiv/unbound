package main

import (
	"os"
	"path/filepath"
	"testing"
)

func writeOTAFile(t *testing.T, root, name, contents string) {
	t.Helper()
	path := filepath.Join(root, name)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(contents), 0o644); err != nil {
		t.Fatal(err)
	}
}

func readOTAFile(t *testing.T, root, name string) string {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(root, name))
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func TestSeedOTAsCopiesTheCacheIntoTheContainer(t *testing.T) {
	cache := t.TempDir()
	container := t.TempDir()
	writeOTAFile(t, cache, "351.0_abc/main.jsbundle.351.0", "bundle")
	target := &iosSmokeTarget{otaCache: cache}

	if err := target.seedOTAs(container); err != nil {
		t.Fatal(err)
	}

	if got := readOTAFile(t, containerOTAs(container), "351.0_abc/main.jsbundle.351.0"); got != "bundle" {
		t.Fatalf("seeded bundle = %q", got)
	}
}

func TestSeedOTAsSkipsAMissingCache(t *testing.T) {
	container := t.TempDir()
	target := &iosSmokeTarget{otaCache: filepath.Join(t.TempDir(), "missing")}

	if err := target.seedOTAs(container); err != nil {
		t.Fatal(err)
	}

	if _, err := os.Stat(containerOTAs(container)); !os.IsNotExist(err) {
		t.Fatalf("expected no OTA directory, got %v", err)
	}
}

func TestKeepOTAsReplacesTheCacheWithTheDownloadedUpdates(t *testing.T) {
	cache := t.TempDir()
	container := t.TempDir()
	writeOTAFile(t, cache, "350.0_old/main.jsbundle.350.0", "old")
	writeOTAFile(t, containerOTAs(container), "351.0_new/main.jsbundle.351.0", "new")
	target := &iosSmokeTarget{otaCache: cache}

	if err := target.keepOTAs(container); err != nil {
		t.Fatal(err)
	}

	if got := readOTAFile(t, cache, "351.0_new/main.jsbundle.351.0"); got != "new" {
		t.Fatalf("kept bundle = %q", got)
	}
	if _, err := os.Stat(filepath.Join(cache, "350.0_old")); !os.IsNotExist(err) {
		t.Fatalf("expected the old update to be gone, got %v", err)
	}
}
