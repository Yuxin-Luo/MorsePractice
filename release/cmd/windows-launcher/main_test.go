package main

import (
	"net"
	"strings"
	"testing"
)

// 验证 pickPort 能选到可用端口
func TestPickPort(t *testing.T) {
	ln, err := pickPort()
	if err != nil {
		t.Fatalf("pickPort failed: %v", err)
	}
	defer ln.Close()
	addr := ln.Addr().(*net.TCPAddr)
	if addr.Port == 0 {
		t.Fatal("expected non-zero port")
	}
	if !strings.HasPrefix(addr.IP.String(), "127.") {
		t.Fatalf("expected loopback, got %s", addr.IP)
	}
}

// 验证 buildURL 拼接正确
func TestBuildURL(t *testing.T) {
	url := buildURL(18765)
	if !strings.HasPrefix(url, "http://127.0.0.1:") {
		t.Fatalf("expected http://127.0.0.1:..., got %s", url)
	}
	if !strings.HasSuffix(url, "/") {
		t.Fatalf("expected trailing /, got %s", url)
	}
	if !strings.Contains(url, "18765") {
		t.Fatalf("expected port 18765, got %s", url)
	}
}