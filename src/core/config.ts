/**
 * Read environment-driven runtime config. Phase 1 has no `config.yml`, so
 * everything here is sourced from process.env (with sensible defaults).
 */

export interface RuntimeConfig {
  autoPrune: boolean;
  defaultLifespan: string;
  trashTtl: string;
}

function envBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const v = value.trim().toLowerCase();
  if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
  if (v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
  return fallback;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  return {
    autoPrune: envBool(env.AGENT_CARNET_AUTO_PRUNE, true),
    defaultLifespan: env.AGENT_CARNET_DEFAULT_LIFESPAN ?? '30d',
    trashTtl: env.AGENT_CARNET_TRASH_TTL ?? '7d',
  };
}
