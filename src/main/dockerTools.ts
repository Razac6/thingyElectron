// Pure helpers for the Docker tool (Dev Notes > Docker): parsing `docker ps` output,
// recognising database images and building connection strings from a container's env.

export type ContainerState =
  | 'running'
  | 'exited'
  | 'created'
  | 'paused'
  | 'restarting'
  | 'dead'
  | 'removing';

export type DbKind =
  | 'postgres'
  | 'mysql'
  | 'mariadb'
  | 'mongo'
  | 'redis'
  | 'mssql'
  | 'elasticsearch'
  | 'clickhouse'
  | 'cassandra'
  | 'oracle'
  | 'neo4j'
  | 'rabbitmq'
  | 'kafka';

export interface PortMapping {
  hostIp: string;
  hostPort: number;
  containerPort: number;
  protocol: string;
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: ContainerState | string;
  status: string; // "Up 2 hours", "Exited (0) 3 days ago"
  ports: PortMapping[];
  project: string | null; // docker compose project
  createdAt: string;
  db: DbKind | null;
}

export interface ConnectionString {
  label: string;
  value: string;
}

// Image name fragments -> database kind (checked against the repo name, no tag)
const DB_IMAGES: [RegExp, DbKind][] = [
  [
    /(^|\/)(postgres|postgis|timescaledb|pgvector|supabase\/postgres)/,
    'postgres',
  ],
  [/(^|\/)mariadb/, 'mariadb'],
  [/(^|\/)(mysql|percona)/, 'mysql'],
  [/(^|\/)mongo/, 'mongo'],
  [/(^|\/)(redis|valkey|keydb|dragonfly)/, 'redis'],
  [/mssql|sql-server|azure-sql-edge/, 'mssql'],
  [/(^|\/)(elasticsearch|opensearch)/, 'elasticsearch'],
  [/(^|\/)clickhouse/, 'clickhouse'],
  [/(^|\/)(cassandra|scylla)/, 'cassandra'],
  [/oracle|gvenzl\/oracle/, 'oracle'],
  [/(^|\/)neo4j/, 'neo4j'],
  [/(^|\/)rabbitmq/, 'rabbitmq'],
  [/kafka|redpanda/, 'kafka'],
];

// The port each database listens on inside the container
export const DB_PORTS: Record<DbKind, number> = {
  postgres: 5432,
  mysql: 3306,
  mariadb: 3306,
  mongo: 27017,
  redis: 6379,
  mssql: 1433,
  elasticsearch: 9200,
  clickhouse: 8123,
  cassandra: 9042,
  oracle: 1521,
  neo4j: 7687,
  rabbitmq: 5672,
  kafka: 9092,
};

export const detectDb = (image: string): DbKind | null => {
  const repo = image
    .toLowerCase()
    .split('@')[0]
    .replace(/:[^/]*$/, '');
  const hit = DB_IMAGES.find(([re]) => re.test(repo));
  return hit ? hit[1] : null;
};

/** "0.0.0.0:5432->5432/tcp, :::5432->5432/tcp, 9000/tcp" -> host mappings (deduplicated). */
export const parsePorts = (ports: string): PortMapping[] => {
  const out: PortMapping[] = [];
  (ports || '').split(/,\s*/).forEach((part) => {
    // host range "0.0.0.0:8000-8001->8000-8001/tcp" or single
    const m = part
      .trim()
      .match(/^(.*):(\d+)(?:-(\d+))?->(\d+)(?:-(\d+))?\/(\w+)$/);
    if (!m) return;
    const [, ip, hostFrom, hostTo, contFrom, , protocol] = m;
    const count = hostTo ? Number(hostTo) - Number(hostFrom) + 1 : 1;
    for (let i = 0; i < Math.min(count, 50); i += 1) {
      const mapping = {
        hostIp: ip,
        hostPort: Number(hostFrom) + i,
        containerPort: Number(contFrom) + i,
        protocol,
      };
      // IPv4 + IPv6 bindings of the same port show up twice
      if (
        !out.some(
          (o) =>
            o.hostPort === mapping.hostPort && o.protocol === mapping.protocol,
        )
      ) {
        out.push(mapping);
      }
    }
  });
  return out;
};

const parseLabels = (labels: string) => {
  const map: Record<string, string> = {};
  (labels || '').split(',').forEach((pair) => {
    const i = pair.indexOf('=');
    if (i > 0) map[pair.slice(0, i).trim()] = pair.slice(i + 1);
  });
  return map;
};

/** Output of `docker ps -a --no-trunc --format '{{json .}}'` (one JSON object per line). */
export const parseContainers = (output: string): DockerContainer[] =>
  output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean)
    .map((raw: any) => {
      const status = String(raw.Status || '');
      const state =
        String(raw.State || '').toLowerCase() ||
        (status.startsWith('Up') ? 'running' : 'exited');
      const image = String(raw.Image || '');
      return {
        id: String(raw.ID || '').slice(0, 12),
        name: String(raw.Names || '').split(',')[0],
        image,
        state,
        status,
        ports: parsePorts(String(raw.Ports || '')),
        project:
          parseLabels(String(raw.Labels || ''))['com.docker.compose.project'] ||
          null,
        createdAt: String(raw.CreatedAt || ''),
        db: detectDb(image),
      };
    });

