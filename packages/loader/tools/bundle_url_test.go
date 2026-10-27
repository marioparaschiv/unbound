package main

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestDefaultBundleURLCanBeOverriddenAtBuildTime(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("could not locate test source")
	}
	root := filepath.Dir(filepath.Dir(filename))
	for path, required := range map[string][]string{
		"core/include/LoaderUpdater.h": {
			"#ifndef UNBOUND_DEFAULT_BUNDLE_URL\n#define UNBOUND_DEFAULT_BUNDLE_URL \"https://builds.unbound.rip/\"\n#endif",
			"constexpr const char *kDefaultBundleBaseURL  = UNBOUND_DEFAULT_BUNDLE_URL;",
		},
		"ios/Makefile": {
			"ifneq ($(strip $(UNBOUND_BUNDLE_URL)),)",
			`COMMON_FLAGS += -DUNBOUND_DEFAULT_BUNDLE_URL='"$(UNBOUND_BUNDLE_URL)"'`,
		},
		"android/module/src/main/cpp/CMakeLists.txt": {
			"if(UNBOUND_BUNDLE_URL)",
			`add_compile_definitions(UNBOUND_DEFAULT_BUNDLE_URL="${UNBOUND_BUNDLE_URL}")`,
		},
		"android/module/build.gradle.kts": {
			`providers.gradleProperty("unboundBundleURL")`,
			`"-DUNBOUND_BUNDLE_URL=${bundleURL.orEmpty()}"`,
			"unboundBundleURL must be an https URL ending in /",
		},
	} {
		data, err := os.ReadFile(filepath.Join(root, path))
		if err != nil {
			t.Fatal(err)
		}
		for _, snippet := range required {
			if !strings.Contains(string(data), snippet) {
				t.Errorf("%s is missing %q", path, snippet)
			}
		}
	}
	cmake, err := os.ReadFile(filepath.Join(root, "android/module/src/main/cpp/CMakeLists.txt"))
	if err != nil {
		t.Fatal(err)
	}
	definition := strings.Index(string(cmake), "add_compile_definitions(UNBOUND_DEFAULT_BUNDLE_URL")
	core := strings.Index(string(cmake), "add_subdirectory(${UNBOUND_REPOSITORY_ROOT}/core")
	if definition < 0 || core < definition {
		t.Fatal("the bundle URL must be defined before the shared core is added")
	}
}
