import { NextResponse } from 'next/server';
import { requireAuth, JwtPayload } from '@/server/utils/auth';
import connectToDatabase from '@/config/database';
import { ProctoringRecord } from '@/server/models/ProctoringRecord';
import { ProctoringEvent } from '@/server/models/ProctoringEvent';
import mongoose from 'mongoose';

export const GET = requireAuth(async (req: Request, session: JwtPayload) => {
  // Enforce server-verified ADMIN authorization
  if (session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');

  await connectToDatabase();

  if (sessionId) {
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return NextResponse.json({ error: 'Invalid sessionId format' }, { status: 400 });
    }

    const sessionObjId = new mongoose.Types.ObjectId(sessionId);

    // 1. Fetch from authoritative proctoring_events collection
    const record = await ProctoringRecord.findOne({ sessionId: sessionObjId }).lean() as any;

    if (record) {
      return NextResponse.json({
        success: true,
        record: {
          id: record._id.toString(),
          sessionId: record.sessionId?.toString(),
          studentName: record.studentName,
          studentEmail: record.studentEmail,
          totalStrikes: record.totalStrikes,
          status: record.status,
          lastEventType: record.lastEventType,
          lastEventAt: record.lastEventAt,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt
        },
        events: (record.events || []).map((e: any) => ({
          id: e.eventId,
          sessionId: record.sessionId?.toString(),
          eventType: e.eventType,
          category: e.category,
          strikePoints: e.strikePoints,
          serverTimestamp: e.serverTimestamp,
          clientTimestamp: e.clientTimestamp,
          severity: e.severity,
          strikeAssigned: e.strikePoints > 0,
          accepted: e.accepted,
          reason: e.reason,
          metadata: e.metadata
        }))
      });
    }

    // Fallback: Query legacy proctoringevents collection
    const fallbackEvents = await ProctoringEvent.find({ sessionId: sessionObjId })
      .populate('candidateId', 'email fullName')
      .sort({ serverTimestamp: -1 })
      .limit(100)
      .lean();

    return NextResponse.json({
      success: true,
      record: null,
      events: fallbackEvents.map((e: any) => ({
        id: e._id.toString(),
        sessionId: e.sessionId?.toString(),
        candidate: e.candidateId ? {
          id: e.candidateId._id?.toString(),
          email: e.candidateId.email,
          fullName: e.candidateId.fullName
        } : null,
        eventType: e.eventType,
        serverTimestamp: e.serverTimestamp,
        clientTimestamp: e.clientTimestamp,
        severity: e.severity,
        strikeAssigned: e.strikeAssigned,
        reason: e.eventType,
        metadata: e.metadata
      }))
    });
  }

  // If no sessionId provided, return recent proctoring records
  const recentRecords = await ProctoringRecord.find({})
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();

  return NextResponse.json({
    success: true,
    records: recentRecords.map((r: any) => ({
      id: r._id.toString(),
      sessionId: r.sessionId?.toString(),
      studentName: r.studentName,
      studentEmail: r.studentEmail,
      totalStrikes: r.totalStrikes,
      status: r.status,
      lastEventType: r.lastEventType,
      lastEventAt: r.lastEventAt,
      eventCount: r.events?.length || 0
    }))
  });
});

export const PATCH = requireAuth(async (req: Request, session: JwtPayload) => {
  if (session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { sessionId, status, adminNote } = body;

    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return NextResponse.json({ error: 'Valid sessionId is required' }, { status: 400 });
    }

    const validStatuses = ['NORMAL', 'WARNING', 'REVIEW_REQUIRED', 'COMPLETED', 'CLEARED', 'REVIEWED'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid review status' }, { status: 400 });
    }

    await connectToDatabase();

    const updated = await ProctoringRecord.findOneAndUpdate(
      { sessionId: new mongoose.Types.ObjectId(sessionId) },
      {
        $set: {
          status,
          updatedAt: new Date()
        },
        $push: {
          events: {
            eventId: new mongoose.Types.ObjectId().toString(),
            idempotencyKey: `admin-review-${Date.now()}`,
            eventType: 'ADMIN_REVIEW_UPDATE',
            category: 'SYSTEM',
            serverTimestamp: new Date(),
            strikePoints: 0,
            severity: 'LOW',
            accepted: true,
            isDuplicate: false,
            flaggedForReview: false,
            reason: `Admin updated status to ${status}. Note: ${adminNote || 'No notes provided'}`,
            metadata: {
              adminEmail: session.email,
              adminNote: adminNote || null
            }
          }
        }
      },
      { returnDocument: 'after' }
    );

    if (!updated) {
      return NextResponse.json({ error: 'Proctoring record not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Proctoring record status updated to ${status}`,
      record: {
        sessionId: updated.sessionId.toString(),
        totalStrikes: updated.totalStrikes,
        status: updated.status
      }
    });
  } catch (err: any) {
    console.error('Error updating proctoring review status:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
