// Presentation Layer DTO
// HTTP Request DTO for reserving inventory

import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class ReserveInventoryItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsString()
  @IsNotEmpty()
  currency: string;
}

export class ReserveInventoryRequest {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReserveInventoryItemDto)
  @ArrayMinSize(1)
  items: ReserveInventoryItemDto[];
}
