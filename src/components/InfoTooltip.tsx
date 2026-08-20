import React, { useEffect, useId, useRef, useState } from 'react';

type InfoTooltipProps = {
  text: string;
};

/**
 * Shows its text on hover for mouse users.
 *
 * Hover alone would strand two groups: keyboard users, who cannot hover, and
 * touch users, where hover does not exist. So the three inputs compose rather
 * than compete — the tooltip is open if it is hovered, focused, or pinned by a
 * click. A plain click-toggle on top of hover would fight it, because a click
 * is preceded by a hover that has already opened the tooltip, so the toggle
 * would close it again on the way in.
 *
 * Hover lives on the wrapper, not the icon, so the pointer can travel onto the
 * text to read or select it. Escape and an outside press dismiss it, per
 * WCAG 1.4.13 (Content on Hover or Focus).
 */
export function InfoTooltip({ text }: InfoTooltipProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  const open = hovered || focused || pinned;

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setPinned(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setPinned(false);
      setHovered(false);
      setFocused(false);
      buttonRef.current?.blur();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <span
      ref={ref}
      className="relative inline-flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onClick={(event) => {
          // Prevent an ancestor <label> from forwarding this click to its input.
          event.preventDefault();
          setPinned((value) => !value);
        }}
        className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-brand-300 text-[10px] leading-none font-semibold text-brand-300 normal-case transition-colors outline-none hover:border-brand-400 hover:text-brand-400 focus-visible:ring-2 focus-visible:ring-brand-300"
      >
        i
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded-md border border-brand-100 bg-white p-2 text-xs font-normal normal-case text-brand-500 shadow-md"
        >
          {text}
        </span>
      )}
    </span>
  );
}
