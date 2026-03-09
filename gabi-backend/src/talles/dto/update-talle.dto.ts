import { PartialType } from '@nestjs/mapped-types';
import { CreateTalleDto } from './create-talle.dto';

export class UpdateTalleDto extends PartialType(CreateTalleDto) { }
