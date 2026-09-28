# Python基础镜像
FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .

# Python 依赖镜像源。
#
# ⚠️ 这一步通常是整个构建里**最慢**的：langchain + langchain-community + langgraph
#    全家桶体积很大，直连 PyPI 在国内能拖十几分钟。默认走清华源。
# 海外构建 / 需要私有源：--build-arg PIP_INDEX=https://pypi.org/simple
ARG PIP_INDEX=https://pypi.tuna.tsinghua.edu.cn/simple

# 安装Python依赖
RUN pip install --no-cache-dir --index-url ${PIP_INDEX} -r requirements.txt

# 复制应用代码
COPY . .

# 创建日志目录
RUN mkdir -p logs

# 暴露端口
EXPOSE 8000

# 启动命令
#
# 刻意不用 `uvicorn app.main:app --port 8000`：端口硬编码在 Dockerfile 里，
# 而 app/main.py 的 __main__ 分支读的是 settings.AGENT_PORT —— 两处一旦不一致，
# 容器仍监听 8000，而 Go 侧 AGENT_URL 指向别处，排查成本很高。
# 走 __main__ 分支让配置说话（AGENT_PORT 默认就是 8000）。
CMD ["python", "-m", "app.main"]
