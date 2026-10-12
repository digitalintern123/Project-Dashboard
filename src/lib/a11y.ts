import type { KeyboardEvent } from 'react';

/** Keyboard handler giving a non-button element button-like Enter/Space activation. */
export function activateOnKey(fn: () => void) {
  return (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fn();
    }
  };
}
