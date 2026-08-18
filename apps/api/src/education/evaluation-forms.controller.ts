import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

import { BadRequestException, Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

import { Public } from '@/access';

const ALLOWED_HOST = 'toastmasterscdn.azureedge.net';

/** Streams official Toastmasters evaluation PDFs through our own origin with
 * `Content-Disposition: attachment`. The CDN sends no CORS headers, so a
 * browser `fetch()`-into-blob download is impossible; an anchor pointed here
 * downloads like any same-origin file. Public but allowlisted: the worst it
 * can serve is a public Toastmasters PDF. */
@Controller('education/evaluation-forms')
export class EvaluationFormsController {
  @Get('download')
  @Public()
  async download(@Query('url') url: string, @Res() res: Response): Promise<void> {
    // SSRF guard: HTTPS only, the official CDN only, PDFs only.
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      throw new BadRequestException({ code: 'EVAL_FORM_BAD_URL' });
    }
    const isAllowed =
      target.protocol === 'https:' &&
      target.hostname === ALLOWED_HOST &&
      target.pathname.toLowerCase().endsWith('.pdf');
    if (!isAllowed) {
      throw new BadRequestException({ code: 'EVAL_FORM_URL_NOT_ALLOWED' });
    }

    const upstream = await fetch(target);
    if (!upstream.ok || !upstream.body) {
      throw new BadRequestException({ code: 'EVAL_FORM_UPSTREAM_FAILED' });
    }

    const filename = target.pathname.split('/').pop() ?? 'evaluation-form.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    Readable.fromWeb(upstream.body as unknown as WebReadableStream).pipe(res);
  }
}
