import { IsIn, IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

// itemType is restricted to a whitelist everywhere it's used across the API
// (booking, review, wishlist) so a client can never point these dynamic
// Prisma model lookups at anything other than Tour or Event.
export const BOOKABLE_ITEM_TYPES = ['tour', 'event'] as const;

export class CreateCheckoutDto {
  @IsString() itemId!: string;
  @IsIn(BOOKABLE_ITEM_TYPES) itemType!: string;
  @IsOptional() @IsISO8601() travelDate?: string;
  @IsOptional() @IsString() couponCode?: string;
  @IsOptional() @IsIn(['FULL', 'ADVANCE']) paymentChoice?: string;
}

export class VerifyTicketDto {
  @IsString() @MinLength(1) qrCode!: string;
}
