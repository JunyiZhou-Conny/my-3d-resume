import { motion } from 'framer-motion'
import { SOCIAL_ICONS } from './SocialIcons'
import { FOCUS_POINTS } from '../data/focusPoints'

interface ResumeGroup {
  heading?: string
  logoImg?: string
  sub?: string
  link?: string
  items?: string[]
  links?: { id: string; label: string; href: string }[]
}
interface ResumeEntry {
  period: string
  place: string
  role?: string
  logo?: { src: string; alt: string }
  points?: string[]
  groups?: ResumeGroup[]
}
const RESUME: Record<'en' | 'zh', { title: string; entries: ResumeEntry[] }> = {
  en: {
    title: 'Focus',
    entries: [
      {
        period: '01 · Clinical AI',
        place: 'Pediatric Savior',
        role: 'Pediatric airway training · Shipped 2024',
      },
      {
        period: '02 · Computational biology',
        place: 'speciesOT',
        role: 'Mouse-to-human cell transport',
        points: [
          'Optimal transport in a shared autoencoder latent space.',
          'Model comparison, scorecards, and cluster workflows in one CLI.',
          'Python · PyTorch · scanpy · CellOT · SLURM',
        ],
      },
      {
        period: '03 · Agent systems',
        place: 'Job Search OS',
        role: 'An application workflow with a memory',
        points: [
          'Cursor defines policy. Polar Browser carries out the workflow.',
          'GitHub records changes; Google Sheets tracks each run.',
          'Application submission follows explicit rules.',
        ],
      },
      {
        period: '04 · Research infrastructure',
        place: 'scGen / CellOT autoresearch',
        groups: [
          {
            heading: 'Research that keeps running',
            sub: 'FASRC Cannon',
            items: [
              'Submit experiments, watch results, and plan the next run.',
              'An agent plans experiments and runs them on the cluster.',
            ],
            link: 'https://github.com/JunyiZhou-Conny/scgen-cellot-autoresearch',
          },
        ],
      },
      {
        period: '05 · Open methods',
        place: 'Systems other people can run',
        groups: [
          {
            heading: 'CLIs · runbooks · agent files',
            sub: 'Explore on GitHub',
            link: 'https://github.com/JunyiZhou-Conny',
          },
          {
            heading: 'Get in touch',
            sub: 'junyizhou@hsph.harvard.edu',
            link: 'mailto:junyizhou@hsph.harvard.edu',
          },
        ],
      },
    ],
  },
  zh: {
    title: 'Focus',
    entries: [
      {
        period: '01 · 临床 AI',
        place: 'Pediatric Savior',
        role: '儿科气道训练 · 2024 年发布',
      },
      {
        period: '02 · 计算生物学',
        place: 'speciesOT',
        role: '从小鼠细胞到人类细胞',
        points: [
          '在共享自编码器潜在空间中研究最优传输。',
          '用一个命令行工具组织模型比较、评分与集群工作流。',
          'Python · PyTorch · scanpy · CellOT · SLURM',
        ],
      },
      {
        period: '03 · 智能体系统',
        place: 'Job Search OS',
        role: '有记忆的求职申请工作流',
        points: [
          'Cursor 定义策略，Polar Browser 执行工作流。',
          'GitHub 记录变更，Google Sheets 跟踪每次运行。',
          '申请提交遵循明确的规则。',
        ],
      },
      {
        period: '04 · 研究基础设施',
        place: 'scGen / CellOT autoresearch',
        groups: [
          {
            heading: '持续运行的研究',
            sub: 'FASRC Cannon',
            items: [
              '提交实验、观察结果，再规划下一次运行。',
              '决策层提出计划，执行层持续推进。',
            ],
            link: 'https://github.com/JunyiZhou-Conny/scgen-cellot-autoresearch',
          },
        ],
      },
      {
        period: '05 · 开放方法',
        place: '让他人也能运行的系统',
        groups: [
          {
            heading: '命令行工具 · 操作手册 · 智能体文件',
            sub: '在 GitHub 查看',
            link: 'https://github.com/JunyiZhou-Conny',
          },
          {
            heading: '联系我',
            sub: 'junyizhou@hsph.harvard.edu',
            link: 'mailto:junyizhou@hsph.harvard.edu',
          },
        ],
      },
    ],
  },
}

// 履历条目依次对应 glb 里的聚焦锚点（相机停靠点），顺序须与 entries 一致。
// 名单是唯一真源，见 data/focusPoints.ts（Scene.tsx 也从那里取）。
const POINT_ORDER = FOCUS_POINTS

const EASE = [0.22, 1, 0.36, 1]
const containerV = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.04 } },
}
const itemV = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.75, ease: EASE } },
}

function Group({ group }: { group: ResumeGroup }) {
  const heading =
    group.link ? (
      <a className="about-link" href={group.link} target="_blank" rel="noopener noreferrer">
        {group.heading}
      </a>
    ) : (
      <span>{group.heading}</span>
    )

  return (
    <motion.div className="tl-group" variants={itemV}>
      <div className="tl-group-head">
        {group.logoImg && (
          <span className="tl-group-logo">
            <img src={group.logoImg} alt={group.heading || ''} loading="lazy" />
          </span>
        )}
        {heading}
        {group.sub && <span className="tl-group-sub">{group.sub}</span>}
      </div>
      {group.items && (
        <ul className="tl-points">
          {group.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      )}
      {group.links && (
        <div className="tl-logos">
          {group.links.map((l) => {
            const Icon = SOCIAL_ICONS[l.id as keyof typeof SOCIAL_ICONS]
            return (
              <a
                key={l.id}
                className="tl-logo"
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={l.label}
                title={l.label}
              >
                <Icon />
              </a>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}

function Entry({ entry, index }: { entry: ResumeEntry; index: number }) {
  return (
    <motion.div
      className="tl-entry"
      data-point={POINT_ORDER[index]}
      variants={containerV}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-12% 0px -12% 0px' }}
    >
      <motion.span className="tl-dot" variants={itemV} aria-hidden="true" />
      {/* tl-body 包住文字内容（点保持在外做时间轴标记）：移动端可给它加卡片衬底，
          且它紧贴内容高度，不含 tl-entry 用于排布的大 padding。
          用普通 div（非 motion）：framer 变体经 React context 穿透它，叶子元素仍是
          tl-entry 的直接 stagger 子级，入场动画与包裹前完全一致。 */}
      <div className="tl-body">
        <motion.div className="tl-period" variants={itemV}>
          {entry.period}
        </motion.div>
        <motion.div className="tl-head" variants={itemV}>
          {entry.logo && (
            <span className="tl-logo-chip">
              <img src={entry.logo.src} alt={entry.logo.alt} loading="lazy" />
            </span>
          )}
          <h3 className="tl-place">{entry.place}</h3>
        </motion.div>
        {entry.role && (
          <motion.div className="tl-role" variants={itemV}>
            {entry.role}
          </motion.div>
        )}
        {entry.points && (
          <motion.ul className="tl-points" variants={itemV}>
            {entry.points.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </motion.ul>
        )}
        {entry.groups && entry.groups.map((g, i) => <Group key={i} group={g} />)}
      </div>
    </motion.div>
  )
}

export default function Resume({ lang }: { lang: 'en' | 'zh' }) {
  const data = RESUME[lang]
  return (
    <section className="resume" lang={lang}>
      <motion.h2
        className="resume-title"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-10% 0px' }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        {data.title}
      </motion.h2>
      <div className="timeline">
        {data.entries.map((e, i) => (
          <Entry key={i} entry={e} index={i} />
        ))}
      </div>
    </section>
  )
}
