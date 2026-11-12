import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

declare const process: {
  env: {
    DATABASE_URL?: string;
  };
};

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
export const db = drizzle(client);