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

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async update({ model, operation, args, query }) {
        if (model === 'AuditLog') return query(args);

        const ctx = getAuditContext();
        if (!ctx) return query(args);

        // @ts-ignore
        const oldRecord = await basePrisma[model].findUnique({ where: args.where });

        const newRecord = await query(args);

        if (oldRecord && newRecord) {
            const oldData: Record<string, any> = {};
            const newData: Record<string, any> = {};
            let hasChanges = false;

            const oldRecObj = oldRecord as Record<string, any>;
            const newRecObj = newRecord as Record<string, any>;

            for (const key of Object.keys(newRecObj)) {
              const oldVal = oldRecObj[key];
              const newVal = newRecObj[key];
              
              const oldStr = oldVal instanceof Date ? oldVal.toISOString() : JSON.stringify(oldVal);
              const newStr = newVal instanceof Date ? newVal.toISOString() : JSON.stringify(newVal);

              if (oldStr !== newStr) {
                 const humanKey = formatAuditField(key);
                 oldData[humanKey] = oldVal;
                 newData[humanKey] = newVal;
                 hasChanges = true;
              }
            }

            if (hasChanges) {
                const changedFields = Object.keys(newData);
                const descFields = changedFields.length > 3 
                    ? `${changedFields.slice(0, 3).join(", ")} and ${changedFields.length - 3} other fields` 
                    : changedFields.join(", ");
                // @ts-ignore
                const recordId = newRecord.id ? Number(newRecord.id) : null;
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

        // @ts-ignore
        const oldRecord = await basePrisma[model].findUnique({ where: args.where });

        const result = await query(args);

        if (oldRecord) {
            // @ts-ignore
            const recordId = oldRecord.id ? Number(oldRecord.id) : null;
            const oldData: Record<string, any> = {};
            const oldRecObj = oldRecord as Record<string, any>;
            for (const key of Object.keys(oldRecObj)) {
                oldData[formatAuditField(key)] = oldRecObj[key];
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
