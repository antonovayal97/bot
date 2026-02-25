import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('admin/auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const result = await this.auth.login(dto.login, dto.password);
    if (!result) throw new UnauthorizedException('Invalid credentials');
    return result;
  }
}
