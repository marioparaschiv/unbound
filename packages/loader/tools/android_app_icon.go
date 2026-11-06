package main

import (
	"archive/zip"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

const androidAppIconMarker = "assets/unbound/app-icon.json"

func runAndroidAppIcon(args []string) error {
	set := flag.NewFlagSet("android-app-icon", flag.ContinueOnError)
	apk := set.String("apk", "", "Discord base APK")
	icon := set.String("icon", "", "Unbound WebP icon")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *apk == "" || *icon == "" || set.NArg() != 0 {
		return errors.New("usage: android-app-icon --apk <base.apk> --icon <unbound-icon.webp>")
	}
	if err := patchDiscordAppIcon(*apk, *icon); err != nil {
		return err
	}
	fmt.Println("installed Unbound's icon in Discord's Brand Inverted launcher slot")
	return nil
}

func patchDiscordAppIcon(apkPath, iconPath string) error {
	icon, err := os.ReadFile(iconPath)
	if err != nil {
		return fmt.Errorf("read Unbound Android app icon: %w", err)
	}
	iconEntries := discordIconEntries()
	archive, err := zip.OpenReader(apkPath)
	if err != nil {
		return err
	}
	defer archive.Close()
	temporary, err := os.CreateTemp(filepath.Dir(apkPath), ".android-icon-*.apk")
	if err != nil {
		return err
	}
	temporaryPath := temporary.Name()
	defer os.Remove(temporaryPath)
	writer := zip.NewWriter(temporary)
	if err := writer.SetComment(archive.Comment); err != nil {
		return err
	}
	seen := make(map[string]bool, len(iconEntries))
	markerSeen := false
	var writeErr error
	for _, entry := range archive.File {
		if entry.Name == androidAppIconMarker {
			markerSeen = true
			if err := writeAndroidIconEntry(writer, entry.FileHeader, []byte(`{"id":"BrandInvertedIcon"}`)); err != nil {
				writeErr = err
				break
			}
			continue
		}
		if _, replace := iconEntries[entry.Name]; replace {
			seen[entry.Name] = true
			if err := writeAndroidIconEntry(writer, entry.FileHeader, icon); err != nil {
				writeErr = err
				break
			}
			continue
		}
		raw, err := entry.OpenRaw()
		if err != nil {
			writeErr = err
			break
		}
		output, err := writer.CreateRaw(&entry.FileHeader)
		if err != nil {
			writeErr = err
			break
		}
		if _, err := io.Copy(output, raw); err != nil {
			writeErr = err
			break
		}
	}
	if writeErr == nil {
		for name := range iconEntries {
			if !seen[name] {
				writeErr = fmt.Errorf("Discord base APK is missing launcher icon resource %s", name)
				break
			}
		}
	}
	if writeErr == nil && !markerSeen {
		header := &zip.FileHeader{Name: androidAppIconMarker, Method: zip.Deflate}
		writeErr = writeAndroidIconEntry(writer, *header, []byte(`{"id":"BrandInvertedIcon"}`))
	}
	closeWriterErr := writer.Close()
	closeTemporaryErr := temporary.Close()
	if writeErr != nil {
		return writeErr
	}
	if closeWriterErr != nil {
		return closeWriterErr
	}
	if closeTemporaryErr != nil {
		return closeTemporaryErr
	}
	if err := archive.Close(); err != nil {
		return err
	}
	if err := os.Rename(temporaryPath, apkPath); err != nil {
		return err
	}
	return nil
}

func writeAndroidIconEntry(writer *zip.Writer, original zip.FileHeader, content []byte) error {
	header := &zip.FileHeader{
		Name:     original.Name,
		Method:   zip.Store,
		Modified: original.Modified,
		Comment:  original.Comment,
	}
	header.SetMode(original.Mode())
	output, err := writer.CreateHeader(header)
	if err != nil {
		return err
	}
	_, err = output.Write(content)
	return err
}

func discordIconEntries() map[string]struct{} {
	entries := make(map[string]struct{}, 15)
	for _, density := range []string{"mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"} {
		for _, variant := range []string{"brand_inverted", "brand_inverted_foreground", "brand_inverted_round"} {
			entries["res/mipmap-"+density+"-v4/"+variant+".webp"] = struct{}{}
		}
	}
	return entries
}
