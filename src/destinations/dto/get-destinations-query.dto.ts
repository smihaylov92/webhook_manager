import { IsUUID } from 'class-validator';

export class GetDestinationsQueryDto {
  @IsUUID()
  endpointId!: string;
}
