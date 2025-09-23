import { IsString, IsNumber, Min, IsNotEmpty, IsUUID } from 'class-validator';

export class DeleteItemCommand {
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  quantity: number;
}
