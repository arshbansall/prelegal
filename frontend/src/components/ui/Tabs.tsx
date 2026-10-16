"use client";

import type { KeyboardEvent, ReactNode } from "react";

const tabId = (idPrefix: string, tab: string) => `${idPrefix}-tab-${tab}`;
const panelId = (idPrefix: string, tab: string) => `${idPrefix}-panel-${tab}`;

/**
 * An accessible tab list (WAI-ARIA tabs pattern): arrow keys, Home and End
 * move between tabs. Render each tab's content in a `TabPanel` with the same
 * `idPrefix`.
 */
export function Tabs<T extends string>({
  label,
  idPrefix,
  tabs,
  value,
  onChange,
}: {
  label: string;
  idPrefix: string;
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (tab: T) => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((tab) => tab.id === value);
    const next = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onChange(tabs[next].id);
    document.getElementById(tabId(idPrefix, tabs[next].id))?.focus();
  }

  return (
    <div role="tablist" aria-label={label} onKeyDown={handleKeyDown} className="flex gap-1 border-b border-slate-200 px-3">
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={tabId(idPrefix, tab.id)}
            aria-selected={selected}
            aria-controls={panelId(idPrefix, tab.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={
              "-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-2 " +
              "focus-visible:outline-primary " +
              (selected ? "border-secondary text-navy" : "border-transparent text-slate-500 hover:text-navy")
            }
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The content of one tab. Inactive panels stay mounted (just hidden), so their
 * state, such as a half-typed message, survives switching tabs.
 */
export function TabPanel({
  idPrefix,
  tab,
  selected,
  className,
  children,
}: {
  idPrefix: string;
  tab: string;
  selected: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={panelId(idPrefix, tab)}
      aria-labelledby={tabId(idPrefix, tab)}
      hidden={!selected}
      className={className}
    >
      {children}
    </div>
  );
}
