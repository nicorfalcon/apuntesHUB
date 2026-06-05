"use client";

import { useState } from "react";
import type { StudyActivity } from "@/lib/ai/study-activity";
import type { Source } from "./source-pills";
import { SourcePills } from "./source-pills";
import { StudyQuestionCard } from "./study-question-card";

export interface StudyResultSummary {
  correct: number;
  total: number;
  incorrectQuestionIds: string[];
}

interface Props {
  activity: StudyActivity;
  sources: Source[];
  onFinish: (summary: StudyResultSummary) => void;
}

export function StudySession({ activity, sources, onFinish }: Props) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<
    Record<string, { value: number | boolean; correct: boolean }>
  >({});

  const total = activity.questions.length;
  const current = activity.questions[index];
  const currentAnswer = answers[current.id];

  function handleSelect(value: number | boolean, isCorrect: boolean) {
    if (answers[current.id]) return; // bloquear tras la primera respuesta
    setAnswers((prev) => ({ ...prev, [current.id]: { value, correct: isCorrect } }));
  }

  function handleNext() {
    if (index < total - 1) {
      setIndex(index + 1);
      return;
    }
    const incorrectQuestionIds: string[] = [];
    let correct = 0;
    for (const question of activity.questions) {
      if (answers[question.id]?.correct) correct += 1;
      else incorrectQuestionIds.push(question.id);
    }
    onFinish({ correct, total, incorrectQuestionIds });
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      <StudyQuestionCard
        activity={activity}
        index={index}
        total={total}
        selected={currentAnswer ? currentAnswer.value : null}
        onSelect={handleSelect}
        onNext={handleNext}
        isLast={index === total - 1}
      />
      {sources.length > 0 && <SourcePills sources={sources} />}
    </div>
  );
}
