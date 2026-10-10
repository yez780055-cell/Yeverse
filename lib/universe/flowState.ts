export type IntroMode = 'full' | 'quick' | 'none';
export type UniverseCollectionStage = 'none' | 'approach' | 'collection' | 'return';

export type SceneRebuildAction = 'unchanged' | 'defer' | 'rebuild';

export function sceneRebuildAction(configChanged: boolean, collectionStage: UniverseCollectionStage, atUniverseHome: boolean): SceneRebuildAction {
  if (!configChanged) return 'unchanged';
  return collectionStage === 'none' && atUniverseHome ? 'rebuild' : 'defer';
}

export function startupSceneRebuildAction(
  configChanged: boolean,
  hasFormed: boolean,
  collectionStage: UniverseCollectionStage,
  atUniverseHome: boolean,
): SceneRebuildAction {
  if (!configChanged) return 'unchanged';
  if (!hasFormed) return 'rebuild';
  return sceneRebuildAction(configChanged, collectionStage, atUniverseHome);
}

export function isCurrentSceneRevision(sceneRevision: number, currentRevision: number, disposed: boolean): boolean {
  return !disposed && sceneRevision === currentRevision;
}

export function carryStartupElapsed(previousElapsed: number, sceneElapsed: number): number {
  return Math.max(previousElapsed, sceneElapsed);
}

export type CollectionEntryPath = 'universe-planet' | 'index-timeline';

export function collectionReturnContract(path: CollectionEntryPath, hasCapturedPlanetDismissAnchor: boolean): {
  pose: 'captured-planet-focus' | 'synthetic-planet-focus';
  planetDismissAnchor: boolean;
} {
  return path === 'universe-planet'
    ? {pose: 'captured-planet-focus', planetDismissAnchor: hasCapturedPlanetDismissAnchor}
    : {pose: 'synthetic-planet-focus', planetDismissAnchor: false};
}

export type PlanetFocusBackAction = 'dismiss-planet-focus' | 'leave-galaxy' | 'none';

export function planetFocusBackAction(focusedPlanet: boolean, hasPlanetDismissAnchor: boolean): PlanetFocusBackAction {
  if (!focusedPlanet) return 'none';
  return hasPlanetDismissAnchor ? 'dismiss-planet-focus' : 'leave-galaxy';
}

export function shouldUniverseHandleBack(active: boolean, collectionStage: UniverseCollectionStage): boolean {
  return active && collectionStage === 'none';
}

export type CollectionCloseState = {
  photo: boolean;
  inspect: boolean;
  editing: boolean;
  settings: boolean;
  expanded: boolean;
  archive: boolean;
  selected: boolean;
};

export type CollectionCloseAction = 'photo' | 'inspect' | 'editing' | 'settings' | 'expanded' | 'archive' | 'collection' | 'none';

export type GalaxyActivationAction = 'blocked' | 'focus' | 'enter';

export function galaxyActivationAction(state: {
  focusedGalaxyId: string | undefined;
  clickedGalaxyId: string;
  completed: boolean;
  galaxyFlight: boolean;
  planetFlight: boolean;
  focusFlight: boolean;
}): GalaxyActivationAction {
  if (!state.completed || state.galaxyFlight || state.planetFlight || state.focusFlight) return 'blocked';
  return state.focusedGalaxyId === state.clickedGalaxyId ? 'enter' : 'focus';
}

export type PlanetActivationAction = 'blocked' | 'focus' | 'open';

export function planetActivationAction(
  focusedPlanetId: string | undefined,
  clickedPlanetId: string,
  isTransitioning = false,
): PlanetActivationAction {
  if (isTransitioning) return 'blocked';
  return focusedPlanetId === clickedPlanetId ? 'open' : 'focus';
}

export type FocusBackAction = 'consume-returning-transition' | 'dismiss-planet-focus' | 'dismiss-galaxy-focus' | 'none';

export function focusBackAction(state: {
  returningFocusFlight: boolean;
  focusedPlanet: boolean;
  hasPlanetDismissAnchor: boolean;
  focusedGalaxy: boolean;
  hasGalaxyDismissAnchor: boolean;
}): FocusBackAction {
  if (state.returningFocusFlight) return 'consume-returning-transition';
  if (planetFocusBackAction(state.focusedPlanet, state.hasPlanetDismissAnchor) === 'dismiss-planet-focus') {
    return 'dismiss-planet-focus';
  }
  if (state.focusedGalaxy && state.hasGalaxyDismissAnchor) return 'dismiss-galaxy-focus';
  return 'none';
}

export type BackNavigationAction = 'reset' | 'unhandled';

export function backNavigationAction(mode: string): BackNavigationAction {
  return mode === 'universe' ? 'unhandled' : 'reset';
}

export type ResetNavigationAction = 'return-to-universe' | 'reset-universe';

export function resetNavigationAction(hasActiveGalaxySystem: boolean): ResetNavigationAction {
  return hasActiveGalaxySystem ? 'return-to-universe' : 'reset-universe';
}

export function collectionStageFromUniverse(stage: 'approach' | 'entered' | 'exited'): 'approach' | 'collection' | 'none' {
  if (stage === 'entered') return 'collection';
  if (stage === 'exited') return 'none';
  return 'approach';
}

export function isIntroHandoffReady(state: {
  requested: boolean;
  universeFrameReady: boolean;
  disposed: boolean;
  introMode: IntroMode;
}): boolean {
  return state.requested && state.universeFrameReady && !state.disposed && state.introMode !== 'none';
}

export function collectionCloseAction(state: CollectionCloseState): CollectionCloseAction {
  if (state.photo) return 'photo';
  if (state.inspect) return 'inspect';
  if (state.editing) return 'editing';
  if (state.settings) return 'settings';
  if (state.expanded) return 'expanded';
  if (state.archive) return 'archive';
  if (state.selected) return 'collection';
  return 'none';
}
