import { describe, expect, it } from 'vitest';
import { shouldOpenEditorAfterStop } from '../lib/should-open-editor-after-stop';

describe('shouldOpenEditorAfterStop', () => {
  it('skips the editor when interview mode is on', () => {
    expect(shouldOpenEditorAfterStop(true)).toBe(false);
  });

  it('keeps opening the editor when interview mode is off or unset', () => {
    expect(shouldOpenEditorAfterStop(false)).toBe(true);
    expect(shouldOpenEditorAfterStop(undefined)).toBe(true);
  });
});
