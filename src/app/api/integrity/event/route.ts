import { NextResponse } from 'next/server';
import { requireAuth, JwtPayload } from '@/server/utils/auth';
import connectToDatabase from '@/config/database';
import { AssessmentSession } from '@/server/models/AssessmentSession';
import { Candidate } from '@/server/models/Candidate';
import { ProctoringEvent } from '@/server/models/ProctoringEvent';
import { ProctoringRecord } from '@/server/models/ProctoringRecord';
import { evaluateEventPolicy, PROCTORING_CONFIG } from '@/server/utils/proctoringPolicy';
import { checkRateLimit } from '@/server/utils/rateLimiter';
import { z } from 'zod';
import mongoose from 'mongoose';
import crypto from 'crypto';

const integrityEventSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  eventId: z.string().optional(),
  idempotencyKey: z.string().optional(),
  eventType: z.enum([
    'TAB_SWITCH',
    'FULLSCREEN_EXIT',
    'WINDOW_BLUR',
    'FACE_LOST',
    'FACE_RECOVERED',
    'MULTIPLE_FACES',
    'HEAD_POSE_DEVIATION',
    'GAZE_DEVIATION',
    'FACE_PARTIALLY_OUT_OF_FRAME',
    'COPY_PASTE_ATTEMPT',
    'RESTRICTED_KEY_COMBO',
    'CAMERA_DISCONNECTED',
    'CAMERA_REVOKED',
    'DETECTION_UNAVAILABLE',
    'CONNECTION_LOST',
    'PAGE_LEAVE_ATTEMPT'
  ]),
  clientTimestamp: z.string().datetime().optional(),
  durationMs: z.number().nonnegative().max(3600000).optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

