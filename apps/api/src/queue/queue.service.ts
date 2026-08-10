/** Payload contract for every background job in the system.
 *
 * Declare a job here before enqueuing it — the map is what gives `enqueue()`
 * its per-job payload type. While it is empty `JobName` is `never`, so the
 * compiler rejects any `enqueue()` call: there are genuinely no jobs yet, and
 * that is enforced rather than merely documented.
 *
 * Example once BullMQ lands:
 *   'email:send': { to: string; template: string };
 */
// biome-ignore lint/suspicious/noEmptyInterface: intentionally empty until the first job is declared
export interface JobPayloads {}

export type JobName = keyof JobPayloads & string;

/** Injection token *and* contract for enqueuing background work.
 *
 * An abstract class rather than an interface + symbol because Nest can use the
 * class itself as the DI token, so call sites read `constructor(private queue:
 * QueueService)` with no `@Inject()` decorator.
 *
 * Consumers never branch on the environment — `QueueModule.forRoot()` decides
 * which implementation is bound. That is the whole point of this seam: adding
 * Redis must not scatter `if (isProduction)` across the codebase. */
export abstract class QueueService {
  abstract enqueue<N extends JobName>(name: N, payload: JobPayloads[N]): Promise<void>;
}
