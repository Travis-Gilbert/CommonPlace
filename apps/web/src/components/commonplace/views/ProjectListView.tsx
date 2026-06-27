'use client';

import { useCallback, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  type Table,
  useReactTable,
} from '@tanstack/react-table';
import { toast } from 'sonner';
import { useApiData } from '@/lib/commonplace-api';
import {
  gqlAddWorkItemToCycle,
  gqlAddWorkItemToModule,
  gqlCreatePmCycle,
  gqlCreatePmModule,
  gqlCreatePmProject,
  gqlCreateSticky,
  gqlCreateWorkItem,
  gqlCreateWorkItemComment,
  gqlLogWork,
  gqlPmOverview,
  gqlScopeProjectLabel,
  gqlSetWorkItemState,
  type CollectionGql,
  type PmOverviewGql,
  type PmProjectGql,
  type PmStateGql,
  type PmWorkItemGql,
} from '@/lib/commonplace-graphql';
import { useLayout } from '@/lib/providers/layout-provider';

type ViewMode = 'board' | 'list' | 'planning';

type WorkRow = PmWorkItemGql & {
  projectName: string;
  stateName: string;
  updatedLabel: string;
};

const EMPTY_OVERVIEW: PmOverviewGql = {
  projects: [],
  workItems: [],
  stickies: [],
  pages: [],
};
const PRIORITIES = ['none', 'low', 'medium', 'high', 'urgent'];
const LABEL_COLORS = ['#2D5F6B', '#A65324', '#C49A4A', '#5A7A4A', '#8B6FA0'];

function identifierFromName(name: string): string {
  const ident = name
    .split(/\s+/)
    .map((part) => part.match(/[a-z0-9]/i)?.[0] ?? '')
    .join('')
    .slice(0, 4)
    .toUpperCase();
  return ident || 'CP';
}

function formatUpdated(ms: number): string {
  if (!ms) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(ms));
}

function dateInputFromMs(ms: number): string {
  if (!ms) return '';
  return new Date(ms).toISOString().slice(0, 10);
}

function msFromDateInput(value: string, fallbackOffsetDays: number): number {
  if (value) return new Date(`${value}T12:00:00`).getTime();
  return Date.now() + fallbackOffsetDays * 24 * 60 * 60 * 1000;
}

function stateName(state?: string | null): string {
  return state?.trim() || 'Unassigned';
}

