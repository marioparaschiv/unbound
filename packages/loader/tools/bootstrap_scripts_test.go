package main

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

func TestEveryBootstrapScriptHasAFile(t *testing.T) {
	root := loaderRoot(t)
	header, err := os.ReadFile(filepath.Join(root, "core", "include", "LoaderBootstrap.h"))
	if err != nil {
		t.Fatal(err)
	}
	names := regexp.MustCompile(`inline constexpr const char \*k\w+\s*=\s*"([^"]+)";`).FindAllStringSubmatch(string(header), -1)
	if len(names) == 0 {
		t.Fatal("core names no bootstrap scripts")
	}
	for _, name := range names {
		if _, err := os.Stat(filepath.Join(root, "bootstrap", name[1]+".js")); err != nil {
			t.Errorf("bootstrap/%s.js is missing", name[1])
		}
	}
}

func TestLoaderSourcesEmbedNoJavaScript(t *testing.T) {
	root := loaderRoot(t)
	embedded := regexp.MustCompile(`R"JS\(|"\(\(\)\s*=>|"\(function\s*\(|@"\(function\s*\(`)
	for _, directory := range []string{"core/src", "core/include", "android/module/src/main/cpp", "ios/sources", "android/module/src/main/kotlin"} {
		err := filepath.Walk(filepath.Join(root, directory), func(path string, info os.FileInfo, err error) error {
			if err != nil || info.IsDir() {
				return err
			}
			if !strings.ContainsAny(filepath.Ext(path), "chkmx") {
				return nil
			}
			contents, err := os.ReadFile(path)
			if err != nil {
				return err
			}
			if embedded.Match(contents) {
				rel, _ := filepath.Rel(root, path)
				t.Errorf("%s embeds JavaScript; move it into bootstrap/", rel)
			}
			return nil
		})
		if err != nil {
			t.Fatal(err)
		}
	}
}
