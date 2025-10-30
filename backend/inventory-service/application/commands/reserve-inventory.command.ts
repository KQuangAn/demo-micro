// Reserve Inventory Command

export class ReserveInventoryCommand {
  constructor(
    public readonly userId: string,
    public readonly items: Array<{
      productId: string;
      quantity: number;
      currency: string;
    }>,
  ) {}
}