export const POST = requireAuth(async (req: Request, session: JwtPayload) => {
  if (session.role !== 'CANDIDATE') {
    return NextResponse.json({ error: 'Only candidates report proctoring events' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parseResult = integrityEventSchema.safeParse(body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues[0]?.message || 'Invalid integrity event format';
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }

  const { sessionId, eventType, clientTimestamp, durationMs, metadata } = parseResult.data;
  const eventId = parseResult.data.eventId || crypto.randomUUID();
  const idempotencyKey = parseResult.data.idempotencyKey || eventId;

  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    return NextResponse.json({ error: 'Invalid session ID format' }, { status: 400 });
  }

  await connectToDatabase();

  // 1. Rate limiting per session
  const rateCheck = await checkRateLimit(
    `integrity:${sessionId}`,
    PROCTORING_CONFIG.MAX_EVENTS_PER_MINUTE,
    60000
  );
  if (rateCheck.isLimited) {
    return NextResponse.json(
      { error: 'Event ingestion frequency limit exceeded' },
      { status: 429 }
    );
  }

  // 2. Validate session and ownership
  const assessmentSession = await AssessmentSession.findOne({
    _id: sessionId,
    candidateId: session.candidateId
  });

  if (!assessmentSession) {
    return NextResponse.json({ error: 'Assessment session not found or unauthorized' }, { status: 404 });
  }

  // Submitted assessments reject late proctoring events safely
  if (assessmentSession.status !== 'IN_PROGRESS') {
    return NextResponse.json(
      { 
        error: 'Proctoring events are only accepted for active in-progress sessions',
        sessionStatus: assessmentSession.status
      },
      { status: 400 }
    );
  }

  // 3. Fetch candidate name & email for authoritative recording
  const candidate = await Candidate.findById(session.candidateId).lean();
  const studentName = candidate?.fullName || session.email.split('@')[0] || 'Candidate';
  const studentEmail = (candidate?.email || session.email).toLowerCase();

  const now = new Date();

  // 4. Idempotency Check: Query ProctoringRecord for this session to see if idempotencyKey already exists
  let proctoringRecord = await ProctoringRecord.findOne({
    sessionId: assessmentSession._id
  });

  if (proctoringRecord) {
    const existingEvent = proctoringRecord.events.find(
      (e: any) => e.idempotencyKey === idempotencyKey || e.eventId === eventId
    );
    if (existingEvent) {
      return NextResponse.json({
        success: true,
        eventId: existingEvent.eventId,
        eventType: existingEvent.eventType,
        strikeAssigned: existingEvent.strikePoints > 0,
        strikeCount: proctoringRecord.totalStrikes,
        status: proctoringRecord.status,
        reason: existingEvent.reason,
        serverTimestamp: existingEvent.serverTimestamp.toISOString(),
        deduplicated: true
      });
    }
  }

  // 5. Evaluate policy against server security rules
  const lastEvent = proctoringRecord?.events?.[proctoringRecord.events.length - 1];
  const lastStrikeEvent = proctoringRecord?.events
    ?.slice()
    .reverse()
    .find((e: any) => e.eventType === eventType && e.strikePoints > 0);

  const evalResult = evaluateEventPolicy({
    eventType,
    durationMs,
    metadata,
    lastEventAt: lastEvent ? lastEvent.serverTimestamp : null,
    lastStrikeAt: lastStrikeEvent ? lastStrikeEvent.serverTimestamp : null,
    currentStrikes: proctoringRecord ? proctoringRecord.totalStrikes : (assessmentSession.strikeCount || 0)
  });

  // Clean metadata to exclude large items
  const cleanMetadata = sanitizeMetadata(metadata || {});

  const eventItem = {
    eventId,
    idempotencyKey,
    eventType,
    category: evalResult.category,
    serverTimestamp: now,
    clientTimestamp: clientTimestamp ? new Date(clientTimestamp) : undefined,
    strikePoints: evalResult.strikePoints,
    severity: evalResult.severity,
    accepted: evalResult.accepted,
    isDuplicate: evalResult.isDuplicate,
    flaggedForReview: evalResult.flaggedForReview,
    reason: evalResult.reason,
    metadata: cleanMetadata
  };

  // 6. Atomic MongoDB Persistence into proctoring_events collection
  // Uses $inc for totalStrikes and $push for events array
  const updatedRecord = await ProctoringRecord.findOneAndUpdate(
    { sessionId: assessmentSession._id },
    {
      $setOnInsert: {
        studentName,
        studentEmail,
        candidateId: new mongoose.Types.ObjectId(session.candidateId),
        assessmentId: assessmentSession.assessmentId,
        createdAt: now
      },
      $set: {
        status: evalResult.status,
        lastEventType: eventType,
        lastEventAt: now,
        updatedAt: now
      },
      $inc: { totalStrikes: evalResult.strikePoints },
      $push: { events: eventItem }
    },
    { upsert: true, returnDocument: 'after' }
  );

  const authoritativeStrikes = updatedRecord.totalStrikes;
  const authoritativeStatus = updatedRecord.status;

  // 7. Update AssessmentSession proctoringSummary and strikeCount
  if (!assessmentSession.proctoringSummary) {
    assessmentSession.proctoringSummary = {
      faceMissingStrikes: 0,
      multipleFaceEvents: 0,
      tabSwitches: 0,
      fullscreenExits: 0,
      technicalFailures: 0,
      lastMissingFaceStartedAt: null,
      lastMissingFaceStrikeAt: null,
      lastFacePresentAt: null,
      inMissingEpisode: false
    };
  }

  const summary = assessmentSession.proctoringSummary;
  switch (eventType) {
    case 'FACE_LOST':
      if (evalResult.strikePoints > 0) {
        summary.faceMissingStrikes = (summary.faceMissingStrikes || 0) + 1;
        summary.lastMissingFaceStrikeAt = now;
      }
      summary.inMissingEpisode = true;
      summary.lastMissingFaceStartedAt = now;
      break;
    case 'FACE_RECOVERED':
      summary.inMissingEpisode = false;
      summary.lastFacePresentAt = now;
      break;
    case 'MULTIPLE_FACES':
      summary.multipleFaceEvents = (summary.multipleFaceEvents || 0) + 1;
      break;
    case 'TAB_SWITCH':
    case 'WINDOW_BLUR':
    case 'PAGE_LEAVE_ATTEMPT':
      summary.tabSwitches = (summary.tabSwitches || 0) + 1;
      break;
    case 'FULLSCREEN_EXIT':
      summary.fullscreenExits = (summary.fullscreenExits || 0) + 1;
      break;
    case 'CAMERA_DISCONNECTED':
    case 'CAMERA_REVOKED':
    case 'DETECTION_UNAVAILABLE':
    case 'CONNECTION_LOST':
      summary.technicalFailures = (summary.technicalFailures || 0) + 1;
      break;
  }

  const mappedIntegrityStatus = 
    authoritativeStatus === 'REVIEW_REQUIRED'
      ? 'REVIEW_REQUIRED'
      : authoritativeStatus === 'WARNING'
      ? 'WARNING'
      : 'CLEAN';

  try {
    await AssessmentSession.updateOne(
      { _id: assessmentSession._id },
      {
        $set: {
          strikeCount: authoritativeStrikes,
          integrityStatus: mappedIntegrityStatus,
          proctoringSummary: summary
        }
      }
    );
  } catch (sessUpdateErr) {
    console.warn('[IntegrityEvent] AssessmentSession sync notice:', sessUpdateErr);
  }

  // 8. Write backward-compatible event to proctoringevents collection
  try {
    await ProctoringEvent.create({
      sessionId: assessmentSession._id,
      candidateId: new mongoose.Types.ObjectId(session.candidateId),
      eventType,
      serverTimestamp: now,
      clientTimestamp: clientTimestamp ? new Date(clientTimestamp) : undefined,
      severity: evalResult.severity,
      strikeAssigned: evalResult.strikePoints > 0,
      metadata: cleanMetadata
    });
  } catch (err) {
    console.warn('[IntegrityEvent] Backward-compatible event logging notice:', err);
  }

  // 9. Return safe authoritative response
  return NextResponse.json({
    success: true,
    eventId,
    eventType,
    strikeAssigned: evalResult.strikePoints > 0,
    strikeCount: authoritativeStrikes,
    status: authoritativeStatus,
    reason: evalResult.reason,
    serverTimestamp: now.toISOString()
  });
});

function sanitizeMetadata(data: Record<string, any>): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    // Exclude images, base64 strings, or oversized data payloads
    if (typeof val === 'string' && val.length > 500) {
      clean[key] = val.substring(0, 500) + '...[truncated]';
    } else if (
      typeof val === 'number' || 
      typeof val === 'boolean' || 
      typeof val === 'string' ||
      val === null
    ) {
      clean[key] = val;
    }
  }
  return clean;
}
