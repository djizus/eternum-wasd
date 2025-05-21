import { NextResponse } from 'next/server';

// Define the expected structure of a single item in the response array
// This should match the data returned by the SQL query joining GuildMember and Guild tables.
interface TribeMemberInfo {
  guild_id: string;
  internal_created_at: string;
  internal_entity_id: string;
  internal_event_id: string;
  internal_event_message_id: string | null;
  internal_executed_at: string;
  internal_id: string;
  internal_updated_at: string;
  member: string; // Player address from GuildMember table
  member_count: number; // From Guild table (repeated for each member)
  name: string; // Guild name from Guild table (hex encoded string)
  public: number; // From Guild table (0 or 1)
  // Allow other properties that might come from the join,
  // for example, other columns from s1_eternum-Guild if not explicitly listed above.
  [key: string]: unknown;
}

const GAME_DATA_SQL_URL = process.env.GAME_DATA_SQL;
// Note: Table names with hyphens need to be double-quoted in the SQL query for many SQL dialects.
const TRIBES_QUERY = 'SELECT * FROM "s1_eternum-GuildMember" T1 INNER JOIN "s1_eternum-Guild" T2 ON T1.guild_id = T2.guild_id';

export async function GET() {
  if (!GAME_DATA_SQL_URL) {
    console.error('[api/tribes] GAME_DATA_SQL environment variable is not set.');
    return NextResponse.json({ error: 'Server configuration error: Game data URL not set.' }, { status: 500 });
  }

  const fetchURL = `${GAME_DATA_SQL_URL}?query=${encodeURIComponent(TRIBES_QUERY)}`;

  try {
    console.log(`[api/tribes] Fetching tribes data from: ${fetchURL}`);
    const response = await fetch(fetchURL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[api/tribes] Failed to fetch tribes data from game SQL API. Status: ${response.status}`, errorText);
      return NextResponse.json(
        { error: `Failed to fetch tribes data: ${response.status} ${response.statusText}`, details: errorText },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
        const errorText = await response.text();
        console.error("[api/tribes] Game SQL API did not return JSON. Content-Type:", contentType, "Response text:", errorText);
        return NextResponse.json({ error: "Game SQL API did not return JSON.", details: errorText }, { status: 502 }); // 502 Bad Gateway
    }

    const tribesData: TribeMemberInfo[] = await response.json();
    console.log(`[api/tribes] Successfully fetched ${tribesData.length} tribe member entries.`);
    // The data is an array where each entry represents a member, with guild info duplicated.
    // Further processing (grouping by guild_id, decoding names, etc.) can be done client-side or here if needed.
    return NextResponse.json(tribesData, { status: 200 });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[api/tribes] Error fetching or processing tribes data:', error);
    return NextResponse.json({ error: 'Internal server error while fetching tribes data.', details: errorMessage }, { status: 500 });
  }
} 