// Value Object for Price
// Encapsulates price logic with currency

export class Price {
  private constructor(
    private readonly _amount: number,
    private readonly _currency: Currency,
  ) {
    if (_amount < 0) {
      throw new Error('Price amount cannot be negative');
    }
  }

  static create(amount: number, currency: Currency): Price {
    return new Price(amount, currency);
  }

  get amount(): number {
    return this._amount;
  }

  get currency(): Currency {
    return this._currency;
  }

  equals(other: Price): boolean {
    return (
      this._amount === other._amount && this._currency.equals(other._currency)
    );
  }

  toString(): string {
    return `${this._currency.symbol}${this._amount.toFixed(2)}`;
  }
}

export class Currency {
  private constructor(
    private readonly _code: string,
    private readonly _name: string,
    private readonly _symbol: string,
  ) {
    if (!_code || _code.length !== 3) {
      throw new Error('Currency code must be 3 characters');
    }
  }

  static create(code: string, name: string, symbol: string): Currency {
    return new Currency(code.toUpperCase(), name, symbol);
  }

  static USD = Currency.create('USD', 'US Dollar', '$');
  static EUR = Currency.create('EUR', 'Euro', '€');
  static GBP = Currency.create('GBP', 'British Pound', '£');

  get code(): string {
    return this._code;
  }

  get name(): string {
    return this._name;
  }

  get symbol(): string {
    return this._symbol;
  }

  equals(other: Currency): boolean {
    return this._code === other._code;
  }
}
