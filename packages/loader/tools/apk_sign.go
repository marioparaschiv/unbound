package main

import (
	"crypto"
	"crypto/ecdsa"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/binary"
	"encoding/pem"
	"errors"
	"fmt"
	"os"
)

const (
	apkSigningBlockMagic   = "APK Sig Block 42"
	apkSignatureV2BlockID  = 0x7109871a
	apkSigRSAPKCS1SHA256   = 0x0103
	apkSigECDSASHA256      = 0x0201
	apkContentChunkSize    = 1 << 20
	apkContentChunkPrefix  = 0xa5
	apkContentDigestPrefix = 0x5a
)

type apkSigner struct {
	key         crypto.Signer
	certificate []byte
	algorithm   uint32
}

// readAPKSigner loads a private key and its certificate from one PEM file, as `openssl pkcs12 -nodes` writes it.
func readAPKSigner(path string) (apkSigner, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return apkSigner{}, err
	}
	var key crypto.Signer
	var certificates []*x509.Certificate
	for {
		var block *pem.Block
		block, data = pem.Decode(data)
		if block == nil {
			break
		}
		switch block.Type {
		case "CERTIFICATE":
			certificate, err := x509.ParseCertificate(block.Bytes)
			if err != nil {
				return apkSigner{}, fmt.Errorf("unreadable certificate: %w", err)
			}
			certificates = append(certificates, certificate)
		case "PRIVATE KEY", "RSA PRIVATE KEY", "EC PRIVATE KEY":
			key, err = parseSigningKey(block)
			if err != nil {
				return apkSigner{}, err
			}
		}
	}
	if key == nil {
		return apkSigner{}, fmt.Errorf("%s has no private key", path)
	}
	for _, certificate := range certificates {
		public, ok := certificate.PublicKey.(interface{ Equal(crypto.PublicKey) bool })
		if !ok || !public.Equal(key.Public()) {
			continue
		}
		algorithm, err := apkSignatureAlgorithm(key)
		if err != nil {
			return apkSigner{}, err
		}
		return apkSigner{key: key, certificate: certificate.Raw, algorithm: algorithm}, nil
	}
	return apkSigner{}, fmt.Errorf("%s has no certificate for its private key", path)
}

func parseSigningKey(block *pem.Block) (crypto.Signer, error) {
	var key any
	var err error
	switch block.Type {
	case "RSA PRIVATE KEY":
		key, err = x509.ParsePKCS1PrivateKey(block.Bytes)
	case "EC PRIVATE KEY":
		key, err = x509.ParseECPrivateKey(block.Bytes)
	default:
		key, err = x509.ParsePKCS8PrivateKey(block.Bytes)
	}
	if err != nil {
		return nil, fmt.Errorf("unreadable private key: %w", err)
	}
	signer, ok := key.(crypto.Signer)
	if !ok {
		return nil, errors.New("the private key cannot sign")
	}
	return signer, nil
}

func apkSignatureAlgorithm(key crypto.Signer) (uint32, error) {
	switch key.Public().(type) {
	case *rsa.PublicKey:
		return apkSigRSAPKCS1SHA256, nil
	case *ecdsa.PublicKey:
		return apkSigECDSASHA256, nil
	}
	return 0, fmt.Errorf("unsupported signing key %T", key.Public())
}

// apkSigningBlock signs the three APK sections with APK Signature Scheme v2 and returns the block that goes between entries and centralDirectory.
func apkSigningBlock(signer apkSigner, entries, centralDirectory, endOfCentralDirectory []byte) ([]byte, error) {
	eocd := append([]byte(nil), endOfCentralDirectory...)
	binary.LittleEndian.PutUint32(eocd[16:], uint32(len(entries)))
	digest := apkContentDigest(entries, centralDirectory, eocd)

	digests := lengthPrefixed(lengthPrefixed(binary.LittleEndian.AppendUint32(nil, signer.algorithm), lengthPrefixed(digest)))
	certificates := lengthPrefixed(lengthPrefixed(signer.certificate))
	signedData := concatBytes(digests, certificates, lengthPrefixed())

	hash := sha256.Sum256(signedData)
	var options crypto.SignerOpts = crypto.SHA256
	signature, err := signer.key.Sign(rand.Reader, hash[:], options)
	if err != nil {
		return nil, fmt.Errorf("Failed to sign the APK digest: %w", err)
	}
	publicKey, err := x509.MarshalPKIXPublicKey(signer.key.Public())
	if err != nil {
		return nil, err
	}
	signatures := lengthPrefixed(lengthPrefixed(binary.LittleEndian.AppendUint32(nil, signer.algorithm), lengthPrefixed(signature)))
	value := lengthPrefixed(lengthPrefixed(lengthPrefixed(signedData), signatures, lengthPrefixed(publicKey)))

	pair := binary.LittleEndian.AppendUint64(nil, uint64(4+len(value)))
	pair = binary.LittleEndian.AppendUint32(pair, apkSignatureV2BlockID)
	pair = append(pair, value...)
	size := uint64(len(pair) + 8 + len(apkSigningBlockMagic))
	block := binary.LittleEndian.AppendUint64(nil, size)
	block = append(block, pair...)
	block = binary.LittleEndian.AppendUint64(block, size)
	return append(block, apkSigningBlockMagic...), nil
}

func apkContentDigest(sections ...[]byte) []byte {
	var chunks []byte
	count := 0
	for _, section := range sections {
		for start := 0; start < len(section); start += apkContentChunkSize {
			chunk := section[start:min(start+apkContentChunkSize, len(section))]
			hash := sha256.New()
			hash.Write(binary.LittleEndian.AppendUint32([]byte{apkContentChunkPrefix}, uint32(len(chunk))))
			hash.Write(chunk)
			chunks = hash.Sum(chunks)
			count++
		}
	}
	hash := sha256.New()
	hash.Write(binary.LittleEndian.AppendUint32([]byte{apkContentDigestPrefix}, uint32(count)))
	hash.Write(chunks)
	return hash.Sum(nil)
}

func lengthPrefixed(parts ...[]byte) []byte {
	body := concatBytes(parts...)
	return append(binary.LittleEndian.AppendUint32(nil, uint32(len(body))), body...)
}

func concatBytes(parts ...[]byte) []byte {
	var out []byte
	for _, part := range parts {
		out = append(out, part...)
	}
	return out
}
