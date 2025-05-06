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
  T1_TROOPS_PRIMARY: [
    ResourcesIds.Copper,
    ResourcesIds.Obsidian,
    ResourcesIds.Silver,
    ResourcesIds.Ironwood,
    ResourcesIds.ColdIron,
    ResourcesIds.Gold,
  ],
  T2_TROOPS_SECONDARY: [ResourcesIds.Hartwood, ResourcesIds.Diamonds, ResourcesIds.Sapphire, ResourcesIds.Ruby],
  T2_TROOPS_TERTIARY: [ResourcesIds.DeepCrystal, ResourcesIds.Ignium, ResourcesIds.EtherealSilica],
  T3_TROOPS_SECONDARY: [ResourcesIds.TrueIce, ResourcesIds.TwilightQuartz, ResourcesIds.AlchemicalSilver],
  T3_TROOPS_TERTIARY: [ResourcesIds.Adamantine, ResourcesIds.Mithral, ResourcesIds.Dragonhide],
} as const; 