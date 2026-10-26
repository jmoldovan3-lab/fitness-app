import { describe, expect, it } from 'vitest';
import { completedSetCount, epley1RM, setVolume, totalVolume } from '../src/stats';

describe('stats', () => {
  it('volume counts only completed sets', () => {
    const sets = [
      { weight: 100, reps: 5, completed: true },
      { weight: 100, reps: 5, completed: false },
      { weight: 0, reps: 12, completed: true },
      { weight: 50, reps: 10, completed: true },
    ];
    expect(setVolume(sets[0])).toBe(500);
    expect(setVolume(sets[1])).toBe(0);
    expect(totalVolume(sets)).toBe(1000);
    expect(completedSetCount(sets)).toBe(3);
    expect(totalVolume([])).toBe(0);
  });
  it('ignores negative inputs', () => {
    expect(setVolume({ weight: -5, reps: 5, completed: true })).toBe(0);
  });
  it('Epley e1RM', () => {
    expect(epley1RM(100, 1)).toBe(100);
    expect(epley1RM(100, 10)).toBeCloseTo(133.33, 1);
    expect(epley1RM(0, 5)).toBe(0);
  });
});
