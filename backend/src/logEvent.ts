import { Event } from "./models/Event.js";

export async function logEvent(type: string, data: Record<string, unknown> = {}): Promise<void> {
  try {
    await Event.create({ type, data });
  } catch {
    // never crash the request over analytics
  }
}
