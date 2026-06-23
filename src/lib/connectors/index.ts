/**
 * Connector registry — add new connectors here.
 * Each connector is only active if its required env vars are set.
 */

import type { Connector } from './pipeline';
import { instapaperConnector } from './instapaper';
import { feedlyConnector } from './feedly';
import { xConnector } from './x';
import { pinterestConnector } from './pinterest';

interface ConnectorConfig {
  connector: Connector;
  requiredEnvVars: string[];
  enabled: boolean;
}

export const CONNECTORS: ConnectorConfig[] = [
  {
    connector: instapaperConnector,
    requiredEnvVars: ['INSTAPAPER_USERNAME', 'INSTAPAPER_PASSWORD'],
    enabled: !!(process.env.INSTAPAPER_USERNAME && process.env.INSTAPAPER_PASSWORD),
  },
  {
    connector: feedlyConnector,
    requiredEnvVars: ['FEEDLY_ACCESS_TOKEN'],
    enabled: !!process.env.FEEDLY_ACCESS_TOKEN,
  },
  {
    connector: xConnector,
    requiredEnvVars: ['X_BEARER_TOKEN', 'X_USER_ID'],
    enabled: !!(process.env.X_BEARER_TOKEN && process.env.X_USER_ID),
  },
  {
    connector: pinterestConnector,
    requiredEnvVars: ['PINTEREST_ACCESS_TOKEN'],
    enabled: !!process.env.PINTEREST_ACCESS_TOKEN,
  },
];

export function getEnabledConnectors() {
  return CONNECTORS.filter(c => c.enabled).map(c => c.connector);
}

export function getConnectorStatus() {
  return CONNECTORS.map(c => ({
    name: c.connector.name,
    description: c.connector.description,
    enabled: c.enabled,
    requiredEnvVars: c.requiredEnvVars,
  }));
}
