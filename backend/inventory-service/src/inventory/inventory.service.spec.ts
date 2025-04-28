import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBridge } from '../event-emitter/eventbridge/eventbridge';
import { NotFoundException } from '@nestjs/common';
import { EventType } from 'src/common/types';

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: PrismaService;
  let eb: EventBridge;

  const mockPrisma = {
    inventory: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrisma)),
  };

  const mockEB = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBridge, useValue: mockEB },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    prisma = module.get<PrismaService>(PrismaService);
    eb = module.get<EventBridge>(EventBridge);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create inventory and emit event', async () => {
      const input = {
        title: 'item',
        brand: 'x',
        description: 'desc',
        images: [''],
        categories: ['stuff'],
        discount: 0,
        quantity: 10,
        price: 5,
      };
      const created = { id: '1', ...input };

      mockPrisma.inventory.create.mockResolvedValue(created);

      const result = await service.create(input);
      expect(result).toEqual(created);
      expect(mockEB.emit).toHaveBeenCalledWith(
        created,
        EventType.InventoryCreated,
      );
    });
  });

  describe('update', () => {
    it('should update inventory and emit event', async () => {
      const id = '1';
      const updateData = { name: 'new name' };
      const inventory = { id, name: 'old name' };
      const updated = { id, ...updateData };

      mockPrisma.inventory.findUnique.mockResolvedValue(inventory);
      mockPrisma.inventory.update.mockResolvedValue(updated);

      const result = await service.update(id, updateData);
      expect(result).toEqual(updated);
      expect(mockEB.emit).toHaveBeenCalledWith(
        updated,
        EventType.InventoryUpdated,
      );
    });

    it('should throw if inventory not found', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(null);
      await expect(service.update('1', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove inventory and emit event', async () => {
      const id = '1';
      const inventory = { id, name: 'item' };

      mockPrisma.inventory.findUnique.mockResolvedValue(inventory);
      mockPrisma.inventory.delete.mockResolvedValue(inventory);

      const result = await service.remove(id);
      expect(result).toEqual(inventory);
      expect(mockEB.emit).toHaveBeenCalledWith(
        inventory,
        EventType.InventoryDeleted,
      );
    });

    it('should throw if inventory not found', async () => {
      mockPrisma.inventory.findUnique.mockResolvedValue(null);
      await expect(service.remove('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('handleOrderCancelled', () => {
    it('should update inventory and emit event', async () => {
      const item = {
        id: '1',
        productId: '1',
        quantity: 2,
        status: EventType.OrderCancelledByUser,
      };
      const inventory = { id: '1', quantity: 5 };

      mockPrisma.inventory.findUnique.mockResolvedValue(inventory);
      mockPrisma.inventory.update.mockResolvedValue({});

      await service.handleOrderCancelled([item]);

      expect(mockPrisma.inventory.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { quantity: 7 },
      });

      expect(mockEB.emit).toHaveBeenCalledWith(
        { productId: '1', quantity: 2 },
        EventType.InventoryUpdated,
      );
    });
  });

  describe('handleOrderUpdated', () => {
    it('should update inventory and emit event', async () => {
      const item = {
        id: 'order1',
        productId: '1',
        quantity: 2,
        status: EventType.OrderUpdated,
      };
      const inventory = { id: '1', quantity: 10 };

      mockPrisma.inventory.findUnique.mockResolvedValue(inventory);
      Object.defineProperty(service, 'client', {
        value: {
          query: jest
            .fn()
            .mockResolvedValue({ data: { order: { quantity: 1 } } }),
        },
      });

      mockPrisma.inventory.update.mockResolvedValue({});

      await service.handleOrderUpdated([item]);

      expect(mockPrisma.inventory.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { quantity: 11 },
      });

      expect(mockEB.emit).toHaveBeenCalledWith(
        { productId: '1', quantity: 2 },
        EventType.InventoryUpdated,
      );
    });
  });

  describe('handleOrderCreated', () => {
    it('should update inventory and emit reserved event', async () => {
      const item = {
        id: '1',
        productId: '1',
        quantity: 2,
        status: EventType.OrderPlaced,
      };
      const inventory = { id: '1', quantity: 10 };

      mockPrisma.inventory.findUnique.mockResolvedValue(inventory);
      mockPrisma.inventory.update.mockResolvedValue({});

      await service.handleOrderCreated([item]);

      expect(mockPrisma.inventory.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { quantity: 8 },
      });

      expect(mockEB.emit).toHaveBeenCalledWith(
        { productId: '1', quantity: 2 },
        EventType.InventoryReserved,
      );
    });
  });
});
