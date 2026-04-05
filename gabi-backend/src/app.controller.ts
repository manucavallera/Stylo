import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AppService } from './app.service';
import { Public } from './auth/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.appService.search(q ?? '');
  }

  @Public()
  @Get('health')
  async getHealth(@Res() res: Response) {
    const { httpStatus, body } = await this.appService.getHealth();
    return res.status(httpStatus).json(body);
  }
}
