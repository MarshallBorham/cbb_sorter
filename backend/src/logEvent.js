import { Event } from "./models/Event.js";

const DISCORD_DEPTH_CHART_EVENT = "discord_depth_chart";

export async function logEvent(type, data = {}) {
  try {
    await Event.create({ type, data });
  } catch {
    // never crash the request over analytics
  }
}

/**
 * Track Discord /depth-chart invocations: raw Event row + rolling per-team counts.
 * Safe to await without try/catch at call sites; failures are swallowed.
 */
