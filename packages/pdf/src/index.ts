// PDF rapor üretimi (docs/SPEC-architecture.md §5.6). Sadece sunucuda çalışır.
import { join } from 'node:path';
import { createElement, type ReactElement } from 'react';
import { Font, renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import type { ReportModel } from './model';
import { Report } from './report';

export type { Block, Cell, Column, ReportModel, Tone } from './model';

let registered = '';

/** Türkçe karakterli font (DejaVu Sans) bir kez kaydedilir; satır sonunda kelime bölünmez. */
function registerFonts(fontDir: string) {
  if (registered === fontDir) return;
  Font.register({
    family: 'DejaVu',
    fonts: [
      { src: join(fontDir, 'DejaVuSans.ttf'), fontWeight: 400 },
      { src: join(fontDir, 'DejaVuSans-Bold.ttf'), fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  registered = fontDir;
}

export async function renderReport(model: ReportModel, opts: { fontDir: string }): Promise<Buffer> {
  registerFonts(opts.fontDir);
  return renderToBuffer(createElement(Report, { model }) as unknown as ReactElement<DocumentProps>);
}
