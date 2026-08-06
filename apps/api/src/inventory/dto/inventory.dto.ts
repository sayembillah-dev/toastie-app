import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const INVENTORY_TITLE_MAX = 120;
export const INVENTORY_DESCRIPTION_MAX = 600;
export const CHECKLIST_ITEM_TEXT_MAX = 120;

export const INVENTORY_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;
export type InventoryImageMimeType = (typeof INVENTORY_IMAGE_MIME_TYPES)[number];

/** Data-URL payload ceiling — 4 MB × 4/3 base64 blowup. */
const DATA_URL_MAX = 6 * 1024 * 1024;

/** Body for `POST /inventory-items`. `imageUrl` + `imageMimeType` travel as
 * a pair — either both present or both absent. */
export class CreateInventoryItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(INVENTORY_TITLE_MAX)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(INVENTORY_DESCRIPTION_MAX)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DATA_URL_MAX)
  imageUrl?: string;

  @IsOptional()
  @IsIn(INVENTORY_IMAGE_MIME_TYPES as readonly string[])
  imageMimeType?: InventoryImageMimeType;
}

/** Body for `PATCH /inventory-items/:itemId`. `imageUrl: null` explicitly
 * clears an existing image; omitting the key leaves it alone. */
export class UpdateInventoryItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(INVENTORY_TITLE_MAX)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(INVENTORY_DESCRIPTION_MAX)
  description?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(DATA_URL_MAX)
  imageUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(INVENTORY_IMAGE_MIME_TYPES as readonly string[])
  imageMimeType?: InventoryImageMimeType | null;
}

export class CreateChecklistItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(CHECKLIST_ITEM_TEXT_MAX)
  text!: string;
}

export class UpdateChecklistItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(CHECKLIST_ITEM_TEXT_MAX)
  text?: string;

  @IsOptional()
  @IsBoolean()
  done?: boolean;
}
