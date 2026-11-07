package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
)

var controlVersionLine = regexp.MustCompile(`(?m)^Version:.*$`)

type loaderVersionManifest struct {
	Version string `json:"version"`
}

func runLoaderVersion(args []string) error {
	set := flag.NewFlagSet("loader-version", flag.ContinueOnError)
	root := set.String("root", ".", "loader root")
	stamp := set.String("set", "", "write this version into ios/control instead of printing the computed one")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *stamp != "" {
		return stampLoaderVersion(*root, *stamp)
	}
	version, err := loaderVersion(*root)
	if err != nil {
		return err
	}
	fmt.Println(version)
	return nil
}

func loaderVersion(root string) (string, error) {
	contents, err := os.ReadFile(filepath.Join(root, "version.json"))
	if err != nil {
		return "", fmt.Errorf("Failed to read the loader version: %w", err)
	}
	var manifest loaderVersionManifest
	if err := json.Unmarshal(contents, &manifest); err != nil {
		return "", fmt.Errorf("Failed to parse the loader version file: %w", err)
	}
	if _, err := parseSemanticVersion(manifest.Version); err != nil {
		return "", fmt.Errorf("invalid loader version %q: %w", manifest.Version, err)
	}
	return manifest.Version, nil
}

// stampLoaderVersion writes version into ios/control, which every build (Theos, Gradle, CMake, attestation) reads.
func stampLoaderVersion(root, version string) error {
	if _, err := parseSemanticVersion(version); err != nil {
		return fmt.Errorf("invalid loader version %q: %w", version, err)
	}
	path := filepath.Join(iosRoot(root), "control")
	contents, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	if !controlVersionLine.Match(contents) {
		return fmt.Errorf("%s has no Version line", path)
	}
	stamped := controlVersionLine.ReplaceAll(contents, []byte("Version: "+version))
	return os.WriteFile(path, stamped, 0o644)
}
