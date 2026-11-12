package main

import (
	"archive/zip"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
)

func ipaExtensions(entries []string) map[string]struct{} {
	extensions := map[string]struct{}{}
	for _, entry := range entries {
		parts := strings.Split(entry, "/")
		if len(parts) != 5 || parts[0] != "Payload" || !strings.HasSuffix(parts[1], ".app") ||
			parts[2] != "PlugIns" || !strings.HasSuffix(parts[3], ".appex") || parts[4] != "Info.plist" {
			continue
		}
		extensions[parts[1]+"/"+strings.TrimSuffix(parts[3], ".appex")] = struct{}{}
	}
	return extensions
}

func validateIPAExtensions(sourceEntries, finalEntries []string) error {
	appName := "Discord.app"
	for _, entry := range sourceEntries {
		parts := strings.Split(entry, "/")
		if len(parts) >= 3 && parts[0] == "Payload" && strings.HasSuffix(parts[1], ".app") {
			appName = parts[1]
			break
		}
	}
	required := ipaExtensions(sourceEntries)
	required[appName+"/OpenInDiscord"] = struct{}{}
	required[appName+"/Share"] = struct{}{}
	installed := ipaExtensions(finalEntries)
	missing := []string{}
	for name := range required {
		if _, ok := installed[name]; !ok {
			missing = append(missing, name)
		}
	}
	if len(missing) == 0 {
		return nil
	}
	sort.Strings(missing)
	return fmt.Errorf("final IPA is missing required extensions: %s", strings.Join(missing, ", "))
}

func validateIPAExtensionExecutables(path string) error {
	archive, err := zip.OpenReader(path)
	if err != nil {
		return err
	}
	defer archive.Close()
	entries := make(map[string]*zip.File, len(archive.File))
	for _, file := range archive.File {
		entries[file.Name] = file
	}
	for _, file := range archive.File {
		parts := strings.Split(file.Name, "/")
		if len(parts) != 5 || parts[0] != "Payload" || !strings.HasSuffix(parts[1], ".app") ||
			parts[2] != "PlugIns" || !strings.HasSuffix(parts[3], ".appex") || parts[4] != "Info.plist" {
			continue
		}
		reader, err := file.Open()
		if err != nil {
			return fmt.Errorf("could not read extension %s: %w", parts[3], err)
		}
		info, err := os.CreateTemp("", "loader-ipa-extension-*.plist")
		if err != nil {
			reader.Close()
			return err
		}
		_, copyErr := io.Copy(info, reader)
		readCloseErr := reader.Close()
		writeCloseErr := info.Close()
		if copyErr != nil || readCloseErr != nil || writeCloseErr != nil {
			os.Remove(info.Name())
			return fmt.Errorf("could not extract extension %s Info.plist: %w", parts[3], errors.Join(copyErr, readCloseErr, writeCloseErr))
		}
		executable, readErr := plistExecutable(info.Name())
		removeErr := os.Remove(info.Name())
		if readErr != nil {
			return fmt.Errorf("could not read extension %s executable: %w", parts[3], readErr)
		}
		if removeErr != nil {
			return removeErr
		}
		if executable == "" || filepath.Base(executable) != executable {
			return fmt.Errorf("extension %s has an invalid executable name %q", parts[3], executable)
		}
		binary := strings.TrimSuffix(file.Name, "Info.plist") + executable
		if candidate := entries[binary]; candidate == nil || candidate.UncompressedSize64 == 0 {
			return fmt.Errorf("final IPA is missing executable %s", binary)
		}
	}
	return nil
}

func rejectInjectedIPA(ipa, work string, runner commandRunner) error {
	info := filepath.Join(work, "Info.plist")
	if err := unzipEntry(ipa, "Payload/*.app/Info.plist", info, runner, "."); err != nil {
		return err
	}
	executable, err := plistExecutable(info)
	if err != nil {
		return err
	}
	entries, err := zipList(ipa, runner, ".")
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if strings.HasSuffix(entry, ".app/"+executable) {
			binary := filepath.Join(work, "executable")
			if err := unzipEntry(ipa, entry, binary, runner, "."); err != nil {
				return err
			}
			output, _ := exec.Command("otool", "-L", binary).CombinedOutput()
			if strings.Contains(string(output), "Unbound.dylib") {
				return errors.New("input IPA already contains Unbound.dylib; use a clean Discord IPA")
			}
			return nil
		}
	}
	return nil
}

func verifyIPA(ipa, work string, runner commandRunner) error {
	verification := filepath.Join(work, "verify")
	if err := unzip(ipa, verification, runner, "."); err != nil {
		return err
	}
	dylib, err := findFile(filepath.Join(verification, "Payload"), "Unbound.dylib")
	if err != nil {
		return errors.New("final IPA contains no Unbound.dylib")
	}
	public, err := pinnedPublicKey()
	if err != nil {
		return err
	}
	if _, err := verifyFile(dylib, public); err != nil {
		return fmt.Errorf("final IPA contains an invalid embedded tweak attestation: %w", err)
	}
	return nil
}

func plistExecutable(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("could not read IPA executable name: %w", err)
	}
	info, err := readPlist(data)
	if err != nil {
		return "", fmt.Errorf("could not read IPA executable name: %w", err)
	}
	executable := info.get("CFBundleExecutable")
	if executable == nil || strings.TrimSpace(executable.text) == "" {
		return "", fmt.Errorf("could not read IPA executable name: %s has no CFBundleExecutable", path)
	}
	return strings.TrimSpace(executable.text), nil
}
