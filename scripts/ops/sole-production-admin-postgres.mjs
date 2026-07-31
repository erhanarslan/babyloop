import { SOLE_PRODUCTION_ADMIN_EMAIL } from "./sole-production-admin-lib.mjs";

export function createSoleProductionAdminPostgresAdapter(pool) {
  return {
    readSnapshot: () => readSnapshot(pool),
    async transaction(work) {
      const connection = await pool.connect();

      try {
        await connection.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
        const result = await work(createTransactionAdapter(connection));
        await connection.query("COMMIT");
        return result;
      } catch (error) {
        await connection.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        connection.release();
      }
    }
  };
}

function createTransactionAdapter(connection) {
  return {
    async lockRelevantUsers(targetEmail) {
      await connection.query(
        `select id
           from users
          where lower(btrim(email)) = $1 or role = 'admin'
          order by id
          for update`,
        [targetEmail]
      );
    },
    readSnapshot: () => readSnapshot(connection),
    async demoteOtherAdmins(targetEmail, updatedAt) {
      await connection.query(
        `update users
            set role = 'user', updated_at = $2
          where role = 'admin' and lower(btrim(email)) <> $1`,
        [targetEmail, updatedAt]
      );
    },
    async promoteTarget(targetEmail, updatedAt) {
      await connection.query(
        `update users
            set role = 'admin', updated_at = $2
          where lower(btrim(email)) = $1`,
        [targetEmail, updatedAt]
      );
    }
  };
}

async function readSnapshot(queryable) {
  const result = await queryable.query(
    `select
       u.email,
       u.email_verified_at as "emailVerifiedAt",
       u.is_demo_system_account as "isDemoSystemAccount",
       u.login_disabled as "loginDisabled",
       u.role,
       (
         select count(*)::integer
           from auth_accounts aa
          where aa.user_id = u.id and aa.provider = 'google'
       ) as "googleAuthAccountCount"
     from users u
     where lower(btrim(u.email)) = $1 or u.role = 'admin'
     order by lower(u.email), u.id`,
    [SOLE_PRODUCTION_ADMIN_EMAIL]
  );
  const rows = result.rows.map((row) => ({
    email: row.email,
    emailVerifiedAt: row.emailVerifiedAt,
    googleAuthAccountCount: Number(row.googleAuthAccountCount),
    isDemoSystemAccount: row.isDemoSystemAccount,
    loginDisabled: row.loginDisabled,
    role: row.role
  }));

  return {
    targets: rows.filter((row) => row.email.trim().toLowerCase() === SOLE_PRODUCTION_ADMIN_EMAIL),
    admins: rows.filter((row) => row.role === "admin")
  };
}
