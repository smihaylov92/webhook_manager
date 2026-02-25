import { HttpMethods } from '@/common/enums/http-methods.enum';
import {
  IsOptional,
  IsUUID,
  IsUrl,
  IsObject,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';

export class CreateDestinationDto {
  @IsUUID()
  endpointId!: string;

  @IsEnum(HttpMethods)
  httpMethod: HttpMethods = HttpMethods.POST;

  @IsObject()
  @IsOptional()
  headers?: Record<string, string> = {};

  @IsUrl()
  @IsNotEmpty()
  url!: string;

  @IsBoolean()
  isActive = true;
}
