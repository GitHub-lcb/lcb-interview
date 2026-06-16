import { useCallback, useEffect, useMemo, useState } from 'react'
import type { InterviewAttempt, Question, StudyProgress, StudyQuestionStatus } from '../types'
import {
  STUDY_PROGRESS_EVENT,
  appendDailyPlanQuestions,
  getQuestionState,
  rememberQuestions as rememberQuestionsInProgress,
  readStudyProgress,
  recordInterviewAttempt as recordInterviewAttemptInProgress,
  replaceDailyPlan,
  toggleQuestionInPlan,
  updateStudySettings,
  updateQuestionStatus,
  writeStudyProgress,
} from '../utils/studyProgress'

export function useStudyProgress() {
  const [progress, setProgress] = useState<StudyProgress>(() => readStudyProgress())

  useEffect(() => {
    const refresh = () => setProgress(readStudyProgress())
    window.addEventListener('storage', refresh)
    window.addEventListener(STUDY_PROGRESS_EVENT, refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener(STUDY_PROGRESS_EVENT, refresh)
    }
  }, [])

  const save = useCallback((next: StudyProgress) => {
    writeStudyProgress(next)
    setProgress(next)
  }, [])

  const setStatus = useCallback((questionId: number, status: StudyQuestionStatus) => {
    save(updateQuestionStatus(readStudyProgress(), questionId, status))
  }, [save])

  const setInPlan = useCallback((questionId: number, added: boolean) => {
    save(toggleQuestionInPlan(readStudyProgress(), questionId, added))
  }, [save])

  const setDailyPlan = useCallback((questionIds: number[]) => {
    save(replaceDailyPlan(readStudyProgress(), questionIds))
  }, [save])

  const addDailyPlanQuestions = useCallback((questionIds: number[]) => {
    save(appendDailyPlanQuestions(readStudyProgress(), questionIds))
  }, [save])

  const updateSettings = useCallback((patch: { targetRole?: string; sprintDays?: number | null }) => {
    save(updateStudySettings(readStudyProgress(), patch))
  }, [save])

  const rememberQuestions = useCallback((questions: Question[]) => {
    if (questions.length === 0) {
      return
    }
    save(rememberQuestionsInProgress(readStudyProgress(), questions))
  }, [save])

  const rememberQuestion = useCallback((question: Question) => {
    save(rememberQuestionsInProgress(readStudyProgress(), [question]))
  }, [save])

  const recordInterviewAttempt = useCallback((attempt: InterviewAttempt) => {
    save(recordInterviewAttemptInProgress(readStudyProgress(), attempt))
  }, [save])

  return useMemo(() => ({
    progress,
    getState: (questionId: number) => getQuestionState(progress, questionId),
    setStatus,
    setInPlan,
    setDailyPlan,
    addDailyPlanQuestions,
    updateSettings,
    rememberQuestion,
    rememberQuestions,
    recordInterviewAttempt,
  }), [addDailyPlanQuestions, progress, rememberQuestion, rememberQuestions, recordInterviewAttempt, setDailyPlan, setInPlan, setStatus, updateSettings])
}
