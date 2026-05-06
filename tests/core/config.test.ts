import { describe, expect, it } from 'vitest';
import { readConfig } from '../../src/core/config.js';

describe('readConfig', () => {
  it('uses defaults when env is empty', () => {
    expect(readConfig({})).toEqual({ autoPrune: true, defaultLifespan: '30d', trashTtl: '7d' });
  });
  it('parses booleans for AGENT_CARNET_AUTO_PRUNE', () => {
    expect(readConfig({ AGENT_CARNET_AUTO_PRUNE: 'false' }).autoPrune).toBe(false);
    expect(readConfig({ AGENT_CARNET_AUTO_PRUNE: '0' }).autoPrune).toBe(false);
    expect(readConfig({ AGENT_CARNET_AUTO_PRUNE: 'no' }).autoPrune).toBe(false);
    expect(readConfig({ AGENT_CARNET_AUTO_PRUNE: 'true' }).autoPrune).toBe(true);
  });
  it('honors lifespan and trash ttl overrides', () => {
    expect(readConfig({ AGENT_CARNET_DEFAULT_LIFESPAN: '90d' }).defaultLifespan).toBe('90d');
    expect(readConfig({ AGENT_CARNET_TRASH_TTL: '14d' }).trashTtl).toBe('14d');
  });
});
