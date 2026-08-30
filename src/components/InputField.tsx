import React, { useEffect, useId, useRef, useState } from 'react';
import { NumericFormat } from 'react-number-format';
import { InfoTooltip } from './InfoTooltip';

type InputFieldProps = {
  title: string;
  prepend?: string;
  append?: string;
  value: string | number;
  onChange: (value: string) => void;
  disabled?: boolean;
  info?: string;
  /**
   * Rendered on its own line under the title. For parentheticals that would
   * otherwise wrap mid-phrase — "Payoff month (of" / "360)".
   * Still part of the accessible name, so queries see the whole label.
   */
  titleNote?: string;
  /**
   * Accessible name for the number itself, when the visible label describes the
   * toggle beside it rather than the value — "Enable purchase costs" names the
   * checkbox, while the figure next to it is the total.
   */
  valueLabel?: string;
  /**
   * Where the "computed" tag sits. Inline reads better and is the default;
   * narrow cards where the label already wraps set it below, so the tag does
   * not sometimes fit and sometimes not within the same card.
   */
  badge?: 'inline' | 'below';
  /**
   * Digits shown after the decimal point. Defaults to 0 for money (cents are
   * noise on figures this size) and 2 otherwise, so rates keep their precision.
   * Display only — state and the calculation engine keep full precision.
   */
  decimals?: number;
  toggle?: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    /** Renders the dash state — some, but not all, of what this controls is on. */
    indeterminate?: boolean;
    /** Overrides the default `Include {title} in total` accessible name. */
    label?: string;
  };
};

function ComputedTag({ className = '' }: { className?: string }) {
  return (
    <span
      className={
        'rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-brand-400 uppercase ' +
        className
      }
    >
      computed
    </span>
  );
}

export function InputField({
  title,
  prepend,
  append,
  value,
  onChange,
  disabled,
  info,
  titleNote,
  valueLabel,
  badge = 'inline',
  decimals,
  toggle,
}: InputFieldProps) {
  const isMoney = prepend === '€' || append === '€';
  const decimalScale = decimals ?? (isMoney ? 0 : 2);
  const id = useId();

  // NumericFormat holds what you type until blur, so the committed value and
  // the displayed one can diverge. Mirror it in local state and re-sync from
  // the prop, otherwise an entry the parent clamps back to the value it
  // already had (e.g. typing 99 into a 1-12 field already showing 12) stays on
  // screen while every figure below is computed from the clamped number.
  // `indeterminate` is a DOM property with no HTML attribute, so it can only
  // be set imperatively.
  const toggleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (toggleRef.current) {
      toggleRef.current.indeterminate = toggle?.indeterminate ?? false;
    }
  }, [toggle?.indeterminate]);

  const [draft, setDraft] = useState<string | number>(value);
  const [committed, setCommitted] = useState<string | number>(value);

  // Adjust-state-during-render rather than in an effect: no extra paint, and
  // no cascading-render lint error.
  if (value !== committed) {
    setCommitted(value);
    setDraft(value);
  }

  return (
    // Column layout with the value pushed to the bottom: grid items stretch to
    // the row height, so every value in a row lands on the same line however
    // tall its label happens to be.
    <div
      className={
        'flex h-full flex-col ' + (toggle && !toggle.checked ? 'opacity-50' : '')
      }
    >
      <div className="flex items-center gap-1.5 text-base text-brand-400">
        {toggle && (
          <input
            ref={toggleRef}
            type="checkbox"
            checked={toggle.checked}
            onChange={(e) => toggle.onChange(e.target.checked)}
            aria-label={toggle.label ?? `Include ${title} in total`}
            className="h-3.5 w-3.5 rounded border-brand-300 text-brand-400 focus:ring-2 focus:ring-brand-200"
          />
        )}
        {/* With a valueLabel the visible text names the toggle, not the
            number, so it must not be a <label for> the input — that would give
            the input a second name and make it ambiguous to assistive tech. */}
        {React.createElement(
          valueLabel ? 'span' : 'label',
          valueLabel ? {} : { htmlFor: id },
          title,
          titleNote ? (
            <React.Fragment key="note">
              {' '}
              <span>{titleNote}</span>
            </React.Fragment>
          ) : null,
        )}
        {info && <InfoTooltip text={info} />}
        {disabled && badge === 'inline' && <ComputedTag className="shrink-0" />}
      </div>
      {disabled && badge === 'below' && <ComputedTag className="mt-1 self-start" />}
      {/* mt-auto: the cell is stretched to the row height, so pushing the
          value to the bottom lines it up with every other value in the row,
          however many lines the labels above them took. */}
      <div className="relative mt-auto pt-1">
        {prepend && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-brand-300">
            {prepend}
          </span>
        )}
        <NumericFormat
          id={id}
          aria-label={valueLabel}
          inputMode="decimal"
          decimalScale={decimalScale}
          thousandSeparator
          value={draft}
          disabled={disabled}
          onValueChange={(values) => setDraft(values.value)}
          onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
            onChange(e.currentTarget.value.replace(/,/g, ''));
            // When the clamp lands back on the current value the prop never
            // changes, so the effect above won't fire — reset the display here.
            setDraft(value);
          }}
          className={
            'w-full rounded-md border py-2 text-sm tabular-nums transition-colors ' +
            (prepend ? 'pl-8' : 'pl-3') +
            ' ' +
            (append ? 'pr-8' : 'pr-3') +
            ' ' +
            (disabled
              ? 'cursor-default border-transparent bg-brand-50 text-brand-500'
              : 'border-brand-200 bg-white text-brand-600 focus:border-brand-400 focus:ring-2 focus:ring-brand-200 focus:outline-none')
          }
        />
        {append && (
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-brand-300">
            {append}
          </span>
        )}
      </div>
    </div>
  );
}
