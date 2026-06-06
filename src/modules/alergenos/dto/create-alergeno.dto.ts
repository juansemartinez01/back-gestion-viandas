import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAlergenoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcion?: string;
}
