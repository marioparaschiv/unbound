package main

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

const hermesTag = "hermes-v250829098.0.14"

func runHermesCoreTests(root string, runner commandRunner) error {
	source := filepath.Join(root, "build", "hermes-src")
	if err := fetchHermes(root, source, runner); err != nil {
		return err
	}
	if err := requireMatchingJSI(root, source); err != nil {
		return err
	}
	buildPath := filepath.Join(root, "build", "jsi-fuzz")
	if err := runner(root, "cmake", hermesConfigureArgs(buildPath, source), os.Environ(), os.Stdout, os.Stderr); err != nil {
		return err
	}
	if err := runner(root, "cmake", []string{"--build", buildPath, "--parallel"}, os.Environ(), os.Stdout, os.Stderr); err != nil {
		return err
	}
	return runner(root, "ctest", []string{"--test-dir", buildPath, "--output-on-failure", "-R", "_hermes$"}, os.Environ(), os.Stdout, os.Stderr)
}

func fetchHermes(root, source string, runner commandRunner) error {
	if _, err := os.Stat(filepath.Join(source, "API", "jsi", "jsi", "jsi.h")); err == nil {
		return nil
	}
	if err := os.RemoveAll(source); err != nil {
		return fmt.Errorf("failed to clear the Hermes checkout %s: %w", source, err)
	}
	return runner(root, "git", []string{"clone", "--depth", "1", "--branch", hermesTag, "https://github.com/facebook/hermes.git", source}, os.Environ(), os.Stdout, os.Stderr)
}

func requireMatchingJSI(root, source string) error {
	vendored, err := os.ReadFile(filepath.Join(root, "vendor", "react", "jsi", "jsi.h"))
	if err != nil {
		return fmt.Errorf("failed to read the vendored jsi.h: %w", err)
	}
	hermes, err := os.ReadFile(filepath.Join(source, "API", "jsi", "jsi", "jsi.h"))
	if err != nil {
		return fmt.Errorf("failed to read jsi.h from %s: %w", source, err)
	}
	if !bytes.Equal(vendored, hermes) {
		return fmt.Errorf("the Hermes checkout at %s is not %s: its jsi.h differs from vendor/react/jsi/jsi.h; delete it to fetch again", source, hermesTag)
	}
	return nil
}

func hermesConfigureArgs(buildPath, source string) []string {
	args := []string{
		"-S", "core", "-B", buildPath,
		"-DUNBOUND_CORE_TESTS=ON",
		"-DUNBOUND_CORE_JSI_FUZZ=ON",
		"-DUNBOUND_HERMES_SOURCE_DIR=" + source,
		"-DCMAKE_BUILD_TYPE=Debug",
		"-DCMAKE_C_FLAGS=-fsanitize=address,undefined",
		"-DCMAKE_CXX_FLAGS=-fsanitize=address,undefined -fno-sanitize-recover=all",
	}
	if _, err := exec.LookPath("ninja"); err == nil {
		args = append(args, "-G", "Ninja")
	}
	return args
}
