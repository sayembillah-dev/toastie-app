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
  CreateBudgetLineDto,
  CreateTransactionDto,
  UpdateBudgetLineDto,
  UpdateDuesRecordDto,
  UpdateTransactionDto,
} from './dto/finance.dto';
import { FinanceService } from './finance.service';
import { type BudgetLineWire, type DuesRecordWire, type TransactionWire } from './serializers';

@Controller()
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  /** ------------------------------------------------ transactions -- */

  @Requires('transaction', 'read')
  @Get('transactions')
  listTransactions(@CurrentContext() ctx: RequestContext): Promise<TransactionWire[]> {
    const clubId = requireClubContext(ctx);
    return this.finance.listTransactions(ctx.subject, clubId);
  }

  @Requires('transaction', 'read')
  @Get('transactions/:transactionId')
  getTransaction(
    @CurrentContext() ctx: RequestContext,
    @Param('transactionId') transactionId: string,
  ): Promise<TransactionWire> {
    return this.finance.getTransaction(ctx.subject, transactionId);
  }

  @Requires('transaction', 'create')
  @Post('transactions')
  createTransaction(
    @CurrentContext() ctx: RequestContext,
    @Body() dto: CreateTransactionDto,
  ): Promise<TransactionWire> {
    const clubId = requireClubContext(ctx);
    return this.finance.createTransaction(
      ctx.subject,
      clubId,
      actorMembershipIdFor(ctx, clubId),
      dto,
    );
  }

  @Requires('transaction', 'update')
  @Patch('transactions/:transactionId')
  updateTransaction(
    @CurrentContext() ctx: RequestContext,
    @Param('transactionId') transactionId: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<TransactionWire> {
    const clubId = ctx.clubId;
    return this.finance.updateTransaction(
      ctx.subject,
      transactionId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
      dto,
    );
  }

  @Requires('transaction', 'delete')
  @Delete('transactions/:transactionId')
  deleteTransaction(
    @CurrentContext() ctx: RequestContext,
    @Param('transactionId') transactionId: string,
  ): Promise<null> {
    const clubId = ctx.clubId;
    return this.finance.deleteTransaction(
      ctx.subject,
      transactionId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
    );
  }

  /** ------------------------------------------------ dues records -- */

  @Requires('dues', 'read')
  @Get('dues-records')
  listDuesRecords(
    @CurrentContext() ctx: RequestContext,
    @Query('periodId') periodId: string,
  ): Promise<DuesRecordWire[]> {
    const clubId = requireClubContext(ctx);
    if (!periodId) {
      throw new BadRequestException('A periodId query parameter is required');
    }
    return this.finance.listDuesRecords(ctx.subject, clubId, periodId);
  }

  @Requires('dues', 'update')
  @Patch('dues-records/:recordId')
  updateDuesRecord(
    @CurrentContext() ctx: RequestContext,
    @Param('recordId') recordId: string,
    @Body() dto: UpdateDuesRecordDto,
  ): Promise<DuesRecordWire> {
    const clubId = ctx.clubId;
    return this.finance.updateDuesRecord(
      ctx.subject,
      recordId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
      dto,
    );
  }

  /** ------------------------------------------------ budget lines -- */

  @Requires('budget', 'read')
  @Get('budget-lines')
  listBudgetLines(
    @CurrentContext() ctx: RequestContext,
    @Query('fiscalYear') fiscalYear?: string,
  ): Promise<BudgetLineWire[]> {
    const clubId = requireClubContext(ctx);
    return this.finance.listBudgetLines(ctx.subject, clubId, fiscalYear);
  }

  @Requires('budget', 'create')
  @Post('budget-lines')
  createBudgetLine(
    @CurrentContext() ctx: RequestContext,
    @Body() dto: CreateBudgetLineDto,
  ): Promise<BudgetLineWire> {
    const clubId = requireClubContext(ctx);
    return this.finance.createBudgetLine(
      ctx.subject,
      clubId,
      actorMembershipIdFor(ctx, clubId),
      dto,
    );
  }

  @Requires('budget', 'update')
  @Patch('budget-lines/:lineId')
  updateBudgetLine(
    @CurrentContext() ctx: RequestContext,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateBudgetLineDto,
  ): Promise<BudgetLineWire> {
    const clubId = ctx.clubId;
    return this.finance.updateBudgetLine(
      ctx.subject,
      lineId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
      dto,
    );
  }

  @Requires('budget', 'delete')
  @Delete('budget-lines/:lineId')
  deleteBudgetLine(
    @CurrentContext() ctx: RequestContext,
    @Param('lineId') lineId: string,
  ): Promise<null> {
    const clubId = ctx.clubId;
    return this.finance.deleteBudgetLine(
      ctx.subject,
      lineId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
    );
  }
}

function requireClubContext(ctx: RequestContext): string {
  if (!ctx.clubId) {
    throw new BadRequestException({
      code: 'CLUB_CONTEXT_REQUIRED',
      message: 'Finance is only accessible from a club context',
    });
  }
  return ctx.clubId;
}
