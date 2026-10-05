import { describe, expect, it } from 'vitest';
import { containedHands, findHands, type HandId } from '../src/engine';

const hands = (faces: number[], rules = {}) => Object.keys(findHands(faces, rules)).sort() as HandId[];

describe('findHands', () => {
  it('finds sets', () => {
    expect(hands([2, 2, 3, 4, 6])).toEqual(['high', 'pair']);
    expect(hands([2, 2, 3, 3, 6])).toEqual(['high', 'pair', 'twopair']);
    expect(hands([5, 5, 5, 1, 2])).toEqual(['high', 'pair', 'three']);
    expect(hands([5, 5, 5, 2, 2]).sort()).toEqual(['fullhouse', 'high', 'pair', 'three', 'twopair']);
    expect(hands([4, 4, 4, 4, 1])).toContain('four');
    expect(hands([4, 4, 4, 4, 1])).not.toContain('twopair');
    expect(hands([6, 6, 6, 6, 6])).toContain('five');
  });

  it('finds straights', () => {
    expect(hands([1, 2, 3, 4, 6])).toContain('smallstr');
    expect(hands([1, 2, 3, 4, 6])).not.toContain('largestr');
    expect(hands([2, 3, 4, 5, 6])).toEqual(expect.arrayContaining(['smallstr', 'largestr']));
    expect(hands([1, 2, 3, 5, 6])).not.toContain('smallstr');
  });

  it('finds six-dice hands', () => {
    expect(hands([1, 1, 2, 2, 3, 3])).toContain('threepair');
    expect(hands([1, 1, 1, 2, 2, 2])).toContain('twotrips');
    expect(hands([1, 2, 3, 4, 5, 6])).toContain('grand');
    expect(hands([3, 3, 3, 3, 3, 3])).toContain('six');
  });

  it('uses the highest dice when there is a choice', () => {
    const f = [1, 1, 6, 6, 3];
    expect(findHands(f).pair!.map((i) => f[i])).toEqual([6, 6]);
    const s = [1, 2, 3, 4, 5, 6];
    expect(findHands(s).largestr!.map((i) => s[i])).toEqual([2, 3, 4, 5, 6]);
  });

  it('bends straights with Shortcut and Four Fingers', () => {
    expect(hands([1, 3, 4, 6, 6], { shortcut: true })).toContain('smallstr');
    expect(hands([1, 3, 4, 6, 6])).not.toContain('smallstr');
    expect(hands([2, 3, 4, 6, 6], { fourFingers: true })).toContain('smallstr');
    expect(hands([2, 3, 4, 5, 1], { fourFingers: true })).toContain('largestr');
  });

  it('knows what a hand contains', () => {
    const c = containedHands([5, 5, 5, 2, 2]);
    expect(c.has('pair')).toBe(true);
    expect(c.has('three')).toBe(true);
    expect(c.has('twopair')).toBe(true);
  });
});
