import { NextResponse } from 'next/server';

// Define the expected structure of a single item in the response array
// This should match the GenericStructure interface in LiveMapPage.tsx
interface GenericStructure {
  'base.category': number;
  'base.coord_x': number;
  'base.coord_y': number;
  'base.created_at': number;
  'base.level': number;
  'base.troop_explorer_count': number;
  'base.troop_guard_count': number;
  'base.troop_max_explorer_count': number;
  'base.troop_max_guard_count': number;
  category: number;
  entity_id: number;
  internal_created_at: string;
  internal_entity_id: string;
  internal_event_id: string;
  internal_event_message_id: string | null;
  internal_executed_at: string;
  internal_id: string;
  internal_updated_at: string;
  'metadata.has_wonder': number;
  'metadata.order': number;
  'metadata.realm_id': number;
  'metadata.village_realm': number;
  'metadata.villages_count': number;
  owner: string;
  resources_packed: string;
  [key: string]: unknown; 
}

const GAME_DATA_SQL_URL = process.env.GAME_DATA_SQL;
const STRUCTURE_QUERY = 'select * from "s1_eternum-Structure"';

export async function GET() {
  if (!GAME_DATA_SQL_URL) {
    console.error('[api/eternum-structures] GAME_DATA_SQL environment variable is not set.');
    return NextResponse.json({ error: 'Server configuration error: Game data URL not set.' }, { status: 500 });
  }

  const fetchURL = `${GAME_DATA_SQL_URL}?query=${encodeURIComponent(STRUCTURE_QUERY)}`;

  try {
    console.log(`[api/eternum-structures] Fetching structures from: ${fetchURL}`);
    const response = await fetch(fetchURL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[api/eternum-structures] Failed to fetch structures from game SQL API. Status: ${response.status}`, errorText);
      return NextResponse.json(
        { error: `Failed to fetch structures: ${response.status} ${response.statusText}`, details: errorText }, 
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
        const errorText = await response.text();
        console.error("[api/eternum-structures] Game SQL API did not return JSON. Content-Type:", contentType, "Response text:", errorText);
        return NextResponse.json({ error: "Game SQL API did not return JSON.", details: errorText }, { status: 502 }); // 502 Bad Gateway
    }

    const structuresData: GenericStructure[] = await response.json();
    console.log(`[api/eternum-structures] Successfully fetched ${structuresData.length} structures.`);
    return NextResponse.json(structuresData, { status: 200 });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[api/eternum-structures] Error fetching or processing structures:', error);
    return NextResponse.json({ error: 'Internal server error while fetching structures.', details: errorMessage }, { status: 500 });
  }
} 