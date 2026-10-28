'use strict';

// Activa Row Level Security en todas las tablas del esquema public.
//
// En Supabase el esquema public queda expuesto por la API REST (PostgREST) al rol
// `anon`: sin RLS, cualquiera con la clave pública del proyecto podía leer y escribir
// usuarios (con hashes de contraseña), documentos y auditoría. La app no usa esa API;
// el backend se conecta como `postgres`, dueño de las tablas, y el dueño no está
// sujeto a RLS (no se usa FORCE). Sin políticas, `anon` y `authenticated` no ven nada.
//
// En un PostgreSQL local sin esos roles el cambio no tiene efecto visible.
const TABLES = [
  'SequelizeMeta', 'audit_logs', 'backup_logs', 'doc_types', 'documents',
  'jals', 'notifications', 'radicado_counters', 'sync_queue', 'users',
];

module.exports = {
  async up(queryInterface) {
    for (const t of TABLES) {
      await queryInterface.sequelize.query(`ALTER TABLE IF EXISTS public."${t}" ENABLE ROW LEVEL SECURITY`);
    }
  },

  async down(queryInterface) {
    for (const t of TABLES) {
      await queryInterface.sequelize.query(`ALTER TABLE IF EXISTS public."${t}" DISABLE ROW LEVEL SECURITY`);
    }
  },
};
