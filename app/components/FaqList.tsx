"use client";

import { useState } from "react";
import { FaqItem } from "./FaqItem";
import type { Question } from "./Faq";

export function FaqList({ questions }: { questions: Question[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      {questions.map((q, i) => (
        <FaqItem
          key={q.question}
          number={i + 1}
          question={q.question}
          answer={q.answer}
          open={openIndex === i}
          onToggle={() => setOpenIndex(openIndex === i ? null : i)}
        />
      ))}
    </>
  );
}
