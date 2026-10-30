"use client";

import React from "react";

export const GOLDMINE_DESCRIPTIONS: Record<string, string> = {
  M: "Mint – Perfecto, sin uso",
  NM: "Near Mint – Casi perfecto, mínimas señales",
  "VG+": "Very Good Plus – Muy buen estado, marcas leves",
  VG: "Very Good – Buen estado, marcas visibles pero reproduce bien",
  F: "Fair – Justo, daño considerable",
};

function GradeWithTooltip({ grade }: { grade: string }) {
  const description = GOLDMINE_DESCRIPTIONS[grade];
  if (!description) return <>{grade}</>;

  return (
    <span
      className="underline decoration-dotted cursor-help"
      title={description}
    >
      {grade}
    </span>
  );
}

/**
 * Renders shortDescription text, parsing "Condición: Usado (XX/YY)" lines
 * to add Goldmine grade tooltips on the grade abbreviations.
 */
export function ShortDescriptionText({ text }: { text: string }) {
  const conditionRegex = /^(Condición:\s*Usado\s*\()([A-Z+]+)(\/?)([A-Z+]*)\)(.*)$/m;
  const match = text.match(conditionRegex);

  if (!match) {
    return <>{text}</>;
  }

  const beforeMatch = text.slice(0, match.index);
  const afterMatch = text.slice((match.index || 0) + match[0].length);

  const [, prefix, mediaGrade, slash, sleeveGrade, suffix] = match;

  return (
    <>
      {beforeMatch}
      {prefix}
      <GradeWithTooltip grade={mediaGrade} />
      {slash}
      {sleeveGrade && <GradeWithTooltip grade={sleeveGrade} />}
      {")"}
      {suffix}
      {afterMatch}
    </>
  );
}
