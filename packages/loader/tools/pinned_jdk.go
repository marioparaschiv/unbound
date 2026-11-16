package main

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

const pinnedJDKRelease = "jdk-21.0.1+12"

type pinnedJDKArchive struct {
	url    string
	sha256 string
}

var pinnedJDKArchives = map[string]pinnedJDKArchive{
	"arm64": {
		url:    "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.1%2B12/OpenJDK21U-jdk_aarch64_mac_hotspot_21.0.1_12.tar.gz",
		sha256: "0d29257c9bcb5f20f5c4643ef9437f36b10376863eddaf6248d09093796c6b30",
	},
	"amd64": {
		url:    "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.1%2B12/OpenJDK21U-jdk_x64_mac_hotspot_21.0.1_12.tar.gz",
		sha256: "35f3cbc86d7ff0a01facefd741d5cfb675867e0a5ec137f62ba071d2511a45c9",
	},
}

func needsPinnedJDK(goos string, env func(string) string) bool {
	return goos == "darwin" && env("CI") == "" && env("LOADER_KEEP_JAVA_HOME") == ""
}

func pinnedJDKHome(cache string) string {
	return filepath.Join(cache, pinnedJDKRelease, "Contents", "Home")
}

func defaultJDKCache() string {
	if directory, err := os.UserCacheDir(); err == nil {
		return filepath.Join(directory, "unbound", "jdk")
	}

	return filepath.Join(os.TempDir(), "unbound-jdk")
}

func fileDigest(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()

	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}

	return hex.EncodeToString(hash.Sum(nil)), nil
}

func downloadPinnedJDK(archive pinnedJDKArchive, cache string) error {
	if err := os.MkdirAll(cache, 0o755); err != nil {
		return err
	}

	partial, err := os.CreateTemp(cache, "jdk-*.tar.gz")
	if err != nil {
		return err
	}
	defer os.Remove(partial.Name())

	response, err := http.Get(archive.url)
	if err != nil {
		partial.Close()

		return fmt.Errorf("failed to download the pinned JDK: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		partial.Close()

		return fmt.Errorf("failed to download the pinned JDK: HTTP %d", response.StatusCode)
	}

	if _, err := io.Copy(partial, response.Body); err != nil {
		partial.Close()

		return fmt.Errorf("failed to download the pinned JDK: %w", err)
	}

	partial.Close()

	digest, err := fileDigest(partial.Name())
	if err != nil {
		return err
	}

	if digest != archive.sha256 {
		return fmt.Errorf("the pinned JDK download has sha256 %s, expected %s", digest, archive.sha256)
	}

	command := exec.Command("tar", "-xzf", partial.Name(), "-C", cache)
	if output, err := command.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to unpack the pinned JDK: %s", output)
	}

	return nil
}

func usePinnedJDK() error {
	if !needsPinnedJDK(runtime.GOOS, os.Getenv) {
		return nil
	}

	archive, ok := pinnedJDKArchives[runtime.GOARCH]
	if !ok {
		return errors.New("no pinned JDK is known for " + runtime.GOARCH)
	}

	cache := defaultJDKCache()
	home := pinnedJDKHome(cache)

	if _, err := os.Stat(filepath.Join(home, "bin", "java")); err != nil {
		fmt.Println("loader: downloading Temurin " + pinnedJDKRelease + " for Gradle")

		if err := downloadPinnedJDK(archive, cache); err != nil {
			return err
		}
	}

	fmt.Println("loader: using Temurin " + pinnedJDKRelease + " from " + home + "; set LOADER_KEEP_JAVA_HOME=1 to keep your JAVA_HOME")

	if err := os.Setenv("JAVA_HOME", home); err != nil {
		return err
	}

	return os.Setenv("PATH", filepath.Join(home, "bin")+string(os.PathListSeparator)+os.Getenv("PATH"))
}
