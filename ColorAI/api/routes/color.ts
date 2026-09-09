import { Router, type Request, type Response } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = Router()

const uploadsDir = path.resolve(__dirname, '../../public/uploads')

const ensureUploadsDir = () => {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }
}

const colorNameMap: [RegExp, string][] = [
  [/^#[0-9a-fA-F]{2}0000$/, '红色'],
  [/^#00[0-9a-fA-F]{2}00$/, '绿色'],
  [/^#0000[0-9a-fA-F]{2}$/, '蓝色'],
  [/^#[0-9a-fA-F]{2}[0-9a-fA-F]{2}00$/, '黄色'],
  [/^#00[0-9a-fA-F]{2}[0-9a-fA-F]{2}$/, '青色'],
  [/^#[0-9a-fA-F]{2}00[0-9a-fA-F]{2}$/, '品红'],
  [/^#[0-9a-fA-F]{6}$/, '自定义色'],
]

const getColorName = (hex: string): string => {
  for (const [regex, name] of colorNameMap) {
    if (regex.test(hex)) return name
  }
  return '混合色'
}

const getColorCategory = (r: number, g: number, b: number): string => {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max - min < 20) return '中性灰'
  if (max === r && g > b * 1.3) return '暖色系'
  if (max === r) return '红色系'
  if (max === g) return '绿色系'
  if (max === b && r > g * 0.8) return '紫色系'
  return '蓝色系'
}

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const randomFloat = (min: number, max: number, decimals = 2) =>
  +(Math.random() * (max - min) + min).toFixed(decimals)

const saveUploadedFile = async (req: Request, fieldName: string): Promise<string | null> => {
  ensureUploadsDir()

  if (!req.body) return null

  const body = req.body as Record<string, unknown>
  const fileData = body[fieldName] as { data?: Buffer; name?: string; mimetype?: string } | undefined

  if (fileData && fileData.data) {
    const ext = path.extname(fileData.name || 'image.jpg') || '.jpg'
    const filename = `${Date.now()}-${fieldName}-${randomInt(1000, 9999)}${ext}`
    const filepath = path.join(uploadsDir, filename)
    fs.writeFileSync(filepath, fileData.data)
    return `/uploads/${filename}`
  }

  const fallbackFiles = (req as unknown as { files?: Record<string, { data: Buffer; name: string }> }).files
  if (fallbackFiles && fallbackFiles[fieldName]) {
    const f = fallbackFiles[fieldName]
    const ext = path.extname(f.name) || '.jpg'
    const filename = `${Date.now()}-${fieldName}-${randomInt(1000, 9999)}${ext}`
    const filepath = path.join(uploadsDir, filename)
    fs.writeFileSync(filepath, f.data)
    return `/uploads/${filename}`
  }

  return `/uploads/placeholder-${fieldName}.jpg`
}

router.post('/correct', async (req: Request, res: Response): Promise<void> => {
  const imageUrl = await saveUploadedFile(req, 'image')

  const response = {
    success: true,
    originalUrl: imageUrl,
    correctedUrl: imageUrl,
    meta: {
      brightness: randomInt(-5, 15),
      contrast: randomInt(5, 25),
      saturation: randomInt(-5, 15),
      temperature: randomInt(-15, 15),
    },
  }

  setTimeout(() => res.json(response), randomInt(500, 1500))
})

router.post('/pick', (req: Request, res: Response): void => {
  const r = randomInt(0, 255)
  const g = randomInt(0, 255)
  const b = randomInt(0, 255)
  const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()

  const response = {
    success: true,
    hex,
    rgb: { r, g, b },
    name: getColorName(hex),
    category: getColorCategory(r, g, b),
  }

  setTimeout(() => res.json(response), randomInt(200, 800))
})

router.post('/compare', async (req: Request, res: Response): Promise<void> => {
  const urlA = await saveUploadedFile(req, 'imageA')
  const urlB = await saveUploadedFile(req, 'imageB')
  const similarity = randomFloat(60, 98, 1)
  const deltaE = randomFloat(0.3, 8, 2)

  const response = {
    success: true,
    similarity,
    deltaE,
    pass: deltaE <= 3,
    images: {
      imageA: urlA,
      imageB: urlB,
    },
    details: {
      brightnessDiff: randomFloat(-10, 10, 2),
      colorDiff: randomFloat(0.5, 10, 2),
      saturationDiff: randomFloat(-8, 8, 2),
    },
  }

  setTimeout(() => res.json(response), randomInt(600, 1800))
})

router.post('/phone-correct', async (req: Request, res: Response): Promise<void> => {
  const imageUrl = await saveUploadedFile(req, 'image')

  const response = {
    success: true,
    originalUrl: imageUrl,
    visualCorrectedUrl: imageUrl,
    standardCorrectedUrl: imageUrl,
    adjustment: {
      redChannel: randomInt(-8, 12),
      greenChannel: randomInt(-10, 8),
      blueChannel: randomInt(-12, 10),
      brightness: randomInt(3, 18),
      exposureCompensation: randomFloat(0.2, 1.0, 1),
    },
  }

  setTimeout(() => res.json(response), randomInt(1000, 2200))
})

export default router
