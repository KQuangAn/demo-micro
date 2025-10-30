// REST Controller for Inventory
// Handles HTTP requests and delegates to use cases

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { CreateInventoryItemUseCase } from 'application/use-cases/create-inventory-item.use-case';
import { GetInventoryItemUseCase } from 'application/use-cases/get-inventory-item.use-case';
import { ReserveInventoryUseCase } from 'application/use-cases/reserve-inventory.use-case';
import { CreateInventoryItemCommand } from 'application/commands/create-inventory-item.command';
import { ReserveInventoryCommand } from 'application/commands/reserve-inventory.command';
import { GetInventoryItemQuery } from 'application/queries/get-inventory-item.query';
import { InventoryItemDto } from 'application/dtos/inventory-item.dto';

// Request/Response DTOs for presentation layer
class CreateInventoryItemRequest {
  title: string;
  brand: string;
  description: string;
  images: string[];
  categories: string[];
  quantity: number;
  price: number;
  currencyCode: string;
}

class ReserveInventoryRequest {
  userId: string;
  items: Array<{ itemId: string; quantity: number }>;
}

@Controller('inventory')
export class InventoryController {
  constructor(
    @Inject(CreateInventoryItemUseCase)
    private readonly createInventoryItemUseCase: CreateInventoryItemUseCase,
    @Inject(GetInventoryItemUseCase)
    private readonly getInventoryItemUseCase: GetInventoryItemUseCase,
    @Inject(ReserveInventoryUseCase)
    private readonly reserveInventoryUseCase: ReserveInventoryUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createInventoryItem(
    @Body() request: CreateInventoryItemRequest,
  ): Promise<InventoryItemDto> {
    const command = new CreateInventoryItemCommand(
      request.title,
      request.brand,
      request.description,
      request.images,
      request.categories,
      request.quantity,
      request.price,
      request.currencyCode,
    );

    return await this.createInventoryItemUseCase.execute(command);
  }

  @Get(':id')
  async getInventoryItem(@Param('id') id: string): Promise<InventoryItemDto> {
    const query = new GetInventoryItemQuery(id);
    return await this.getInventoryItemUseCase.execute(query);
  }

  @Get()
  async getAllInventoryItems(): Promise<InventoryItemDto[]> {
    const query = { type: 'getAll' }; // Simple flag for get all query
    return await this.getInventoryItemUseCase.executeGetAll();
  }

  @Post('reserve')
  @HttpCode(HttpStatus.OK)
  async reserveInventory(
    @Body() request: ReserveInventoryRequest,
  ): Promise<{ success: boolean; message: string }> {
    const command = new ReserveInventoryCommand(request.userId, request.items);

    await this.reserveInventoryUseCase.execute(command);

    return {
      success: true,
      message: 'Inventory reserved successfully',
    };
  }
}
