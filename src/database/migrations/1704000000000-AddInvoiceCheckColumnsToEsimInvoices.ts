import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddInvoiceCheckColumnsToEsimInvoices1704000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'esim_invoices',
      new TableColumn({
        name: 'checkScheduledAt',
        type: 'timestamp',
        isNullable: true,
        comment: 'Timestamp when invoice check was scheduled',
      }),
    );

    await queryRunner.addColumn(
      'esim_invoices',
      new TableColumn({
        name: 'nextCheckTime',
        type: 'timestamp',
        isNullable: true,
        comment: 'Next scheduled check time',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('esim_invoices', 'nextCheckTime');
    await queryRunner.dropColumn('esim_invoices', 'checkScheduledAt');
  }
}
