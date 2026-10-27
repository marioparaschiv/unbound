package main

import (
	"debug/macho"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	loadCommandVersionMinIPhoneOS = 0x25
	machoPlatformIOSSimulator     = 7
)

type legacyIPhoneOSTarget struct {
	path       string
	minimumOS  string
	sdkVersion string
}

func retargetLegacyFrameworks(app string, runner commandRunner, root string) error {
	targets, err := findLegacyIPhoneOSBinaries(filepath.Join(app, "Frameworks"))
	if err != nil {
		return err
	}
	for _, target := range targets {
		arguments := []string{"vtool", "-set-build-version", fmt.Sprint(machoPlatformIOSSimulator), target.minimumOS, target.sdkVersion, "-replace", "-output", target.path, target.path}
		if err := runner(root, "xcrun", arguments, os.Environ(), os.Stdout, os.Stderr); err != nil {
			return fmt.Errorf("retarget %s to the simulator: %w", target.path, err)
		}
	}
	return nil
}

func findLegacyIPhoneOSBinaries(frameworks string) ([]legacyIPhoneOSTarget, error) {
	var targets []legacyIPhoneOSTarget
	err := filepath.WalkDir(frameworks, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			if os.IsNotExist(err) && path == frameworks {
				return filepath.SkipDir
			}
			return err
		}
		if entry.IsDir() || strings.Contains(path, "_CodeSignature") {
			return nil
		}
		if target, ok := legacyIPhoneOSBinary(path); ok {
			targets = append(targets, target)
		}
		return nil
	})
	return targets, err
}

func legacyIPhoneOSBinary(path string) (legacyIPhoneOSTarget, bool) {
	file, err := macho.Open(path)
	if err != nil {
		return legacyIPhoneOSTarget{}, false
	}
	defer file.Close()
	for _, load := range file.Loads {
		raw := load.Raw()
		if len(raw) < 16 || file.ByteOrder.Uint32(raw[0:4]) != loadCommandVersionMinIPhoneOS {
			continue
		}
		return legacyIPhoneOSTarget{
			path:       path,
			minimumOS:  machoVersion(file.ByteOrder.Uint32(raw[8:12])),
			sdkVersion: machoVersion(file.ByteOrder.Uint32(raw[12:16])),
		}, true
	}
	return legacyIPhoneOSTarget{}, false
}

func machoVersion(encoded uint32) string {
	major := encoded >> 16
	minor := (encoded >> 8) & 0xff
	patch := encoded & 0xff
	if patch == 0 {
		return fmt.Sprintf("%d.%d", major, minor)
	}
	return fmt.Sprintf("%d.%d.%d", major, minor, patch)
}
