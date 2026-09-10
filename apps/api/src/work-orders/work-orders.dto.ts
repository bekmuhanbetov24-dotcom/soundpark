import { IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export class CreateWorkOrderDto {
  @IsString() @MinLength(1) @MaxLength(100) number!: string;
  @IsDateString() startsOn!: string;
  @IsDateString() endsOn!: string;
  @IsOptional() @IsString() @MaxLength(300) eventName?: string;
  @IsOptional() @IsString() @MaxLength(300) venue?: string;
  @IsString() @MinLength(1) @MaxLength(200) filledByName!: string;
  @IsOptional() @IsString() @MaxLength(300) transport?: string;
  @IsOptional() @IsNumber() @Min(0) lightAmount?: number;
  @IsOptional() @IsNumber() @Min(0) soundAmount?: number;
  @IsOptional() @IsNumber() @Min(0) structuresAmount?: number;
  @IsOptional() @IsIn(['draft', 'in_progress', 'completed', 'calculated', 'closed']) status?: string;
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}

export class UpdateWorkOrderDto extends CreateWorkOrderDto {}

export class UpsertParticipantDto {
  @IsUUID() helperId!: string;
  @IsBoolean() loading!: boolean;
  @IsOptional() @IsNumber() @Min(0) loadingAmount?: number;
  @IsBoolean() unloading!: boolean;
  @IsOptional() @IsNumber() @Min(0) unloadingAmount?: number;
  @IsBoolean() installation!: boolean;
  @IsOptional() @IsNumber() @Min(0) installationAmount?: number;
  @IsBoolean() dismantling!: boolean;
  @IsOptional() @IsNumber() @Min(0) dismantlingAmount?: number;
  @IsBoolean() flatRate!: boolean;
  @IsOptional() @IsNumber() @Min(0) flatRateAmount?: number;
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}
