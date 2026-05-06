// Library API surface. The CLI layer is the primary consumer, but exposing
// the core lets agents that prefer in-process calls skip the spawn.
export { type RuntimeConfig, readConfig } from './core/config.js';
export { CarnetError, exitCodeFor } from './core/errors.js';
export { type FindHit, type FindOptions, find, type SearchScope } from './core/find.js';
export { type ImportOptions, type ImportReport, importFrom } from './core/import.js';
export { type InitOptions, type InitResult, init } from './core/init.js';
export { type ListEntry, type ListOptions, list, type SortKey } from './core/list.js';
export { categoryOf, normalizeCarnetPath, slugOf, storageRoot, trashRoot } from './core/paths.js';
export { type PruneOptions, prune } from './core/prune.js';
export { type SaveInput, type SaveResult, save } from './core/save.js';
export { type ShowOptions, show } from './core/show.js';
export { loadAllCarnets, readCarnet, writeCarnet } from './core/storage.js';
export type {
  Carnet,
  CarnetFrontmatter,
  CliErrorShape,
  ErrorCode,
  GlobalFlags,
  OutputMode,
  PruneReport,
} from './types/index.js';
