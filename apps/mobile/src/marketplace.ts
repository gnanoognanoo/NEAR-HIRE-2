export type Language = 'en' | 'ta';
export type Kind = 'Business' | 'Residential';
export type Job = { id: string; title: string; company: string; category: string; kind: Kind; locality: string; distance: number; pay: number; unit: 'day' | 'hour' | 'month'; schedule: string; description: string; createdAt: number; owner: boolean };
export type Application = { jobId: string; appliedAt: number; status: 'Pending' | 'Withdrawn' };
export type State = { version: 1; language: Language | null; name: string; onboarded: boolean; saved: string[]; applications: Application[]; jobs: Job[]; postsUsed: number };
export const DAY = 86_400_000;
export const isActive = (job: Job, now = Date.now()) => now < job.createdAt + DAY;
export const remaining = (job: Job, now = Date.now()) => Math.min(24, Math.max(0, Math.ceil((job.createdAt + DAY - now) / 3_600_000)));
export const categories = ['All', 'Retail', 'Hospitality', 'Delivery', 'Cleaning', 'Repairs'] as const;
export function seed(now = Date.now()): State {
  const common = { createdAt: now - 3_600_000, owner: false };
  return { version: 1, language: null, name: '', onboarded: false, saved: [], applications: [], postsUsed: 0, jobs: [
    { ...common, id: 'sample-1', title: 'Store assistant', company: 'The Daily Store', category: 'Retail', kind: 'Business', locality: 'Anna Nagar', distance: 0.8, pay: 700, unit: 'day', schedule: 'Day shift · 9 AM – 6 PM', description: 'Help customers, organise shelves, and support the billing team at a neighbourhood grocery store. Basic Tamil communication and a friendly attitude are welcome. No previous experience required.' },
    { ...common, id: 'sample-2', title: 'Café team member', company: 'Chapter Coffee', category: 'Hospitality', kind: 'Business', locality: 'Shenoy Nagar', distance: 1.4, pay: 850, unit: 'day', schedule: 'Part time · 4 PM – 10 PM', description: 'Welcome guests, take orders, and help keep the café inviting. Training is provided. Ideal for someone who enjoys meeting people and working with a small team.' },
    { ...common, id: 'sample-3', title: 'Home cleaning help', company: 'Residential work', category: 'Cleaning', kind: 'Residential', locality: 'Anna Nagar West', distance: 2.1, pay: 450, unit: 'hour', schedule: 'Flexible · 3 hours', description: 'General cleaning for a two-bedroom home. Cleaning materials are provided. Exact address and contact details are only shared after an application is accepted.' },
    { ...common, id: 'sample-4', title: 'Local delivery partner', company: 'Neighbourhood Essentials', category: 'Delivery', kind: 'Business', locality: 'Kilpauk', distance: 3.2, pay: 900, unit: 'day', schedule: 'Flexible · Day shift', description: 'Deliver groceries within the neighbourhood. A bicycle or two-wheeler is required. Routes are local and the team helps coordinate each delivery.' },
    { ...common, id: 'sample-5', title: 'Ceiling fan repair', company: 'Residential work', category: 'Repairs', kind: 'Residential', locality: 'Aminjikarai', distance: 2.8, pay: 500, unit: 'hour', schedule: 'One-time · Afternoon', description: 'Inspect and repair a ceiling fan. Please bring your standard tools. Parts, if needed, will be discussed separately with the resident.' },
  ] };
}
export function apply(state: State, jobId: string, now = Date.now()): State {
  const job = state.jobs.find(j => j.id === jobId);
  if (!job || job.owner || !isActive(job, now)) throw new Error('This job is no longer accepting applications.');
  if (state.applications.some(a => a.jobId === jobId && a.status === 'Pending')) throw new Error('You have already applied.');
  return { ...state, applications: [...state.applications.filter(a => a.jobId !== jobId), { jobId, appliedAt: now, status: 'Pending' }] };
}
export function post(state: State, input: Omit<Job, 'id' | 'owner' | 'createdAt' | 'distance'>, now = Date.now()): State {
  if (state.postsUsed >= 5) throw new Error('You have used your 5 preview posts. Paid posting is not enabled yet.');
  if (!input.title.trim() || !input.company.trim() || !input.locality.trim() || !input.description.trim() || !input.schedule.trim()) throw new Error('Please complete every field.');
  if (!Number.isFinite(input.pay) || input.pay <= 0 || input.pay > 1_000_000) throw new Error('Enter a valid pay amount between ₹1 and ₹10,00,000.');
  return { ...state, postsUsed: state.postsUsed + 1, jobs: [{ ...input, id: `local-${now}-${Math.random().toString(36).slice(2, 8)}`, owner: true, createdAt: now, distance: 0 }, ...state.jobs] };
}

