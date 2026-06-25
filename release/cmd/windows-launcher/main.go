// Morse Practice · Windows 启动器
// 启动本地静态服务器（嵌入的 web 资源）并打开默认浏览器。
// 关闭控制台窗口 = 停止服务。
package main

import (
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"runtime"
)

//go:embed all:dist
var assets embed.FS

var (
	version = "dev"
	showVer = flag.Bool("version", false, "print version and exit")
	headless = flag.Bool("headless", false, "start server without opening browser")
	port = flag.Int("port", 0, "port to listen on (0 = auto-assign)")
)

func main() {
	flag.Parse()
	if *showVer {
		fmt.Printf("morse-practice %s\n", version)
		return
	}

	// 1. 找端口
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", *port))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to listen: %v\n", err)
		os.Exit(1)
	}
	port := ln.Addr().(*net.TCPAddr).Port

	// 2. 启动静态服务器
	sub, err := fs.Sub(assets, "dist")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to access embedded assets: %v\n", err)
		os.Exit(1)
	}
	go func() {
		server := &http.Server{Handler: http.FileServer(http.FS(sub))}
		if err := server.Serve(ln); err != nil {
			fmt.Fprintf(os.Stderr, "Server stopped: %v\n", err)
		}
	}()

	// 3. 打开浏览器
	url := buildURL(port)
	fmt.Printf("Morse Practice %s 已启动：%s\n", version, url)
	fmt.Println("关闭此窗口即停止。")

	if !*headless {
		openBrowser(url)
	}

	// 4. 阻塞
	select {}
}

// pickPort 找一个可用端口（测试可见）
func pickPort() (net.Listener, error) {
	return net.Listen("tcp", "127.0.0.1:0")
}

// buildURL 拼装访问 URL（测试可见）
func buildURL(port int) string {
	return fmt.Sprintf("http://127.0.0.1:%d/", port)
}

// openBrowser 跨平台打开默认浏览器
func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default: // linux, freebsd, etc.
		cmd = exec.Command("xdg-open", url)
	}
	cmd.Start()
}