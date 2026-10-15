'use client';
import { useEffect } from 'react';
import { useAssessmentState } from '@/hooks/useAssessmentState';
import AssessmentShell from '@/components/assessment/AssessmentShell';

export default function ReviewRoutePage() {
  const setStatus = useAssessmentState((s) => s.setStatus);

  useEffect(() => {
    setStatus('REVIEW');
  }, [setStatus]);

  return <AssessmentShell />;
}
