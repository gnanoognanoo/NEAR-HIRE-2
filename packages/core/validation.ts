import { z } from "zod";
export const locationSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});
export const jobSchema = locationSchema
  .extend({
    title: z.string().trim().min(3).max(120),
    kind: z.enum(["residential", "business"]),
    category: z.string().min(1),
    description: z.string().trim().min(10).max(3000),
    pay: z.coerce.number().positive().max(1000000),
    pay_unit: z.enum(["hour", "day", "job", "month"]),
    workers_required: z.coerce.number().int().min(1).max(100),
    schedule: z.string().trim().min(1).max(200),
    locality: z.string().trim().min(2).max(120),
    exact_address: z.string().trim().min(1).max(500),
  })
  .passthrough();
export type JobInput = z.infer<typeof jobSchema>;
