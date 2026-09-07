import {db} from '@/lib/storage';
export const dynamic='force-dynamic';
export async function GET(){try{await db().query('SELECT id FROM records LIMIT 1');return Response.json({status:'ok'});}catch{return Response.json({status:'unavailable'},{status:503});}}
