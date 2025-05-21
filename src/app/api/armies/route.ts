import { NextResponse } from 'next/server';

// Define the expected structure of a single item in the response array
interface ArmyInfo {
  "coord.x": number;
  "coord.y": number;
  explorer_id: number;
  internal_created_at: string;
  internal_entity_id: string;
  internal_event_id: string;
  internal_event_message_id: string | null;
  internal_executed_at: string;
  internal_id: string;
  internal_updated_at: string;
  owner: number;
  "troops.category": string;
  "troops.count": string;
  "troops.stamina.amount": string;
  "troops.stamina.updated_tick": string;
  "troops.tier": string;
  [key: string]: unknown;
}

const GAME_DATA_SQL_URL = process.env.GAME_DATA_SQL;
const ARMIES_QUERY = 'SELECT * FROM "s1_eternum-ExplorerTroops"';

export async function GET() {
  if (!GAME_DATA_SQL_URL) {
    console.error('[api/armies] GAME_DATA_SQL environment variable is not set.');
    return NextResponse.json({ error: 'Server configuration error: Game data URL not set.' }, { status: 500 });
  }

  const fetchURL = `${GAME_DATA_SQL_URL}?query=${encodeURIComponent(ARMIES_QUERY)}`;

  try {
    console.log(`[api/armies] Fetching armies data from: ${fetchURL}`);
    const response = await fetch(fetchURL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[api/armies] Failed to fetch armies data from game SQL API. Status: ${response.status}`, errorText);
      return NextResponse.json(
        { error: `Failed to fetch armies data: ${response.status} ${response.statusText}`, details: errorText },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const errorText = await response.text();
      console.error("[api/armies] Game SQL API did not return JSON. Content-Type:", contentType, "Response text:", errorText);
      return NextResponse.json({ error: "Game SQL API did not return JSON.", details: errorText }, { status: 502 });
    }

    const armiesData: ArmyInfo[] = await response.json();
    console.log(`[api/armies] Successfully fetched ${armiesData.length} armies.`);
    return NextResponse.json(armiesData, { status: 200 });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[api/armies] Error fetching or processing armies data:', error);
    return NextResponse.json({ error: 'Internal server error while fetching armies data.', details: errorMessage }, { status: 500 });
  }
} 