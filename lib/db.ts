import "server-only";
import postgres from "postgres";

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} env var is not set`);
  }
  return value;
}

function createSql() {
  return postgres(getEnv("DATABASE_URL"), {
    max: 10,
    types: {
      timestamptz: {
        to: 1184,
        from: [1184],
        serialize: (x: string | Date) =>
          x instanceof Date ? x.toISOString() : x,
        parse: (x: string) => new Date(x).toISOString(),
      },
    },
  });
}

type Sql = ReturnType<typeof createSql>;

const globalForDb = globalThis as unknown as { wondersSql?: Sql };

function getSql(): Sql {
  globalForDb.wondersSql ??= createSql();
  return globalForDb.wondersSql;
}

export const sql = new Proxy((() => {}) as unknown as Sql, {
  apply: (_target, _this, args) =>
    (getSql() as unknown as (...a: unknown[]) => unknown)(...args),
  get: (_target, prop) => {
    const value = Reflect.get(getSql(), prop);
    return typeof value === "function" ? value.bind(getSql()) : value;
  },
});
