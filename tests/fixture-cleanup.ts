import { promises as fs } from 'node:fs';

/** Git for Windows and antivirus/indexing processes can briefly hold handles
 * after a child exits. Retry only our owned temporary fixtures, never a Vault. */
export async function cleanFixtureRoots(roots: string[]): Promise<void> {
  for (const root of roots.splice(0)) {
    await fs.rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  }
}
