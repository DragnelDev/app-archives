import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';
import { CurrentUser } from '../common/decorators.js';
import type { UsuarioSesion } from '../common/enums.js';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly s: DashboardService) {}
  @Get() obtener(@CurrentUser() u: UsuarioSesion) {
    return this.s.obtener(u);
  }
}
