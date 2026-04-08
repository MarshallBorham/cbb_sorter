import { Event } from "./models/Event.js";

export async function logEvent(type, data = {}) {
  try {
    await Event.create({ type, data });
  } catch {
    // never crash the request over analytics
  }
}