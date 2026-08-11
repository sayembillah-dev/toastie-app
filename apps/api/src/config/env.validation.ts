import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

/** Deployment environment. Deliberately *not* `NODE_ENV`.
 *
 * `NODE_ENV` is owned by the tooling — `next build` and PM2 both force it to
 * `production` — so it cannot express "a production-mode build running on a
 * laptop with no Redis reachable". `APP_ENV` is ours: it is the single switch
 * that decides whether infrastructure-backed features (BullMQ/Redis) are wired
 * up at all. See `queue.module.ts`. */
export enum AppEnv {
  Development = 'development',
  Production = 'production',
}

/** Where uploaded bytes live. `local-db` inlines them as base64 data-URLs in
 * the owning row's `Text` column — the original backend, kept because it needs
 * no infrastructure at all and so keeps `pnpm dev` working on a fresh clone
 * with nothing but Postgres. `s3` stores an object per file and keeps only the
 * key in the column. See `src/storage`. */
export enum FileStorageProvider {
  LocalDb = 'local-db',
  S3 = 's3',
}

/** Placeholder values shipped in `.env.example`. Booting production with one of
 * these still "works" — which is exactly why it has to be a hard failure. */
const PLACEHOLDER_SECRETS = new Set(['change-me-in-.env', 'change-me-in-.env-too']);

class EnvironmentVariables {
  @IsOptional()
  @IsEnum(AppEnv, { message: 'APP_ENV must be either "development" or "production"' })
  APP_ENV: AppEnv = AppEnv.Development;

  @IsString()
  @IsNotEmpty({ message: 'DATABASE_URL is required — Prisma cannot connect without it' })
  DATABASE_URL!: string;

  @IsOptional()
  @IsString()
  PORT?: string;

  // Access tokens are JWTs; refresh tokens are opaque random strings, so there
  // is deliberately no JWT_REFRESH_SECRET here — see token.service.ts.
  @IsString()
  @MinLength(16, { message: 'JWT_ACCESS_SECRET must be at least 16 characters' })
  JWT_ACCESS_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_TTL?: string;

  @IsOptional()
  @IsString()
  JWT_REFRESH_TTL?: string;

  // Only enforced in production: local dev falls back to http://localhost:3000
  // in main.ts, but a production box serving a wrong origin is a real security
  // problem rather than an inconvenience.
  @ValidateIf((env: EnvironmentVariables) => env.APP_ENV === AppEnv.Production)
  @IsString()
  @IsNotEmpty({ message: 'CORS_ORIGINS is required when APP_ENV=production' })
  CORS_ORIGINS?: string;

  // NOT required by APP_ENV=production alone — QueueModule always binds the
  // no-op InlineQueueService today (see queue.module.ts), regardless of
  // environment, because no job type exists yet. Demanding infrastructure
  // that nothing connects to turned the first-ever production boot into a
  // crash loop. Validated for shape if present so a typo'd URL still fails
  // loudly; move this to a hard requirement (add @IsNotEmpty +
  // @ValidateIf(APP_ENV===production) back) in the same change that gives
  // QueueModule a real BullMQ binding — see docs/DEPLOYMENT.md's Redis
  // rollout section.
  @IsOptional()
  @Matches(/^rediss?:\/\/.+/, { message: 'REDIS_URL must be a redis:// or rediss:// URL' })
  REDIS_URL?: string;

  // Web Push pipeline (see src/push). All three optional together — nobody
  // has generated real keys yet (`pnpm dlx web-push generate-vapid-keys`),
  // so `PushService.send()` just no-ops until they're set rather than
  // failing boot. Subscribe/unsubscribe work with no keys at all.
  @IsOptional()
  @IsString()
  VAPID_PUBLIC_KEY?: string;

  @IsOptional()
  @IsString()
  VAPID_PRIVATE_KEY?: string;

  // A contact URI the push services can reach if they need to reach the
  // sender — conventionally `mailto:someone@example.com`.
  @IsOptional()
  @IsString()
  VAPID_SUBJECT?: string;

