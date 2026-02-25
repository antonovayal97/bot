import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(login: string, password: string): Promise<{ access_token: string } | null> {
    const adminLogin = this.config.get<string>('ADMIN_LOGIN', 'admin');
    const adminPassword = this.config.get<string>('ADMIN_PASSWORD', 'admin');
    if (login !== adminLogin || password !== adminPassword) return null;
    const payload = { sub: 'admin', role: 'admin' };
    const access_token = this.jwt.sign(payload);
    return { access_token };
  }

  async validatePayload(payload: { sub: string; role?: string }) {
    if (payload.sub === 'admin' && payload.role === 'admin') return { id: 'admin', role: 'admin' };
    return null;
  }
}
