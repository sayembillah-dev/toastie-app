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
