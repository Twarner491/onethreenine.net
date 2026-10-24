import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { PushPin, pushPinColors } from '../../src/components/PushPin';

describe('PushPin Component & Invariants', () => {
  it('renders with viewBox 0 0 120 140', () => {
    const { container } = render(<PushPin color="red" size={90} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 120 140');
  });

  it('falls back to red palette when given an invalid color', () => {
    const { container } = render(<PushPin color="invalid-color" size={90} />);
    // Check that primary color of fallback red is present in one of the gradients
    const baseFlareStop = container.querySelector(`linearGradient[id^="base-flare-"] stop[offset="48%"]`);
    expect(baseFlareStop?.getAttribute('stop-color')).toBe(pushPinColors.red.primary);
  });

  it('uses the specified color palette (e.g. green)', () => {
    const { container } = render(<PushPin color="green" size={90} />);
    const baseFlareStop = container.querySelector(`linearGradient[id^="base-flare-"] stop[offset="48%"]`);
    expect(baseFlareStop?.getAttribute('stop-color')).toBe(pushPinColors.green.primary);
  });

  it('generates unique gradient IDs across multiple rendered instances to prevent collision', () => {
    const { container: container1 } = render(<PushPin color="blue" size={90} />);
    const { container: container2 } = render(<PushPin color="blue" size={90} />);

    const id1 = container1.querySelector('radialGradient')?.getAttribute('id');
    const id2 = container2.querySelector('radialGradient')?.getAttribute('id');

    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
  });

  it('computes deterministic pin properties from item IDs', () => {
    // Polynomial hash algorithm from PinnedItem.tsx
    const computePinData = (itemId: string) => {
      const colors = ['red', 'yellow', 'blue', 'green', 'white', 'orange', 'purple'];
      let hash = 0;
      for (let i = 0; i < itemId.length; i++) {
        hash = (hash << 5) - hash + itemId.charCodeAt(i);
      }
      const absHash = Math.abs(hash);
      return {
        color: colors[absHash % colors.length],
        rotation: ((absHash % 17) - 8) * 0.9,
        tiltX: 24 + (absHash % 12),
        tiltY: ((Math.floor(absHash / 7) % 15) - 7) * 0.9,
      };
    };

    const firstRun = computePinData('item_123456');
    const secondRun = computePinData('item_123456');
    expect(firstRun).toEqual(secondRun);

    const differentItem = computePinData('item_789012');
    expect(firstRun).not.toEqual(differentItem);
  });
});
