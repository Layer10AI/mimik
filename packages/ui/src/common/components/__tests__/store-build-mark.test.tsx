// @vitest-environment happy-dom
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The ValueScout Show-me store build shows Scout, our own mascot, wherever Mimik's would be.
async function rendered(component: 'MascotIcon' | 'CameraMascot', storeBuild: boolean) {
  vi.resetModules();
  if (storeBuild) vi.stubGlobal('__VALUESCOUT_STORE__', true);
  const module = await import(component === 'MascotIcon' ? '../MascotIcon' : '../CameraMascot');
  const Component = module[component] as (props: { size: number }) => React.JSX.Element;
  return render(<Component size={32} />).container.innerHTML;
}

const scoutHead = '#B4461B';

afterEach(() => vi.unstubAllGlobals());

describe('mascots in the ValueScout Show-me store build', () => {
  it('ordinary builds keep Mimik', async () => {
    expect(await rendered('MascotIcon', false)).toContain('mascot-crown-split');
    expect(await rendered('CameraMascot', false)).not.toContain(scoutHead);
  });

  it('the store build shows Scout, blinking, in both forms', async () => {
    for (const component of ['MascotIcon', 'CameraMascot'] as const) {
      const html = await rendered(component, true);
      expect(html).toContain(scoutHead);
      expect(html).toContain('scout-blink');
      expect(html).not.toContain('mascot-crown-split');
    }
  });
});
