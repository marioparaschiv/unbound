package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

func unzip(path, destination string, runner commandRunner, root string) error {
	return runner(root, "unzip", []string{"-q", path, "-d", destination}, os.Environ(), os.Stdout, os.Stderr)
}

func unzipEntry(path, entry, destination string, runner commandRunner, root string) error {
	file, err := os.Create(destination)
	if err != nil {
		return err
	}
	defer file.Close()
	command := exec.Command("unzip", "-p", path, entry)
	command.Stdout = file
	command.Stderr = os.Stderr
	return command.Run()
}

func zipList(path string, runner commandRunner, root string) ([]string, error) {
	output, err := captureCommand(root, runner, "unzip", []string{"-Z1", path}, os.Environ())
	if err != nil {
		return nil, err
	}
	return strings.Split(strings.TrimSpace(output), "\n"), nil
}

func zipDirectory(payload, output string, runner commandRunner, root string) error {
	return runner(payload, "zip", []string{"-q", "-r", output, "Discord.app"}, os.Environ(), os.Stdout, os.Stderr)
}

func copyTree(source, destination string) error {
	return filepath.Walk(source, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		relative, err := filepath.Rel(source, path)
		if err != nil {
			return err
		}
		target := filepath.Join(destination, relative)
		if info.IsDir() {
			return os.MkdirAll(target, info.Mode().Perm())
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		return os.WriteFile(target, data, info.Mode().Perm())
	})
}
