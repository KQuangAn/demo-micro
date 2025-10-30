// Command DTO
export class CreateInventoryItemCommand {
  constructor(
    public readonly title: string,
    public readonly brand: string,
    public readonly description: string,
    public readonly images: string[],
    public readonly categories: string[],
    public readonly quantity: number,
    public readonly price: number,
    public readonly currencyCode: string,
  ) {}
}
