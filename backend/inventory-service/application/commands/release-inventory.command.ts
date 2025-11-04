// Release Inventory Command

export class ReleaseInventoryCommand {
  constructor(
    public readonly userId: string,
    public readonly items: Array<{
      productId: string;
      quantity: number;
      reason?: string;
    }>,
  ) {}
}
