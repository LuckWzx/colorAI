import { Router, type Request, type Response } from 'express'
import { colorIssues, photoTips, shops, brands } from '../data/knowledgeData.js'

const router = Router()

router.get('/color-issues', (req: Request, res: Response): void => {
  const keyword = (req.query.keyword as string) || ''
  let result = [...colorIssues]

  if (keyword) {
    const kw = keyword.toLowerCase()
    result = result.filter(
      (item) =>
        item.question.toLowerCase().includes(kw) ||
        item.answer.toLowerCase().includes(kw) ||
        (item.category && item.category.toLowerCase().includes(kw)) ||
        (item.tags && item.tags.some((t) => t.toLowerCase().includes(kw)))
    )
  }

  res.json({
    success: true,
    items: result,
    total: result.length,
  })
})

router.get('/photo-tips', (_req: Request, res: Response): void => {
  res.json({
    success: true,
    items: photoTips,
    total: photoTips.length,
  })
})

router.get('/shops', (req: Request, res: Response): void => {
  const city = (req.query.city as string) || 'all'
  let result = [...shops]

  if (city !== 'all' && city !== '全部城市') {
    result = result.filter((s) => s.city === city)
  }

  res.json({
    success: true,
    items: result,
    total: result.length,
  })
})

router.get('/brands', (req: Request, res: Response): void => {
  const category = (req.query.category as string) || 'all'
  let result = [...brands]

  if (category !== 'all' && category !== '全部') {
    result = result.filter((b) => b.category.includes(category))
  }

  res.json({
    success: true,
    items: result,
    total: result.length,
  })
})

export default router
