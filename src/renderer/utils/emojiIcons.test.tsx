import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { renderTextWithIcons } from './emojiIcons';

// renderTextWithIcons returns React.ReactNode, not a component - wrap it to render.
function Wrapper({ text }: { text: string | null | undefined }) {
  return <div data-testid="wrapper">{renderTextWithIcons(text)}</div>;
}

describe('renderTextWithIcons', () => {
  it('passes through null, undefined and empty string unchanged', () => {
    expect(renderTextWithIcons(null)).toBeNull();
    expect(renderTextWithIcons(undefined)).toBeUndefined();
    expect(renderTextWithIcons('')).toBe('');
  });

  it('renders plain text with no emoji unchanged', () => {
    const { getByTestId } = render(<Wrapper text="No emoji here" />);
    expect(getByTestId('wrapper')).toHaveTextContent('No emoji here');
    expect(getByTestId('wrapper').querySelector('svg')).toBeNull();
  });

  it('renders a mapped emoji as its MUI icon instead of the literal character', () => {
    const { getByTestId } = render(<Wrapper text="Pamiętaj o wodzie! 💧" />);
    const wrapper = getByTestId('wrapper');
    expect(wrapper).toHaveTextContent('Pamiętaj o wodzie!');
    expect(wrapper.textContent).not.toContain('💧');
    expect(
      wrapper.querySelector('svg[data-testid="WaterDropIcon"]'),
    ).toBeInTheDocument();
  });

  it('leaves an unmapped emoji/symbol as literal text', () => {
    const { getByTestId } = render(<Wrapper text="Unmapped symbol: 🦄" />);
    const wrapper = getByTestId('wrapper');
    expect(wrapper).toHaveTextContent('Unmapped symbol: 🦄');
    expect(wrapper.querySelector('svg')).toBeNull();
  });

  it('resolves the same icon whether or not the variation selector (U+FE0F) is present', () => {
    // Scope to each render's own `container` (rather than the baseElement-scoped bound
    // queries) since two renders coexist in document.body within this one test.
    const { container: withSelector, unmount } = render(<Wrapper text="⚠️" />);
    expect(
      withSelector.querySelector('svg[data-testid="WarningAmberIcon"]'),
    ).toBeInTheDocument();
    unmount();

    const { container: withoutSelector } = render(<Wrapper text="⚠" />);
    expect(
      withoutSelector.querySelector('svg[data-testid="WarningAmberIcon"]'),
    ).toBeInTheDocument();
  });

  it('renders multiple emoji interspersed with text correctly', () => {
    const { getByTestId } = render(
      <Wrapper text="Pamiętaj o wodzie! 💧 Super robota 🎉" />,
    );
    const wrapper = getByTestId('wrapper');

    expect(wrapper).toHaveTextContent('Pamiętaj o wodzie!');
    expect(wrapper).toHaveTextContent('Super robota');
    expect(
      wrapper.querySelector('svg[data-testid="WaterDropIcon"]'),
    ).toBeInTheDocument();
    expect(
      wrapper.querySelector('svg[data-testid="CelebrationIcon"]'),
    ).toBeInTheDocument();
  });
});
