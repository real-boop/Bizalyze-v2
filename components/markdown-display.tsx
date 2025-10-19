"use client"

import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { tomorrow } from "react-syntax-highlighter/dist/esm/styles/prism"

interface MarkdownDisplayProps {
  content: string
}

export function MarkdownDisplay({ content }: MarkdownDisplayProps) {
  return (
    <div className="prose prose-sm sm:prose lg:prose-lg dark:prose-invert max-w-none prose-headings:text-blue-900 dark:prose-headings:text-blue-200 prose-p:text-gray-800 dark:prose-p:text-gray-200">
      <ReactMarkdown
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "")
            return !inline && match ? (
              <SyntaxHighlighter style={tomorrow} language={match[1]} PreTag="div" className="rounded-lg" {...props}>
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            ) : (
              <code className={`${className} bg-blue-100/50 dark:bg-blue-800/50 rounded px-1`} {...props}>
                {children}
              </code>
            )
          },
          // Make headings responsive with gradient
          h1: ({ node, ...props }) => (
            <h1
              className="text-2xl sm:text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-green-500 dark:from-blue-400 dark:to-green-400"
              {...props}
            />
          ),
          h2: ({ node, ...props }) => (
            <h2
              className="text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-green-500 dark:from-blue-400 dark:to-green-400"
              {...props}
            />
          ),
          h3: ({ node, ...props }) => (
            <h3
              className="text-lg sm:text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-green-500 dark:from-blue-400 dark:to-green-400"
              {...props}
            />
          ),
          // Make lists more readable
          ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-2" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal pl-5 space-y-2" {...props} />,
          // Improve paragraph spacing
          p: ({ node, ...props }) => <p className="my-4" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

