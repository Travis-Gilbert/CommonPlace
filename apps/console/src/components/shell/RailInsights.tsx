'use client';

// SOURCING: twenty-ui/navigation MenuItemNavigate for the rows and
// twenty-ui/data-display Tag for step state, per the "Inspector rail activity
// rows" and "Inspector rail step state" ledger rows. Icons are Noun marks from
// the one icon file, which satisfy the fork's IconComponent directly because
// they already take SVGProps.
//
// The steps are real. `useThreadStore().plan` is the live AgentPlanStep list the
// chat rail already renders, so this is a second reading of one run rather than
// a second source of truth, and there is no fixture behind it. An empty plan
// renders nothing at all: a heading over no steps would claim the agent is
// working when it is not.
//
// The reference distinguishes three weights, and the status enum already
// carries them: the step running now takes the accent, finished steps settle
// into full ink, and steps not yet reached stay muted. Colour arrives through
// register utilities rather than values, so the light and dark registers both
// resolve it. No pulse: motion here would need an interaction-inventory row,
// and a colour already says which step is live.

import { MenuItemNavigate } from 'twenty-ui/navigation';
import { Tag, type TagColor } from 'twenty-ui/data-display';
import { IconRun } from '@/components/shell/icons';
import { forkIcon } from '@/components/shell/fork-icon';
import { useThreadStore, type AgentPlanStep } from '@/lib/thread-store';
import { cn } from '@/lib/cn';

// Module scope: a component identity minted during render remounts the icon.
const StepIcon = forkIcon(IconRun);

type StepStatus = AgentPlanStep['status'];

/** Register ink per status: the three weights the reference reads at a glance. */
function inkFor(status: StepStatus): string {
  switch (status) {
    case 'running':
      return 'text-ij-gold';
    case 'complete':
      return 'text-ij-ink';
    case 'refused':
      return 'text-[color:var(--hue-status-failed)]';
    case 'pending':
    default:
      return 'text-ij-ink-disabled';
  }
}

/** The fork's tag palette per status, for the tool chip beside a step. */
function tagColorFor(status: StepStatus): TagColor {
  switch (status) {
    case 'running':
      return 'blue';
    case 'refused':
      return 'red';
    case 'complete':
    case 'pending':
    default:
      return 'gray';
  }
}

export interface RailInsightsProps {
  /** Opens the step in the surface that owns it. Rows are inert without it. */
  readonly onOpenStep?: (step: AgentPlanStep) => void;
  readonly className?: string;
}

export function RailInsights({ onOpenStep, className }: RailInsightsProps) {
  const plan = useThreadStore((state) => state.plan);

  if (plan.length === 0) return null;

  return (
    <section
      data-rail-insights
      aria-label="Agentic task insights"
      className={cn('flex min-h-0 shrink-0 flex-col gap-0.5 overflow-y-auto', className)}
    >
      <h2 className="px-2.5 pb-1 text-ij-island-meta uppercase text-ij-ink-info">
        Agentic task insights
      </h2>

      {plan.map((step) => (
        <div
          key={step.id}
          data-rail-insight-step={step.id}
          data-step-status={step.status}
          className={cn('flex items-center gap-1', inkFor(step.status))}
        >
          <MenuItemNavigate
            className="min-w-0 flex-1"
            LeftIcon={StepIcon}
            text={step.label}
            onClick={onOpenStep ? () => onOpenStep(step) : undefined}
          />
          {/* The tool is the part of a step a reader scans for, and the fork
              already has the chip for it. Omitted rather than rendered empty
              when a step names no tool. */}
          {step.tool ? (
            <Tag color={tagColorFor(step.status)} text={step.tool} preventShrink />
          ) : null}
        </div>
      ))}
    </section>
  );
}
