// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { extractElementMeta } from '../element-meta';

describe('element text', () => {
  it('keeps lines the page styles as separate, even though the copy loses the page CSS', () => {
    const style = document.createElement('style');
    style.textContent = '.list .option strong, .list .option span { display: block; }';
    document.head.appendChild(style);
    document.body.innerHTML =
      '<div class="list"><div class="option" role="option"><strong>Banking, Lending, and Credit Services</strong><span>Finance, Insurance and Real Estate</span></div></div>';
    const option = document.querySelector('[role=option]') as HTMLElement;

    expect(extractElementMeta(option).textContent).toBe('Banking, Lending, and Credit Services');
  });
});
