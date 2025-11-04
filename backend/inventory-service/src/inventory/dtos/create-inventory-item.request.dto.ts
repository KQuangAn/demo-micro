// Presentation Layer DTO
// HTTP Request DTO for creating inventory items

import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsNumber,
  Min,
  ArrayMinSize,
} from 'class-validator';

export class CreateInventoryItemRequest {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  brand: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  images: string[];

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  categories: string[];

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsNotEmpty()
  currencyCode: string;
}
