import { Controller, Post, Body, Req, Res, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { MaxelPayService } from './maxelpay.service';

@Controller('payments/maxelpay')
export class MaxelPayController {
  private readonly logger = new Logger(MaxelPayController.name);

  constructor(private maxelpay: MaxelPayService) {}

  @Post('webhook')
  async webhook(@Req() req: Request, @Res() res: Response, @Body() body: Record<string, unknown>) {
    const reqWithRaw = req as unknown as { rawBody?: Buffer };
    const rawBody = reqWithRaw.rawBody
      ? reqWithRaw.rawBody.toString('utf8')
      : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(body);

    const signature = req.headers['x-maxelpay-signature'] as string | undefined;
    if (!this.maxelpay.verifySignature(rawBody, signature)) {
      this.logger.warn(`MaxelPay webhook: invalid signature (rawBody length=${rawBody?.length}, hasSig=${!!signature})`);
      return res.status(401).json({ error: 'Invalid signature' });
    }

    try {
      await this.maxelpay.handleWebhook(body as Parameters<MaxelPayService['handleWebhook']>[0]);
    } catch (err) {
      this.logger.error(`MaxelPay webhook error: ${err instanceof Error ? err.message : err}`);
    }

    return res.status(200).json({ received: true });
  }
}
