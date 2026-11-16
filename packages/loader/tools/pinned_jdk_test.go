package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNeedsPinnedJDKOnlyOnMacOutsideCI(t *testing.T) {
	env := func(values map[string]string) func(string) string {
		return func(key string) string { return values[key] }
	}

	if !needsPinnedJDK("darwin", env(nil)) {
		t.Fatal("expected macOS to use the pinned JDK")
	}

	if needsPinnedJDK("linux", env(nil)) {
		t.Fatal("expected Linux to keep its JDK")
	}

	if needsPinnedJDK("darwin", env(map[string]string{"CI": "true"})) {
		t.Fatal("expected CI to keep its JDK")
	}

	if needsPinnedJDK("darwin", env(map[string]string{"LOADER_KEEP_JAVA_HOME": "1"})) {
		t.Fatal("expected LOADER_KEEP_JAVA_HOME to keep the user's JDK")
	}
}

func TestPinnedJDKArchivesCoverMacArchitectures(t *testing.T) {
	for _, arch := range []string{"arm64", "amd64"} {
		archive, ok := pinnedJDKArchives[arch]
		if !ok || len(archive.sha256) != 64 || archive.url == "" {
			t.Fatalf("expected a pinned JDK with a sha256 for %s", arch)
		}
	}
}

func TestFileDigestHashesTheFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "file")
	if err := os.WriteFile(path, []byte("abc"), 0o600); err != nil {
		t.Fatal(err)
	}

	digest, err := fileDigest(path)
	if err != nil {
		t.Fatal(err)
	}

	if digest != "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" {
		t.Fatalf("unexpected digest %s", digest)
	}
}
