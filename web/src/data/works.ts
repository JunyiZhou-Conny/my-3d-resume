// 作品集数据（双语）。4 大板块 → 点击展开作品详情。
// 纯数据驱动：增删板块 / 作品只改本文件，Works.jsx 仅负责渲染。
//
// 板块字段：
//   id        唯一标识（用于 framer layoutId 共享元素动画）
//   no        编号 '01'…'05'
//   title     板块标题
//   tagline   索引行右侧一句话
//   items[]   扁平作品列表：{ name, meta?, tags?, link? }
//             点击 item 弹出全屏详情，可补充可选媒体/文案字段：
//             { image?, video?, year?, desc? }（缺省时媒体用占位、简介回退 meta/标签）
//   groups[]  分组作品（与 items 二选一）：{ heading, items: string[] }
//   awards[]  奖项 chip（可选）
//   footer    底部技术/备注一行（可选）

export interface WorkListItem {
  name: string
  meta?: string
  tags?: string[]
  link?: string
  slug?: string
}

export interface WorkGroup {
  heading: string
  items: string[]
}

export interface WorkSection {
  id: string
  no: string
  title: string
  tagline: string
  items?: WorkListItem[]
  groups?: WorkGroup[]
  awards?: string[]
  footer?: string
}

export interface WorksLang {
  title: string
  closeLabel: string
  openLabel: string
  hint: string
  awardsLabel: string
  visitLabel: string
  detailPlaceholder: string
  phImageLabel: string
  phButtonLabel: string
  countLabel: (n: number) => string
  sections: WorkSection[]
}

export const WORKS: Record<'zh' | 'en', WorksLang> = {
  zh: {
    title: 'Works',
    closeLabel: '返回',
    openLabel: '展开作品',
    hint: '继续下滑',
    awardsLabel: '获奖',
    visitLabel: '查看代码仓库',
    detailPlaceholder: '你的作品介绍',
    phImageLabel: '图片 / 视频',
    phButtonLabel: '跳转按钮',
    countLabel: (n) => `${n} 件作品`,
    sections: [
      {
        id: 'ad',
        no: '01',
        title: '临床 AI',
        tagline: '面向住院医师的训练工具',
        items: [
          {
            name: 'Pediatric Savior',
            meta: '儿科气道训练 · 2024 年发布',
            tags: ['React', 'Flask', 'AWS'],
            link: 'https://github.com/JunyiZhou-Conny/Airway-Management-Assistant',
            slug: 'pediatric-savior',
          },
        ],
      },
      {
        id: 'maker',
        no: '02',
        title: '计算生物学',
        tagline: '细胞、传输与共享工具',
        items: [
          {
            name: 'speciesOT',
            meta: '小鼠到人类细胞的映射 · 进行中',
            tags: ['Python', 'PyTorch', 'CellOT'],
            link: 'https://github.com/JunyiZhou-Conny/speciesOT',
            slug: 'species-ot',
          },
        ],
      },
      {
        id: 'product',
        no: '03',
        title: '智能体系统',
        tagline: '有记忆的工作流',
        items: [
          {
            name: 'Job Search OS',
            meta: '策略、浏览器操作与运行记录',
            tags: ['Cursor', 'Polar Browser', 'GitHub'],
            link: 'https://github.com/JunyiZhou-Conny/job-search-2026-2027-starter',
            slug: 'job-search-os',
          },
        ],
      },
      {
        id: 'graphics',
        no: '04',
        title: '研究基础设施',
        tagline: '持续推进的实验',
        items: [
          {
            name: 'scGen / CellOT autoresearch',
            meta: 'FASRC Cannon 上考虑公平份额的实验搜索',
            tags: ['Python', 'SLURM', 'FASRC'],
            link: 'https://github.com/JunyiZhou-Conny/scgen-cellot-autoresearch',
            slug: 'autoresearch',
          },
        ],
      },
    ],
  },
  en: {
    title: 'Works',
    closeLabel: 'Back',
    openLabel: 'Explore',
    hint: 'Keep scrolling',
    awardsLabel: 'Awards',
    visitLabel: 'View repository',
    detailPlaceholder: 'Your work description',
    phImageLabel: 'Image / Video',
    phButtonLabel: 'Link button',
    countLabel: (n) => `${n} works`,
    sections: [
      {
        id: 'ad',
        no: '01',
        title: 'Clinical AI',
        tagline: 'Resident-facing training tools',
        items: [
          {
            name: 'Pediatric Savior',
            meta: 'Pediatric airway training · Shipped 2024',
            tags: ['React', 'Flask', 'AWS'],
            link: 'https://github.com/JunyiZhou-Conny/Airway-Management-Assistant',
            slug: 'pediatric-savior',
          },
        ],
      },
      {
        id: 'maker',
        no: '02',
        title: 'Computational biology',
        tagline: 'Cells, transport, and shared tools',
        items: [
          {
            name: 'speciesOT',
            meta: 'Mouse-to-human transport · In progress',
            tags: ['Python', 'PyTorch', 'CellOT'],
            link: 'https://github.com/JunyiZhou-Conny/speciesOT',
            slug: 'species-ot',
          },
        ],
      },
      {
        id: 'product',
        no: '03',
        title: 'Agent systems',
        tagline: 'Workflows with a memory',
        items: [
          {
            name: 'Job Search OS',
            meta: 'Policy, browser actions, and tracked runs',
            tags: ['Cursor', 'Polar Browser', 'GitHub'],
            link: 'https://github.com/JunyiZhou-Conny/job-search-2026-2027-starter',
            slug: 'job-search-os',
          },
        ],
      },
      {
        id: 'graphics',
        no: '04',
        title: 'Research infrastructure',
        tagline: 'Experiments that keep moving',
        items: [
          {
            name: 'scGen / CellOT autoresearch',
            meta: 'Fairshare-aware search on FASRC Cannon',
            tags: ['Python', 'SLURM', 'FASRC'],
            link: 'https://github.com/JunyiZhou-Conny/scgen-cellot-autoresearch',
            slug: 'autoresearch',
          },
        ],
      },
    ],
  },
}

// 缺图时左栏用大编号渐变占位，放入图片后自动点亮。
export const SECTION_COVERS: Record<string, string> = {
  ad: `${import.meta.env.BASE_URL}stickers/pulse-illustrated.webp`,
  maker: `${import.meta.env.BASE_URL}stickers/dna-illustrated.webp`,
  product: `${import.meta.env.BASE_URL}stickers/hub-illustrated.webp`,
  graphics: `${import.meta.env.BASE_URL}stickers/chip-illustrated.webp`,
}

// 统计一个板块的作品数（items 或 groups 求和），用于索引行 hover 显示
export function sectionCount(section: WorkSection): number {
  if (section.items) return section.items.length
  if (section.groups) return section.groups.reduce((n, g) => n + g.items.length, 0)
  return 0
}
