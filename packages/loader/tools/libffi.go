package main

import (
	"bytes"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

func runLibFFIBuild(args []string) error {
	releaseBuildLock, err := acquireLibFFIBuildLock("/tmp/unbound-loader-libffi-build.lock")
	if err != nil {
		return err
	}
	defer releaseBuildLock()

	set := flag.NewFlagSet("libffi-build", flag.ContinueOnError)
	root := set.String("root", ".", "repository root")
	archive := set.String("archive", "", "output static archive")
	include := set.String("include", "", "output include directory")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *archive == "" || *include == "" {
		return errors.New("usage: libffi-build --archive <path> --include <path>")
	}
	rootPath, err := filepath.Abs(*root)
	if err != nil {
		return err
	}
	archivePath, err := filepath.Abs(*archive)
	if err != nil {
		return err
	}
	includePath, err := filepath.Abs(*include)
	if err != nil {
		return err
	}
	sourcePath := filepath.Join(rootPath, "vendor", "libffi")
	if _, err := os.Stat(filepath.Join(sourcePath, ".git")); err != nil {
		return fmt.Errorf("libffi submodule is unavailable: %w", err)
	}
	revision, err := commandOutput(rootPath, "git", "-C", sourcePath, "rev-parse", "HEAD")
	if err != nil {
		return err
	}
	buildKey := libFFIBuildKey(strings.TrimSpace(string(revision)))
	if libFFIUpToDate(archivePath, includePath, buildKey) {
		fmt.Println("libffi is up to date")
		return nil
	}
	buildPath, err := os.MkdirTemp("", "unbound-libffi-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(buildPath)
	archiveBytes, err := commandOutput(rootPath, "git", "-C", sourcePath, "archive", "--format=tar", "HEAD")
	if err != nil {
		return err
	}
	if err := runCommand(buildPath, bytes.NewReader(archiveBytes), io.Discard, os.Stderr, "tar", "-x", "-C", buildPath); err != nil {
		return err
	}
	if err := runCommand(buildPath, nil, os.Stdout, os.Stderr, "autoreconf", "-i", "-f", "-v"); err != nil {
		return err
	}
	buildMachine, err := commandOutput(buildPath, "uname", "-m")
	if err != nil {
		return err
	}
	for _, arch := range []string{"arm64", "arm64e"} {
		if err := buildLibFFIArch(buildPath, strings.TrimSpace(string(buildMachine)), arch); err != nil {
			return err
		}
	}
	if err := os.MkdirAll(filepath.Join(buildPath, "include"), 0o755); err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(archivePath), 0o755); err != nil {
		return err
	}
	if err := os.MkdirAll(includePath, 0o755); err != nil {
		return err
	}
	arm64Archive := filepath.Join(buildPath, "build_iphoneos-arm64", ".libs", "libffi.a")
	arm64eArchive := filepath.Join(buildPath, "build_iphoneos-arm64e", ".libs", "libffi.a")
	if err := runCommand(buildPath, nil, os.Stdout, os.Stderr, "xcrun", "lipo", "-create", arm64Archive, arm64eArchive, "-output", archivePath); err != nil {
		return err
	}
	for _, name := range libFFIHeaders {
		source := filepath.Join(buildPath, "build_iphoneos-arm64", "include", name)
		if name == "fficonfig.h" {
			source = filepath.Join(buildPath, "build_iphoneos-arm64", name)
		}
		if err := copyFile(source, filepath.Join(includePath, name)); err != nil {
			return err
		}
	}
	return os.WriteFile(libFFIStampPath(archivePath), []byte(buildKey), 0o644)
}

var libFFIHeaders = []string{"ffi.h", "ffitarget.h", "fficonfig.h"}

func libFFIBuildKey(revision string) string {
	return strings.Join(append([]string{revision, "arm64,arm64e"}, libFFIConfigureArgs("build")...), "\n")
}

func libFFIStampPath(archivePath string) string {
	return archivePath + ".stamp"
}

func libFFIUpToDate(archivePath, includePath, buildKey string) bool {
	stamp, err := os.ReadFile(libFFIStampPath(archivePath))
	if err != nil || string(stamp) != buildKey {
		return false
	}
	for _, path := range append([]string{archivePath}, prefixPaths(includePath, libFFIHeaders)...) {
		if info, err := os.Stat(path); err != nil || info.Size() == 0 {
			return false
		}
	}
	return true
}

func prefixPaths(directory string, names []string) []string {
	paths := make([]string, 0, len(names))
	for _, name := range names {
		paths = append(paths, filepath.Join(directory, name))
	}
	return paths
}

func acquireLibFFIBuildLock(lockPath string) (func(), error) {
	lockFile, err := os.OpenFile(lockPath, os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return nil, err
	}

	deadline := time.Now().Add(15 * time.Minute)
	for {
		if err := syscall.Flock(int(lockFile.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err == nil {
			return func() {
				_ = syscall.Flock(int(lockFile.Fd()), syscall.LOCK_UN)
				_ = lockFile.Close()
			}, nil
		} else if !errors.Is(err, syscall.EWOULDBLOCK) && !errors.Is(err, syscall.EAGAIN) {
			_ = lockFile.Close()
			return nil, err
		}
		if time.Now().After(deadline) {
			_ = lockFile.Close()
			return nil, fmt.Errorf("timed out waiting for libffi build lock %s", lockFile.Name())
		}
		time.Sleep(100 * time.Millisecond)
	}
}

func buildLibFFIArch(root, buildMachine, arch string) error {
	buildDirectory := filepath.Join(root, "build_iphoneos-"+arch)
	if err := os.MkdirAll(buildDirectory, 0o755); err != nil {
		return err
	}
	configure := exec.Command("../configure", libFFIConfigureArgs(buildMachine)...)
	configure.Dir = buildDirectory
	configure.Env = append(os.Environ(),
		"CC=xcrun -sdk iphoneos clang -target arm64-apple-ios",
		"LD=xcrun -sdk iphoneos ld -target arm64-apple-ios",
		"CFLAGS=-miphoneos-version-min=7.0 -fembed-bitcode -arch "+arch,
	)
	configure.Stdout = os.Stdout
	configure.Stderr = os.Stderr
	if err := configure.Run(); err != nil {
		return fmt.Errorf("configure %s failed: %w", arch, err)
	}
	if err := clearLibFFIConfigurePlaceholders(buildDirectory); err != nil {
		return err
	}
	if err := runLibFFIMake(buildDirectory); err != nil {
		return err
	}
	archive := filepath.Join(buildDirectory, ".libs", "libffi.a")
	if _, err := os.Stat(archive); err != nil {
		return fmt.Errorf("libffi %s build did not produce %s: %w", arch, archive, err)
	}
	return nil
}

func libFFIConfigureArgs(buildMachine string) []string {
	return []string{
		"--disable-multi-os-directory",
		"--host=arm64-apple-ios",
		"--build=" + buildMachine + "-apple-darwin",
	}
}

func clearLibFFIConfigurePlaceholders(buildDirectory string) error {
	archivePlaceholder := filepath.Join(buildDirectory, "libffi.la")
	if err := os.Remove(archivePlaceholder); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return filepath.WalkDir(filepath.Join(buildDirectory, "src"), func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".lo" {
			return nil
		}
		if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
		return nil
	})
}

func libFFIMakeArgs() []string {
	return []string{"-B", "-o", "config.status", "-j4", "libffi.la"}
}

func runLibFFIMake(buildDirectory string) error {
	command := exec.Command("make", libFFIMakeArgs()...)
	command.Dir = buildDirectory
	command.Env = libFFIMakeEnvironment(os.Environ())
	command.Stdout = os.Stdout
	command.Stderr = os.Stderr
	if err := command.Run(); err != nil {
		return fmt.Errorf("libffi make failed: %w", err)
	}
	return nil
}

func libFFIMakeEnvironment(environment []string) []string {
	filtered := make([]string, 0, len(environment))
	for _, variable := range environment {
		name, _, _ := strings.Cut(variable, "=")
		switch name {
		case "MAKEFLAGS", "MFLAGS", "GNUMAKEFLAGS", "MAKEOVERRIDES", "MAKELEVEL":
			continue
		}
		filtered = append(filtered, variable)
	}
	return filtered
}

func commandOutput(dir, name string, args ...string) ([]byte, error) {
	command := exec.Command(name, args...)
	command.Dir = dir
	output, err := command.Output()
	if err != nil {
		return nil, fmt.Errorf("%s failed: %w", name, err)
	}
	return output, nil
}

func runCommand(dir string, stdin io.Reader, stdout, stderr io.Writer, name string, args ...string) error {
	command := exec.Command(name, args...)
	command.Dir = dir
	command.Stdin = stdin
	command.Stdout = stdout
	command.Stderr = stderr
	if err := command.Run(); err != nil {
		return fmt.Errorf("%s failed: %w", name, err)
	}
	return nil
}

func copyFile(source, destination string) error {
	input, err := os.Open(source)
	if err != nil {
		return err
	}
	defer input.Close()
	output, err := os.Create(destination)
	if err != nil {
		return err
	}
	if _, err := io.Copy(output, input); err != nil {
		output.Close()
		return err
	}
	return output.Close()
}
