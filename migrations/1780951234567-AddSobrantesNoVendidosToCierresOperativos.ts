import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSobrantesNoVendidosToCierresOperativos1780951234567 implements MigrationInterface {
  name = 'AddSobrantesNoVendidosToCierresOperativos1780951234567';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cierres_operativos" ADD "cantidad_sobrantes_no_vendidos" integer NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cierres_operativos" DROP COLUMN "cantidad_sobrantes_no_vendidos"`,
    );
  }
}
