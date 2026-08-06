import { Injectable, Logger } from '@nestjs/common';
import type { Lineage } from '@toastly/access';

import { PrismaService } from '@/prisma';

interface Entry {
  lineage: Lineage;
  expiresAt: number;
}

/** Per-request scope resolution runs on every authenticated call. Joining
 * the org tree each time (`Club → Area → Division → District`) at 100
 * clubs is fine at low RPS, but pointless — reparenting runs approximately
 * never (one `components/org/move-modal.tsx` action), so the answer is
 * stable across requests. In-memory `Map` with a 60s TTL is cheap; the
 * reparent transaction calls `invalidate(clubId)` synchronously, so the
 * cache never serves post-move stale data. */
@Injectable()
export class ClubLineageCache {
  private readonly logger = new Logger(ClubLineageCache.name);
  private readonly cache = new Map<string, Entry>();
  private readonly ttlMs = 60_000;

  constructor(private readonly prisma: PrismaService) {}

  async getLineage(clubId: string, now: number): Promise<Lineage | null> {
    const hit = this.cache.get(clubId);
    if (hit && hit.expiresAt > now) return hit.lineage;

    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true, areaId: true, divisionId: true, districtId: true },
    });
    if (!club) return null;

    const lineage: Lineage = {
      clubId: club.id,
      areaId: club.areaId ?? undefined,
      divisionId: club.divisionId ?? undefined,
      districtId: club.districtId ?? undefined,
    };
    this.cache.set(clubId, { lineage, expiresAt: now + this.ttlMs });
    return lineage;
  }

  /** Called from the reparent transaction (S9). Also usable in tests to
   * force a re-fetch without waiting for the TTL. */
  invalidate(clubId?: string): void {
    if (clubId) {
      this.cache.delete(clubId);
      return;
    }
    this.cache.clear();
  }
}
