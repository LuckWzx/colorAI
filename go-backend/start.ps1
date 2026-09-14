# ColorAI 启动脚本
# 同时启动 Python Agent 和 Go 后端

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ColorAI 服务启动脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 获取脚本所在目录
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AgentDir = Join-Path $ScriptDir "Agent"

# 检查 Python 虚拟环境
$VenvActivate = Join-Path $AgentDir ".venv\Scripts\Activate.ps1"
if (-not (Test-Path $VenvActivate)) {
    Write-Host "[错误] 未找到 Python 虚拟环境，请先运行:" -ForegroundColor Red
    Write-Host "  cd Agent; python -m venv .venv; .\.venv\Scripts\Activate; pip install -r requirements.txt" -ForegroundColor Yellow
    exit 1
}

# 检查 .env 文件
$EnvFile = Join-Path $AgentDir ".env"
if (-not (Test-Path $EnvFile)) {
    Write-Host "[错误] 未找到 Agent/.env 文件，请先配置 DEEPSEEK_API_KEY" -ForegroundColor Red
    exit 1
}

Write-Host "[1/2] 启动 Python Agent..." -ForegroundColor Green

# 在后台启动 Python Agent
$AgentProcess = Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoExit", "-Command", "cd '$AgentDir'; & '$VenvActivate'; python -m app.main" `
    -PassThru `
    -WindowStyle Minimized

Write-Host "  Python Agent 已启动 (PID: $($AgentProcess.Id))" -ForegroundColor Gray
Write-Host "  等待服务就绪..." -ForegroundColor Gray

# 等待 Python Agent 启动
$MaxWait = 10
$Count = 0
do {
    Start-Sleep -Seconds 1
    $Count++
    try {
        $Response = Invoke-WebRequest -Uri "http://localhost:8000/health" -TimeoutSec 2 -ErrorAction Stop
        if ($Response.StatusCode -eq 200) {
            Write-Host "  Python Agent 就绪!" -ForegroundColor Green
            break
        }
    } catch {
        if ($Count -ge $MaxWait) {
            Write-Host "  [警告] Python Agent 启动超时，请检查日志" -ForegroundColor Yellow
        }
    }
} while ($Count -lt $MaxWait)

Write-Host ""
Write-Host "[2/2] 启动 Go 后端..." -ForegroundColor Green
Write-Host "  按 Ctrl+C 停止所有服务" -ForegroundColor Gray
Write-Host ""

# 前台启动 Go 后端
try {
    Set-Location $ScriptDir
    & go run main.go
} finally {
    # 当 Go 后端停止时，也停止 Python Agent
    Write-Host ""
    Write-Host "正在停止 Python Agent..." -ForegroundColor Yellow
    Stop-Process -Id $AgentProcess.Id -Force -ErrorAction SilentlyContinue
    Write-Host "所有服务已停止" -ForegroundColor Green
}
