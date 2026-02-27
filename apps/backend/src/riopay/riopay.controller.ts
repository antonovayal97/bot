import { Controller, Post, Body, Req, Res, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { RioPayService } from './riopay.service';

@Controller('payments/riopay')
export class RioPayController {
  private readonly logger = new Logger(RioPayController.name);

  constructor(private riopay: RioPayService) {}

  @Post('webhook')
  async webhook(@Req() req: Request, @Res() res: Response, @Body() body: Record<string, unknown>) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
    if (!this.riopay.verifyWebhookIp(ip)) {
      this.logger.warn(`RioPay webhook: rejected IP "${ip}" (expected 82.146.51.110)`);
      return res.status(403).send('Forbidden');
    }

    const reqWithRaw = req as unknown as { rawBody?: Buffer };
    const rawBody = reqWithRaw.rawBody
      ? reqWithRaw.rawBody.toString('utf8')
      : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(body);
    const signature = req.headers['x-signature'] as string | undefined;
    if (!this.riopay.verifySignature(rawBody, signature)) {
      this.logger.warn(`RioPay webhook: invalid signature (rawBody length=${rawBody?.length}, hasSig=${!!signature})`);
      return res.status(403).send('Invalid signature');
    }

    try {
      await this.riopay.handleWebhook(body as Parameters<RioPayService['handleWebhook']>[0]);
    } catch (err) {
      this.logger.error(`RioPay webhook error: ${err instanceof Error ? err.message : err}`);
    }

    return res.status(200).send('OK');
  }
}
