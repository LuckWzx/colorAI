import axios from 'axios';

export interface CorrectResponse {
  success: boolean;
  correctedImageUrl: string;
  originalImageUrl: string;
  stats: {
    brightnessDelta: number;
    contrastDelta: number;
    saturationDelta: number;
  };
  processingTime: number;
}

export interface PickResponse {
  success: boolean;
  color: {
    hex: string;
    rgb: { r: number; g: number; b: number };
    hsl: { h: number; s: number; l: number };
    name: string;
  };
  position: { x: number; y: number };
}

export interface CompareResponse {
  success: boolean;
  similarity: number;
  deltaE: number;
  differences: {
    brightness: number;
    contrast: number;
    saturation: number;
    temperature: number;
  };
  reportUrl: string;
}

export interface PhoneCorrectResponse {
  success: boolean;
  correctedImageUrl: string;
  device: string;
  scene: string;
  whiteBalance: number;
  colorTemperature: number;
  processingTime: number;
}

export interface QAItem {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  updatedAt: string;
}

export interface Shop {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  rating: number;
  specialties: string[];
  distance?: number;
}

export interface Brand {
  id: string;
  name: string;
  category: string;
  description: string;
  logo: string;
  products: string[];
}

const isBrowser = typeof window !== 'undefined';

const apiClient = axios.create({
  baseURL: isBrowser ? '/api' : 'http://localhost:3001/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：自动携带 token
apiClient.interceptors.request.use((config) => {
  if (isBrowser) {
    const raw = localStorage.getItem('colorai_auth');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const token = parsed?.state?.token;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch { /* ignore */ }
    }
  }
  return config;
});

// 响应拦截器：401 自动清除登录态并跳转登录页
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && isBrowser) {
      localStorage.removeItem('colorai_auth');
      // 避免在登录页本身循环跳转
      if (!location.pathname.includes('/login')) {
        location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = () => delay(200 + Math.random() * 300);

function generateMockImageUrl(width = 800, height = 600): string {
  if (!isBrowser) return `https://picsum.photos/${width}/${height}`;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return `https://picsum.photos/${width}/${height}`;
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    const hue1 = Math.floor(Math.random() * 360);
    const hue2 = (hue1 + 60 + Math.floor(Math.random() * 120)) % 360;
    gradient.addColorStop(0, `hsl(${hue1}, 65%, 55%)`);
    gradient.addColorStop(0.5, `hsl(${(hue1 + hue2) / 2}, 70%, 60%)`);
    gradient.addColorStop(1, `hsl(${hue2}, 65%, 50%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 15; i++) {
      ctx.beginPath();
      const r = 20 + Math.random() * 80;
      const x = Math.random() * width;
      const y = Math.random() * height;
      const h = Math.floor(Math.random() * 360);
      ctx.fillStyle = `hsla(${h}, 70%, 60%, ${0.1 + Math.random() * 0.2})`;
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('QuQuan AI 校正效果图', width / 2, height / 2);
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return `https://picsum.photos/${width}/${height}`;
  }
}

const colorNames = [
  '珊瑚红', '天蓝色', '薄荷绿', '柠檬黄', '薰衣草紫',
  '蜜桃粉', '孔雀蓝', '橄榄绿', '玫瑰红', '天空灰',
  '落日橙', '深海蓝', '森林绿', '樱花粉', '香槟金'
];

function getRandomColorName() {
  return colorNames[Math.floor(Math.random() * colorNames.length)];
}

const mockColorIssues: QAItem[] = [
  {
    id: 'q1',
    title: '为什么室内拍照偏黄？',
    content: '室内灯光通常为暖色调（色温3000K以下），手机自动白平衡未能及时校正，导致画面偏黄。建议手动设置白平衡至3200K-4000K，或使用Raw格式后期校正。',
    category: '白平衡',
    tags: ['室内', '偏黄', '色温'],
    updatedAt: '2024-03-15'
  },
  {
    id: 'q2',
    title: '晴天户外照片过曝怎么办？',
    content: '强光环境下相机容易过曝。建议：1. 降低曝光补偿-0.3~-1EV；2. 使用点测光对亮部；3. 加CPL偏振镜或ND镜减少进光；4. Raw格式保留更多高光细节。',
    category: '曝光',
    tags: ['户外', '过曝', '晴天'],
    updatedAt: '2024-03-10'
  },
  {
    id: 'q3',
    title: '人像照片肤色偏红怎么调？',
    content: '肤色偏红常见于闪光灯直射或传感器红通道过载。解决：1. HSL面板降低红色饱和度-10~-15；2. 色温向冷色偏移200-500K；3. 曲线微调蓝色通道提亮暗部。',
    category: '肤色',
    tags: ['人像', '偏红', '肤色'],
    updatedAt: '2024-03-05'
  },
  {
    id: 'q4',
    title: '夜景照片噪点多如何处理？',
    content: '高ISO导致噪点是夜景通病。建议：1. 使用三脚架+低ISO长曝光；2. 相机开启长曝光降噪；3. 后期使用AI降噪（Lightroom/Topaz Denoise AI）；4. 适当降低锐化。',
    category: '夜景',
    tags: ['夜景', '噪点', 'ISO'],
    updatedAt: '2024-02-28'
  },
  {
    id: 'q5',
    title: '不同显示器颜色不一致原因？',
    content: '显示器色差主要来自：面板类型差异、色域覆盖不同（sRGB/AdobeRGB）、色温设置、未做硬件校准。解决办法：统一使用sRGB工作空间，定期用校色仪（Spyder/X-Rite）校准。',
    category: '显示',
    tags: ['显示器', '色差', '校色'],
    updatedAt: '2024-02-20'
  }
];

const mockPhotoTips: QAItem[] = [
  {
    id: 't1',
    title: '黄金时刻拍摄的5个技巧',
    content: '日出后1小时、日落前1小时为黄金时刻：1. 低角度逆光拍摄产生轮廓光；2. 白平衡设为阴天模式强化暖调；3. 大光圈虚化前景；4. 使用反光板补暗部；5. 连拍捕捉动态光影。',
    category: '光线',
    tags: ['黄金时刻', '日落', '光线'],
    updatedAt: '2024-03-12'
  },
  {
    id: 't2',
    title: '手机拍出专业感的构图法则',
    content: '1. 三分法：打开网格线，主体放交叉点；2. 引导线：利用道路/栏杆延伸视线；3. 前景框架：门窗/树叶制造层次；4. 对称构图：建筑/倒影的稳定感；5. 负空间：留白突出主体。',
    category: '构图',
    tags: ['手机', '构图', '技巧'],
    updatedAt: '2024-03-08'
  },
  {
    id: 't3',
    title: '产品摄影布光入门',
    content: '简易产品布光三件套：1. 主光：45度侧上方柔光箱塑造立体；2. 辅光：对侧反光板补阴影；3. 轮廓光：后方逆光勾边。背景用硫酸纸或渐变纸更显高级。',
    category: '布光',
    tags: ['产品', '布光', '商业'],
    updatedAt: '2024-03-01'
  }
];

const mockShops: Shop[] = [
  {
    id: 's1',
    name: '专业暗房胶片社',
    address: '北京市朝阳区三里屯路19号',
    city: '北京',
    phone: '010-6417-8888',
    rating: 4.8,
    specialties: ['C41彩负冲洗', 'E6反转片', '数码打印', '老照片修复'],
    distance: 1.2
  },
  {
    id: 's2',
    name: '色彩工坊冲印中心',
    address: '上海市黄浦区南京东路233号',
    city: '上海',
    phone: '021-6352-6666',
    rating: 4.6,
    specialties: ['艺术微喷', '黑白手工放大', '相框定制', '校色服务'],
    distance: 2.5
  },
  {
    id: 's3',
    name: '乐彩影像生活空间',
    address: '广州市天河区天河路385号',
    city: '广州',
    phone: '020-3862-5555',
    rating: 4.7,
    specialties: ['证件照精修', '相册制作', '摄影培训', '器材租赁'],
    distance: 0.8
  },
  {
    id: 's4',
    name: '胶片复兴小铺',
    address: '成都市锦江区春熙路IFS负一层',
    city: '成都',
    phone: '028-8666-9999',
    rating: 4.9,
    specialties: ['一次性相机', '135/120胶卷', '复古滤镜', '摄影聚会'],
    distance: 3.1
  },
  {
    id: 's5',
    name: '印像家·高端输出',
    address: '深圳市南山区海岸城购物中心',
    city: '深圳',
    phone: '0755-8899-7777',
    rating: 4.5,
    specialties: ['哈内姆勒纸张', '亚克力装裱', '大尺寸输出', '企业画册'],
    distance: 1.8
  }
];

const mockBrands: Brand[] = [
  {
    id: 'b1',
    name: 'Kodak 柯达',
    category: '胶片',
    description: '百年胶片品牌，ColorPlus/Gold/Portra系列覆盖日常到专业人像需求。',
    logo: '🟡',
    products: ['ColorPlus 200', 'Gold 200', 'Portra 400', 'Ektar 100', 'Tri-X 400']
  },
  {
    id: 'b2',
    name: 'Fujifilm 富士',
    category: '胶片',
    description: '日系色彩代表，C200业务卷、Provia反转片、Instax拍立得全线产品。',
    logo: '🟢',
    products: ['C200', 'Provia 100F', 'Velvia 50', 'Instax Mini', 'X-TRA 400']
  },
  {
    id: 'b3',
    name: 'Ilford 伊尔福',
    category: '黑白胶片',
    description: '英国老牌黑白胶片厂，HP5/Delta/Pan系列深受人文摄影师喜爱。',
    logo: '⚫',
    products: ['HP5 Plus 400', 'Delta 100', 'Pan 100', 'XP2 Super', 'SFX 200']
  },
  {
    id: 'b4',
    name: 'Hahnemühle 哈内姆勒',
    category: '打印纸',
    description: '德国430年造纸工艺，博物馆级无酸艺术纸，收藏级影像输出首选。',
    logo: '🏛️',
    products: ['Photo Rag 308', 'Baryta FB 350', 'Fine Art Pearl', 'William Turner']
  },
  {
    id: 'b5',
    name: 'Epson 爱普生',
    category: '打印设备',
    description: '专业影像打印标杆，SureColor系列微压电喷头+原装颜料墨水。',
    logo: '🔵',
    products: ['SC-P708', 'SC-P908', 'SC-T3480N', 'SureLab D1080']
  },
  {
    id: 'b6',
    name: 'Datacolor 德塔颜色',
    category: '校色设备',
    description: '全球色彩管理领导者，Spyder系列显示器校色仪为摄影师必备工具。',
    logo: '🔷',
    products: ['Spyder X Elite', 'Spyder X Pro', 'Spyder Cube', 'Spyder Checkr']
  }
];

export const colorService = {
  async correctImage(file: File, mode?: string): Promise<CorrectResponse> {
    await randomDelay();
    const originalUrl = isBrowser ? URL.createObjectURL(file) : '';
    return {
      success: true,
      correctedImageUrl: generateMockImageUrl(1200, 800),
      originalImageUrl: originalUrl,
      stats: {
        brightnessDelta: +(Math.random() * 20 - 5).toFixed(1),
        contrastDelta: +(Math.random() * 15 + 2).toFixed(1),
        saturationDelta: +(Math.random() * 10 - 2).toFixed(1)
      },
      processingTime: +(0.5 + Math.random() * 2).toFixed(2)
    };
  },

  async pickColor(imageUrl: string, x: number, y: number): Promise<PickResponse> {
    await randomDelay();
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    const l = (max + min) / 2;
    let s = 0;
    if (max !== min) {
      s = l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
    }
    let h = 0;
    if (max !== min) {
      const d = max - min;
      switch (max) {
        case r / 255: h = ((g - b) / d + (g < b ? 6 : 0)); break;
        case g / 255: h = (b - r) / d + 2; break;
        case b / 255: h = (r - g) / d + 4; break;
      }
      h *= 60;
    }
    return {
      success: true,
      color: {
        hex,
        rgb: { r, g, b },
        hsl: { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) },
        name: getRandomColorName()
      },
      position: { x, y }
    };
  },

  async compareImages(fileA: File, fileB: File): Promise<CompareResponse> {
    await randomDelay();
    return {
      success: true,
      similarity: +(85 + Math.random() * 12).toFixed(1),
      deltaE: +(Math.random() * 8 + 1).toFixed(2),
      differences: {
        brightness: +(Math.random() * 15 - 5).toFixed(1),
        contrast: +(Math.random() * 10 - 3).toFixed(1),
        saturation: +(Math.random() * 12 - 4).toFixed(1),
        temperature: +(Math.random() * 500 - 200).toFixed(0)
      },
      reportUrl: generateMockImageUrl(1000, 600)
    };
  },

  async phoneCorrectImage(file: File, device = 'iPhone 15 Pro', scene = '自动'): Promise<PhoneCorrectResponse> {
    await randomDelay();
    return {
      success: true,
      correctedImageUrl: generateMockImageUrl(1200, 1600),
      device,
      scene,
      whiteBalance: +(Math.random() * 800 + 4800).toFixed(0),
      colorTemperature: +(Math.random() * 600 + 5200).toFixed(0),
      processingTime: +(0.8 + Math.random() * 2).toFixed(2)
    };
  }
};

export const knowledgeService = {
  async getColorIssues(keyword?: string): Promise<QAItem[]> {
    await randomDelay();
    let result = mockColorIssues;
    if (keyword) {
      const k = keyword.toLowerCase();
      result = result.filter(q =>
        q.title.toLowerCase().includes(k) ||
        q.content.toLowerCase().includes(k) ||
        q.tags.some(t => t.toLowerCase().includes(k))
      );
    }
    return result;
  },

  async getPhotoTips(): Promise<QAItem[]> {
    await randomDelay();
    return mockPhotoTips;
  },

  async getShops(city?: string): Promise<Shop[]> {
    await randomDelay();
    let result = mockShops;
    if (city) {
      result = result.filter(s => s.city.includes(city));
    }
    return result;
  },

  async getBrands(category?: string): Promise<Brand[]> {
    await randomDelay();
    let result = mockBrands;
    if (category) {
      result = result.filter(b => b.category.includes(category));
    }
    return result;
  }
};

export default apiClient;
