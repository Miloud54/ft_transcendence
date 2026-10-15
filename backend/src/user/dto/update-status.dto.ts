import { IsIn } from 'class-validator';

export class UpdateStatusDto {
  @IsIn(['ONLINE', 'OFFLINE'])
  status: 'ONLINE' | 'OFFLINE';
}
