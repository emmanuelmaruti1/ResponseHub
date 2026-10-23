
const { Pool } = require("pg");

const isProduction = process.env.NODE_ENV === "production";
const databaseUrl = process.env.DATABASE_URL;

if (isProduction && !databaseUrl) {
  throw new Error(
    "DATABASE_URL is missing. Configure it in the Render web service Environment settings."
  );
}

const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: isProduction ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    })
  : new Pool({
      user: process.env.DB_USER || "postgres",
      host: process.env.DB_HOST || "localhost",
      database: process.env.DB_NAME || "responsehub",
      password: process.env.DB_PASSWORD,
      port: Number(process.env.DB_PORT || 5432),
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    });

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error.message);
});

module.exports = pool;
