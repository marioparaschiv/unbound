package main

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"errors"
	"flag"
	"fmt"
	"io"
	"strings"
)

type ipaMetadata struct {
	Version string `json:"version"`
	Build   string `json:"build"`
}

func runIPAInfo(args []string) error {
	set := flag.NewFlagSet("ipa-info", flag.ContinueOnError)
	path := set.String("ipa", "", "IPA path")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *path == "" {
		return errors.New("usage: ipa-info --ipa <path>")
	}
	metadata, err := readIPAMetadata(*path)
	if err != nil {
		return err
	}
	return printJSON(metadata)
}

func readIPAMetadata(path string) (ipaMetadata, error) {
	archive, err := zip.OpenReader(path)
	if err != nil {
		return ipaMetadata{}, err
	}
	defer archive.Close()
	var fallback *zip.File
	for _, file := range archive.File {
		if file.Name == "Payload/Discord.app/Info.plist" {
			return parseIPAMetadata(file)
		}
		if strings.HasPrefix(file.Name, "Payload/") && strings.HasSuffix(file.Name, ".app/Info.plist") && fallback == nil {
			fallback = file
		}
	}
	if fallback == nil {
		return ipaMetadata{}, errors.New("IPA contains no application Info.plist")
	}
	return parseIPAMetadata(fallback)
}

func parseIPAMetadata(file *zip.File) (ipaMetadata, error) {
	reader, err := file.Open()
	if err != nil {
		return ipaMetadata{}, err
	}
	data, readErr := io.ReadAll(reader)
	closeErr := reader.Close()
	if readErr != nil {
		return ipaMetadata{}, readErr
	}
	if closeErr != nil {
		return ipaMetadata{}, closeErr
	}
	version, err := plistString(data, "CFBundleShortVersionString")
	if err != nil {
		return ipaMetadata{}, err
	}
	build, err := plistString(data, "CFBundleVersion")
	if err != nil {
		return ipaMetadata{}, err
	}
	return ipaMetadata{Version: version, Build: build}, nil
}

func plistString(data []byte, key string) (string, error) {
	decoder := xml.NewDecoder(bytes.NewReader(data))
	for {
		token, err := decoder.Token()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return "", fmt.Errorf("could not parse Info.plist: %w", err)
		}
		start, ok := token.(xml.StartElement)
		if !ok || start.Name.Local != "key" {
			continue
		}
		var candidate string
		if err := decoder.DecodeElement(&candidate, &start); err != nil {
			return "", fmt.Errorf("could not parse Info.plist key: %w", err)
		}
		if candidate != key {
			continue
		}
		for {
			token, err = decoder.Token()
			if err != nil {
				return "", fmt.Errorf("could not parse Info.plist value: %w", err)
			}
			switch value := token.(type) {
			case xml.CharData:
				if strings.TrimSpace(string(value)) == "" {
					continue
				}
			case xml.StartElement:
				if value.Name.Local != "string" {
					return "", fmt.Errorf("Info.plist key %s is not a string", key)
				}
				var result string
				if err := decoder.DecodeElement(&result, &value); err != nil {
					return "", fmt.Errorf("could not parse Info.plist value: %w", err)
				}
				return result, nil
			}
		}
	}
	return "", fmt.Errorf("Info.plist key %s was not found", key)
}
