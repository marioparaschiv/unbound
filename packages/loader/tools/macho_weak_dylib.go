package main

import (
	"bytes"
	"debug/macho"
	"encoding/binary"
	"errors"
	"fmt"
	"os"
)

const (
	machoLoadWeakDylib = 0x80000018
	machoHeaderSize64  = 32
	dylibCommandSize   = 24
)

func alignedDylibCommand(name string) []byte {
	size := dylibCommandSize + len(name) + 1
	size = (size + 7) &^ 7
	command := make([]byte, size)
	binary.LittleEndian.PutUint32(command[0:], machoLoadWeakDylib)
	binary.LittleEndian.PutUint32(command[4:], uint32(size))
	binary.LittleEndian.PutUint32(command[8:], dylibCommandSize)
	binary.LittleEndian.PutUint32(command[12:], 2)
	binary.LittleEndian.PutUint32(command[16:], 0x10000)
	binary.LittleEndian.PutUint32(command[20:], 0x10000)
	copy(command[dylibCommandSize:], name)
	return command
}

func firstSectionOffset(file *macho.File) uint32 {
	first := ^uint32(0)
	for _, section := range file.Sections {
		if section.Offset != 0 && section.Offset < first {
			first = section.Offset
		}
	}
	return first
}

func loadedDylibName(raw []byte) (string, bool) {
	if len(raw) < dylibCommandSize {
		return "", false
	}
	switch binary.LittleEndian.Uint32(raw) {
	case uint32(macho.LoadCmdDylib), machoLoadWeakDylib:
	default:
		return "", false
	}
	offset := binary.LittleEndian.Uint32(raw[8:])
	if offset >= uint32(len(raw)) {
		return "", false
	}
	name := raw[offset:]
	if end := bytes.IndexByte(name, 0); end >= 0 {
		name = name[:end]
	}
	return string(name), true
}

func machoLoadsDylib(file *macho.File, name string) bool {
	for _, load := range file.Loads {
		if loaded, ok := loadedDylibName(load.Raw()); ok && loaded == name {
			return true
		}
	}
	return false
}

func addWeakDylib(path, name string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	file, err := macho.NewFile(bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("%s is not a thin Mach-O: %w", path, err)
	}
	if file.Magic != macho.Magic64 || file.ByteOrder != binary.LittleEndian {
		return errors.New(path + " is not a little-endian 64-bit Mach-O")
	}
	if machoLoadsDylib(file, name) {
		return nil
	}
	command := alignedDylibCommand(name)
	end := machoHeaderSize64 + file.Cmdsz
	if end+uint32(len(command)) > firstSectionOffset(file) {
		return fmt.Errorf("%s has no room for another load command", path)
	}
	for _, value := range data[end : end+uint32(len(command))] {
		if value != 0 {
			return fmt.Errorf("%s has data after its load commands", path)
		}
	}
	copy(data[end:], command)
	binary.LittleEndian.PutUint32(data[16:], file.Ncmd+1)
	binary.LittleEndian.PutUint32(data[20:], file.Cmdsz+uint32(len(command)))
	return os.WriteFile(path, data, 0o755)
}
