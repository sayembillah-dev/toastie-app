import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { can, type PermissionSubject } from '@toastly/access';

import { ActivityService } from '@/activity';
import { PrismaService } from '@/prisma';

import type {
  CreateBudgetLineDto,
  CreateTransactionDto,
  UpdateBudgetLineDto,
  UpdateDuesRecordDto,
  UpdateTransactionDto,
} from './dto/finance.dto';
import {
  type BudgetLineWire,
  CATEGORY_LABELS,
  type DuesRecordWire,
  getDuesPeriod,
  isIncomeCategory,
  type TransactionWire,
  toBudgetLineWire,
  toDuesRecordWire,
  toTransactionWire,
} from './serializers';

/** Handles `/transactions`, `/dues-records`, `/budget-lines`. The one
 * cross-table write in this domain — recording a dues payment — happens in
 * a single `$transaction` so the ledger and the dues record cannot fall
 * out of sync. Direct edits/deletes to a dues-linked transaction row
 * return 409 `TRANSACTION_LOCKED_TO_DUES`. */
@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  /** ------------------------------------------------- transactions -- */

  async listTransactions(subject: PermissionSubject, clubId: string): Promise<TransactionWire[]> {
    this.assertTransaction(subject, clubId, 'read');
    const rows = await this.prisma.transaction.findMany({
      where: { clubId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toTransactionWire);
  }

  async getTransaction(
    subject: PermissionSubject,
    transactionId: string,
  ): Promise<TransactionWire> {
    const row = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!row) throw new NotFoundException(`No transaction with id "${transactionId}"`);
    this.assertTransaction(subject, row.clubId, 'read');
    return toTransactionWire(row);
  }

  async createTransaction(
    subject: PermissionSubject,
    clubId: string,
    actorMembershipId: string | null,
    dto: CreateTransactionDto,
  ): Promise<TransactionWire> {
    this.assertTransaction(subject, clubId, 'create');
    if (!isValidDate(dto.date)) {
      throw new BadRequestException('A valid date is required');
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          clubId,
          date: dto.date,
          direction: dto.direction,
          category: dto.category,
          amountMinor: dto.amountMinor,
          description: dto.description.trim(),
          method: dto.method,
          counterparty: dto.counterparty?.trim() || null,
          reference: dto.reference?.trim() || null,
        },
      });
      await this.activity.record(
        {
          clubId,
          actorMembershipId,
          category: 'finance',
          action: 'logged a transaction',
          summary: `Logged ${created.direction === 'in' ? 'income' : 'an expense'} — ${created.description}`,
          entityType: 'transaction',
          entityId: created.id,
        },
        tx,
      );
      return created;
    });
    return toTransactionWire(row);
  }

  async updateTransaction(
    subject: PermissionSubject,
    transactionId: string,
    actorMembershipId: string | null,
    dto: UpdateTransactionDto,
  ): Promise<TransactionWire> {
    const existing = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!existing) throw new NotFoundException(`No transaction with id "${transactionId}"`);
    this.assertTransaction(subject, existing.clubId, 'update');
    if (existing.duesRecordId) {
      throw new ConflictException({
        code: 'TRANSACTION_LOCKED_TO_DUES',
        message:
          'This entry was recorded from a dues payment — change it from the Dues tab instead.',
      });
    }
    if (dto.date !== undefined && !isValidDate(dto.date)) {
      throw new BadRequestException('A valid date is required');
    }

    const data: Prisma.TransactionUpdateInput = { updatedAt: new Date() };
    if (dto.date !== undefined) data.date = dto.date;
    if (dto.direction !== undefined) data.direction = dto.direction;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.amountMinor !== undefined) data.amountMinor = dto.amountMinor;
    if (dto.description !== undefined) data.description = dto.description.trim();
    if (dto.method !== undefined) data.method = dto.method;
    if (dto.counterparty !== undefined) data.counterparty = dto.counterparty.trim() || null;
    if (dto.reference !== undefined) data.reference = dto.reference.trim() || null;

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.transaction.update({ where: { id: transactionId }, data });
      await this.activity.record(
        {
          clubId: updated.clubId,
          actorMembershipId,
          category: 'finance',
          action: 'updated a transaction',
          summary: `Updated a transaction — ${updated.description}`,
          entityType: 'transaction',
          entityId: updated.id,
        },
        tx,
      );
      return updated;
    });
    return toTransactionWire(row);
  }

  async deleteTransaction(
    subject: PermissionSubject,
    transactionId: string,
    actorMembershipId: string | null,
  ): Promise<null> {
    const existing = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!existing) throw new NotFoundException(`No transaction with id "${transactionId}"`);
    this.assertTransaction(subject, existing.clubId, 'delete');
    if (existing.duesRecordId) {
      throw new ConflictException({
        code: 'TRANSACTION_LOCKED_TO_DUES',
        message:
          'This entry was recorded from a dues payment — change it from the Dues tab instead.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.delete({ where: { id: transactionId } });
      await this.activity.record(
        {
          clubId: existing.clubId,
          actorMembershipId,
          category: 'finance',
          action: 'deleted a transaction',
          summary: `Deleted a transaction — ${existing.description}`,
          entityType: 'transaction',
          entityId: existing.id,
        },
        tx,
      );
    });
    return null;
  }

  /** ------------------------------------------------- dues records -- */

  /** Returns every active member's record for the period, materialising a
   * fresh unpaid row for anyone the roster has grown to include since the
   * period was last read. This is what keeps the Dues tab following the
   * member roster without a separate sync step. Matches the local-db
   * `listDuesRecords` behaviour. */
  async listDuesRecords(
    subject: PermissionSubject,
    clubId: string,
    periodId: string,
  ): Promise<DuesRecordWire[]> {
    this.assertDues(subject, clubId, 'read');
    const period = getDuesPeriod(periodId);
    if (!period) throw new NotFoundException(`No dues period with id "${periodId}"`);

    // Only fill in records for **active** members — a removed member should
    // not sprout new unpaid dues on every list-refresh.
    const members = await this.prisma.membership.findMany({
      where: { clubId, status: 'active' },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    const memberIds = members.map((m) => m.id);
    if (memberIds.length === 0) return [];

    const existing = await this.prisma.duesRecord.findMany({
      where: { clubId, periodId, membershipId: { in: memberIds } },
    });
    const byMember = new Map(existing.map((r) => [r.membershipId, r]));
    const missing = memberIds.filter((id) => !byMember.has(id));

    if (missing.length > 0) {
      await this.prisma.duesRecord.createMany({
        data: missing.map((membershipId) => ({
          clubId,
          periodId,
          membershipId,
          amountDueMinor: period.standardAmountMinor,
          amountPaidMinor: 0,
          waived: false,
        })),
        skipDuplicates: true,
      });
      const filled = await this.prisma.duesRecord.findMany({
        where: { clubId, periodId, membershipId: { in: missing } },
      });
      for (const row of filled) byMember.set(row.membershipId, row);
    }

    return memberIds
      .map((id) => byMember.get(id))
      .filter((r): r is (typeof existing)[number] => r !== undefined)
      .map(toDuesRecordWire);
  }

  /** The one write path where two tables change together. Recording a
   * payment (or clearing one) keeps the ledger truthful without the
   * treasurer entering the same payment twice. Wrapped in a single
   * `$transaction` — see `requireEditableTransaction` above for the other
   * half of that guarantee. */
  async updateDuesRecord(
    subject: PermissionSubject,
    recordId: string,
    actorMembershipId: string | null,
    dto: UpdateDuesRecordDto,
  ): Promise<DuesRecordWire> {
    const existing = await this.prisma.duesRecord.findUnique({ where: { id: recordId } });
    if (!existing) throw new NotFoundException(`No dues record with id "${recordId}"`);
    this.assertDues(subject, existing.clubId, 'update');

    const member = await this.prisma.membership.findUnique({
      where: { id: existing.membershipId },
      select: { firstName: true, lastName: true },
    });
    const memberName = member ? `${member.firstName} ${member.lastName}` : existing.membershipId;
    const period = getDuesPeriod(existing.periodId);

    const data: Prisma.DuesRecordUpdateInput = { updatedAt: new Date() };
    if (dto.amountPaidMinor !== undefined) data.amountPaidMinor = dto.amountPaidMinor;
    if (dto.waived !== undefined) data.waived = dto.waived;
    if (dto.paidOn !== undefined) data.paidOn = dto.paidOn;
    if (dto.method !== undefined) data.method = dto.method;
    if (dto.note !== undefined) data.note = dto.note === null ? null : dto.note.trim() || null;

    const nextPaid = dto.amountPaidMinor ?? existing.amountPaidMinor;
    const nextWaived = dto.waived ?? existing.waived;
    const nextMethod = dto.method !== undefined ? dto.method : existing.method;
    const nextPaidOn = dto.paidOn !== undefined ? dto.paidOn : existing.paidOn;
    const now = new Date();

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.duesRecord.update({ where: { id: recordId }, data });
      const linked = await tx.transaction.findFirst({ where: { duesRecordId: recordId } });

      if (nextPaid > 0 && !nextWaived) {
        if (linked) {
          await tx.transaction.update({
            where: { id: linked.id },
            data: {
              amountMinor: nextPaid,
              date: nextPaidOn ?? linked.date,
              method: nextMethod ?? linked.method,
              updatedAt: now,
            },
          });
        } else {
          await tx.transaction.create({
            data: {
              clubId: updated.clubId,
              date: nextPaidOn ?? now.toISOString().slice(0, 10),
              direction: 'in',
              category: 'dues',
              amountMinor: nextPaid,
              description: `Dues — ${period?.label ?? updated.periodId}`,
              method: nextMethod ?? 'cash',
              counterparty: memberName,
              duesRecordId: updated.id,
            },
          });
        }
      } else if (linked) {
        // Reset to zero, or waived after already having a recorded payment
        // — retire the linked entry rather than leaving stale income.
        await tx.transaction.delete({ where: { id: linked.id } });
      }

      await this.activity.record(
        {
          clubId: updated.clubId,
          actorMembershipId,
          category: 'finance',
          action: nextWaived ? 'waived a dues payment' : 'recorded a dues payment',
          summary: nextWaived
            ? `Waived dues for ${memberName}`
            : `Recorded a dues payment from ${memberName}`,
          entityType: 'duesRecord',
          entityId: updated.id,
        },
        tx,
      );
      return updated;
    });
    return toDuesRecordWire(row);
  }

  /** ------------------------------------------------- budget lines -- */

  async listBudgetLines(
    subject: PermissionSubject,
    clubId: string,
    fiscalYear?: string,
  ): Promise<BudgetLineWire[]> {
    this.assertBudget(subject, clubId, 'read');
    const rows = await this.prisma.budgetLine.findMany({
      where: {
        clubId,
        ...(fiscalYear ? { fiscalYear } : {}),
      },
      orderBy: [{ fiscalYear: 'asc' }, { kind: 'asc' }, { category: 'asc' }],
    });
    return rows.map(toBudgetLineWire);
  }

  async createBudgetLine(
    subject: PermissionSubject,
    clubId: string,
    actorMembershipId: string | null,
    dto: CreateBudgetLineDto,
  ): Promise<BudgetLineWire> {
    this.assertBudget(subject, clubId, 'create');
    if ((dto.kind === 'income') !== isIncomeCategory(dto.category)) {
      throw new BadRequestException(
        `"${CATEGORY_LABELS[dto.category]}" is not ${dto.kind === 'income' ? 'an income' : 'an expense'} category`,
      );
    }

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const line = await tx.budgetLine.create({
          data: {
            clubId,
            fiscalYear: dto.fiscalYear.trim(),
            kind: dto.kind,
            category: dto.category,
            plannedMinor: dto.plannedMinor,
            note: dto.note?.trim() || null,
          },
        });
        await this.activity.record(
          {
            clubId,
            actorMembershipId,
            category: 'finance',
            action: 'added a budget line',
            summary: `Added a ${line.fiscalYear} budget line — ${CATEGORY_LABELS[dto.category]}`,
            entityType: 'budgetLine',
            entityId: line.id,
          },
          tx,
        );
        return line;
      });
      return toBudgetLineWire(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          code: 'BUDGET_LINE_DUPLICATE',
          message: `A budget line for "${CATEGORY_LABELS[dto.category]}" already exists for ${dto.fiscalYear.trim()}`,
        });
      }
      throw err;
    }
  }

  async updateBudgetLine(
    subject: PermissionSubject,
    lineId: string,
    actorMembershipId: string | null,
    dto: UpdateBudgetLineDto,
  ): Promise<BudgetLineWire> {
    const existing = await this.prisma.budgetLine.findUnique({ where: { id: lineId } });
    if (!existing) throw new NotFoundException(`No budget line with id "${lineId}"`);
    this.assertBudget(subject, existing.clubId, 'update');

    const data: Prisma.BudgetLineUpdateInput = { updatedAt: new Date() };
    if (dto.plannedMinor !== undefined) data.plannedMinor = dto.plannedMinor;
    if (dto.note !== undefined) data.note = dto.note === null ? null : dto.note.trim() || null;

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.budgetLine.update({ where: { id: lineId }, data });
      await this.activity.record(
        {
          clubId: updated.clubId,
          actorMembershipId,
          category: 'finance',
          action: 'updated a budget line',
          summary: `Updated the ${updated.fiscalYear} budget line — ${CATEGORY_LABELS[updated.category as keyof typeof CATEGORY_LABELS]}`,
          entityType: 'budgetLine',
          entityId: updated.id,
        },
        tx,
      );
      return updated;
    });
    return toBudgetLineWire(row);
  }

  async deleteBudgetLine(
    subject: PermissionSubject,
    lineId: string,
    actorMembershipId: string | null,
  ): Promise<null> {
    const existing = await this.prisma.budgetLine.findUnique({ where: { id: lineId } });
    if (!existing) throw new NotFoundException(`No budget line with id "${lineId}"`);
    this.assertBudget(subject, existing.clubId, 'delete');

    await this.prisma.$transaction(async (tx) => {
      await tx.budgetLine.delete({ where: { id: lineId } });
      await this.activity.record(
        {
          clubId: existing.clubId,
          actorMembershipId,
          category: 'finance',
          action: 'deleted a budget line',
          summary: `Deleted the ${existing.fiscalYear} budget line — ${CATEGORY_LABELS[existing.category as keyof typeof CATEGORY_LABELS]}`,
          entityType: 'budgetLine',
          entityId: existing.id,
        },
        tx,
      );
    });
    return null;
  }

  /** ---------------------------------------------------------- helpers -- */

  private assertTransaction(
    subject: PermissionSubject,
    clubId: string,
    action: 'read' | 'create' | 'update' | 'delete',
  ): void {
    if (!can(subject, action, 'transaction', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'transaction',
        action,
        reason: 'You do not manage this club',
      });
    }
  }

  private assertDues(
    subject: PermissionSubject,
    clubId: string,
    action: 'read' | 'create' | 'update' | 'delete',
  ): void {
    if (!can(subject, action, 'dues', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'dues',
        action,
        reason: 'You do not manage this club',
      });
    }
  }

  private assertBudget(
    subject: PermissionSubject,
    clubId: string,
    action: 'read' | 'create' | 'update' | 'delete',
  ): void {
    if (!can(subject, action, 'budget', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'budget',
        action,
        reason: 'You do not manage this club',
      });
    }
  }
}

function isValidDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}
