package agent

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

// Manager Python Agent 进程管理器
type Manager struct {
	cmd   *exec.Cmd
	dir   string
	port  int
	ready bool
}

// NewManager 创建 Agent 管理器
func NewManager() *Manager {
	dir, _ := os.Getwd()
	agentDir := filepath.Join(dir, "Agent")

	return &Manager{
		dir:  agentDir,
		port: 8000,
	}
}

// Start 启动 Python Agent
func (m *Manager) Start() error {
	// 检查 Agent 目录是否存在
	if _, err := os.Stat(m.dir); os.IsNotExist(err) {
		log.Printf("[Agent] Agent 目录不存在: %s，跳过启动", m.dir)
		return nil
	}

	// 检查虚拟环境是否存在
	pythonPath := m.getPythonPath()
	if _, err := os.Stat(pythonPath); os.IsNotExist(err) {
		log.Printf("[Agent] Python 虚拟环境不存在，跳过启动")
		return nil
	}

	// 检查 .env 文件是否存在
	envFile := filepath.Join(m.dir, ".env")
	if _, err := os.Stat(envFile); os.IsNotExist(err) {
		log.Printf("[Agent] .env 文件不存在，跳过启动")
		return nil
	}

	log.Println("[Agent] 正在启动 Python Agent...")

	// 直接使用虚拟环境中的 Python，避免 shell 注入风险
	cmd := exec.Command(pythonPath, "-m", "app.main")
	cmd.Dir = m.dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	// 启动进程
	if err := cmd.Start(); err != nil {
		log.Printf("[Agent] 启动失败: %v", err)
		return err
	}

	m.cmd = cmd

	// 等待服务就绪
	go m.waitForReady()

	return nil
}

// waitForReady 等待 Python Agent 就绪
func (m *Manager) waitForReady() {
	url := fmt.Sprintf("http://localhost:%d/health", m.port)
	client := &http.Client{Timeout: 2 * time.Second}

	maxWait := 15 * time.Second
	start := time.Now()

	for time.Since(start) < maxWait {
		resp, err := client.Get(url)
		if err == nil && resp.StatusCode == 200 {
			resp.Body.Close()
			m.ready = true
			log.Printf("[Agent] Python Agent 就绪 (端口: %d)", m.port)
			return
		}
		if resp != nil {
			resp.Body.Close()
		}
		time.Sleep(500 * time.Millisecond)
	}

	log.Printf("[Agent] Python Agent 启动超时，请手动检查")
}

// Stop 停止 Python Agent
func (m *Manager) Stop() {
	if m.cmd != nil && m.cmd.Process != nil {
		log.Println("[Agent] 正在停止 Python Agent...")
		if err := m.cmd.Process.Kill(); err != nil {
			log.Printf("[Agent] 停止失败: %v", err)
		} else {
			log.Println("[Agent] Python Agent 已停止")
		}
	}
}

// IsReady 检查 Agent 是否就绪
func (m *Manager) IsReady() bool {
	return m.ready
}

// getPythonPath 获取 Python 解释器路径
func (m *Manager) getPythonPath() string {
	venvDir := filepath.Join(m.dir, ".venv")
	// Windows 和 Unix 的 Python 路径不同
	if filepath.Separator == '\\' {
		return filepath.Join(venvDir, "Scripts", "python.exe")
	}
	return filepath.Join(venvDir, "bin", "python")
}
