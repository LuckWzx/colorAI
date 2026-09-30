/**
 * 智能体消息 Markdown 渲染
 * - 后端 LLM 回复为 Markdown（标题 / 列表 / 表格 / 代码块等），纯文本直出观感差
 * - react-markdown 默认不解析原始 HTML，天然防 XSS，无需额外 sanitize
 * - remark-gfm 支持表格 / 任务列表 / 删除线 / 自动链接
 * - 视觉样式集中在 index.css 的 .markdown-msg（对齐品牌纸感体系）
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

export interface MarkdownMessageProps {
  /** Markdown 源文本（智能体回复原文） */
  text: string;
  className?: string;
}

export default function MarkdownMessage({ text, className }: MarkdownMessageProps) {
  return (
    <div className={cn('markdown-msg', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 表格外层包横向滚动容器：列多时窄屏可滑动，不撑破消息气泡
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table>{children}</table>
            </div>
          ),
          // 链接新开标签页，避免离开工作台
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
