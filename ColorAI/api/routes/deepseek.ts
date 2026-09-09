/**
 * DeepSeek API 代理路由
 * - 客户端不直接存储 API Key，所有请求通过此代理转发
 * - API Key 从服务端环境变量 DEEPSEEK_API_KEY 读取
 *
 * 安全说明：
 *   - 此文件仅在服务端运行，不会暴露 API Key 给前端
 *   - 生产环境请将 DEEPSEEK_API_KEY 配置在服务器环境变量中
 */
import { Router, type Request, type Response } from 'express'
import axios from 'axios'

const router = Router()

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEFAULT_MODEL = 'deepseek-chat'
const MAX_TOKENS = 2000
const TIMEOUT_MS = 30000

router.post('/chat', async (req: Request, res: Response): Promise<void> => {
  const apiKey = process.env.DEEPSEEK_API_KEY

  if (!apiKey) {
    res.status(500).json({
      success: false,
      error: 'Server configuration error: DEEPSEEK_API_KEY not set',
    })
    return
  }

  const { messages, model } = req.body as {
    messages?: Array<{ role: string; content: string }>
    model?: string
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Invalid request: messages array is required',
    })
    return
  }

  try {
    const response = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: model || DEFAULT_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: MAX_TOKENS,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: TIMEOUT_MS,
      },
    )

    const data = response.data as {
      choices?: Array<{ message: { content: string } }>
      model?: string
      usage?: {
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
      }
    }

    if (!data?.choices?.[0]?.message?.content) {
      res.status(502).json({
        success: false,
        error: 'Invalid response from DeepSeek API',
      })
      return
    }

    res.json({
      success: true,
      choices: data.choices,
      model: data.model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    })
  } catch (error: unknown) {
    const err = error as {
      response?: {
        status?: number
        data?: { message?: string }
      }
      message?: string
    }

    if (err.response?.status) {
      res.status(err.response.status).json({
        success: false,
        error: `DeepSeek API error: ${err.response.data?.message || err.message}`,
      })
    } else {
      res.status(503).json({
        success: false,
        error: `Failed to reach DeepSeek API: ${err.message}`,
      })
    }
  }
})

export default router