export const envToMap = (env: string[] = []) => {
  const map: Record<string, string> = {};
  env.forEach((entry) => {
    const i = entry.indexOf('=');
    if (i > 0) map[entry.slice(0, i)] = entry.slice(i + 1);
  });
  return map;
};

const enc = encodeURIComponent;
const auth = (user?: string, password?: string) => {
  if (!user && !password) return '';
  return `${user ? enc(user) : ''}${password ? `:${enc(password)}` : ''}@`;
};

/**
 * Connection strings for a database container, from its env (the variables the official
 * images read) and the host port it's published on. Empty when the port isn't published.
 */
export const connectionStrings = (
  kind: DbKind,
  env: Record<string, string>,
  hostPort: number | null,
  host = 'localhost',
): ConnectionString[] => {
  if (!hostPort) return [];
  const at = `${host}:${hostPort}`;
  switch (kind) {
    case 'postgres': {
      const user = env.POSTGRES_USER || 'postgres';
      const password = env.POSTGRES_PASSWORD;
      const db = env.POSTGRES_DB || user;
      return [
        {
          label: 'URL',
          value: `postgresql://${auth(user, password)}${at}/${db}`,
        },
        { label: 'JDBC', value: `jdbc:postgresql://${at}/${db}` },
        {
          label: 'psql',
          value: `psql -h ${host} -p ${hostPort} -U ${user} ${db}`,
        },
      ];
    }
    case 'mysql':
    case 'mariadb': {
      const p = kind === 'mariadb' ? 'MARIADB' : 'MYSQL';
      const get = (k: string) => env[`${p}_${k}`] || env[`MYSQL_${k}`];
      const user = get('USER') || 'root';
      const password = get('USER') ? get('PASSWORD') : get('ROOT_PASSWORD');
      const db = get('DATABASE') || '';
      return [
        { label: 'URL', value: `mysql://${auth(user, password)}${at}/${db}` },
        { label: 'JDBC', value: `jdbc:${kind}://${at}/${db}` },
        {
          label: 'CLI',
          value: `mysql -h 127.0.0.1 -P ${hostPort} -u ${user} -p${db ? ` ${db}` : ''}`,
        },
      ];
    }
    case 'mongo': {
      const user = env.MONGO_INITDB_ROOT_USERNAME;
      const password = env.MONGO_INITDB_ROOT_PASSWORD;
      const db = env.MONGO_INITDB_DATABASE || '';
      return [
        {
          label: 'URL',
          value: `mongodb://${auth(user, password)}${at}/${db}${user ? '?authSource=admin' : ''}`,
        },
      ];
    }
    case 'redis': {
      const password = env.REDIS_PASSWORD;
      return [
        { label: 'URL', value: `redis://${auth('', password)}${at}` },
        { label: 'CLI', value: `redis-cli -h ${host} -p ${hostPort}` },
      ];
    }
    case 'mssql': {
      const password = env.MSSQL_SA_PASSWORD || env.SA_PASSWORD || '';
      return [
        {
          label: 'ADO.NET',
          value: `Server=${host},${hostPort};User Id=sa;Password=${password};TrustServerCertificate=True`,
        },
        {
          label: 'JDBC',
          value: `jdbc:sqlserver://${at};user=sa;encrypt=false`,
        },
      ];
    }
    case 'oracle': {
      const service = env.ORACLE_DATABASE || 'FREEPDB1';
      return [{ label: 'JDBC', value: `jdbc:oracle:thin:@${at}/${service}` }];
    }
    case 'elasticsearch':
    case 'clickhouse':
      return [{ label: 'HTTP', value: `http://${at}` }];
    case 'neo4j':
      return [{ label: 'Bolt', value: `bolt://${at}` }];
    case 'rabbitmq': {
      const user = env.RABBITMQ_DEFAULT_USER || 'guest';
      const password = env.RABBITMQ_DEFAULT_PASS || 'guest';
      return [{ label: 'AMQP', value: `amqp://${auth(user, password)}${at}` }];
    }
    default:
      return [{ label: 'Host', value: at }];
  }
};

/** The published host port for the database's own port (or the first published TCP port). */
export const dbHostPort = (container: DockerContainer): number | null => {
  if (!container.db) return null;
  const tcp = container.ports.filter((p) => p.protocol === 'tcp');
  const own = tcp.find((p) => p.containerPort === DB_PORTS[container.db!]);
  return (own || tcp[0])?.hostPort ?? null;
};

/** Containers with no ID or a weird one are never passed to the CLI. */
export const isSafeContainerRef = (ref: string) =>
  /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(ref);
