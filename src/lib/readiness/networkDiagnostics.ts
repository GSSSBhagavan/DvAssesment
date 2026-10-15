/**
 * Advanced real-time network diagnostics engine.
 * Measures round-trip server ping, latency stability (jitter),
 * connection downlink throughput, and real-time network quality.
 */

export interface NetworkMetrics {
  latencyMs: number;
  jitterMs: number;
  quality: 'optimal' | 'good' | 'moderate' | 'unstable' | 'offline';
  effectiveType: string;
  downlinkMbps: number | null;
  status: 'passed' | 'warning' | 'failed';
  summary: string;
  realtimePillText: string;
  timestamp: number;
}

let latencyHistory: number[] = [];

export async function measureRealtimeNetwork(): Promise<NetworkMetrics> {
  const timestamp = Date.now();

  // 1. Check navigator online state
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      latencyMs: 0,
      jitterMs: 0,
      quality: 'offline',
      effectiveType: 'None',
      downlinkMbps: 0,
      status: 'failed',
      summary: 'No internet connection detected.',
      realtimePillText: 'Offline',
      timestamp
    };
  }

  // 2. Measure round-trip ping using cache-busted lightweight HEAD request
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const start = performance.now();
    const res = await fetch(`/api/integrity/ping?_t=${Date.now()}`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal
    });
    const end = performance.now();
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }

    const latencyMs = Math.max(1, Math.round(end - start));

    // Maintain recent ping history for jitter calculation (rolling window of 5)
    latencyHistory.push(latencyMs);
    if (latencyHistory.length > 5) {
      latencyHistory.shift();
    }

    // Jitter calculation: average absolute difference between consecutive latency samples
    let jitterMs = 0;
    if (latencyHistory.length >= 2) {
      let diffSum = 0;
      for (let i = 1; i < latencyHistory.length; i++) {
        diffSum += Math.abs(latencyHistory[i] - latencyHistory[i - 1]);
      }
      jitterMs = Math.round(diffSum / (latencyHistory.length - 1));
    }

    // Network Information API inspection (Chrome/Edge/Android)
    let connType = 'Broadband';
    let downlinkMbps: number | null = null;
    if (typeof navigator !== 'undefined') {
      const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      if (conn) {
        if (conn.effectiveType) {
          connType = conn.effectiveType.toUpperCase();
        }
        if (typeof conn.downlink === 'number') {
          downlinkMbps = conn.downlink;
        }
      }
    }

    // Quality categorization
    let quality: NetworkMetrics['quality'] = 'optimal';
    let status: NetworkMetrics['status'] = 'passed';
    let statusLabel = 'Optimal';

    if (latencyMs <= 120 && jitterMs <= 40) {
      quality = 'optimal';
      status = 'passed';
      statusLabel = 'Optimal';
    } else if (latencyMs <= 300) {
      quality = 'good';
      status = 'passed';
      statusLabel = 'Good';
    } else if (latencyMs <= 600) {
      quality = 'moderate';
      status = 'warning';
      statusLabel = 'Moderate';
    } else {
      quality = 'unstable';
      status = 'failed';
      statusLabel = 'Unstable';
    }

    const throughputStr = downlinkMbps ? ` · ${downlinkMbps} Mbps` : '';
    const jitterStr = jitterMs > 0 ? ` · Jitter: ${jitterMs}ms` : '';
    const summary = `${statusLabel} (${latencyMs}ms latency${jitterStr}${throughputStr} · ${connType})`;
    const realtimePillText = `${latencyMs} ms · ${statusLabel}`;

    return {
      latencyMs,
      jitterMs,
      quality,
      effectiveType: connType,
      downlinkMbps,
      status,
      summary,
      realtimePillText,
      timestamp
    };
  } catch (err: any) {
    const isTimeout = err.name === 'AbortError';
    return {
      latencyMs: isTimeout ? 6000 : 9999,
      jitterMs: 0,
      quality: 'unstable',
      effectiveType: 'Unknown',
      downlinkMbps: null,
      status: 'failed',
      summary: isTimeout ? 'Network timeout (>6s). High latency.' : 'Connection unstable or interrupted.',
      realtimePillText: 'Unstable',
      timestamp
    };
  }
}
