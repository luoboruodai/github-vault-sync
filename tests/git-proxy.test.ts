import { describe, expect, it } from 'vitest';
import { isGitNetworkError, withGitHttpProxy } from '../src/git';

describe('Git transport diagnostics', () => {
  it('scopes a configured proxy to every Git invocation without changing remote URLs', () => {
    expect(withGitHttpProxy(['fetch', '--prune', 'origin', 'main'], 'http://127.0.0.1:7897'))
      .toEqual(['-c', 'http.proxy=http://127.0.0.1:7897', 'fetch', '--prune', 'origin', 'main']);
    expect(withGitHttpProxy(['status'], '')).toEqual(['status']);
  });

  it('classifies transport failures separately from authentication errors', () => {
    expect(isGitNetworkError("fatal: unable to access 'https://github.com/x/y.git/': Recv failure: Connection was reset")).toBe(true);
    expect(isGitNetworkError('remote: Invalid username or password.')).toBe(false);
  });
});
