import {pgTable,text,timestamp} from 'drizzle-orm/pg-core';
export const records=pgTable('records',{id:text('id').primaryKey(),kind:text('kind').notNull(),payload:text('payload').notNull(),updated:timestamp('updated',{withTimezone:true}).notNull()});
