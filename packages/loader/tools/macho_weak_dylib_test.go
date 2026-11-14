package main

import (
	"debug/macho"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
)

func TestAddWeakDylib(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("needs clang")
	}
	dir := t.TempDir()
	source := filepath.Join(dir, "main.c")
	binary := filepath.Join(dir, "main")
	if err := os.WriteFile(source, []byte("int main(void) { return 0; }\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if output, err := exec.Command("xcrun", "clang", "-arch", "arm64", "-Wl,-headerpad,0x100", "-o", binary, source).CombinedOutput(); err != nil {
		t.Skipf("clang unavailable: %v %s", err, output)
	}
	const name = "@rpath/UnboundGroups.dylib"
	for range 2 {
		if err := addWeakDylib(binary, name); err != nil {
			t.Fatal(err)
		}
	}
	file, err := macho.Open(binary)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	count := 0
	for _, load := range file.Loads {
		if loaded, ok := loadedDylibName(load.Raw()); ok && loaded == name {
			count++
		}
	}
	if count != 1 {
		t.Fatalf("want the dylib loaded once, got %d", count)
	}
}
