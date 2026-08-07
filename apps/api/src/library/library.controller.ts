import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { actorMembershipIdFor, CurrentContext, type RequestContext, Requires } from '@/access';

import {
  CreateAssetDto,
  CreateDocumentDto,
  UpdateAssetDto,
  UpdateDocumentDto,
} from './dto/library.dto';
import { CreatePlannerIdeaDto, UpdatePlannerIdeaDto } from './dto/planner.dto';
import { LibraryService } from './library.service';
import {
  type AssetsPageWire,
  type AssetWire,
  type DocumentsPageWire,
  type DocumentWire,
  type PlannerIdeaWire,
} from './serializers';

/** yyyy-mm-dd. Mirrors the DTO guard so a bad `from`/`to` on the list query
 * is a 400 rather than a silently empty month. */
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

@Controller()
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  /** ------------------------------------------------------ assets -- */

  @Requires('library', 'read')
  @Get('assets')
  listAssets(
    @CurrentContext() ctx: RequestContext,
    @Query('q') q?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ): Promise<AssetsPageWire> {
    const clubId = requireClubContext(ctx);
    return this.library.listAssets(ctx.subject, clubId, {
      q,
      offset: offset ? Number.parseInt(offset, 10) : undefined,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }

  @Requires('library', 'read')
  @Get('assets/:assetId')
  getAsset(
    @CurrentContext() ctx: RequestContext,
    @Param('assetId') assetId: string,
  ): Promise<AssetWire> {
    return this.library.getAsset(ctx.subject, assetId);
  }

  @Requires('library', 'create')
  @Post('assets')
  createAsset(
    @CurrentContext() ctx: RequestContext,
    @Body() dto: CreateAssetDto,
  ): Promise<AssetWire> {
    const clubId = requireClubContext(ctx);
    return this.library.createAsset(ctx.subject, clubId, actorMembershipIdFor(ctx, clubId), dto);
  }

  @Requires('library', 'update')
  @Patch('assets/:assetId')
  updateAsset(
    @CurrentContext() ctx: RequestContext,
    @Param('assetId') assetId: string,
    @Body() dto: UpdateAssetDto,
  ): Promise<AssetWire> {
    const clubId = ctx.clubId;
    return this.library.updateAsset(
      ctx.subject,
      assetId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
      dto,
    );
  }

  @Requires('library', 'delete')
  @Delete('assets/:assetId')
  deleteAsset(
    @CurrentContext() ctx: RequestContext,
    @Param('assetId') assetId: string,
  ): Promise<null> {
    const clubId = ctx.clubId;
    return this.library.deleteAsset(
      ctx.subject,
      assetId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
    );
  }

  /** --------------------------------------------------- documents -- */

  @Requires('library', 'read')
  @Get('documents')
  listDocuments(
    @CurrentContext() ctx: RequestContext,
    @Query('q') q?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ): Promise<DocumentsPageWire> {
    const clubId = requireClubContext(ctx);
    return this.library.listDocuments(ctx.subject, clubId, {
      q,
      offset: offset ? Number.parseInt(offset, 10) : undefined,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }

  @Requires('library', 'read')
  @Get('documents/:documentId')
  getDocument(
    @CurrentContext() ctx: RequestContext,
    @Param('documentId') documentId: string,
  ): Promise<DocumentWire> {
    return this.library.getDocument(ctx.subject, documentId);
  }

  @Requires('library', 'create')
  @Post('documents')
  createDocument(
    @CurrentContext() ctx: RequestContext,
    @Body() dto: CreateDocumentDto,
  ): Promise<DocumentWire> {
    const clubId = requireClubContext(ctx);
    return this.library.createDocument(ctx.subject, clubId, actorMembershipIdFor(ctx, clubId), dto);
  }

  @Requires('library', 'update')
  @Patch('documents/:documentId')
  updateDocument(
    @CurrentContext() ctx: RequestContext,
    @Param('documentId') documentId: string,
    @Body() dto: UpdateDocumentDto,
  ): Promise<DocumentWire> {
    const clubId = ctx.clubId;
    return this.library.updateDocument(
      ctx.subject,
      documentId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
      dto,
    );
  }

  @Requires('library', 'delete')
  @Delete('documents/:documentId')
  deleteDocument(
    @CurrentContext() ctx: RequestContext,
    @Param('documentId') documentId: string,
  ): Promise<null> {
    const clubId = ctx.clubId;
    return this.library.deleteDocument(
      ctx.subject,
      documentId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
    );
  }

  /** ----------------------------------------------------- planner -- */

  @Requires('library', 'read')
  @Get('planner/ideas')
  listPlannerIdeas(
    @CurrentContext() ctx: RequestContext,
    @Query('from') from: string,
    @Query('to') to: string,
  ): Promise<PlannerIdeaWire[]> {
    const clubId = requireClubContext(ctx);
    return this.library.listIdeas(
      ctx.subject,
      clubId,
      requireDay(from, 'from'),
      requireDay(to, 'to'),
    );
  }

  @Requires('library', 'create')
  @Post('planner/ideas')
  createPlannerIdea(
    @CurrentContext() ctx: RequestContext,
    @Body() dto: CreatePlannerIdeaDto,
  ): Promise<PlannerIdeaWire> {
    const clubId = requireClubContext(ctx);
    return this.library.createIdea(ctx.subject, clubId, actorMembershipIdFor(ctx, clubId), dto);
  }

  @Requires('library', 'update')
  @Patch('planner/ideas/:ideaId')
  updatePlannerIdea(
    @CurrentContext() ctx: RequestContext,
    @Param('ideaId') ideaId: string,
    @Body() dto: UpdatePlannerIdeaDto,
  ): Promise<PlannerIdeaWire> {
    const clubId = ctx.clubId;
    return this.library.updateIdea(
      ctx.subject,
      ideaId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
      dto,
    );
  }

  @Requires('library', 'delete')
  @Delete('planner/ideas/:ideaId')
  deletePlannerIdea(
    @CurrentContext() ctx: RequestContext,
    @Param('ideaId') ideaId: string,
  ): Promise<null> {
    const clubId = ctx.clubId;
    return this.library.deleteIdea(
      ctx.subject,
      ideaId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
    );
  }
}

function requireDay(value: string | undefined, param: string): string {
  if (!value || !DAY_PATTERN.test(value)) {
    throw new BadRequestException({
      code: 'INVALID_DAY',
      message: `"${param}" must be a yyyy-mm-dd date`,
    });
  }
  return value;
}

function requireClubContext(ctx: RequestContext): string {
  if (!ctx.clubId) {
    throw new BadRequestException({
      code: 'CLUB_CONTEXT_REQUIRED',
      message: 'Library items are only accessible from a club context',
    });
  }
  return ctx.clubId;
}