function formatDuration(ms: number): string {
  if (!ms) return '0m';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function findCollection(collections: CollectionGql[], id?: string): CollectionGql | undefined {
  if (!id) return undefined;
  return collections.find((collection) => collection.id === id);
}

export default function ProjectListView() {
  const { launchView } = useLayout();
  const { data, loading, error, refetch } = useApiData<PmOverviewGql>(
    () => gqlPmOverview(),
    [],
  );
  const [mode, setMode] = useState<ViewMode>('board');
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'updated', desc: true },
  ]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showWorkItemForm, setShowWorkItemForm] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectIdentifier, setProjectIdentifier] = useState('');
  const [workItemTitle, setWorkItemTitle] = useState('');
  const [workItemDescription, setWorkItemDescription] = useState('');
  const [workItemPriority, setWorkItemPriority] = useState('medium');
  const [workItemEstimate, setWorkItemEstimate] = useState('3');
  const [cycleName, setCycleName] = useState('');
  const [cycleStart, setCycleStart] = useState(dateInputFromMs(Date.now()));
  const [cycleEnd, setCycleEnd] = useState(dateInputFromMs(Date.now() + 14 * 24 * 60 * 60 * 1000));
  const [moduleName, setModuleName] = useState('');
  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState(LABEL_COLORS[0]);
  const [stickyTitle, setStickyTitle] = useState('');
  const [stickyDescription, setStickyDescription] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [worklogMinutes, setWorklogMinutes] = useState('30');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const overview = data ?? EMPTY_OVERVIEW;
  const projects = overview.projects;
  const activeProject = projects.find((project) => project.collection.id === selectedProjectId)
    ?? projects[0]
    ?? null;

  const projectById = useMemo(() => {
    const next = new Map<string, PmProjectGql>();
    for (const project of projects) next.set(project.collection.id, project);
    return next;
  }, [projects]);

  const rows = useMemo<WorkRow[]>(() => overview.workItems.map((workItem) => {
    const project = workItem.projectIds
      .map((id) => projectById.get(id))
      .find(Boolean);
    return {
      ...workItem,
      projectName: project?.collection.name ?? 'Unscoped',
      stateName: stateName(workItem.state?.name ?? workItem.item.status),
      updatedLabel: formatUpdated(workItem.item.updatedAtMs),
    };
  }), [overview.workItems, projectById]);

  const visibleRows = useMemo(() => {
    if (!activeProject) return rows;
    return rows.filter((row) => row.projectIds.includes(activeProject.collection.id));
  }, [activeProject, rows]);

  const selectedWorkItem = visibleRows.find((row) => row.item.id === selectedWorkItemId)
    ?? visibleRows[0]
    ?? null;

  const columns = useMemo<ColumnDef<WorkRow>[]>(() => [
    {
      id: 'work',
      accessorFn: (row) => `${row.sequenceId ?? ''} ${row.item.title}`,
      header: 'Work item',
      cell: ({ row }) => (
        <button
          type="button"
          className="cp-pm-row-button"
          onClick={() => setSelectedWorkItemId(row.original.item.id)}
        >
          <span className="cp-pm-sequence">{row.original.sequenceId ?? 'TASK'}</span>
          <span className="cp-pm-work-title">{row.original.item.title || 'Untitled'}</span>
        </button>
      ),
    },
    {
      accessorKey: 'stateName',
      header: 'State',
      cell: ({ row }) => (
        <span className="cp-pm-state-pill" data-group={row.original.state?.group ?? 'none'}>
          {row.original.stateName}
        </span>
      ),
    },
    {
      id: 'priority',
      accessorFn: (row) => row.item.priority ?? 'none',
      header: 'Priority',
      cell: ({ row }) => <span className="cp-pm-muted">{row.original.item.priority ?? 'none'}</span>,
    },
    {
      id: 'estimate',
      accessorFn: (row) => row.estimatePoint ?? 0,
      header: 'Estimate',
      cell: ({ row }) => (
        <span className="cp-pm-muted">
          {row.original.estimatePoint ? `${row.original.estimatePoint} pt` : '-'}
        </span>
      ),
    },
    {
      id: 'cycle',
      accessorFn: (row) => findCollection(activeProject?.cycles ?? [], row.cycleIds[0])?.name ?? '',
      header: 'Cycle',
      cell: ({ row }) => (
        <span className="cp-pm-muted">
          {findCollection(activeProject?.cycles ?? [], row.original.cycleIds[0])?.name ?? '-'}
        </span>
      ),
    },
    {
      id: 'module',
      accessorFn: (row) => findCollection(activeProject?.modules ?? [], row.moduleIds[0])?.name ?? '',
      header: 'Module',
      cell: ({ row }) => (
        <span className="cp-pm-muted">
          {findCollection(activeProject?.modules ?? [], row.original.moduleIds[0])?.name ?? '-'}
        </span>
      ),
    },
    {
      id: 'linked',
      accessorFn: (row) => row.aboutIds.length + row.commentCount + row.worklogCount,
      header: 'Graph',
      cell: ({ row }) => (
        <span className="cp-pm-muted">
          {row.original.aboutIds.length} about / {row.original.commentCount} comments
        </span>
      ),
    },
    {
      id: 'updated',
      accessorFn: (row) => row.item.updatedAtMs,
      header: 'Updated',
      cell: ({ row }) => <span className="cp-pm-muted">{row.original.updatedLabel}</span>,
    },
  ], [activeProject]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: visibleRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const runAction = useCallback(async (
    key: string,
    action: () => Promise<void>,
    success: string,
  ) => {
    setBusyAction(key);
    try {
      await action();
      refresh();
      toast.success(success);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyAction(null);
    }
  }, [refresh]);

  const handleCreateProject = useCallback(() => {
    const name = projectName.trim();
    if (!name) return;
    runAction('project', async () => {
      const project = await gqlCreatePmProject({
        name,
        identifier: projectIdentifier.trim() || identifierFromName(name),
        defaultStates: true,
      });
      setProjectName('');
      setProjectIdentifier('');
      setShowProjectForm(false);
      setSelectedProjectId(project.collection.id);
    }, `${name} created`);
  }, [projectIdentifier, projectName, runAction]);

  const handleCreateWorkItem = useCallback(() => {
    const title = workItemTitle.trim();
    if (!title || !activeProject) return;
    runAction('work-item', async () => {
      const state = activeProject.states.find((candidate) => candidate.group === 'backlog')
        ?? activeProject.states[0];
      const estimate = Number.parseInt(workItemEstimate, 10);
      const created = await gqlCreateWorkItem({
        title,
        description: workItemDescription.trim() || undefined,
        projectId: activeProject.collection.id,
        stateId: state?.id,
        priority: workItemPriority === 'none' ? undefined : workItemPriority,
        estimatePoint: Number.isFinite(estimate) ? estimate : undefined,
      });
      setWorkItemTitle('');
      setWorkItemDescription('');
      setWorkItemEstimate('3');
      setShowWorkItemForm(false);
      setSelectedWorkItemId(created.item.id);
    }, 'Work item created');
  }, [
    activeProject,
    runAction,
    workItemDescription,
    workItemEstimate,
    workItemPriority,
    workItemTitle,
  ]);

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!activeProject || !result.destination) return;
    const itemId = result.draggableId;
    const stateId = result.destination.droppableId;
    if (result.source.droppableId === stateId) return;
    const state = activeProject.states.find((candidate) => candidate.id === stateId);
    if (!state) return;
    runAction(`state-${itemId}`, async () => {
      await gqlSetWorkItemState(itemId, state.id);
      setSelectedWorkItemId(itemId);
    }, `Moved to ${state.name}`);
  }, [activeProject, runAction]);

  const handleCreateCycle = useCallback(() => {
    if (!activeProject || !cycleName.trim()) return;
    const name = cycleName.trim();
    runAction('cycle', async () => {
      await gqlCreatePmCycle({
        projectId: activeProject.collection.id,
        name,
        startAtMs: msFromDateInput(cycleStart, 0),
        endAtMs: msFromDateInput(cycleEnd, 14),
      });
      setCycleName('');
    }, `${name} created`);
  }, [activeProject, cycleEnd, cycleName, cycleStart, runAction]);

  const handleCreateModule = useCallback(() => {
    if (!activeProject || !moduleName.trim()) return;
    const name = moduleName.trim();
    runAction('module', async () => {
      await gqlCreatePmModule({ projectId: activeProject.collection.id, name });
      setModuleName('');
    }, `${name} created`);
  }, [activeProject, moduleName, runAction]);

  const handleCreateLabel = useCallback(() => {
    if (!activeProject || !labelName.trim()) return;
    const name = labelName.trim();
    runAction('label', async () => {
      await gqlScopeProjectLabel({
        projectId: activeProject.collection.id,
        name,
        color: labelColor,
      });
      setLabelName('');
    }, `${name} added`);
  }, [activeProject, labelColor, labelName, runAction]);

  const handleCreateSticky = useCallback(() => {
    if (!activeProject || !stickyTitle.trim()) return;
    const title = stickyTitle.trim();
    runAction('sticky', async () => {
      await gqlCreateSticky({
        ownerId: activeProject.collection.id,
        title,
        description: stickyDescription.trim() || undefined,
        color: '#2D5F6B',
        backgroundColor: '#F5F0E8',
        sortOrder: overview.stickies.length + 1,
      });
      setStickyTitle('');
      setStickyDescription('');
    }, `${title} created`);
  }, [activeProject, overview.stickies.length, runAction, stickyDescription, stickyTitle]);

  const handleAssignCycle = useCallback((cycleId: string) => {
    if (!selectedWorkItem || !cycleId) return;
    runAction(`cycle-${selectedWorkItem.item.id}`, async () => {
      await gqlAddWorkItemToCycle(selectedWorkItem.item.id, cycleId);
    }, 'Cycle updated');
  }, [runAction, selectedWorkItem]);

  const handleAssignModule = useCallback((moduleId: string) => {
    if (!selectedWorkItem || !moduleId) return;
    runAction(`module-${selectedWorkItem.item.id}`, async () => {
      await gqlAddWorkItemToModule(selectedWorkItem.item.id, moduleId);
    }, 'Module updated');
  }, [runAction, selectedWorkItem]);

  const handleAssignState = useCallback((stateId: string) => {
    if (!selectedWorkItem || !stateId) return;
    const state = activeProject?.states.find((candidate) => candidate.id === stateId);
    runAction(`state-${selectedWorkItem.item.id}`, async () => {
      await gqlSetWorkItemState(selectedWorkItem.item.id, stateId);
    }, state ? `Moved to ${state.name}` : 'State updated');
  }, [activeProject, runAction, selectedWorkItem]);

  const handleAddComment = useCallback(() => {
    if (!selectedWorkItem || !commentBody.trim()) return;
    runAction(`comment-${selectedWorkItem.item.id}`, async () => {
      await gqlCreateWorkItemComment({
        itemId: selectedWorkItem.item.id,
        body: commentBody.trim(),
        authorId: 'member:local',
      });
      setCommentBody('');
    }, 'Comment added');
  }, [commentBody, runAction, selectedWorkItem]);

  const handleLogWork = useCallback(() => {
    if (!selectedWorkItem) return;
    const minutes = Number.parseInt(worklogMinutes, 10);
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    runAction(`worklog-${selectedWorkItem.item.id}`, async () => {
      await gqlLogWork({
        taskId: selectedWorkItem.item.id,
        durationMs: minutes * 60_000,
        loggedBy: 'member:local',
      });
      setWorklogMinutes('30');
    }, 'Work logged');
  }, [runAction, selectedWorkItem, worklogMinutes]);

  if (loading) {
    return (
      <div className="cp-pm-view cp-scrollbar">
        <div className="cp-pm-header">
          <div className="cp-loading-skeleton" style={{ width: 220, height: 28 }} />
        </div>
        <div className="cp-pm-skeleton-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="cp-loading-skeleton cp-pm-skeleton-row" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cp-pm-view">
        <div className="cp-error-banner" style={{ margin: 16 }}>
          <p>
            {error.isNetworkError
              ? 'Could not reach CommonPlace API.'
              : `Error: ${error.message}`}
          </p>
          <button type="button" onClick={refetch}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="cp-pm-view cp-scrollbar">
      <div className="cp-pm-header">
        <div>
          <div className="cp-pm-kicker">Projects</div>
          <h2 className="cp-pm-title">Work graph</h2>
        </div>
        <div className="cp-pm-actions">
          <SegmentedMode mode={mode} onChange={setMode} />
          <button
            type="button"
            className="cp-btn-ghost"
            onClick={() => setShowProjectForm((value) => !value)}
          >
            New project
          </button>
          <button
            type="button"
            className="cp-btn-accent"
            onClick={() => setShowWorkItemForm((value) => !value)}
            disabled={!activeProject}
          >
            <span className="cp-btn-accent-dot" />
            New work item
          </button>
        </div>
      </div>

      {showProjectForm && (
        <div className="cp-pm-inline-form">
          <input
            className="cp-input"
            value={projectName}
            onChange={(event) => {
              const next = event.target.value;
              setProjectName(next);
              if (!projectIdentifier) setProjectIdentifier(identifierFromName(next));
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleCreateProject();
              if (event.key === 'Escape') setShowProjectForm(false);
            }}
            placeholder="Project name"
          />
          <input
            className="cp-input cp-pm-short-input"
            value={projectIdentifier}
            onChange={(event) => setProjectIdentifier(event.target.value.toUpperCase())}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleCreateProject();
              if (event.key === 'Escape') setShowProjectForm(false);
            }}
            placeholder="KEY"
          />
          <button
            type="button"
            className="cp-btn-accent"
            onClick={handleCreateProject}
            disabled={busyAction === 'project' || !projectName.trim()}
          >
            {busyAction === 'project' ? 'Creating...' : 'Create'}
          </button>
        </div>
      )}

      {showWorkItemForm && activeProject && (
        <div className="cp-pm-inline-form cp-pm-work-form">
          <input
            className="cp-input"
            value={workItemTitle}
            onChange={(event) => setWorkItemTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleCreateWorkItem();
              if (event.key === 'Escape') setShowWorkItemForm(false);
            }}
            placeholder={`Work item in ${activeProject.collection.name}`}
          />
          <input
            className="cp-input"
            value={workItemDescription}
            onChange={(event) => setWorkItemDescription(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleCreateWorkItem();
              if (event.key === 'Escape') setShowWorkItemForm(false);
            }}
            placeholder="Description"
          />
          <select
            className="cp-input cp-pm-short-input"
            value={workItemPriority}
            onChange={(event) => setWorkItemPriority(event.target.value)}
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>{priority}</option>
            ))}
          </select>
          <input
            className="cp-input cp-pm-short-input"
            type="number"
            min={0}
            value={workItemEstimate}
            onChange={(event) => setWorkItemEstimate(event.target.value)}
            placeholder="pts"
          />
          <button
            type="button"
            className="cp-btn-accent"
            onClick={handleCreateWorkItem}
            disabled={busyAction === 'work-item' || !workItemTitle.trim()}
          >
            {busyAction === 'work-item' ? 'Creating...' : 'Create'}
          </button>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="cp-empty-state">
          <p>No projects yet.</p>
          <button type="button" className="cp-btn-accent" onClick={() => setShowProjectForm(true)}>
            <span className="cp-btn-accent-dot" />
            Create a project
          </button>
        </div>
      ) : (
        <>
          <ProjectStrip
            projects={projects}
            activeProject={activeProject}
            onSelect={setSelectedProjectId}
            onOpen={(project) => launchView('project', { slug: project.collection.id })}
          />

          <div className="cp-pm-summary-row">
            <SummaryValue value={projects.length} label="projects" />
            <SummaryValue value={visibleRows.length} label="work items" />
            <SummaryValue value={activeProject?.cycles.length ?? 0} label="cycles" />
            <SummaryValue value={overview.stickies.length} label="stickies" />
          </div>

          {mode === 'board' && activeProject && (
            <BoardView
              project={activeProject}
              rows={visibleRows}
              selectedWorkItemId={selectedWorkItem?.item.id}
              onSelect={setSelectedWorkItemId}
              onDragEnd={handleDragEnd}
            />
          )}

          {mode === 'list' && (
            <ListView table={table} />
          )}

          {mode === 'planning' && activeProject && (
            <PlanningView
              project={activeProject}
              stickies={overview.stickies}
              cycleName={cycleName}
              cycleStart={cycleStart}
              cycleEnd={cycleEnd}
              moduleName={moduleName}
              labelName={labelName}
              labelColor={labelColor}
              stickyTitle={stickyTitle}
              stickyDescription={stickyDescription}
              busyAction={busyAction}
              onCycleName={setCycleName}
              onCycleStart={setCycleStart}
              onCycleEnd={setCycleEnd}
              onModuleName={setModuleName}
              onLabelName={setLabelName}
              onLabelColor={setLabelColor}
              onStickyTitle={setStickyTitle}
              onStickyDescription={setStickyDescription}
              onCreateCycle={handleCreateCycle}
              onCreateModule={handleCreateModule}
              onCreateLabel={handleCreateLabel}
              onCreateSticky={handleCreateSticky}
            />
          )}

          {selectedWorkItem && activeProject && (
            <WorkItemInspector
              project={activeProject}
              workItem={selectedWorkItem}
              commentBody={commentBody}
              worklogMinutes={worklogMinutes}
              busyAction={busyAction}
              onCommentBody={setCommentBody}
              onWorklogMinutes={setWorklogMinutes}
              onState={handleAssignState}
              onCycle={handleAssignCycle}
              onModule={handleAssignModule}
              onAddComment={handleAddComment}
              onLogWork={handleLogWork}
            />
          )}
        </>
      )}
    </div>
  );
}

