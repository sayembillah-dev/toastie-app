import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

import {
  PAYMENT_METHODS,
  type PaymentMethod,
  TRANSACTION_CATEGORIES,
  type TransactionCategory,
} from '../serializers';

export const TRANSACTION_DESCRIPTION_MAX = 200;
export const TRANSACTION_COUNTERPARTY_MAX = 120;
export const TRANSACTION_REFERENCE_MAX = 60;
export const BUDGET_LINE_NOTE_MAX = 200;
export const DUES_NOTE_MAX = 1000;

/** Body for `POST /transactions`. */
export class CreateTransactionDto {
  @IsString()
  @MinLength(1)
  date!: string;

  @IsIn(['in', 'out'])
  direction!: 'in' | 'out';

  @IsIn(TRANSACTION_CATEGORIES as readonly string[])
  category!: TransactionCategory;

  @IsInt()
  @Min(1)
  amountMinor!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(TRANSACTION_DESCRIPTION_MAX)
  description!: string;

  @IsIn(PAYMENT_METHODS as readonly string[])
  method!: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(TRANSACTION_COUNTERPARTY_MAX)
  counterparty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(TRANSACTION_REFERENCE_MAX)
  reference?: string;
}

export class UpdateTransactionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  date?: string;

  @IsOptional()
  @IsIn(['in', 'out'])
  direction?: 'in' | 'out';

  @IsOptional()
  @IsIn(TRANSACTION_CATEGORIES as readonly string[])
  category?: TransactionCategory;

  @IsOptional()
  @IsInt()
  @Min(1)
  amountMinor?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(TRANSACTION_DESCRIPTION_MAX)
  description?: string;

  @IsOptional()
  @IsIn(PAYMENT_METHODS as readonly string[])
  method?: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(TRANSACTION_COUNTERPARTY_MAX)
  counterparty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(TRANSACTION_REFERENCE_MAX)
  reference?: string;
}

/** Body for `PATCH /dues-records/:recordId`. `amountPaidMinor` at 0 or
 * `waived: true` retires the linked ledger entry; positive amountPaid
 * creates/updates it. Handled server-side in a `$transaction`. */
export class UpdateDuesRecordDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  amountPaidMinor?: number;

  @IsOptional()
  @IsBoolean()
  waived?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  paidOn?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(PAYMENT_METHODS as readonly string[])
  method?: PaymentMethod | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(DUES_NOTE_MAX)
  note?: string | null;
}

export class CreateBudgetLineDto {
  @IsString()
  @MinLength(1)
  fiscalYear!: string;

  @IsIn(['income', 'expense'])
  kind!: 'income' | 'expense';

  @IsIn(TRANSACTION_CATEGORIES as readonly string[])
  category!: TransactionCategory;

  @IsInt()
  @Min(0)
  plannedMinor!: number;

  @IsOptional()
  @IsString()
  @MaxLength(BUDGET_LINE_NOTE_MAX)
  note?: string;
}

export class UpdateBudgetLineDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  plannedMinor?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(BUDGET_LINE_NOTE_MAX)
  note?: string | null;
}
