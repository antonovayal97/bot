import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class BotApiKeyGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.headers['x-bot-api-key'] ?? request.query?.apiKey;
    const expected = this.config.get<string>('BOT_API_KEY', '');
    if (!expected || key !== expected) throw new UnauthorizedException('Invalid bot API key');
    return true;
  }
}
