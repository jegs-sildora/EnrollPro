import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function check() {
  const res = await pool.query("SELECT status, count(*) FROM learners GROUP BY status;");
  console.log("Learner status counts:", res.rows);
  await pool.end();
}
check();
