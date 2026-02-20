import { IsString, IsOptional, Matches } from 'class-validator';

export class CreateEndpointDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must be lowercase, alphanumeric, and can include hyphens',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
