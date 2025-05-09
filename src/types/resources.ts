export enum ResourcesIds {
  Wood = 0,
  Stone = 1,
  Coal = 2,
  Copper = 3,
  Obsidian = 4,
  Silver = 5,
  Ironwood = 6,
  ColdIron = 7,
  Gold = 8,
  Hartwood = 9,
  Diamonds = 10,
  Sapphire = 11,
  Ruby = 12,
  DeepCrystal = 13,
  Ignium = 14,
  EtherealSilica = 15,
  TrueIce = 16,
  TwilightQuartz = 17,
  AlchemicalSilver = 18,
  Adamantine = 19,
  Mithral = 20,
  Dragonhide = 21,
  Labor = 22,
  AncientFragment = 23,
  Donkey = 24,
  Knight = 25,
  KnightT2 = 26,
  KnightT3 = 27,
  Crossbowman = 28,
  CrossbowmanT2 = 29,
  CrossbowmanT3 = 30,
  Paladin = 31,
  PaladinT2 = 32,
  PaladinT3 = 33,
  Lords = 34,
  Wheat = 35,
  Fish = 36,
}

export interface ResourceCost {
  resource: ResourcesIds;
  amount: number;
}

export interface ResourceInputs {
  [key: number]: ResourceCost[];
}

export interface ResourceOutputs {
  [key: number]: number;
}

export interface Realm {
  id: number;
  name: string;
  description: string;
  image: string;
  resources: ResourceCost[];
  availableTroops: ResourcesIds[];
  resourceChains: ResourcesIds[][];
  attributes: Record<string, string | number>;
  owner?: string;
}

export const RESOURCE_BANDS = {
  KNIGHT_T1_MATERIALS: [ResourcesIds.Obsidian, ResourcesIds.ColdIron],
  KNIGHT_T2_MATERIALS: [ResourcesIds.Ruby, ResourcesIds.DeepCrystal],
  KNIGHT_T3_MATERIALS: [ResourcesIds.TwilightQuartz, ResourcesIds.Mithral],
  CROSSBOWMAN_T1_MATERIALS: [ResourcesIds.Silver, ResourcesIds.Ironwood],
  CROSSBOWMAN_T2_MATERIALS: [ResourcesIds.Diamonds, ResourcesIds.EtherealSilica],
  CROSSBOWMAN_T3_MATERIALS: [ResourcesIds.TrueIce, ResourcesIds.Dragonhide],
  PALADIN_T1_MATERIALS: [ResourcesIds.Copper, ResourcesIds.Gold],
  PALADIN_T2_MATERIALS: [ResourcesIds.Sapphire, ResourcesIds.Ignium],
  PALADIN_T3_MATERIALS: [ResourcesIds.AlchemicalSilver, ResourcesIds.Adamantine],
} as const;

export const RESOURCE_TO_BAND: { [key in ResourcesIds]?: string } = {}; 