import { IsString, IsNumber, Min, IsNotEmpty } from 'class-validator';
import { Command } from '@nestjs/cqrs';

export class CreateItemCommand extends Command<{ success: boolean }> {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  quantity: number;
}
