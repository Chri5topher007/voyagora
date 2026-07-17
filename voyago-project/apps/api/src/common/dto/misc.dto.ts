import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { BOOKABLE_ITEM_TYPES } from './booking.dto';

export class CreateReviewDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsString() @MinLength(1) comment!: string;
  @IsOptional() @IsString() tourId?: string;
  @IsOptional() @IsString() eventId?: string;
}

export class GetReviewsQueryDto {
  @IsString() itemId!: string;
  @IsIn(BOOKABLE_ITEM_TYPES) itemType!: string;
}

export class ToggleWishlistDto {
  @IsString() itemId!: string;
  @IsIn(BOOKABLE_ITEM_TYPES) itemType!: string;
}

export class SubmitPlaceDto {
  @IsString() @MinLength(2) name!: string;
  @IsString() @MinLength(10) description!: string;
  @IsString() imageUrl!: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
}

export class GenerateItineraryDto {
  @IsString() @MinLength(3) @MaxLength(500)
  prompt!: string;
}
