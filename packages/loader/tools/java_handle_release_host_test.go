package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
)

func TestAndroidJavaHandleReleaseOnHost(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	sources := filepath.Join(root, "android", "module", "src", "main", "cpp")
	vendor := filepath.Join(root, "vendor")
	test := filepath.Join(root, "android", "module", "src", "test", "cpp", "java_handle_release.cpp")
	variants := [][]string{{}}
	if runtime.GOOS == "darwin" {
		variants = append(variants, []string{"-fsanitize=address,undefined"})
	}
	for index, flags := range variants {
		binary := filepath.Join(t.TempDir(), "android-java-handle-release-test")
		arguments := append([]string{"-std=c++20", "-x", "c++"}, flags...)
		arguments = append(arguments, "-I"+sources, "-I"+vendor, test, "-o", binary)
		compile := exec.Command("c++", arguments...)
		if output, err := compile.CombinedOutput(); err != nil {
			t.Fatalf("android java handle release compilation failed for variant %d: %v\n%s", index, err, output)
		}
		run := exec.Command(binary)
		run.Env = os.Environ()
		if output, err := run.CombinedOutput(); err != nil {
			t.Fatalf("android java handle release failed for variant %d: %v\n%s", index, err, output)
		}
	}
}
