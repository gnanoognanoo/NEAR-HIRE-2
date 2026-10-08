import { z } from "zod";
export const locationSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});
const optionalText = (max: number) => z.string().trim().max(max).optional().default("");
export function validJobDate(value: string) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return (
    Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value && value >= "1900-01-01"
  );
}
export const jobSchema = locationSchema
  .extend({
    title: z.string().trim().min(3).max(120),
    kind: z.enum(["residential", "business"]),
    category: z.string().trim().min(1),
    description: z.string().trim().min(10).max(3000),
    pay: z.coerce.number().positive().max(1000000),
    pay_unit: z.enum(["hour", "day", "job", "month"]),
    workers_required: z.coerce.number().int().min(1).max(100),
    schedule: z.string().trim().min(1).max(200),
    locality: z.string().trim().min(2).max(120),
    exact_address: optionalText(500),
    business_name: optionalText(120),
    city: optionalText(120),
    district: optionalText(120),
    state: optionalText(120),
    country: z.string().trim().length(2).optional().default("IN"),
    benefits: optionalText(1000),
    instructions: optionalText(1000),
    start_date: optionalText(10).refine(validJobDate),
    start_time: optionalText(5).refine((v) => !v || /^([01]\d|2[0-3]):[0-5]\d$/.test(v)),
    is_urgent: z.boolean().optional().default(false),
    required_languages: z
      .array(z.string().trim().min(1).max(30))
      .max(20)
      .optional()
      .default(["ta"]),
    required_skills: z.array(z.string().trim().min(1).max(80)).max(30).optional().default([]),
    experience_years: z.coerce.number().min(0).max(80).optional().default(0),
    employment_type: z
      .enum(["full_time", "part_time", "daily_wage", "temporary", "weekend", "shift"])
      .optional()
      .default("temporary"),
  })
  .passthrough();
export type JobInput = z.infer<typeof jobSchema>;
