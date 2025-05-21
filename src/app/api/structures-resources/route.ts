import { NextResponse } from 'next/server';

// Explicit interface for the structure resource info
export interface StructureResourceInfo {
  // Resource balances
  ADAMANTINE_BALANCE: string;
  ALCHEMICAL_SILVER_BALANCE: string;
  COAL_BALANCE: string;
  COLD_IRON_BALANCE: string;
  COPPER_BALANCE: string;
  CROSSBOWMAN_T1_BALANCE: string;
  CROSSBOWMAN_T2_BALANCE: string;
  CROSSBOWMAN_T3_BALANCE: string;
  DEEP_CRYSTAL_BALANCE: string;
  DIAMONDS_BALANCE: string;
  DONKEY_BALANCE: string;
  DRAGONHIDE_BALANCE: string;
  EARTHEN_SHARD_BALANCE: string;
  ETHEREAL_SILICA_BALANCE: string;
  FISH_BALANCE: string;
  GOLD_BALANCE: string;
  HARTWOOD_BALANCE: string;
  IGNIUM_BALANCE: string;
  IRONWOOD_BALANCE: string;
  KNIGHT_T1_BALANCE: string;
  KNIGHT_T2_BALANCE: string;
  KNIGHT_T3_BALANCE: string;
  LABOR_BALANCE: string;
  LORDS_BALANCE: string;
  MITHRAL_BALANCE: string;
  OBSIDIAN_BALANCE: string;
  PALADIN_T1_BALANCE: string;
  PALADIN_T2_BALANCE: string;
  PALADIN_T3_BALANCE: string;
  RUBY_BALANCE: string;
  SAPPHIRE_BALANCE: string;
  SILVER_BALANCE: string;
  STONE_BALANCE: string;
  TRUE_ICE_BALANCE: string;
  TWILIGHT_QUARTZ_BALANCE: string;
  WHEAT_BALANCE: string;
  WOOD_BALANCE: string;
  // Production fields for each resource
  ADAMANTINE_PRODUCTION: ProductionInfo;
  ALCHEMICAL_SILVER_PRODUCTION: ProductionInfo;
  COAL_PRODUCTION: ProductionInfo;
  COLD_IRON_PRODUCTION: ProductionInfo;
  COPPER_PRODUCTION: ProductionInfo;
  CROSSBOWMAN_T1_PRODUCTION: ProductionInfo;
  CROSSBOWMAN_T2_PRODUCTION: ProductionInfo;
  CROSSBOWMAN_T3_PRODUCTION: ProductionInfo;
  DEEP_CRYSTAL_PRODUCTION: ProductionInfo;
  DIAMONDS_PRODUCTION: ProductionInfo;
  DONKEY_PRODUCTION: ProductionInfo;
  DRAGONHIDE_PRODUCTION: ProductionInfo;
  EARTHEN_SHARD_PRODUCTION: ProductionInfo;
  ETHEREAL_SILICA_PRODUCTION: ProductionInfo;
  FISH_PRODUCTION: ProductionInfo;
  GOLD_PRODUCTION: ProductionInfo;
  HARTWOOD_PRODUCTION: ProductionInfo;
  IGNIUM_PRODUCTION: ProductionInfo;
  IRONWOOD_PRODUCTION: ProductionInfo;
  KNIGHT_T1_PRODUCTION: ProductionInfo;
  KNIGHT_T2_PRODUCTION: ProductionInfo;
  KNIGHT_T3_PRODUCTION: ProductionInfo;
  LABOR_PRODUCTION: ProductionInfo;
  LORDS_PRODUCTION: ProductionInfo;
  MITHRAL_PRODUCTION: ProductionInfo;
  OBSIDIAN_PRODUCTION: ProductionInfo;
  PALADIN_T1_PRODUCTION: ProductionInfo;
  PALADIN_T2_PRODUCTION: ProductionInfo;
  PALADIN_T3_PRODUCTION: ProductionInfo;
  RUBY_PRODUCTION: ProductionInfo;
  SAPPHIRE_PRODUCTION: ProductionInfo;
  SILVER_PRODUCTION: ProductionInfo;
  STONE_PRODUCTION: ProductionInfo;
  TRUE_ICE_PRODUCTION: ProductionInfo;
  TWILIGHT_QUARTZ_PRODUCTION: ProductionInfo;
  WHEAT_PRODUCTION: ProductionInfo;
  WOOD_PRODUCTION: ProductionInfo;
  // Metadata fields
  entity_id: number;
  internal_created_at: string;
  internal_entity_id: string;
  internal_event_id: string;
  internal_event_message_id: string | null;
  internal_executed_at: string;
  internal_id: string;
  internal_updated_at: string;
  "weight.capacity": string;
  "weight.weight": string;
}

export interface ProductionInfo {
  building_count: number;
  last_updated_at: number;
  output_amount_left: string;
  production_rate: string;
}

const GAME_DATA_SQL_URL = process.env.GAME_DATA_SQL;
const STRUCTURES_RESOURCES_QUERY = 'SELECT * FROM [s1_eternum-Resource] where entity_id is not null';

export async function GET() {
  if (!GAME_DATA_SQL_URL) {
    console.error('[api/structures-resources] GAME_DATA_SQL environment variable is not set.');
    return NextResponse.json({ error: 'Server configuration error: Game data URL not set.' }, { status: 500 });
  }

  const fetchURL = `${GAME_DATA_SQL_URL}?query=${encodeURIComponent(STRUCTURES_RESOURCES_QUERY)}`;

  try {
    console.log(`[api/structures-resources] Fetching structure resources data from: ${fetchURL}`);
    const response = await fetch(fetchURL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[api/structures-resources] Failed to fetch structure resources data from game SQL API. Status: ${response.status}`, errorText);
      return NextResponse.json(
        { error: `Failed to fetch structure resources data: ${response.status} ${response.statusText}`, details: errorText },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const errorText = await response.text();
      console.error("[api/structures-resources] Game SQL API did not return JSON. Content-Type:", contentType, "Response text:", errorText);
      return NextResponse.json({ error: "Game SQL API did not return JSON.", details: errorText }, { status: 502 });
    }

    const resourcesData: StructureResourceInfo[] = await response.json();
    console.log(`[api/structures-resources] Successfully fetched ${resourcesData.length} structure resource entries.`);
    return NextResponse.json(resourcesData, { status: 200 });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[api/structures-resources] Error fetching or processing structure resources data:', error);
    return NextResponse.json({ error: 'Internal server error while fetching structure resources data.', details: errorMessage }, { status: 500 });
  }
} 