import { PrismaClient, Prisma } from '../generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import * as pg from 'pg';
import { getAuditContext } from './context.js';
import { formatAuditField } from '../features/audit-logs/field-mapper.js';

const pool = new pg.Pool({
	connectionString: process.env.DATABASE_URL,
	max: 50,
});
const adapter = new PrismaPg(pool);
const basePrisma = new PrismaClient({ adapter });

interface DynamicModelClient {
  findUnique(args: { where: unknown }): Promise<unknown>;
}

const getDynamicModelClient = (model: string): DynamicModelClient =>
  (
    basePrisma as unknown as Record<string, DynamicModelClient>
  )[model];

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;

const toJsonValue = (value: unknown): Prisma.InputJsonValue => {
  if (value === undefined) {
    return JSON.parse("null") as Prisma.InputJsonValue;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
};

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async update({ model, operation, args, query }) {
        if (model === 'AuditLog') return query(args);

        const ctx = getAuditContext();
        if (!ctx) return query(args);

        const oldRecord = await getDynamicModelClient(model).findUnique({
          where: args.where,
        });

        const newRecord = await query(args);
        const oldRecObj = asRecord(oldRecord);
        const newRecObj = asRecord(newRecord);

        if (oldRecObj && newRecObj) {
            const oldData: Record<string, Prisma.InputJsonValue> = {};
            const newData: Record<string, Prisma.InputJsonValue> = {};
            let hasChanges = false;

            for (const key of Object.keys(newRecObj)) {
              const oldVal = oldRecObj[key];
              const newVal = newRecObj[key];
              
              const oldStr = oldVal instanceof Date ? oldVal.toISOString() : JSON.stringify(oldVal);
              const newStr = newVal instanceof Date ? newVal.toISOString() : JSON.stringify(newVal);

              if (oldStr !== newStr) {
                 const humanKey = formatAuditField(key);
                 oldData[humanKey] = toJsonValue(oldVal);
                 newData[humanKey] = toJsonValue(newVal);
                 hasChanges = true;
              }
            }

            if (hasChanges) {
                const changedFields = Object.keys(newData);
                const descFields = changedFields.length > 3 
                    ? `${changedFields.slice(0, 3).join(", ")} and ${changedFields.length - 3} other fields` 
                    : changedFields.join(", ");
                const recordId = newRecObj.id ? Number(newRecObj.id) : null;
                await basePrisma.auditLog.create({
                    data: {
                        actionType: `UPDATED_${model.toUpperCase()}`,
                        description: `Updated ${descFields}`,
                        subjectType: model,
                        recordId,
                        userId: ctx.userId ?? null,
                        ipAddress: ctx.ipAddress ?? "0.0.0.0",
                        userAgent: ctx.userAgent,
                        metadata: {
                           previousData: oldData,
                           newData: newData
                        }
                    }
                });
            }
        }
        return newRecord;
      },
      async delete({ model, operation, args, query }) {
        if (model === 'AuditLog') return query(args);

        const ctx = getAuditContext();
        if (!ctx) return query(args);

        const oldRecord = await getDynamicModelClient(model).findUnique({
          where: args.where,
        });

        const result = await query(args);
        const oldRecObj = asRecord(oldRecord);

        if (oldRecObj) {
            const recordId = oldRecObj.id ? Number(oldRecObj.id) : null;
            const oldData: Record<string, Prisma.InputJsonValue> = {};
            for (const key of Object.keys(oldRecObj)) {
                oldData[formatAuditField(key)] = toJsonValue(oldRecObj[key]);
            }

            await basePrisma.auditLog.create({
                data: {
                    actionType: `DELETED_${model.toUpperCase()}`,
                    description: `Deleted ${model}`,
                    subjectType: model,
                    recordId,
                    userId: ctx.userId ?? null,
                    ipAddress: ctx.ipAddress ?? "0.0.0.0",
                    userAgent: ctx.userAgent,
                    metadata: {
                       previousData: oldData,
                       newData: null
                    }
                }
            });
        }
        return result;
      }
    }
  }
});
