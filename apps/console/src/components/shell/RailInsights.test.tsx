import { describe, expect, it, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RailInsights } from './RailInsights';
import { useThreadStore } from '@/lib/thread-store';

describe('RailInsights', () => {
  beforeEach(() => {
    useThreadStore.setState({ plan: [] });
  });

  // The load-bearing one. The rail is chrome and is always on screen, so a
  // heading rendered over an empty plan would tell the reader an agent is
  // working whenever they open the rail. Nothing to report means nothing drawn.
  it('renders nothing when the plan is empty', () => {
    expect(renderToStaticMarkup(<RailInsights />)).toBe('');
  });

  it('renders one row per step, carrying the step label', () => {
    useThreadStore.setState({
      plan: [
        { id: 's1', label: 'Research', status: 'complete' },
        { id: 's2', label: 'Run Code', tool: 'bash', status: 'running' },
      ],
    });
    const markup = renderToStaticMarkup(<RailInsights />);
    expect(markup).toContain('Research');
    expect(markup).toContain('Run Code');
    expect(markup).toContain('Agentic task insights');
  });

  // The three weights the reference distinguishes have to survive as data, not
  // only as colour, or nothing can assert them and a restyle can silently drop
  // the distinction.
  it('stamps each step status so the weight is assertable', () => {
    useThreadStore.setState({
      plan: [
        { id: 's1', label: 'Fetching', status: 'pending' },
        { id: 's2', label: 'Run Code', status: 'running' },
        { id: 's3', label: 'Refused step', status: 'refused' },
      ],
    });
    const markup = renderToStaticMarkup(<RailInsights />);
    expect(markup).toContain('data-step-status="pending"');
    expect(markup).toContain('data-step-status="running"');
    expect(markup).toContain('data-step-status="refused"');
  });

  it('shows the tool chip only for steps that name a tool', () => {
    useThreadStore.setState({
      plan: [
        { id: 's1', label: 'With tool', tool: 'ripgrep', status: 'complete' },
        { id: 's2', label: 'Without tool', status: 'complete' },
      ],
    });
    const markup = renderToStaticMarkup(<RailInsights />);
    expect(markup).toContain('ripgrep');
    // Two steps, one chip: the second must not render an empty tag.
    expect(markup.match(/ripgrep/g)).toHaveLength(1);
  });
});
