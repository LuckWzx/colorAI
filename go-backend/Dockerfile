# 曲泉AI Go 后端镜像（多阶段构建）
#
# 设计要点：
#   1) 依赖层单独缓存 —— 改业务代码不会重下依赖。
#   2) CGO_ENABLED=0 静态链接 —— 运行阶段可以用 alpine，不依赖 glibc。
#   3) 只拷二进制进运行阶段 —— 源码、go 工具链、.env 都不进最终镜像。
#
# ⚠️ 本镜像不含 Python Agent。Go 启动时会去找 ./agent 目录并尝试拉起 Agent，
#    但 manager.go 有三重存在性检查（agent/ 目录、.venv、.env），容器里都不存在
#    → 只会打一行「跳过启动」日志。Agent 由 compose 作为独立服务提供。

# ===== 构建阶段 =====
# go.mod 声明 go 1.24.0，本地实测工具链是 go1.25.7 → 取 1.25 与已验证环境对齐。
FROM golang:1.25-alpine AS builder

# 国内构建走 goproxy.cn；换环境用 --build-arg GOPROXY=... 覆盖。
# GOTOOLCHAIN=local：禁止容器内自动下载别的工具链（构建要失败得快、失败得可见）。
ARG GOPROXY=https://goproxy.cn,direct
ENV GOPROXY=${GOPROXY} \
    GOTOOLCHAIN=local \
    CGO_ENABLED=0

WORKDIR /src

# 先只拷依赖清单：这一层能被缓存，改业务代码不会重下依赖
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# -trimpath 去掉本机绝对路径；-s -w 去掉符号表与调试信息（镜像更小）
RUN go build -trimpath -ldflags="-s -w" -o /out/colorai-backend .

# ===== 运行阶段 =====
FROM alpine:3.20

# ca-certificates：访问 DeepSeek / 阿里云 OSS 都走 HTTPS，缺根证书会直接 TLS 失败
# tzdata：日志时间戳要按本地时区
RUN apk add --no-cache ca-certificates tzdata

ENV TZ=Asia/Shanghai

WORKDIR /app

COPY --from=builder /out/colorai-backend /app/colorai-backend

# local 驱动时的落盘目录，同时是 Gin 静态路由 /uploads 的映射目录。
# oss 驱动下不写入，但目录缺失只会 404、不会 panic —— 建出来是为了切回 local 时
# 不用重新打镜像（PUBLIC_BASE_URL 的语义会随驱动变，记得一并改）。
RUN mkdir -p /app/uploads

# 与 config/config.go 里 PORT 的默认值一致；实际端口以环境变量 PORT 为准
EXPOSE 3001

# ⚠️ .env 刻意不烘进镜像（见 .dockerignore），改由 compose 的 env_file 在运行时注入。
#    main.go 里的 godotenv.Load() 在容器里找不到 .env 会静默失败，
#    但 compose 已把变量写进进程环境，config.go 的 getEnv 读的就是 os.Getenv —— 两条路都通。
CMD ["/app/colorai-backend"]