function SegmentedMode({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  const modes: ViewMode[] = ['board', 'list', 'planning'];
  return (
    <div className="cp-pm-mode-switch" role="tablist" aria-label="Project view">
      {modes.map((candidate) => (
        <button
          key={candidate}
          type="button"
          role="tab"
          aria-selected={candidate === mode}
          data-selected={candidate === mode}
          onClick={() => onChange(candidate)}
        >
          {candidate}
        </button>
      ))}
    </div>
  );
}

function ProjectStrip({
  projects,
  activeProject,
  onSelect,
  onOpen,
}: {
  projects: PmProjectGql[];
  activeProject: PmProjectGql | null;
  onSelect: (id: string) => void;
  onOpen: (project: PmProjectGql) => void;
}) {
  return (
    <div className="cp-pm-project-strip">
      {projects.map((project) => {
        const selected = project.collection.id === activeProject?.collection.id;
        return (
          <button
            key={project.collection.id}
            type="button"
            className="cp-pm-project-chip"
            data-selected={selected}
            onClick={() => onSelect(project.collection.id)}
            onDoubleClick={() => onOpen(project)}
          >
            <span className="cp-pm-project-key">
              {project.collection.identifier ?? 'CP'}
            </span>
            <span className="cp-pm-project-name">{project.collection.name}</span>
            <span className="cp-pm-project-count">{project.openItemCount}</span>
          </button>
        );
      })}
    </div>
  );
}

function SummaryValue({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <span className="cp-pm-summary-value">{value}</span>
      <span className="cp-pm-summary-label">{label}</span>
    </div>
  );
}

function BoardView({
  project,
  rows,
  selectedWorkItemId,
  onSelect,
  onDragEnd,
}: {
  project: PmProjectGql;
  rows: WorkRow[];
  selectedWorkItemId?: string;
  onSelect: (id: string) => void;
  onDragEnd: (result: DropResult) => void;
}) {
  const states = project.states.length > 0
    ? project.states
    : [{ id: 'unassigned', name: 'Unassigned', group: 'unstarted', sortOrder: 0 }];

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="cp-pm-board" style={{ gridTemplateColumns: `repeat(${states.length}, minmax(230px, 1fr))` }}>
        {states.map((state) => {
          const stateRows = rows.filter((row) => row.state?.id === state.id);
          return (
            <Droppable key={state.id} droppableId={state.id}>
              {(provided, snapshot) => (
                <section
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="cp-pm-board-column"
                  data-over={snapshot.isDraggingOver}
                >
                  <header className="cp-pm-board-column-header">
                    <span>{state.name}</span>
                    <span>{stateRows.length}</span>
                  </header>
                  <div className="cp-pm-board-stack">
                    {stateRows.map((row, index) => (
                      <Draggable key={row.item.id} draggableId={row.item.id} index={index}>
                        {(dragProvided, dragSnapshot) => (
                          <button
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            type="button"
                            className="cp-pm-board-card"
                            data-selected={row.item.id === selectedWorkItemId}
                            data-dragging={dragSnapshot.isDragging}
                            style={dragProvided.draggableProps.style as CSSProperties | undefined}
                            onClick={() => onSelect(row.item.id)}
                          >
                            <span className="cp-pm-sequence">{row.sequenceId ?? 'TASK'}</span>
                            <span className="cp-pm-board-card-title">{row.item.title}</span>
                            <span className="cp-pm-board-card-meta">
                              {row.item.priority ?? 'none'} / {row.estimatePoint ?? 0} pt / {row.commentCount} comments
                            </span>
                          </button>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </section>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}

function ListView({
  table,
}: {
  table: Table<WorkRow>;
}) {
  return (
    <div className="cp-pm-table-wrap">
      {table.getRowModel().rows.length === 0 ? (
        <div className="cp-empty-state">
          <p>No work items yet.</p>
        </div>
      ) : (
        <table className="cp-pm-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id}>
                    <button
                      type="button"
                      className="cp-pm-th-button"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <span className="cp-pm-sort-mark">
                        {header.column.getIsSorted() === 'asc'
                          ? 'asc'
                          : header.column.getIsSorted() === 'desc'
                            ? 'desc'
                            : ''}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PlanningView({
  project,
  stickies,
  cycleName,
  cycleStart,
  cycleEnd,
  moduleName,
  labelName,
  labelColor,
  stickyTitle,
  stickyDescription,
  busyAction,
  onCycleName,
  onCycleStart,
  onCycleEnd,
  onModuleName,
  onLabelName,
  onLabelColor,
  onStickyTitle,
  onStickyDescription,
  onCreateCycle,
  onCreateModule,
  onCreateLabel,
  onCreateSticky,
}: {
  project: PmProjectGql;
  stickies: PmOverviewGql['stickies'];
  cycleName: string;
  cycleStart: string;
  cycleEnd: string;
  moduleName: string;
  labelName: string;
  labelColor: string;
  stickyTitle: string;
  stickyDescription: string;
  busyAction: string | null;
  onCycleName: (value: string) => void;
  onCycleStart: (value: string) => void;
  onCycleEnd: (value: string) => void;
  onModuleName: (value: string) => void;
  onLabelName: (value: string) => void;
  onLabelColor: (value: string) => void;
  onStickyTitle: (value: string) => void;
  onStickyDescription: (value: string) => void;
  onCreateCycle: () => void;
  onCreateModule: () => void;
  onCreateLabel: () => void;
  onCreateSticky: () => void;
}) {
  const projectStickies = stickies.filter((sticky) => sticky.extra.owner_id === project.collection.id);
  return (
    <div className="cp-pm-planning-grid">
      <PlanningPanel title="Cycles">
        <div className="cp-pm-form-row">
          <input className="cp-input" value={cycleName} onChange={(event) => onCycleName(event.target.value)} placeholder="Cycle name" />
          <input className="cp-input" type="date" value={cycleStart} onChange={(event) => onCycleStart(event.target.value)} />
          <input className="cp-input" type="date" value={cycleEnd} onChange={(event) => onCycleEnd(event.target.value)} />
          <button type="button" className="cp-btn-accent" onClick={onCreateCycle} disabled={busyAction === 'cycle' || !cycleName.trim()}>
            {busyAction === 'cycle' ? 'Creating...' : 'Create'}
          </button>
        </div>
        <CompactList items={project.cycles.map((cycle) => cycle.name)} empty="No cycles" />
      </PlanningPanel>
      <PlanningPanel title="Modules">
        <div className="cp-pm-form-row">
          <input className="cp-input" value={moduleName} onChange={(event) => onModuleName(event.target.value)} placeholder="Module name" />
          <button type="button" className="cp-btn-accent" onClick={onCreateModule} disabled={busyAction === 'module' || !moduleName.trim()}>
            {busyAction === 'module' ? 'Creating...' : 'Create'}
          </button>
        </div>
        <CompactList items={project.modules.map((module) => module.name)} empty="No modules" />
      </PlanningPanel>
      <PlanningPanel title="Labels">
        <div className="cp-pm-form-row">
          <input className="cp-input" value={labelName} onChange={(event) => onLabelName(event.target.value)} placeholder="Label name" />
          <select className="cp-input cp-pm-short-input" value={labelColor} onChange={(event) => onLabelColor(event.target.value)}>
            {LABEL_COLORS.map((color) => (
              <option key={color} value={color}>{color}</option>
            ))}
          </select>
          <button type="button" className="cp-btn-accent" onClick={onCreateLabel} disabled={busyAction === 'label' || !labelName.trim()}>
            {busyAction === 'label' ? 'Adding...' : 'Add'}
          </button>
        </div>
        <div className="cp-pm-label-row">
          {project.labels.map((label) => (
            <span key={label.id} className="cp-pm-label-pill" style={{ '--label-color': label.color ?? '#2D5F6B' } as CSSProperties}>
              {label.name}
            </span>
          ))}
        </div>
      </PlanningPanel>
      <PlanningPanel title="Stickies">
        <div className="cp-pm-form-row">
          <input className="cp-input" value={stickyTitle} onChange={(event) => onStickyTitle(event.target.value)} placeholder="Sticky title" />
          <input className="cp-input" value={stickyDescription} onChange={(event) => onStickyDescription(event.target.value)} placeholder="Body" />
          <button type="button" className="cp-btn-accent" onClick={onCreateSticky} disabled={busyAction === 'sticky' || !stickyTitle.trim()}>
            {busyAction === 'sticky' ? 'Creating...' : 'Create'}
          </button>
        </div>
        <CompactList items={projectStickies.map((sticky) => sticky.title)} empty="No stickies" />
      </PlanningPanel>
    </div>
  );
}

function PlanningPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="cp-pm-planning-panel">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function CompactList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) {
    return <p className="cp-pm-muted">{empty}</p>;
  }
  return (
    <div className="cp-pm-compact-list">
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

function WorkItemInspector({
  project,
  workItem,
  commentBody,
  worklogMinutes,
  busyAction,
  onCommentBody,
  onWorklogMinutes,
  onState,
  onCycle,
  onModule,
  onAddComment,
  onLogWork,
}: {
  project: PmProjectGql;
  workItem: WorkRow;
  commentBody: string;
  worklogMinutes: string;
  busyAction: string | null;
  onCommentBody: (value: string) => void;
  onWorklogMinutes: (value: string) => void;
  onState: (stateId: string) => void;
  onCycle: (cycleId: string) => void;
  onModule: (moduleId: string) => void;
  onAddComment: () => void;
  onLogWork: () => void;
}) {
  return (
    <aside className="cp-pm-inspector">
      <div className="cp-pm-inspector-heading">
        <span className="cp-pm-sequence">{workItem.sequenceId ?? 'TASK'}</span>
        <h3>{workItem.item.title}</h3>
      </div>
      <div className="cp-pm-inspector-grid">
        <label>
          <span>State</span>
          <select className="cp-input" value={workItem.state?.id ?? ''} onChange={(event) => onState(event.target.value)}>
            <option value="">Unassigned</option>
            {project.states.map((state) => (
              <option key={state.id} value={state.id}>{state.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Cycle</span>
          <select className="cp-input" value={workItem.cycleIds[0] ?? ''} onChange={(event) => onCycle(event.target.value)}>
            <option value="">None</option>
            {project.cycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>{cycle.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Module</span>
          <select className="cp-input" value={workItem.moduleIds[0] ?? ''} onChange={(event) => onModule(event.target.value)}>
            <option value="">None</option>
            {project.modules.map((module) => (
              <option key={module.id} value={module.id}>{module.name}</option>
            ))}
          </select>
        </label>
        <div>
          <span>Logged</span>
          <strong>{formatDuration(workItem.totalWorklogDurationMs)}</strong>
        </div>
      </div>
      <div className="cp-pm-inspector-actions">
        <input
          className="cp-input"
          value={commentBody}
          onChange={(event) => onCommentBody(event.target.value)}
          placeholder="Comment"
        />
        <button
          type="button"
          className="cp-btn-ghost"
          onClick={onAddComment}
          disabled={busyAction === `comment-${workItem.item.id}` || !commentBody.trim()}
        >
          Add comment
        </button>
      </div>
      <div className="cp-pm-inspector-actions">
        <input
          className="cp-input cp-pm-short-input"
          type="number"
          min={1}
          value={worklogMinutes}
          onChange={(event) => onWorklogMinutes(event.target.value)}
        />
        <button
          type="button"
          className="cp-btn-ghost"
          onClick={onLogWork}
          disabled={busyAction === `worklog-${workItem.item.id}`}
        >
          Log minutes
        </button>
      </div>
    </aside>
  );
}
