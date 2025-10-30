// Domain Entity: The heart of your business logic
// No dependencies on frameworks or infrastructure

export class InventoryItem {
  private constructor(
    private readonly _id: string,
    private _title: string,
    private _brand: string,
    private _description: string,
    private _images: string[],
    private _categories: string[],
    private _quantity: number,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {}

  // Factory method for creating new inventory items
  static create(props: {
    title: string;
    brand: string;
    description: string;
    images: string[];
    categories: string[];
    quantity: number;
  }): InventoryItem {
    // Business rules validation
    if (props.quantity < 0) {
      throw new Error('Quantity cannot be negative');
    }

    if (!props.title || props.title.trim().length === 0) {
      throw new Error('Title is required');
    }

    if (!props.brand || props.brand.trim().length === 0) {
      throw new Error('Brand is required');
    }

    const now = new Date();
    return new InventoryItem(
      crypto.randomUUID(), // Or use your ID generation strategy
      props.title,
      props.brand,
      props.description,
      props.images,
      props.categories,
      props.quantity,
      now,
      now,
    );
  }

  // Factory method for reconstituting from database
  static reconstitute(props: {
    id: string;
    title: string;
    brand: string;
    description: string;
    images: string[];
    categories: string[];
    quantity: number;
    createdAt: Date;
    updatedAt: Date;
  }): InventoryItem {
    return new InventoryItem(
      props.id,
      props.title,
      props.brand,
      props.description,
      props.images,
      props.categories,
      props.quantity,
      props.createdAt,
      props.updatedAt,
    );
  }

  // Business logic methods
  reserveQuantity(amount: number): void {
    if (amount <= 0) {
      throw new Error('Reservation amount must be positive');
    }

    if (this._quantity < amount) {
      throw new Error(
        `Insufficient quantity. Available: ${this._quantity}, Requested: ${amount}`,
      );
    }

    this._quantity -= amount;
    this._updatedAt = new Date();
  }

  releaseQuantity(amount: number): void {
    if (amount <= 0) {
      throw new Error('Release amount must be positive');
    }

    this._quantity += amount;
    this._updatedAt = new Date();
  }

  updateDetails(props: {
    title?: string;
    brand?: string;
    description?: string;
    images?: string[];
    categories?: string[];
  }): void {
    if (props.title !== undefined) {
      if (!props.title || props.title.trim().length === 0) {
        throw new Error('Title cannot be empty');
      }
      this._title = props.title;
    }

    if (props.brand !== undefined) {
      if (!props.brand || props.brand.trim().length === 0) {
        throw new Error('Brand cannot be empty');
      }
      this._brand = props.brand;
    }

    if (props.description !== undefined) {
      this._description = props.description;
    }

    if (props.images !== undefined) {
      this._images = props.images;
    }

    if (props.categories !== undefined) {
      this._categories = props.categories;
    }

    this._updatedAt = new Date();
  }

  isAvailable(requestedQuantity: number): boolean {
    return this._quantity >= requestedQuantity && requestedQuantity > 0;
  }

  // Getters (no setters - immutability)
  get id(): string {
    return this._id;
  }

  get title(): string {
    return this._title;
  }

  get brand(): string {
    return this._brand;
  }

  get description(): string {
    return this._description;
  }

  get images(): string[] {
    return [...this._images]; // Return copy
  }

  get categories(): string[] {
    return [...this._categories]; // Return copy
  }

  get quantity(): number {
    return this._quantity;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