  // Object storage (see src/storage). Defaults to `local-db` so a fresh clone
  // boots with no AWS account in sight; the four AWS_* vars below are demanded
  // only once someone opts into `s3`. Half-configured S3 is the dangerous
  // state — a bucket with no credentials fails at the first upload, i.e. in
  // front of a user, rather than at boot — so they are all-or-nothing.
  @IsOptional()
  @IsEnum(FileStorageProvider, {
    message: 'FILE_STORAGE_PROVIDER must be either "local-db" or "s3"',
  })
  FILE_STORAGE_PROVIDER: FileStorageProvider = FileStorageProvider.LocalDb;

  @ValidateIf((env: EnvironmentVariables) => env.FILE_STORAGE_PROVIDER === FileStorageProvider.S3)
  @IsString()
  @IsNotEmpty({ message: 'AWS_REGION is required when FILE_STORAGE_PROVIDER=s3' })
  AWS_REGION?: string;

  @ValidateIf((env: EnvironmentVariables) => env.FILE_STORAGE_PROVIDER === FileStorageProvider.S3)
  @IsString()
  @IsNotEmpty({ message: 'AWS_S3_BUCKET is required when FILE_STORAGE_PROVIDER=s3' })
  AWS_S3_BUCKET?: string;

  @ValidateIf((env: EnvironmentVariables) => env.FILE_STORAGE_PROVIDER === FileStorageProvider.S3)
  @IsString()
  @IsNotEmpty({ message: 'AWS_ACCESS_KEY_ID is required when FILE_STORAGE_PROVIDER=s3' })
  AWS_ACCESS_KEY_ID?: string;

  @ValidateIf((env: EnvironmentVariables) => env.FILE_STORAGE_PROVIDER === FileStorageProvider.S3)
  @IsString()
  @IsNotEmpty({ message: 'AWS_SECRET_ACCESS_KEY is required when FILE_STORAGE_PROVIDER=s3' })
  AWS_SECRET_ACCESS_KEY?: string;

  // How long a minted GET signature stays valid. Read URLs are embedded in API
  // responses, so this is really "how stale may a page be before its images
  // 403" — long enough to outlive a page session, short enough that a leaked
  // response body stops being useful quickly.
  @IsOptional()
  @IsString()
  S3_SIGNED_GET_TTL_SECONDS?: string;

  // Upload signatures are handed out one per file and consumed immediately,
  // so this stays short.
  @IsOptional()
  @IsString()
  S3_SIGNED_PUT_TTL_SECONDS?: string;
}

/** Wired into `ConfigModule.forRoot({ validate })`, so it runs once at boot and
 * throws before any module is instantiated.
 *
 * Without this, a missing `JWT_ACCESS_SECRET` resolves to `undefined` and the
 * app starts happily — then signs tokens with an undefined secret. Failing at
 * boot turns a silent production security hole into a crash loop that PM2
 * surfaces immediately.
 *
 * Extra keys are intentionally preserved rather than whitelisted away: the
 * process environment carries plenty of unrelated variables (PATH, HOME, PM2's
 * own bookkeeping) and `ConfigService` must keep seeing them. */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const parsed = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const messages = validateSync(parsed, { skipMissingProperties: false, whitelist: false })
    .flatMap((error) => Object.values(error.constraints ?? {}))
    .filter(Boolean);

  // Checked outside the decorator chain because it is a cross-field rule
  // (secret value × environment) rather than a property-shape rule.
  if (parsed.APP_ENV === AppEnv.Production && PLACEHOLDER_SECRETS.has(parsed.JWT_ACCESS_SECRET)) {
    messages.push(
      'JWT_ACCESS_SECRET is still the .env.example placeholder — generate a real secret before deploying',
    );
  }

  if (messages.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n${messages.map((line) => `  - ${line}`).join('\n')}`,
    );
  }

  return parsed as unknown as Record<string, unknown>;
}
