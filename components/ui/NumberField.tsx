"use client";

import { useEffect, useState, type CSSProperties } from "react";

interface Props {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  style?: CSSProperties;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  "aria-label"?: string;
  title?: string;
}

/**
 * Number input that stays EMPTY when cleared instead of snapping to 0. Editing
 * "75" → "" → "85" works without a stuck leading zero (the old bug: clearing
 * forced 0, so retyping produced "085"). A blank field means 0 semantically.
 *
 * Backed by a local string so the box can hold "" and in-progress values like
 * "1." while the parent keeps a clean number.
 */
export function NumberField({ value, onChange, min, max, ...rest }: Props) {
  const [text, setText] = useState(value ? String(value) : "");

  // Re-sync when the value changes from OUTSIDE (quick-set buttons, discard, load),
  // but not from our own keystroke (parsed text already equals value → leave as-is,
  // so mid-edit states like "1." aren't clobbered).
  useEffect(() => {
    const parsed = text === "" ? 0 : parseFloat(text);
    if (parsed !== value) setText(value ? String(value) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="number"
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        if (t === "") {
          onChange(0);
          return;
        }
        const n = parseFloat(t);
        if (!Number.isNaN(n)) {
          const clamped =
            min != null && n < min ? min : max != null && n > max ? max : n;
          onChange(clamped);
        }
      }}
      {...rest}
    />
  );
}
