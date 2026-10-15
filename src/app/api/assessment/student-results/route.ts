import { NextResponse } from 'next/server';
import connectToDatabase from '@/config/database';
import { StudentResult } from '@/server/models/StudentResult';

export async function GET(req: Request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    // If specific student email requested
    if (email) {
      const studentResult = await StudentResult.findOne({
        docType: 'STUDENT_RESULT',
        studentEmail: email.trim().toLowerCase()
      }).sort({ submittedAt: -1 }).lean();

      if (!studentResult) {
        return NextResponse.json({ error: 'Student result not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        studentResult: {
          studentName: studentResult.studentName,
          studentEmail: studentResult.studentEmail,
          marksObtained: studentResult.marksObtained,
          totalMarks: studentResult.totalMarks || 60,
          percentage: studentResult.percentage,
          mcqMarks: studentResult.mcqMarks,
          gitMarks: studentResult.gitMarks,
          shortlistStatus: studentResult.shortlistStatus,
          submittedAt: studentResult.submittedAt,
          sectionBreakdown: studentResult.sectionBreakdown
        }
      });
    }

    // Otherwise, return all students results array from master roster
    const masterRoster = await StudentResult.findOne({
      docType: 'ALL_STUDENTS_ROSTER',
      rosterKey: 'ALL_RESULTS'
    }).lean();

    const allResults = masterRoster?.allStudentsResults || [];

    // Return the array of all students with student name, student email id, marks obtained
    return NextResponse.json({
      success: true,
      totalStudents: allResults.length,
      allStudentsResults: allResults.map((r: any) => ({
        studentName: r.studentName,
        studentEmail: r.studentEmail,
        marksObtained: r.marksObtained,
        totalMarks: r.totalMarks || 60,
        percentage: r.percentage,
        shortlistStatus: r.shortlistStatus,
        submittedAt: r.submittedAt
      }))
    });
  } catch (error) {
    console.error('Error fetching student results:', error);
    return NextResponse.json({ error: 'Failed to fetch student results' }, { status: 500 });
  }
}
