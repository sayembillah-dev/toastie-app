import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { can, type PermissionSubject } from '@toastly/access';

import { ActivityService } from '@/activity';
import { PrismaService } from '@/prisma';

import type {
  CreateAssetDto,
  CreateDocumentDto,
  UpdateAssetDto,
  UpdateDocumentDto,
} from './dto/library.dto';
import {
  type AssetsPageWire,
  type AssetWire,
  type DocumentsPageWire,
  type DocumentWire,
  toAssetWire,
  toDocumentWire,
} from './serializers';

const ASSETS_PAGE_SIZE = 12;
const DOCUMENTS_PAGE_SIZE = 12;

export interface ListPageQuery {
  q?: string;
  offset?: number;
  limit?: number;
}

/** Handles `/assets` and `/documents` — the club's shared image and file
 * shelves. Ownership sits with VPPR per the plan's `library` resource;
 * every route runs the two-phase check against the loaded row's clubId. */
@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  /** ----------------------------------------------------------- assets -- */

  async listAssets(
    subject: PermissionSubject,
    clubId: string,
    query: ListPageQuery,
  ): Promise<AssetsPageWire> {
    this.assertLibrary(subject, clubId, 'read');
    const { offset, limit } = normalisePaging(query, ASSETS_PAGE_SIZE);
    const needle = query.q?.trim().toLowerCase() ?? '';
    // A DB `contains` filter with `mode: 'insensitive'` matches the
    // local-db's case-insensitive title search without pulling the whole
    // table into memory.
    const where = {
      clubId,
      ...(needle ? { title: { contains: needle, mode: 'insensitive' as const } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.asset.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: limit,
      }),
      this.prisma.asset.count({ where }),
    ]);
    const items = rows.map(toAssetWire);
    const nextOffset = offset + items.length < total ? offset + items.length : null;
    return { items, total, nextOffset };
  }

  async getAsset(subject: PermissionSubject, assetId: string): Promise<AssetWire> {
    const row = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!row) throw new NotFoundException(`No asset with id "${assetId}"`);
    this.assertLibrary(subject, row.clubId, 'read');
    return toAssetWire(row);
  }

  async createAsset(
    subject: PermissionSubject,
    clubId: string,
    actorMembershipId: string | null,
    dto: CreateAssetDto,
  ): Promise<AssetWire> {
    this.assertLibrary(subject, clubId, 'create');
    const row = await this.prisma.$transaction(async (tx) => {
      const asset = await tx.asset.create({
        data: {
          clubId,
          title: dto.title.trim(),
          imageUrl: dto.imageUrl,
          mimeType: dto.mimeType,
          width: Math.round(dto.width),
          height: Math.round(dto.height),
          sizeBytes: Math.round(dto.sizeBytes),
        },
      });
      await this.activity.record(
        {
          clubId,
          actorMembershipId,
          category: 'library',
          action: 'added an asset',
          summary: `Added "${asset.title}" to the asset register`,
          entityType: 'asset',
          entityId: asset.id,
        },
        tx,
      );
      return asset;
    });
    return toAssetWire(row);
  }

  async updateAsset(
    subject: PermissionSubject,
    assetId: string,
    actorMembershipId: string | null,
    dto: UpdateAssetDto,
  ): Promise<AssetWire> {
    const existing = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!existing) throw new NotFoundException(`No asset with id "${assetId}"`);
    this.assertLibrary(subject, existing.clubId, 'update');

    const row = await this.prisma.$transaction(async (tx) => {
      const asset = await tx.asset.update({
        where: { id: assetId },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          updatedAt: new Date(),
        },
      });
      await this.activity.record(
        {
          clubId: asset.clubId,
          actorMembershipId,
          category: 'library',
          action: 'updated an asset',
          summary: `Renamed an asset to "${asset.title}"`,
          entityType: 'asset',
          entityId: asset.id,
        },
        tx,
      );
      return asset;
    });
    return toAssetWire(row);
  }

  async deleteAsset(
    subject: PermissionSubject,
    assetId: string,
    actorMembershipId: string | null,
  ): Promise<null> {
    const existing = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!existing) throw new NotFoundException(`No asset with id "${assetId}"`);
    this.assertLibrary(subject, existing.clubId, 'delete');

    await this.prisma.$transaction(async (tx) => {
      await tx.asset.delete({ where: { id: assetId } });
      await this.activity.record(
        {
          clubId: existing.clubId,
          actorMembershipId,
          category: 'library',
          action: 'deleted an asset',
          summary: `Deleted asset "${existing.title}"`,
          entityType: 'asset',
          entityId: existing.id,
        },
        tx,
      );
    });
    return null;
  }

  /** -------------------------------------------------------- documents -- */

  async listDocuments(
    subject: PermissionSubject,
    clubId: string,
    query: ListPageQuery,
  ): Promise<DocumentsPageWire> {
    this.assertLibrary(subject, clubId, 'read');
    const { offset, limit } = normalisePaging(query, DOCUMENTS_PAGE_SIZE);
    const needle = query.q?.trim().toLowerCase() ?? '';
    const where = {
      clubId,
      ...(needle
        ? {
            OR: [
              { title: { contains: needle, mode: 'insensitive' as const } },
              { fileName: { contains: needle, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.libraryDocument.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: limit,
      }),
      this.prisma.libraryDocument.count({ where }),
    ]);
    const items = rows.map(toDocumentWire);
    const nextOffset = offset + items.length < total ? offset + items.length : null;
    return { items, total, nextOffset };
  }

  async getDocument(subject: PermissionSubject, documentId: string): Promise<DocumentWire> {
    const row = await this.prisma.libraryDocument.findUnique({ where: { id: documentId } });
    if (!row) throw new NotFoundException(`No document with id "${documentId}"`);
    this.assertLibrary(subject, row.clubId, 'read');
    return toDocumentWire(row);
  }

  async createDocument(
    subject: PermissionSubject,
    clubId: string,
    actorMembershipId: string | null,
    dto: CreateDocumentDto,
  ): Promise<DocumentWire> {
    this.assertLibrary(subject, clubId, 'create');
    const row = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.libraryDocument.create({
        data: {
          clubId,
          title: dto.title.trim(),
          fileName: dto.fileName.trim(),
          fileUrl: dto.fileUrl,
          mimeType: dto.mimeType,
          sizeBytes: Math.round(dto.sizeBytes),
        },
      });
      await this.activity.record(
        {
          clubId,
          actorMembershipId,
          category: 'library',
          action: 'uploaded a document',
          summary: `Uploaded "${doc.title}" to the library`,
          entityType: 'document',
          entityId: doc.id,
        },
        tx,
      );
      return doc;
    });
    return toDocumentWire(row);
  }

  async updateDocument(
    subject: PermissionSubject,
    documentId: string,
    actorMembershipId: string | null,
    dto: UpdateDocumentDto,
  ): Promise<DocumentWire> {
    const existing = await this.prisma.libraryDocument.findUnique({ where: { id: documentId } });
    if (!existing) throw new NotFoundException(`No document with id "${documentId}"`);
    this.assertLibrary(subject, existing.clubId, 'update');

    const row = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.libraryDocument.update({
        where: { id: documentId },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          updatedAt: new Date(),
        },
      });
      await this.activity.record(
        {
          clubId: doc.clubId,
          actorMembershipId,
          category: 'library',
          action: 'updated a document',
          summary: `Renamed a document to "${doc.title}"`,
          entityType: 'document',
          entityId: doc.id,
        },
        tx,
      );
      return doc;
    });
    return toDocumentWire(row);
  }

  async deleteDocument(
    subject: PermissionSubject,
    documentId: string,
    actorMembershipId: string | null,
  ): Promise<null> {
    const existing = await this.prisma.libraryDocument.findUnique({ where: { id: documentId } });
    if (!existing) throw new NotFoundException(`No document with id "${documentId}"`);
    this.assertLibrary(subject, existing.clubId, 'delete');

    await this.prisma.$transaction(async (tx) => {
      await tx.libraryDocument.delete({ where: { id: documentId } });
      await this.activity.record(
        {
          clubId: existing.clubId,
          actorMembershipId,
          category: 'library',
          action: 'deleted a document',
          summary: `Deleted document "${existing.title}"`,
          entityType: 'document',
          entityId: existing.id,
        },
        tx,
      );
    });
    return null;
  }

  /** ---------------------------------------------------------- helpers -- */

  private assertLibrary(
    subject: PermissionSubject,
    clubId: string,
    action: 'read' | 'create' | 'update' | 'delete',
  ): void {
    if (!can(subject, action, 'library', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'library',
        action,
        reason: 'You do not manage this club',
      });
    }
  }
}

function normalisePaging(query: ListPageQuery, defaultLimit: number) {
  const rawOffset = query.offset ?? 0;
  const rawLimit = query.limit ?? defaultLimit;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), defaultLimit * 4)
      : defaultLimit;
  return { offset, limit };
}
