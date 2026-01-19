import Decimal from 'decimal.js';

// Configure Decimal for financial precision
// 20 digits of precision should be enough for any currency (including crypto dust if needed later)
// ROUND_HALF_EVEN is "Banker's Rounding"
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_EVEN });

export class Money {
    private amount: Decimal;

    constructor(amount: number | string | Decimal) {
        this.amount = new Decimal(amount);
    }

    // Static Factory
    static from(amount: number | string | Decimal): Money {
        return new Money(amount);
    }

    // Arithmetic
    add(other: Money | number | string): Money {
        return new Money(this.amount.plus(new Decimal(other instanceof Money ? other.amount : other)));
    }

    subtract(other: Money | number | string): Money {
        return new Money(this.amount.minus(new Decimal(other instanceof Money ? other.amount : other)));
    }

    multiply(factor: number | string): Money {
        return new Money(this.amount.times(new Decimal(factor)));
    }

    divide(divisor: number | string): Money {
        return new Money(this.amount.div(new Decimal(divisor)));
    }

    // Comparison
    equals(other: Money | number | string): boolean {
        return this.amount.equals(new Decimal(other instanceof Money ? other.amount : other));
    }

    lessThan(other: Money | number | string): boolean {
        return this.amount.lessThan(new Decimal(other instanceof Money ? other.amount : other));
    }

    greaterThan(other: Money | number | string): boolean {
        return this.amount.greaterThan(new Decimal(other instanceof Money ? other.amount : other));
    }

    // Value Access
    toNumber(): number {
        return this.amount.toNumber();
    }

    toString(): string {
        return this.amount.toString();
    }

    toFixed(decimalPlaces: number = 2): string {
        return this.amount.toFixed(decimalPlaces);
    }

    // Rounding
    // Uses ROUND_HALF_EVEN (Banker's Rounding) configured globally above
    round(decimalPlaces: number = 2): Money {
        return new Money(this.amount.toDecimalPlaces(decimalPlaces));
    }

    // Remainder Allocation / Split
    // Splits the current amount into 'count' parts, distributing the remainder
    // so the sum exactly matches the original amount.
    allocate(count: number): Money[] {
        if (count <= 0) throw new Error("Split count must be positive");

        // Basic split (floor)
        // We use floor to ensure we don't overshoot, then distribute remainder
        // Actually, let's work with minor units (cents) logic manually or trust decimal.js
        // Strategy: 
        // 1. Calculate base share (down to 2 decimal places usually, but let's say we want exactness)
        //    Actually for money we usually care about 2 decimal places (cents).
        // 2. 10.00 / 3 = 3.3333... 
        //    Base = 3.33
        //    Total allocated = 9.99
        //    Remainder = 0.01
        //    Give 0.01 to first person.

        const scale = 2; // Standard currency scale
        const totalMinorUnits = this.amount.times(Math.pow(10, scale)).floor(); // 1000 cents

        // Javascript's BigInt could be useful here if we were pure int, but Decimal is fine.
        const baseMinorUnit = totalMinorUnits.div(count).floor(); // 333
        const remainder = totalMinorUnits.minus(baseMinorUnit.times(count)); // 1

        const results: Money[] = [];
        for (let i = 0; i < count; i++) {
            let share = baseMinorUnit;
            if (i < remainder.toNumber()) {
                share = share.plus(1);
            }
            // Convert back to major units
            results.push(new Money(share.div(Math.pow(10, scale))));
        }

        return results;
    }

    // Allocate based on weights/ratios? 
    // This is useful for custom % splits, but for now we mostly need equal splits with remainder handling.

    // Absolute function
    abs(): Money {
        return new Money(this.amount.abs());
    }
}
