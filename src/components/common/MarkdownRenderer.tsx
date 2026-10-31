import React, { useMemo } from "react";
import { marked } from "marked";
import { useTabs } from "../../context/TabContext";
import { handleLinkOpen } from "../../utils/linkHandler";
import { WhiteboardEmbed } from "../notepad/WhiteboardEmbed";

export interface MarkdownRendererProps {
  content: string;
  className?: string;
  onToggleTask?: (taskIndex: number, newChecked: boolean) => void;
  onEditWhiteboard?: (originalRawBlock: string, designJson: string) => void;
  style?: React.CSSProperties;
}

interface ContentSegment {
  type: "markdown" | "whiteboard";
  text: string;
  rawBlock?: string;
}

/**
 * Pre-processes custom callout boxes (e.g., > [!NOTE] or :::info) and renders markdown to HTML.
 */
function renderMarkdownToHtml(rawMarkdown: string): string {
  if (!rawMarkdown || !rawMarkdown.trim()) return "";

  let text = rawMarkdown;

  // Convert GitHub alert syntax > [!NOTE], > [!TIP], etc. into styled div wrappers
  text = text.replace(
    /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n((?:>.*\n?)*)/gim,
    (_match, type, body) => {
      const cleanBody = body
        .split("\n")
        .map((l: string) => l.replace(/^>\s?/, ""))
        .join("\n");
      return `\n<div class="callout-box callout-${type.toLowerCase()}"><div class="callout-title">${type}</div>\n\n${cleanBody}\n</div>\n`;
    }
  );

  // Convert :::box or :::info syntax
  text = text.replace(
    /:::(info|warning|success|note|danger|box|tip)\s*\n([\s\S]*?):::/gi,
    (_match, type, body) => {
      return `\n<div class="callout-box callout-${type.toLowerCase()}">\n\n${body}\n</div>\n`;
    }
  );

  try {
    marked.setOptions({
      gfm: true,
      breaks: true,
    });
    const parsed = marked.parse(text, { async: false }) as string;
    // Remove disabled from task checkboxes so they can be clicked interactively
    return parsed
      .replace(/<input\s+([^>]*?)disabled(?:=""|="disabled")?([^>]*?)type="checkbox"/gi, '<input $1$2type="checkbox"')
      .replace(/<input\s+([^>]*?)type="checkbox"([^>]*?)disabled(?:=""|="disabled")?/gi, '<input $1type="checkbox"$2');
  } catch (e) {
    console.error("Markdown parsing error:", e);
    return text;
  }
}

/**
 * Splits raw content into markdown segments and ```whiteboard ... ``` blocks.
 */
function parseContentSegments(content: string): ContentSegment[] {
  if (!content) return [];
  if (!content.includes("```whiteboard")) {
    return [{ type: "markdown", text: content }];
  }

  const regex = /```whiteboard\s*\n([\s\S]*?)\n```/g;
  const segments: ContentSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "markdown",
        text: content.slice(lastIndex, match.index),
      });
    }
    segments.push({
      type: "whiteboard",
      text: match[1],
      rawBlock: match[0],
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    segments.push({
      type: "markdown",
      text: content.slice(lastIndex),
    });
  }

  return segments;
}

export function MarkdownRenderer({
  content,
  className = "",
  onToggleTask,
  onEditWhiteboard,
  style,
}: MarkdownRendererProps) {
  let openWebviewTab: ((url: string, title?: string) => void) | undefined;
  try {
    const tabs = useTabs();
    openWebviewTab = tabs.openWebviewTab;
  } catch {}

  const segments = useMemo(() => {
    return parseContentSegments(content);
  }, [content]);

  // Handle interactive checkbox clicks and link clicks within rendered markdown
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!target) return;

    // Check for link click
    const anchor = target.closest("a");
    if (anchor && anchor.getAttribute("href")) {
      e.preventDefault();
      const href = anchor.getAttribute("href")!;
      handleLinkOpen(href, anchor.textContent || href, openWebviewTab);
      return;
    }

    // Check for interactive checkbox click
    if (target.tagName === "INPUT" && (target as HTMLInputElement).type === "checkbox") {
      const checkbox = target as HTMLInputElement;
      if (onToggleTask) {
        // Find which checkbox index was clicked among all checkboxes in this container
        const container = e.currentTarget;
        const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]'));
        const index = checkboxes.indexOf(checkbox);
        if (index !== -1) {
          onToggleTask(index, checkbox.checked);
        }
      }
    }
  };

  if (!content || !content.trim()) {
    return (
      <div style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "var(--text-sm)", ...style }}>
        No content provided.
      </div>
    );
  }

  return (
    <div
      className={`markdown-content ${className}`}
      style={{
        lineHeight: 1.6,
        color: "var(--text-primary)",
        fontSize: "var(--text-sm)",
        ...style,
      }}
      onClick={handleContainerClick}
    >
      {segments.map((segment, idx) => {
        if (segment.type === "whiteboard") {
          return (
            <WhiteboardEmbed
              key={`wb_${idx}`}
              rawContent={segment.text}
              onEdit={
                onEditWhiteboard
                  ? () => onEditWhiteboard(segment.rawBlock!, segment.text)
                  : undefined
              }
            />
          );
        }

        const html = renderMarkdownToHtml(segment.text);
        if (!html.trim()) return null;

        return (
          <div
            key={`md_${idx}`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </div>
  );
}

/**
 * Utility to toggle task state in raw markdown string at a specific index
 */
export function toggleMarkdownTask(markdown: string, taskIndex: number, newChecked: boolean): string {
  let currentIndex = 0;
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(\s*[-*+]\s+\[)([ xX])(\]\s+.*)$/);
    if (match) {
      if (currentIndex === taskIndex) {
        const checkMark = newChecked ? "x" : " ";
        lines[i] = `${match[1]}${checkMark}${match[3]}`;
        break;
      }
      currentIndex++;
    }
  }
  return lines.join("\n");
}
