package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func provisionCyan(root string, runner commandRunner) (string, error) {
	cache := filepath.Join(root, ".tools-cache", "cyan-"+cyanCommit)
	python := filepath.Join(cache, "venv", "bin", "python3")
	binary := filepath.Join(cache, "venv", "bin", "cyan")
	if executableExists(binary) {
		return binary, nil
	}
	if err := os.MkdirAll(cache, 0o755); err != nil {
		return "", err
	}
	if err := runner(root, "python3", []string{"-m", "venv", filepath.Join(cache, "venv")}, os.Environ(), os.Stdout, os.Stderr); err != nil {
		return "", err
	}
	archive := cyanRepository + "/archive/" + cyanCommit + ".zip"
	if err := runner(root, python, []string{"-m", "pip", "install", "--disable-pip-version-check", "--force-reinstall", archive, "Pillow==" + pillowVersion}, os.Environ(), os.Stdout, os.Stderr); err != nil {
		return "", err
	}
	return binary, nil
}

func provisionSimforge(root string, runner commandRunner) (string, error) {
	cache := filepath.Join(root, ".tools-cache", "simforge-"+simforgeCommit)
	derivedData := filepath.Join(cache, "derived-data")
	product := filepath.Join(derivedData, "Build", "Products", "Release", "simforge")
	if err := os.MkdirAll(filepath.Dir(cache), 0o755); err != nil {
		return "", err
	}
	if _, err := os.Stat(cache); errors.Is(err, os.ErrNotExist) {
		if err := runner(root, "git", []string{"clone", simforgeRepository, cache}, os.Environ(), os.Stdout, os.Stderr); err != nil {
			return "", err
		}
		if err := runner(cache, "git", []string{"checkout", "--detach", simforgeCommit}, os.Environ(), os.Stdout, os.Stderr); err != nil {
			return "", err
		}
	} else if err != nil {
		return "", err
	} else {
		revision, err := gitOutput(cache, runner, "rev-parse", "HEAD")
		if err != nil {
			return "", err
		}
		if strings.TrimSpace(revision) != simforgeCommit {
			return "", fmt.Errorf("simforge cache is not at pinned commit: %s", cache)
		}
		status, err := gitOutput(cache, runner, "status", "--porcelain", "--untracked-files=no")
		if err != nil {
			return "", err
		}
		if strings.TrimSpace(status) != "" {
			return "", fmt.Errorf("simforge cache has tracked changes: %s", cache)
		}
	}
	if executableExists(product) {
		return product, nil
	}
	if err := runXcodebuild(runner, cache, []string{"-project", "simforge.xcodeproj", "-scheme", "simforge", "-configuration", "Release", "-derivedDataPath", derivedData, "MACOSX_DEPLOYMENT_TARGET=12.0", "build"}); err != nil {
		return "", err
	}
	if !executableExists(product) {
		return "", fmt.Errorf("simforge build did not produce executable: %s", product)
	}
	return product, nil
}
