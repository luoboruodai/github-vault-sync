import { describe, expect, it } from 'vitest';
import { parseGitTransferProgress } from '../src/git';

describe('Git transfer progress parsing', () => {
  it('reads LFS object progress without estimating bytes', () => {
    expect(parseGitTransferProgress('Uploading LFS objects:  39% (39/100), 12 MB | 2 MB/s\r'))
      .toEqual({ kind: 'lfs', completed: 39, total: 100, percent: 39 });
  });
  it('reads the latest Git pack progress', () => {
    expect(parseGitTransferProgress('Writing objects:  1% (1/200)\rWriting objects:  80% (160/200)\r'))
      .toEqual({ kind: 'git', completed: 160, total: 200, percent: 80 });
  });
  it('does not report a fabricated percentage when there is no Git progress', () => {
    expect(parseGitTransferProgress('Receiving remote data...')).toBeNull();
  });
});
