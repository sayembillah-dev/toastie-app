'use client';

import {
  File,
  FileCsv,
  FileDoc,
  FilePdf,
  FilePpt,
  FileText,
  FileXls,
  FileZip,
} from '@phosphor-icons/react/dist/ssr';
import type { ComponentType } from 'react';

import type { DocumentMimeType } from '@/lib/library/documents';

interface IconStyle {
  Icon: ComponentType<{
    size?: number;
    weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
    className?: string;
  }>;
  /** Tailwind text-* class used for the icon and the type chip. Chosen from
   * the app palette so each file type reads at a glance without pulling in
   * anything outside the design tokens. */
  tone: string;
}

const ICON_MAP: Record<DocumentMimeType, IconStyle> = {
  'application/pdf': { Icon: FilePdf, tone: 'text-rose-500' },
  'application/msword': { Icon: FileDoc, tone: 'text-blue-500' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    Icon: FileDoc,
    tone: 'text-blue-500',
  },
  'application/vnd.ms-excel': { Icon: FileXls, tone: 'text-emerald-500' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    Icon: FileXls,
    tone: 'text-emerald-500',
  },
  'application/vnd.ms-powerpoint': { Icon: FilePpt, tone: 'text-orange-500' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    Icon: FilePpt,
    tone: 'text-orange-500',
  },
  'text/plain': { Icon: FileText, tone: 'text-ink-soft' },
  'text/csv': { Icon: FileCsv, tone: 'text-emerald-500' },
  'application/zip': { Icon: FileZip, tone: 'text-violet-500' },
};

interface DocumentIconProps {
  mimeType: DocumentMimeType;
  size?: number;
  className?: string;
}

/** Renders the right file glyph for a document, tinted per its type. Split
 * out so the tab, both view modes and the preview modal never disagree on
 * which icon a `.docx` shows. */
export function DocumentIcon({ mimeType, size = 24, className }: DocumentIconProps) {
  const style = ICON_MAP[mimeType] ?? { Icon: File, tone: 'text-ink-soft' };
  const { Icon, tone } = style;
  return <Icon size={size} weight="regular" className={`${tone} ${className ?? ''}`.trim()} />;
}
