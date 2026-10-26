import { describe, expect, it } from 'vitest';
import { cleanLocation, locationOptions, locations } from '@/data/projects';

describe('cleanLocation', () => {
  it('trims, collapses spaces and capitalises each word', () => {
    expect(cleanLocation('  navi   mumbai ')).toBe('Navi Mumbai');
    expect(cleanLocation('mumbai')).toBe('Mumbai');
  });

  it('keeps capitals the user typed', () => {
    expect(cleanLocation('HYD T2')).toBe('HYD T2');
    expect(cleanLocation('new delhi-aerocity')).toBe('New Delhi-Aerocity');
  });
});

describe('locationOptions', () => {
  it('lists the standard places when no project uses another', () => {
    expect(locationOptions([{ location: 'Goa' }])).toEqual(locations);
  });

  it('adds other locations after the standard ones, A–Z and once each', () => {
    const projects = [{ location: 'Pune' }, { location: 'mumbai' }, { location: 'Mumbai' }, { location: 'goa' }, {}];
    expect(locationOptions(projects)).toEqual([...locations, 'mumbai', 'Pune']);
  });
});
