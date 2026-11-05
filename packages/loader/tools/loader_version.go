package main

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

// loaderVersionPathspec is the path set, relative to the loader root, whose commits count toward the loader version.
// It matches the paths loader-publish.yml triggers on, so every published loader change gets a new version.
var loaderVersionPathspec = []string{".", ":(exclude)docs", ":(exclude)workflow-tests", ":(exclude,glob)**/*.md", ":(exclude,glob)**/*.mdx"}

var controlVersionLine = regexp.MustCompile(`(?m)^Version:.*$`)

func runLoaderVersion(args []string) error {
	set := flag.NewFlagSet("loader-version", flag.ContinueOnError)
	root := set.String("root", ".", "loader root inside a full (not shallow) checkout")
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

// loaderVersion is ios/control's major.minor with the loader commit count as the patch, so every build of one commit
// gets the same version and each loader change a higher one.
func loaderVersion(root string) (string, error) {
	base, err := packageVersion(root)
	if err != nil {
		return "", fmt.Errorf("Failed to read the loader base version: %w", err)
	}
	parsed, err := parseSemanticVersion(base)
	if err != nil {
		return "", fmt.Errorf("Failed to parse the loader base version %s: %w", base, err)
	}
	count, err := loaderCommitCount(root)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s.%s.%d", parsed.major, parsed.minor, count), nil
}

// loaderCommitCount counts the commits up to HEAD that touch loaderVersionPathspec.
func loaderCommitCount(root string) (int, error) {
	shallow, err := gitOutput(root, defaultRunner, "rev-parse", "--is-shallow-repository")
	if err != nil {
		return 0, fmt.Errorf("Failed to inspect the checkout: %w", err)
	}
	if strings.TrimSpace(shallow) != "false" {
		return 0, errors.New("the checkout is shallow, so the loader commit count would be wrong; check out the full history (fetch-depth: 0)")
	}
	output, err := gitOutput(root, defaultRunner, append([]string{"rev-list", "--count", "HEAD", "--"}, loaderVersionPathspec...)...)
	if err != nil {
		return 0, fmt.Errorf("Failed to count the loader commits: %w", err)
	}
	count, err := strconv.Atoi(strings.TrimSpace(output))
	if err != nil || count < 1 {
		return 0, fmt.Errorf("unexpected loader commit count %q", strings.TrimSpace(output))
	}
	return count, nil
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
