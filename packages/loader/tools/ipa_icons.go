package main

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
)

var compiledIPAIcons = map[string]string{
	"AppIcon60x60@2x.png":      "AstralIcon60x60@2x.png",
	"AppIcon76x76@2x~ipad.png": "AstralIcon76x76@2x~ipad.png",
}

func runIPAIcons(args []string) error {
	set := flag.NewFlagSet("ipa-icons", flag.ContinueOnError)
	root := set.String("root", ".", "loader root")
	if err := set.Parse(args); err != nil {
		return err
	}
	rootPath, err := filepath.Abs(*root)
	if err != nil {
		return err
	}
	return compileIPAIcons(filepath.Join(rootPath, "tools", ipaIconDirectory), defaultRunner)
}

func compileIPAIcons(directory string, runner commandRunner) error {
	if runtime.GOOS != "darwin" {
		return errors.New("compiling the IPA icons requires macOS and Xcode")
	}
	work, err := os.MkdirTemp("", "loader-ipa-icons-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(work)
	catalog := filepath.Join(work, "Empty.xcassets")
	if err := os.MkdirAll(catalog, 0o755); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(catalog, "Contents.json"), []byte(`{"info":{"author":"xcode","version":1}}`+"\n"), 0o644); err != nil {
		return err
	}
	compiled := filepath.Join(work, "out")
	if err := os.MkdirAll(compiled, 0o755); err != nil {
		return err
	}
	args := []string{
		"actool", filepath.Join(directory, "AppIcon.icon"), catalog,
		"--compile", compiled,
		"--output-format", "human-readable-text", "--notices", "--warnings",
		"--output-partial-info-plist", filepath.Join(compiled, "partial.plist"),
		"--app-icon", "AppIcon",
		"--enable-on-demand-resources", "NO",
		"--development-region", "en",
		"--target-device", "iphone", "--target-device", "ipad",
		"--minimum-deployment-target", "18.0",
		"--platform", "iphoneos",
		"--bundle-identifier", "com.hammerandchisel.discord",
	}
	if err := runner(directory, "xcrun", args, os.Environ(), os.Stdout, os.Stderr); err != nil {
		return fmt.Errorf("actool failed: %w", err)
	}
	for source, target := range compiledIPAIcons {
		data, err := os.ReadFile(filepath.Join(compiled, source))
		if err != nil {
			return fmt.Errorf("actool did not produce %s: %w", source, err)
		}
		if err := os.WriteFile(filepath.Join(directory, target), data, 0o644); err != nil {
			return err
		}
		fmt.Println("wrote", filepath.Join(directory, target))
	}
	return nil
}
