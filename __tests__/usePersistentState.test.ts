import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistentState } from '../hooks/usePersistentState';

describe('usePersistentState', () => {
  it('returns initial value from initializer on first render', () => {
    const { result } = renderHook(() =>
      usePersistentState('test-key', () => 42)
    );
    // Before effects run, value is from initializer
    expect(result.current.value).toBe(42);
  });

  it('sets ready to true after mount', async () => {
    const { result } = renderHook(() =>
      usePersistentState('test-key-ready', () => 'hello')
    );
    await act(async () => {});
    expect(result.current.ready).toBe(true);
  });

  it('reads stored value from localStorage on mount', async () => {
    localStorage.setItem('test-stored', JSON.stringify('stored-value'));
    const { result } = renderHook(() =>
      usePersistentState('test-stored', () => 'default')
    );
    await act(async () => {});
    expect(result.current.value).toBe('stored-value');
  });

  it('persists value to localStorage when setValue is called', async () => {
    const { result } = renderHook(() =>
      usePersistentState('test-persist', () => 'initial')
    );
    await act(async () => {});
    act(() => {
      result.current.setValue('updated');
    });
    await act(async () => {});
    expect(localStorage.getItem('test-persist')).toBe(JSON.stringify('updated'));
  });

  it('handles corrupted JSON in localStorage gracefully, falls back to initializer', async () => {
    localStorage.setItem('test-corrupt', 'not-valid-json{{{');
    const { result } = renderHook(() =>
      usePersistentState('test-corrupt', () => 'fallback')
    );
    await act(async () => {});
    expect(result.current.ready).toBe(true);
    expect(result.current.value).toBe('fallback');
  });

  it('reset reinitializes to default and persists', async () => {
    localStorage.setItem('test-reset', JSON.stringify('stored'));
    const { result } = renderHook(() =>
      usePersistentState('test-reset', () => 'default')
    );
    await act(async () => {});
    expect(result.current.value).toBe('stored');
    act(() => {
      result.current.reset();
    });
    expect(result.current.value).toBe('default');
    expect(localStorage.getItem('test-reset')).toBe(JSON.stringify('default'));
  });

  it('does not write to localStorage before ready', async () => {
    localStorage.setItem('test-no-overwrite', JSON.stringify('original'));
    renderHook(() =>
      usePersistentState('test-no-overwrite', () => 'should-not-overwrite')
    );
    // Before effects run, localStorage should still have original value
    // The initial state should NOT be written to localStorage immediately
    // (This is validated by the fact that after effects, the stored value wins)
    await act(async () => {});
    // After effects, it should have read the stored value and then written it back
    expect(localStorage.getItem('test-no-overwrite')).toBe(JSON.stringify('original'));
  });
});
