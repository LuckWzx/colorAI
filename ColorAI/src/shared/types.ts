export interface CorrectResponse {
  success: boolean
  originalUrl: string
  correctedUrl: string
  meta: {
    brightness: number
    contrast: number
    saturation: number
    temperature: number
  }
}

export interface PickResponse {
  success: boolean
  hex: string
  rgb: { r: number; g: number; b: number }
  name: string
  category: string
}

export interface CompareResponse {
  success: boolean
  similarity: number
  deltaE: number
  pass: boolean
  details: {
    brightnessDiff: number
    colorDiff: number
    saturationDiff: number
  }
}

export interface PhoneCorrectResponse {
  success: boolean
  originalUrl: string
  visualCorrectedUrl: string
  standardCorrectedUrl: string
  adjustment: {
    redChannel: number
    greenChannel: number
    blueChannel: number
    brightness: number
    exposureCompensation: number
  }
}

export interface QAItem {
  id: string
  question: string
  answer: string
  category?: string
  tags?: string[]
  level?: number
}

export interface Shop {
  id: string
  name: string
  address: string
  city: string
  phone: string
  products: string[]
  rating: number
}

export interface Brand {
  id: string
  name: string
  initial: string
  rating: number
  category: string[]
  description: string
  website: string
}
