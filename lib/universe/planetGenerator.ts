import {generatePlanetVisualProfileV1} from './planetGeneratorV1';
import type {PlanetGeneratorInput,PlanetVisualProfile} from './planetGeneratorV1';
import {createPlanetGeneratorRouter} from './planetGeneratorRouter';

export {PLANET_TYPES,stableHash,planetOrbitRadius,structuralProfile} from './planetGeneratorV1';
export type {PlanetType,SizeTier,MacroFeature,AtmosphereMode,PlanetMoonProfile,PlanetRingProfile,PlanetVisualProfile,PlanetGeneratorInput} from './planetGeneratorV1';
export {UnsupportedPlanetGeneratorVersionError,createSupportedPlanetItems,createPlanetGeneratorRouter,normalizedPlanetGeneratorVersion} from './planetGeneratorRouter';

const generatePlanetVisualProfileByVersion=createPlanetGeneratorRouter<PlanetGeneratorInput,PlanetVisualProfile>(new Map([[1,generatePlanetVisualProfileV1]]));
export function generatePlanetVisualProfile(input:PlanetGeneratorInput){return generatePlanetVisualProfileByVersion(input);}
