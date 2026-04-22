import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import {
  listNotifications,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  createNotification,
} from "../db";

const p = publicProcedure;

export const notificationsRouter = router({
  list: p.query(async () => listNotifications(50)),

  unreadCount: p.query(async () => {
    const count = await countUnreadNotifications();
    return { count };
  }),

  markRead: p
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await markNotificationRead(input.id);
      return { success: true };
    }),

  markAllRead: p.mutation(async () => {
    await markAllNotificationsRead();
    return { success: true };
  }),

  // For testing / manual creation
  create: p
    .input(z.object({
      title: z.string(),
      body: z.string().optional(),
      type: z.enum(["inbound_sms", "inbound_call", "task_complete", "job_update", "general"]).optional(),
      relatedId: z.number().optional(),
      relatedType: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await createNotification(input);
      return { success: true };
    }),
});
