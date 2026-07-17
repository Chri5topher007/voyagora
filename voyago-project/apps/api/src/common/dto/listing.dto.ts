import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsISO8601, Max, Min, MinLength, IsArray } from 'class-validator';

export class CreateTourDto {
  @IsString() @MinLength(3) title!: string;
  @IsString() @MinLength(10) description!: string;
  @IsNumber() @Min(0) price!: number;
  @IsString() imageUrl!: string;
  @IsOptional() @IsArray() gallery?: string[];
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsOptional() @IsIn(['FULL', 'ADVANCE']) paymentType?: string;
  @IsOptional() @IsNumber() @Min(0) advanceAmount?: number;
  @IsOptional() @IsString() gstNumber?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) gstPercentage?: number;
}

export class CreateEventDto extends CreateTourDto {
  @IsISO8601({}, { message: 'eventDate must be a valid date' })
  eventDate!: string;
}

export class GetToursQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() maxPrice?: string;
}
