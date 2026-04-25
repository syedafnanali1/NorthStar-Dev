const { Client } = require("pg");

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  const result = await client.query(`
    select
      count(*)::int as google_accounts,
      count(distinct user_id)::int as distinct_google_users
    from accounts
    where provider = 'google'
  `);

  console.log(JSON.stringify(result.rows[0]));
  await client.end();
})();
