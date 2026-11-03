import { openDatabaseAsync } from 'expo-sqlite';
import { Repository } from './repository';
import { reconcileLibrary } from './library';
let pending: Promise<Repository> | undefined;
/** Strict Mode and remounts share one initialization transaction. A failure remains retryable. */
export function loadRepository(): Promise<Repository> {
  if (!pending)
    pending = (async () => {
      const repository = new Repository(await openDatabaseAsync('ysh-reader.db'));
      await repository.init();
      await reconcileLibrary(repository);
      return repository;
    })().catch((error) => {
      pending = undefined;
      throw error;
    });
  return pending;
}
