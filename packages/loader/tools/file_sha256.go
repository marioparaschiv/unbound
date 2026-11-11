package main

import (
	"crypto/sha256"
	"encoding/hex"
	"io"
	"os"
	"strings"
)

// matchesSHA256 reports whether the file at path hashes to the hex digest expected, in any case.
func matchesSHA256(path, expected string) bool {
	file, err := os.Open(path)
	if err != nil {
		return false
	}
	defer file.Close()
	digest := sha256.New()
	if _, err := io.Copy(digest, file); err != nil {
		return false
	}
	return strings.EqualFold(hex.EncodeToString(digest.Sum(nil)), expected)
}
