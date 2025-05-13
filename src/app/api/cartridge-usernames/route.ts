import { NextResponse, NextRequest } from 'next/server';

// Helper function to normalize Ethereum addresses
const normalizeAddress = (address: string | undefined): string | undefined => {
  if (!address) return undefined;
  const lowerAddress = address.toLowerCase();
  const stripped = lowerAddress.startsWith('0x') ? lowerAddress.slice(2) : lowerAddress;
  const normalizedHex = stripped.replace(/^0+/, '');
  if (normalizedHex === '') return '0x0';
  return '0x' + normalizedHex;
};

// Interfaces for the Cartridge GraphQL API response
interface ControllerNode {
  address: string;
}

interface ControllerEdge {
  node: ControllerNode;
}

interface Controllers {
  edges: ControllerEdge[];
}

interface AccountNode {
  username: string | null;
  controllers: Controllers;
}

interface AccountEdge {
  node: AccountNode;
}

interface Accounts {
  edges: AccountEdge[];
}

interface CartridgeGraphQLResponseData {
  accounts: Accounts;
}

interface CartridgeGraphQLResponse {
  data?: CartridgeGraphQLResponseData; // data can be missing if top-level error
  errors?: Array<{ message: string; [key: string]: unknown }>;
}

// Interface for the request body to this API route
interface CartridgeUsernamesRequestBody {
  addresses?: string[];
}

const CARTRIDGE_API_URL = "https://api.cartridge.gg/query";
const GQL_QUERY = `
    query AccountNames($addresses: [String!]!) {
      accounts(where: {hasControllersWith: {addressIn: $addresses}}) {
        edges {
          node {
            username
            controllers {
              edges {
                node {
                  address
                }
              }
            }
          }
        }
      }
    }`;

export async function POST(request: NextRequest) {
  let requestBody: CartridgeUsernamesRequestBody;
  try {
    requestBody = await request.json();
  } catch (error) {
    console.error("[api/cartridge-usernames] Error parsing request JSON:", error);
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }

  const { addresses } = requestBody;
  // console.log("[api/cartridge-usernames] Received request for addresses:", addresses); // Keep if very brief or for auditing

  if (!addresses || !Array.isArray(addresses) || addresses.some(addr => typeof addr !== 'string')) {
    console.error("[api/cartridge-usernames] Invalid addresses format received.");
    return NextResponse.json({ error: "Missing or invalid 'addresses' array in request body" }, { status: 400 });
  }

  if (addresses.length === 0) {
    // console.log("[api/cartridge-usernames] No addresses provided, returning empty map.");
    return NextResponse.json({}, { status: 200 });
  }

  const normalizedAddressesForCartridge = addresses.map(addr => normalizeAddress(addr)).filter(Boolean) as string[];
  // console.log("[api/cartridge-usernames] Normalized addresses being sent to Cartridge API:", normalizedAddressesForCartridge);

  if (normalizedAddressesForCartridge.length === 0) {
    // console.log("[api/cartridge-usernames] All addresses were invalid after normalization, returning empty map.");
    return NextResponse.json({}, { status: 200 });
  }

  try {
    // console.log(`[api/cartridge-usernames] Fetching from Cartridge API for ${normalizedAddressesForCartridge.length} normalized addresses.`);
    const response = await fetch(CARTRIDGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*', // As per user example
      },
      body: JSON.stringify({
        query: GQL_QUERY,
        variables: { addresses: normalizedAddressesForCartridge }, // Use normalized addresses
      }),
      // 'credentials': 'include', // 'credentials' is not a valid option for server-side fetch in Next.js/Node.js
      // 'mode': 'cors', // 'mode' is also a browser-specific concept for fetch
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[api/cartridge-usernames] Cartridge API request failed: ${response.status}`, errorText);
      return NextResponse.json({ error: `Cartridge API request failed: ${response.status} ${response.statusText}`, details: errorText }, { status: response.status });
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
        const errorText = await response.text();
        console.error("[api/cartridge-usernames] Cartridge API did not return JSON. Content-Type:", contentType, "Response text:", errorText);
        return NextResponse.json({ error: "Cartridge API did not return JSON.", details: errorText }, { status: 502 });
    }
    
    const jsonResponse: CartridgeGraphQLResponse = await response.json();
    // console.log("[api/cartridge-usernames] Received JSON response from Cartridge API:", JSON.stringify(jsonResponse, null, 2)); // Too verbose for production

    if (jsonResponse.errors && jsonResponse.errors.length > 0) {
      console.error('[api/cartridge-usernames] Cartridge API returned GraphQL errors:', jsonResponse.errors);
      return NextResponse.json({ error: 'Cartridge API returned GraphQL errors', details: jsonResponse.errors }, { status: 500 });
    }

    if (!jsonResponse.data || !jsonResponse.data.accounts || !jsonResponse.data.accounts.edges) {
        console.error('[api/cartridge-usernames] Cartridge API response missing expected data structure.'); // Removed jsonResponse from log
        return NextResponse.json({ error: 'Cartridge API response missing expected data structure' }, { status: 500 });
    }
    
    const usernameMap: Record<string, string> = {};
    // Use the same list of normalized addresses that were sent to Cartridge for matching the response
    const requestedNormalizedAddresses = new Set(normalizedAddressesForCartridge);

    jsonResponse.data.accounts.edges.forEach(accountEdge => {
      const accountNode = accountEdge.node;
      if (accountNode && accountNode.username) {
        accountNode.controllers.edges.forEach(controllerEdge => {
          const controllerNode = controllerEdge.node;
          if (controllerNode && controllerNode.address) {
            const normalizedControllerAddress = normalizeAddress(controllerNode.address);
            if (normalizedControllerAddress && requestedNormalizedAddresses.has(normalizedControllerAddress)) {
              usernameMap[normalizedControllerAddress] = accountNode.username!;
            }
          }
        });
      }
    });

    console.log(`[api/cartridge-usernames] Successfully constructed username map with ${Object.keys(usernameMap).length} entries.`);
    return NextResponse.json(usernameMap, { status: 200 });

  } catch (error: unknown) {
    console.error('[api/cartridge-usernames] Error fetching or processing Cartridge usernames:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 });
  }
} 