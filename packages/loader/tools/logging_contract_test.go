package main

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

func TestKotlinLogCategoriesAreCoreCategories(t *testing.T) {
	root := loaderRoot(t)
	header, err := os.ReadFile(filepath.Join(root, "core", "include", "LoaderLogCategories.h"))
	if err != nil {
		t.Fatal(err)
	}
	core := map[string]bool{}
	for _, match := range regexp.MustCompile(`#define LOG_CATEGORY_\w+\s+"([a-z]+)"`).FindAllStringSubmatch(string(header), -1) {
		core[match[1]] = true
	}
	if len(core) == 0 {
		t.Fatal("core declares no log categories")
	}

	directory := filepath.Join(root, "android", "module", "src", "main", "kotlin", "app", "unbound", "android")
	logger, err := os.ReadFile(filepath.Join(directory, "Logger.kt"))
	if err != nil {
		t.Fatal(err)
	}
	kotlin := regexp.MustCompile(`[A-Z]+\("([a-z]+)"\)`).FindAllStringSubmatch(string(logger), -1)
	if len(kotlin) == 0 {
		t.Fatal("Logger.kt declares no log categories")
	}
	for _, match := range kotlin {
		if !core[match[1]] {
			t.Errorf("Kotlin log category %q is not a core category", match[1])
		}
	}

	entries, err := os.ReadDir(directory)
	if err != nil {
		t.Fatal(err)
	}
	literal := regexp.MustCompile(`Logger\.\w+\(\s*"`)
	for _, entry := range entries {
		source, err := os.ReadFile(filepath.Join(directory, entry.Name()))
		if err != nil {
			t.Fatal(err)
		}
		if literal.Match(source) {
			t.Errorf("%s logs with a literal category", entry.Name())
		}
		if entry.Name() != "Logger.kt" && strings.Contains(string(source), "android.util.Log") {
			t.Errorf("%s bypasses Logger", entry.Name())
		}
	}
}
