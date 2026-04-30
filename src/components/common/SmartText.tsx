import React from 'react';

type RenderOptions = {
  linkClass?: string;
  className?: string;
  preserveNewlines?: boolean;
};

export function isArabicText(s?: string) {
  return typeof s === 'string' && /[\u0600-\u06FF]/.test(s);
}

function extractSmartText(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') {
    const t = val.trim();
    if (!t) return '';
    // Try parse JSON strings
    if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
      try {
        const parsed = JSON.parse(t);
        return extractSmartText(parsed);
      } catch (e) {
        // fallthrough
      }
    }
    return t;
  }
  if (Array.isArray(val)) {
    const parts = val.map(extractSmartText).filter(Boolean);
    return parts.join(', ');
  }
  if (typeof val === 'object') {
    const candidate = (val as any).answer ?? (val as any).value ?? (val as any).en ?? (val as any).ar ?? (val as any).text ?? null;
    if (candidate !== null && (typeof candidate === 'string' || typeof candidate === 'number' || typeof candidate === 'boolean')) {
      return extractSmartText(candidate);
    }
    for (const k of Object.keys(val)) {
      const t = extractSmartText((val as any)[k]);
      if (t) return t;
    }
    try {
      return JSON.stringify(val);
    } catch (e) {
      return String(val);
    }
  }
  return String(val);
}

function linkifyTextToNodes(text: string, linkClass?: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  if (!text) return nodes;

  const combined = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  let lastIndex = 0;
  for (const match of text.matchAll(combined)) {
    const idx = match.index ?? 0;
    if (lastIndex < idx) nodes.push(text.slice(lastIndex, idx));
    const matched = match[0];
    if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i.test(matched)) {
      nodes.push(
        <a key={idx} href={`mailto:${matched}`} className={linkClass}>
          {matched}
        </a>
      );
    } else {
      let href = matched;
      if (!/^https?:\/\//i.test(href)) href = 'http://' + href;
      nodes.push(
        <a key={idx} href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {matched}
        </a>
      );
    }
    lastIndex = idx + matched.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function renderSmartText(val: any, options?: RenderOptions): { node: React.ReactNode; text: string } {
  const { linkClass, className, preserveNewlines } = options || {};
  const text = extractSmartText(val);
  const containsArabic = isArabicText(text);
  const dir = containsArabic ? 'rtl' : undefined;

  if (!text) return { node: '-', text: '' };

  if (preserveNewlines || text.includes('\n')) {
    const parts = text.split('\n');
    const nodes: React.ReactNode[] = [];
    parts.forEach((part, idx) => {
      const linkified = linkifyTextToNodes(part, linkClass);
      nodes.push(
        <span key={`p-${idx}`} dir={dir}>
          {linkified}
        </span>
      );
      if (idx < parts.length - 1) nodes.push(<br key={`br-${idx}`} />);
    });
    return { node: <div className={className || 'whitespace-pre-wrap text-gray-900 dark:text-white'} dir={dir}>{nodes}</div>, text };
  }

  const linkified = linkifyTextToNodes(text, linkClass);
  if (linkified.length === 1 && typeof linkified[0] === 'string') {
    return { node: <span className={className} dir={dir}>{linkified[0]}</span>, text };
  }
  return { node: <span className={className} dir={dir}>{linkified}</span>, text };
}

const SmartText: React.FC<{ value: any; className?: string; linkClass?: string; preserveNewlines?: boolean }> = ({ value, className, linkClass, preserveNewlines }) => {
  return renderSmartText(value, { className, linkClass, preserveNewlines }).node as React.ReactElement;
};

export default SmartText;
