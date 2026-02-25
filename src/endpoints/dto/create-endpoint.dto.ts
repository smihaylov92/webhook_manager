import { IsString, IsOptional, Matches, IsNotEmpty } from 'class-validator';

export class CreateEndpointDto {
  @IsString()
  @IsNotEmpty()
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
