package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// s3Bucket writes to an S3-compatible bucket with path-style URLs and Signature Version 4.
type s3Bucket struct {
	endpoint  string
	region    string
	bucket    string
	accessKey string
	secretKey string
	client    *http.Client
	now       func() time.Time
}

// s3BucketFromEnv reads the public bucket the same variables build-bundle.yml uses; ok is false when S3_PUBLIC_BUCKET is unset.
func s3BucketFromEnv() (bucket s3Bucket, ok bool, err error) {
	bucket = s3Bucket{
		endpoint:  strings.TrimRight(os.Getenv("S3_ENDPOINT"), "/"),
		region:    os.Getenv("S3_REGION"),
		bucket:    os.Getenv("S3_PUBLIC_BUCKET"),
		accessKey: os.Getenv("S3_ACCESS_KEY_ID"),
		secretKey: os.Getenv("S3_SECRET_ACCESS_KEY"),
		client:    &http.Client{Timeout: 10 * time.Minute},
		now:       time.Now,
	}
	if bucket.bucket == "" {
		return s3Bucket{}, false, nil
	}
	if bucket.endpoint == "" || bucket.region == "" || bucket.accessKey == "" || bucket.secretKey == "" {
		return s3Bucket{}, false, errors.New("S3_PUBLIC_BUCKET is set but S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID or S3_SECRET_ACCESS_KEY is missing")
	}
	return bucket, true, nil
}

func (bucket s3Bucket) exists(ctx context.Context, key string) (bool, error) {
	response, err := bucket.do(ctx, http.MethodHead, key, nil, 0, emptyPayloadSHA256, "")
	if err != nil {
		return false, err
	}
	response.Body.Close()
	switch response.StatusCode {
	case http.StatusOK:
		return true, nil
	case http.StatusNotFound:
		return false, nil
	}
	return false, fmt.Errorf("HEAD %s returned HTTP %d", key, response.StatusCode)
}

func (bucket s3Bucket) putFile(ctx context.Context, key, path, contentType string) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return err
	}
	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return err
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return err
	}
	response, err := bucket.do(ctx, http.MethodPut, key, file, info.Size(), hex.EncodeToString(hash.Sum(nil)), contentType)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 2048))
		return fmt.Errorf("PUT %s returned HTTP %d: %s", key, response.StatusCode, strings.TrimSpace(string(body)))
	}
	return nil
}

const emptyPayloadSHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

func (bucket s3Bucket) do(ctx context.Context, method, key string, body io.Reader, size int64, payloadSHA256, contentType string) (*http.Response, error) {
	path := "/" + s3EscapePath(bucket.bucket) + "/" + s3EscapePath(key)
	request, err := http.NewRequestWithContext(ctx, method, bucket.endpoint+path, body)
	if err != nil {
		return nil, err
	}
	request.ContentLength = size
	if contentType != "" {
		request.Header.Set("Content-Type", contentType)
	}
	now := bucket.now().UTC()
	request.Header.Set("X-Amz-Date", now.Format("20060102T150405Z"))
	request.Header.Set("X-Amz-Content-Sha256", payloadSHA256)
	request.Header.Set("Authorization", bucket.authorization(request, path, now, payloadSHA256))
	return bucket.client.Do(request)
}

func (bucket s3Bucket) authorization(request *http.Request, path string, now time.Time, payloadSHA256 string) string {
	signedHeaders := "host;x-amz-content-sha256;x-amz-date"
	canonical := strings.Join([]string{
		request.Method,
		path,
		"",
		"host:" + request.URL.Host,
		"x-amz-content-sha256:" + payloadSHA256,
		"x-amz-date:" + request.Header.Get("X-Amz-Date"),
		"",
		signedHeaders,
		payloadSHA256,
	}, "\n")
	day := now.Format("20060102")
	scope := day + "/" + bucket.region + "/s3/aws4_request"
	digest := sha256.Sum256([]byte(canonical))
	toSign := "AWS4-HMAC-SHA256\n" + request.Header.Get("X-Amz-Date") + "\n" + scope + "\n" + hex.EncodeToString(digest[:])
	key := []byte("AWS4" + bucket.secretKey)
	for _, part := range []string{day, bucket.region, "s3", "aws4_request"} {
		key = hmacSHA256(key, part)
	}
	signature := hex.EncodeToString(hmacSHA256(key, toSign))
	return fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s", bucket.accessKey, scope, signedHeaders, signature)
}

func hmacSHA256(key []byte, data string) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(data))
	return mac.Sum(nil)
}

// s3EscapePath percent-encodes every byte of each path segment except RFC 3986 unreserved characters, as SigV4 requires.
func s3EscapePath(path string) string {
	var escaped strings.Builder
	for _, character := range []byte(path) {
		switch {
		case character >= 'A' && character <= 'Z', character >= 'a' && character <= 'z', character >= '0' && character <= '9',
			strings.IndexByte("-._~/", character) >= 0:
			escaped.WriteByte(character)
		default:
			fmt.Fprintf(&escaped, "%%%02X", character)
		}
	}
	return escaped.String()
}
