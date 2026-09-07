import {Pool} from 'pg';
const shared=globalThis as typeof globalThis & {aurumPool?:Pool};
export function db(){
 if(!shared.aurumPool){
  if(!process.env.PGPASSWORD&&!process.env.DATABASE_URL)throw Error('La base de datos no está configurada.');
  shared.aurumPool=new Pool({...(process.env.DATABASE_URL?{connectionString:process.env.DATABASE_URL}:{}),max:10,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
  shared.aurumPool.on('error',()=>console.error('Conexión inactiva de PostgreSQL interrumpida.'));
 }
 return shared.aurumPool;
}
