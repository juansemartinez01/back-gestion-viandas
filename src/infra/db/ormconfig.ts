import { DataSourceOptions } from 'typeorm';

export function makeOrmConfig(databaseUrl: string): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,

    entities: [__dirname + '/../../modules/**/*.entity{.ts,.js}'],

    // Las migrations NO van aquí: el app compilado no puede cargar .ts sin ts-node.
    // La CLI (data-source.ts) agrega la ruta de migrations directamente.
    synchronize: false,
    migrationsRun: false,
    logging: false,
  };
}
