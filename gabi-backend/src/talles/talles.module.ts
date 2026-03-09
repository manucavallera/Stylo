import { Module } from '@nestjs/common';
import { TallesService } from './talles.service';
import { TallesController } from './talles.controller';

@Module({
  providers: [TallesService],
  controllers: [TallesController]
})
export class TallesModule {}
