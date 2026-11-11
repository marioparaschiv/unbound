package main

import (
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"testing"
)

func TestAndroidLoaderRequiresEveryCachedCallback(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	source, err := os.ReadFile(filepath.Join(root, "android", "module", "src", "main", "cpp", "Entry.cpp"))
	if err != nil {
		t.Fatal(err)
	}
	body := regexp.MustCompile(`(?s)static bool cacheCallbacks\(.*?\n}\n`).FindString(string(source))
	check := strings.Index(body, "return !clearPendingException")
	if check == -1 {
		t.Fatal("cacheCallbacks no longer ends by checking its cached callbacks")
	}
	required := map[string]bool{}
	for _, match := range regexp.MustCompile(`gCallbacks\.(\w+)`).FindAllStringSubmatch(body[check:], -1) {
		required[match[1]] = true
	}
	cached := regexp.MustCompile(`gCallbacks\.(\w+)\s*=\s*env->GetStaticMethodID`).FindAllStringSubmatch(body[:check], -1)
	if len(cached) == 0 {
		t.Fatal("cacheCallbacks caches no static callbacks")
	}
	for _, match := range cached {
		if !required[match[1]] {
			t.Errorf("cacheCallbacks caches %s but never checks it was found", match[1])
		}
	}
}
