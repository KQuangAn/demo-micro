import { IsString } from 'class-validator';

export class ItemDto {
  @IsString()
  id: string;
}
