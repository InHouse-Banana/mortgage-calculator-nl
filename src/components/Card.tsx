import React, { useId, useState } from 'react';
import { InfoTooltip } from './InfoTooltip';

type CardProps = {
  title: string;
  info?: string;
  children: React.ReactNode;
  /** Adds a disclosure toggle to the header. */
  collapsible?: boolean;
  /** Only meaningful with `collapsible`. */
  defaultOpen?: boolean;
  /**
   * 'fields' lays children out in the standard two-column input grid.
   * 'plain' leaves layout to the caller — for cards holding their own sections.
   */
  layout?: 'fields' | 'plain';
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={
        'h-4 w-4 shrink-0 transition-transform duration-150 ' +
        (open ? 'rotate-180' : '')
      }
    >
      <path
        d="M5 7.5 10 12.5 15 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Card({
  title,
  info,
  children,
  collapsible = false,
  defaultOpen = true,
  layout = 'fields',
}: CardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  const headingClass =
    'flex items-center gap-1.5 text-base font-semibold tracking-wide text-brand-500 uppercase';
  const body =
    layout === 'plain' ? (
      <div className="space-y-4">{children}</div>
    ) : (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    );

  if (!collapsible) {
    return (
      <div className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
        <h3 className={'mb-3 ' + headingClass}>
          {title}
          {info && <InfoTooltip text={info} />}
        </h3>
        {body}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
      <div className={'flex items-center justify-between gap-2 ' + (open ? 'mb-3' : '')}>
        <h3 className={headingClass}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={bodyId}
            className="-m-1 flex items-center gap-1.5 rounded p-1 text-left uppercase transition-colors outline-none hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            <Chevron open={open} />
            {title}
          </button>
          {info && <InfoTooltip text={info} />}
        </h3>
      </div>
      <div id={bodyId} hidden={!open}>
        {body}
      </div>
    </div>
  );
}

/** A titled block inside a `layout="plain"` card. */
export function CardSection({
  title,
  info,
  children,
}: {
  title: string;
  info?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold tracking-wide text-brand-400 uppercase">
        {title}
        {info && <InfoTooltip text={info} />}
      </h4>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}
