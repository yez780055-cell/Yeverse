export type IntroMode = 'full' | 'quick' | 'none';
export type UniverseCollectionStage = 'none' | 'approach' | 'collection' | 'return';

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

export function planetActivationAction(focusedPlanetId: string | undefined, clickedPlanetId: string): 'focus' | 'open' {
  return focusedPlanetId === clickedPlanetId ? 'open' : 'focus';
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
