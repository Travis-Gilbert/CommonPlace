'use client';

import type { ComponentType } from 'react';
import NoteCard from './NoteCard';
import SourceCard from './SourceCard';
import PersonPill from './PersonPill';
import ConceptNode from './ConceptNode';
import HunchSticky from './HunchSticky';
import QuoteBlock from './QuoteBlock';
import TaskRow from './TaskRow';
import EventBadge from './EventBadge';
import ScriptBlock from './ScriptBlock';
import PlacePin from './PlacePin';
import EmailCard from './EmailCard';
import PaperCard from './PaperCard';
import { ClaimObjectCard, FileObjectCard, LinkObjectCard } from './GrammarObjectCards';
import type { ObjectCardProps } from './ObjectRenderer';

export type ObjectRendererComponent = ComponentType<ObjectCardProps>;

export interface ObjectRendererEntry {
  kind: string;
  label: string;
  renderer: ObjectRendererComponent;
}

export const OBJECT_RENDERER_REGISTRY: Record<string, ObjectRendererEntry> = {
  task: { kind: 'task', label: 'Task', renderer: TaskRow },
  file: { kind: 'file', label: 'File', renderer: FileObjectCard },
  link: { kind: 'link', label: 'Link', renderer: LinkObjectCard },
  note: { kind: 'note', label: 'Note', renderer: NoteCard },
  claim: { kind: 'claim', label: 'Claim', renderer: ClaimObjectCard },
  source: { kind: 'source', label: 'Source', renderer: SourceCard },
  person: { kind: 'person', label: 'Person', renderer: PersonPill },
  concept: { kind: 'concept', label: 'Concept', renderer: ConceptNode },
  hunch: { kind: 'hunch', label: 'Hunch', renderer: HunchSticky },
  quote: { kind: 'quote', label: 'Quote', renderer: QuoteBlock },
  event: { kind: 'event', label: 'Event', renderer: EventBadge },
  script: { kind: 'script', label: 'Script', renderer: ScriptBlock },
  place: { kind: 'place', label: 'Place', renderer: PlacePin },
  email: { kind: 'email', label: 'Email', renderer: EmailCard },
  paper: { kind: 'paper', label: 'Paper', renderer: PaperCard },
};

export function objectRendererFor(kind: string): ObjectRendererComponent | undefined {
  return OBJECT_RENDERER_REGISTRY[kind]?.renderer;
}
