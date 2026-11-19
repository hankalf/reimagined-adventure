import { db } from "./db";
import type { ActorType } from "./db";

export async function audit(input: {
  actorType: ActorType;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        meta: input.meta ? JSON.parse(JSON.stringify(input.meta)) : undefined,
      },
    });
  } catch (err) {
    console.error("[audit] failed", err);
  }
}
