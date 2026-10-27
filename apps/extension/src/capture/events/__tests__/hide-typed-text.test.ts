// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const updateInputStep = vi.fn().mockResolvedValue({ updated: true });
const sink = {
  captureStep: vi.fn().mockResolvedValue({ stepId: 'step-1' }),
  updateInputStep,
  finalizeInputStep: vi.fn().mockResolvedValue({ updated: true }),
} as unknown as CaptureSink;

import { extractDOMContext } from '@/core/capture/dom/context';
import { hideTypedText } from '@/core/capture/dom/element-utils';
import type { CaptureSink } from '@/core/capture/sink';
import { InputSession } from '../input-session';

function field(value: string, label = 'Location'): HTMLInputElement {
  const input = document.createElement('input');
  input.setAttribute('aria-label', label);
  input.value = value;
  document.body.appendChild(input);
  return input;
}

function lastUpdate(): { description: string; inputValue?: string } {
  return updateInputStep.mock.calls.at(-1)?.[0] as { description: string; inputValue?: string };
}

function typeInto(input: HTMLInputElement) {
  const s = new InputSession('guide-1', sink);
  s.stepId = 'step-1';
  s.update(input);
}

beforeEach(() => {
  updateInputStep.mockClear();
  document.body.innerHTML = '';
});

afterEach(() => hideTypedText(false));

describe('keep typed text out of steps', () => {
  it('names the field but not the value, and stores no value', () => {
    hideTypedText(true);
    typeInto(field('Dubai'));
    expect(lastUpdate()).toEqual({ stepId: 'step-1', description: 'steps.typeInto[Location]' });
  });

  it('keeps the value out of the page context sent for AI descriptions', () => {
    hideTypedText(true);
    const context = extractDOMContext(field('Acme Bank', 'Organization name'), 'input');
    expect(JSON.stringify(context)).not.toContain('Acme Bank');
  });

  it('leaves steps unchanged when the setting is off', () => {
    typeInto(field('Dubai'));
    expect(lastUpdate().description).toBe('steps.typeValueInto[Dubai,Location]');
    expect(lastUpdate().inputValue).toBe('Dubai');
  });
});
