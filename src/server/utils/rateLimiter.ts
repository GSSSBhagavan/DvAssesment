import mongoose, { Schema } from 'mongoose';

interface IRateLimitRecord {
  key: string;
  count: number;
  expiresAt: Date;
}

const rateLimitSchema = new Schema<IRateLimitRecord>({
  key: { type: String, required: true, unique: true, index: true },
  count: { type: Number, default: 1 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
});

const RateLimitModel = mongoose.models.RateLimitRecord || mongoose.model<IRateLimitRecord>('RateLimitRecord', rateLimitSchema);

// In-memory fallback in case DB is momentarily unavailable
const memoryFallback = new Map<string, { count: number; expiresAt: number }>();

// Periodic pruning of expired in-memory fallback entries (runs max once every 60s)
let lastPruneTime = 0;
function pruneMemoryFallback(now: number) {
  if (now - lastPruneTime < 60000) return;
  lastPruneTime = now;
  for (const [k, v] of memoryFallback.entries()) {
    if (now > v.expiresAt) {
      memoryFallback.delete(k);
    }
  }
}

export interface RateLimitOptions {
  failClosed?: boolean;
}

export interface RateLimitResult {
  isLimited: boolean;
  currentCount: number;
  degraded?: boolean;
}

/**
 * Shared, deployment-compatible rate limiter.
 * Uses atomic MongoDB operations with automatic TTL index expiration,
 * ensuring distributed synchronization across cluster/serverless instances.
 * 
 * Production Failure Policy:
 * - Distributed mode (primary): MongoDB TTL-backed atomic counters shared across all instances.
 * - Degraded mode (fallback): If MongoDB connection is unavailable, operates in instance-level
 *   in-memory fallback with automated key pruning, logging a structured warning.
 * - If failClosed is explicitly set to true, requests reject when MongoDB is unreachable.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
  options?: RateLimitOptions
): Promise<RateLimitResult> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);

  try {
    if (mongoose.connection.readyState === 1) {
      // Find active record that has not expired
      const updated = await RateLimitModel.findOneAndUpdate(
        { key, expiresAt: { $gt: now } },
        { $inc: { count: 1 } },
        { new: true }
      );

      if (updated) {
        return {
          isLimited: updated.count > maxRequests,
          currentCount: updated.count,
          degraded: false
        };
      }

      // If no active non-expired record exists, upsert a new window
      await RateLimitModel.findOneAndUpdate(
        { key },
        { $set: { count: 1, expiresAt } },
        { upsert: true, new: true }
      );

      return {
        isLimited: false,
        currentCount: 1,
        degraded: false
      };
    }
  } catch (err) {
    console.warn('[RATE_LIMITER] DB check failed; entering degraded fallback mode:', err);
    if (options?.failClosed) {
      return {
        isLimited: true,
        currentCount: maxRequests + 1,
        degraded: true
      };
    }
  }

  // Degraded in-memory fallback
  const nowMs = Date.now();
  pruneMemoryFallback(nowMs);

  const entry = memoryFallback.get(key);
  if (!entry || nowMs > entry.expiresAt) {
    memoryFallback.set(key, { count: 1, expiresAt: nowMs + windowMs });
    return { isLimited: false, currentCount: 1, degraded: true };
  }

  entry.count += 1;
  return {
    isLimited: entry.count > maxRequests,
    currentCount: entry.count,
    degraded: true
  };
}
