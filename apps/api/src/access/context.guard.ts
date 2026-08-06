import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type {
  ActiveContextKey,
  Lineage,
  PermissionSubject,
  SessionResponse,
} from '@toastly/access';
import type { Request } from 'express';

import { ClubLineageCache } from './club-lineage.cache';
import { PUBLIC_METADATA } from './requires.decorator';
import { SubjectFactory } from './subject.factory';

/** Shape written onto `req.ctx` and read by `PermissionGuard`. Kept small
 * — anything richer belongs on a service call, not the request. */
export interface RequestContext {
  session: SessionResponse;
  subject: PermissionSubject;
  contextKey: ActiveContextKey | null;
  clubId: string | null;
  lineage: Lineage;
}

const CONTEXT_HEADER = 'x-toastly-context';

/** Runs after `JwtAuthGuard`. Loads the caller's session + subject, then
 * validates the `X-Toastly-Context` header (if any) against the assignments
 * the DB actually says they hold. Anything else is a forgery attempt —
 * respond with 403 `CONTEXT_NOT_HELD` rather than any hint of what they
 * do hold. */
@Injectable()
export class ContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subjectFactory: SubjectFactory,
    private readonly lineageCache: ClubLineageCache,
  ) {}

  async canActivate(execCtx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_METADATA, [
      execCtx.getHandler(),
      execCtx.getClass(),
    ]);
    if (isPublic) return true;

    const req = execCtx.switchToHttp().getRequest<Request>();
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Not authenticated');

    const now = Date.now();
    const session = await this.subjectFactory.loadSession(userId, now);
    if (!session) {
      throw new UnauthorizedException('User no longer active');
    }
    const subject = this.subjectFactory.toSubject(session);

    const headerValue = req.headers[CONTEXT_HEADER];
    const rawContext = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const parsed = parseContextKey(rawContext);

    if (parsed === undefined) {
      throw new ForbiddenException({
        code: 'CONTEXT_INVALID',
        message: 'X-Toastly-Context header is malformed',
      });
    }

    if (parsed === null) {
      req.ctx = {
        session,
        subject,
        contextKey: null,
        clubId: null,
        lineage: {},
      };
      return true;
    }

    // For `club:<id>`, an Area/Division/District Director may hold the
    // context via lineage even without a Membership row — resolveLineage
    // has to run first to answer that. Every other context kind
    // (`global`/`area`/`division`/`district`) is a direct session lookup.
    const lineage = await resolveLineage(parsed, session, this.lineageCache, now);
    if (!isContextHeld(parsed, session, lineage)) {
      throw new ForbiddenException({
        code: 'CONTEXT_NOT_HELD',
        message: 'You do not hold that context',
      });
    }

    const clubId = parsed.startsWith('club:') ? parsed.slice('club:'.length) : null;

    req.ctx = {
      session,
      // Stamp the resolved lineage onto the subject so a service `can()`
      // call that only knows the target `clubId` still matches an org
      // assignment anchored on the parent area/division/district.
      subject: { ...subject, contextLineage: lineage },
      contextKey: parsed,
      clubId,
      lineage,
    };
    return true;
  }
}

function parseContextKey(raw: string | undefined): ActiveContextKey | null | undefined {
  if (raw === undefined || raw === '') return null;
  if (raw === 'global') return 'global';
  const idx = raw.indexOf(':');
  if (idx <= 0) return undefined;
  const kind = raw.slice(0, idx);
  const id = raw.slice(idx + 1);
  if (!id) return undefined;
  if (kind === 'club' || kind === 'area' || kind === 'division' || kind === 'district') {
    return `${kind}:${id}` as ActiveContextKey;
  }
  return undefined;
}

function isContextHeld(key: ActiveContextKey, session: SessionResponse, lineage: Lineage): boolean {
  if (key === 'global') return session.user.isSuperAdmin;
  if (key.startsWith('club:')) {
    const clubId = key.slice('club:'.length);
    // Direct membership — the common case.
    if (session.memberships.some((m) => m.clubId === clubId)) return true;
    // Director drill-in — the caller holds an org assignment whose anchor
    // is somewhere in the target club's lineage. Lineage was already
    // resolved by `resolveLineage`; this is a pure comparison, no DB.
    return session.orgAssignments.some((a) => {
      if (a.unitType === 'area') return a.unitId === lineage.areaId;
      if (a.unitType === 'division') return a.unitId === lineage.divisionId;
      if (a.unitType === 'district') return a.unitId === lineage.districtId;
      return false;
    });
  }
  const idx = key.indexOf(':');
  const unitType = key.slice(0, idx) as 'area' | 'division' | 'district';
  const unitId = key.slice(idx + 1);
  return session.orgAssignments.some((a) => a.unitType === unitType && a.unitId === unitId);
}

async function resolveLineage(
  key: ActiveContextKey,
  session: SessionResponse,
  cache: ClubLineageCache,
  now: number,
): Promise<Lineage> {
  if (key === 'global') return {};
  if (key.startsWith('club:')) {
    const clubId = key.slice('club:'.length);
    const inSession = session.memberships.find((m) => m.clubId === clubId);
    if (inSession) return inSession.lineage;
    // Director drill-in: fetch (once, cached) the target club's lineage
    // so `isContextHeld` can compare against area/division/district
    // assignments and the permission engine can enrich targets.
    return (await cache.getLineage(clubId, now)) ?? { clubId };
  }
  const inSession = session.orgAssignments.find((a) => `${a.unitType}:${a.unitId}` === key);
  return inSession?.lineage ?? {};
}
