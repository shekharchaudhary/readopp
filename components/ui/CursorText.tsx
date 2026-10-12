"use client";
import { useRef, type ReactNode } from "react";
import { useCursorTextMotion } from "./useCursorTextMotion";

export function CursorMotionRegion({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const motion = useCursorTextMotion(root);
  return <div id={id} ref={root} {...motion} className={className} data-cursor-region>{children}</div>;
}

/** Keeps the accessible name intact while animating only the visual characters. */
export function CursorText({ text }: { text: string }) {
  return <><span className="sr-only">{text}</span><span aria-hidden="true">{text.split(" ").map((word,index)=><span key={`${index}-${word}`}>{index > 0 ? " " : null}<span className="cursor-headline-word">{Array.from(word).map((letter,position)=><span data-cursor-glyph className="cursor-headline-glyph" key={position}>{letter}</span>)}</span></span>)}</span></>;
}
