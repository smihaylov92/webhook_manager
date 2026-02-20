import { IsInt, IsOptional, Max, Min, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class GetEventsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit = 20;

  @IsOptional()
  @IsUUID()
  after?: string;
}
