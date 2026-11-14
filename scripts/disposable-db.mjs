export function disposableDatabaseEnvironment(connectionString, environment = process.env) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('A valid disposable local PostgreSQL URL is required.');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
      || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      || url.search || url.hash || url.pathname === '' || url.pathname === '/') {
    throw new Error('Only a direct local PostgreSQL URL with a database name and no parameters is allowed.');
  }

  let database;
  let username;
  let password;
  try {
    database = decodeURIComponent(url.pathname.slice(1));
    username = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
  } catch {
    throw new Error('Disposable database URL contains invalid encoding.');
  }
  if (!/^[A-Za-z0-9_][A-Za-z0-9_$-]*$/.test(database)
      || username.includes('\0') || password.includes('\0')) {
    throw new Error('Disposable database URL contains invalid connection details.');
  }

  const result = Object.fromEntries(
    Object.entries(environment).filter(([name]) => !/^PG/i.test(name))
  );
  result.PGHOST = url.hostname === '[::1]' ? '::1' : url.hostname;
  result.PGPORT = url.port || '5432';
  result.PGDATABASE = database;
  if (username) result.PGUSER = username;
  if (password) result.PGPASSWORD = password;
  return result;
}
