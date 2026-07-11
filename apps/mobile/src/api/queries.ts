import { gql } from './client';
import type {
  AskResult,
  Briefing,
  CollectionGql,
  ItemGql,
  OrganizeSnapshot,
  SearchHit,
  TheoremAgentRun,
} from './types';

const ITEM_FIELDS = `
  id kind title bodyText blobHash mime source residency tags collections
  classification status priority dueAtMs path createdAtMs updatedAtMs
`;

/* remindAtMs is requested separately so nodes without PT-008 still answer. */
const ITEM_FIELDS_WITH_REMIND = `${ITEM_FIELDS} remindAtMs`;

async function itemQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  try {
    return await gql<T>(query.replace('__ITEM__', ITEM_FIELDS_WITH_REMIND), variables);
  } catch (e) {
    if (e instanceof Error && /remindAtMs/.test(e.message)) {
      return gql<T>(query.replace('__ITEM__', ITEM_FIELDS), variables);
    }
    throw e;
  }
}

export const fetchItems = (kind?: string) =>
  itemQuery<{ items: ItemGql[] }>(`query($kind:String){ items(kind:$kind){ __ITEM__ } }`, { kind }).then(
    (d) => d.items,
  );

export const fetchItem = (id: string) =>
  itemQuery<{ item: ItemGql | null }>(`query($id:String!){ item(id:$id){ __ITEM__ } }`, { id }).then(
    (d) => d.item,
  );

export const fetchCollections = () =>
  gql<{ collections: CollectionGql[] }>(`{ collections { id name kind color createdAtMs } }`).then(
    (d) => d.collections,
  );

export const searchItems = (query: string, k = 20) =>
  itemQuery<{ search: SearchHit[] }>(
    `query($q:String!,$k:Int){ search(query:$q,k:$k){ item{ __ITEM__ } score } }`,
    { q: query, k },
  ).then((d) => d.search);

export const runAsk = (question: string, k = 6) =>
  itemQuery<{ ask: AskResult }>(
    `query($q:String!,$k:Int){ ask(question:$q,k:$k){ answer answerKind provenance{ item{ __ITEM__ } score arms } } }`,
    { q: question, k },
  ).then((d) => d.ask);

export const runTheoremAgent = (task: string, mode: string = 'ask') =>
  gql<{ theoremAgent: TheoremAgentRun }>(
    `query($task:String!,$mode:String){ theoremAgent(task:$task,mode:$mode){ answer answerKind bindingId runId heads evidenceCount } }`,
    { task, mode },
  ).then((d) => d.theoremAgent);

export const fetchBriefing = () =>
  itemQuery<{ briefing: Briefing }>(
    `{ briefing { recent{ __ITEM__ } newlyConnected{ item{ __ITEM__ } connections } openThreads{ __ITEM__ } } }`,
  ).then((d) => d.briefing);

const ORGANIZE_ITEM = `
  id kind title preview source arrivedAt timeSensitive expectedAction tags
  classification { targetCollectionId targetCollectionLabel confidence }
`;

export const fetchOrganize = (timeframe: string = 'day') =>
  gql<{ organize: OrganizeSnapshot }>(
    `query($tf:String){ organize(timeframe:$tf){
      needsYou { ${ORGANIZE_ITEM} }
      organizedToday { mostRecent { item { ${ORGANIZE_ITEM} } filedAt } groups { collectionId label count } totalCount }
      dailyProgress { timeframe done total }
      needsYouCeiling
    } }`,
    { tf: timeframe },
  ).then((d) => d.organize);

export type IngestArgs = {
  title: string;
  text: string;
  kind?: string;
  tags?: string[];
  source?: string;
  /** Explicit values win over the server-side NL parse (PT-008). */
  remindAtMs?: number;
  dueAtMs?: number;
};

export async function ingestItem(args: IngestArgs): Promise<ItemGql> {
  // remind/due args exist only after PT-008; retry without them on older nodes.
  const attempt = (withReminder: boolean) => {
    const { remindAtMs, dueAtMs, ...base } = args;
    const input = withReminder ? args : base;
    return itemQuery<{ ingest: ItemGql }>(
      `mutation($input:IngestInputGql!){ ingest(input:$input){ __ITEM__ } }`,
      { input },
    ).then((d) => d.ingest);
  };
  try {
    return await attempt(true);
  } catch (e) {
    if (e instanceof Error && /(remindAtMs|dueAtMs)/.test(e.message)) return attempt(false);
    throw e;
  }
}

export const putNote = (title: string, text: string, tags?: string[]) =>
  itemQuery<{ putNote: ItemGql }>(
    `mutation($title:String!,$text:String!,$tags:[String!]){ putNote(title:$title,text:$text,tags:$tags){ __ITEM__ } }`,
    { title, text, tags },
  ).then((d) => d.putNote);

export type EditItemArgs = {
  id: string;
  title?: string;
  tags?: string[];
  residency?: string;
  status?: string;
  dueAtMs?: number;
  remindAtMs?: number;
};

/** Builds the arg list dynamically so pre-PT-008 nodes accept the base form. */
export async function editItem(args: EditItemArgs): Promise<ItemGql> {
  const defs: string[] = ['$id:String!'];
  const passes: string[] = ['id:$id'];
  const vars: Record<string, unknown> = { id: args.id };
  const add = (name: string, gqlType: string, value: unknown) => {
    if (value === undefined) return;
    defs.push(`$${name}:${gqlType}`);
    passes.push(`${name}:$${name}`);
    vars[name] = value;
  };
  add('title', 'String', args.title);
  add('tags', '[String!]', args.tags);
  add('residency', 'String', args.residency);
  add('status', 'String', args.status);
  add('dueAtMs', 'Int', args.dueAtMs);
  add('remindAtMs', 'Int', args.remindAtMs);
  return itemQuery<{ editItem: ItemGql }>(
    `mutation(${defs.join(',')}){ editItem(${passes.join(',')}){ __ITEM__ } }`,
    vars,
  ).then((d) => d.editItem);
}

export const addToCollection = (itemId: string, collectionId: string) =>
  gql<{ addToCollection: boolean }>(
    `mutation($i:String!,$c:String!){ addToCollection(itemId:$i,collectionId:$c) }`,
    { i: itemId, c: collectionId },
  ).then((d) => d.addToCollection);
