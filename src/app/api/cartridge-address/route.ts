import { NextResponse } from 'next/server';

// Define a simple interface for the expected error structure from Cartridge API
interface CartridgeApiError {
  message: string;
  // Add other properties if known and needed, e.g., code, path, etc.
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');

  if (!username) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  }

  const CARTRIDGE_API_URL = 'https://api.cartridge.gg/query';
  const query = `
    query Controller($username: String!, $chainId: String!) {
      controller(username: $username, chainId: $chainId) {
        address
      }
    }
  `;
  const variables = {
    chainId: "SN_MAIN",
    username: username,
  };

  try {
    const apiResponse = await fetch(CARTRIDGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*',
        // Add any other specific headers Cartridge API might require from a server,
        // but User-Agent is a good one to include for robustness.
        'User-Agent': 'EternumWASD-BackendFetcher/1.0', // Example User-Agent
        // Origin and Referer are less relevant for server-to-server,
        // and sec- headers are browser-specific.
      },
      body: JSON.stringify({
        query: query,
        variables: variables,
      }),
    });

    const result = await apiResponse.json();

    if (!apiResponse.ok) {
      console.error('Cartridge API Error:', result);
      const errorMessages = result.errors ? (result.errors as CartridgeApiError[]).map((err) => err.message).join(', ') : 'Failed to fetch address from Cartridge API.';
      return NextResponse.json({ error: errorMessages }, { status: apiResponse.status });
    }

    if (result.data && result.data.controller && result.data.controller.address) {
      return NextResponse.json({ address: result.data.controller.address });
    } else if (result.data && result.data.controller === null) {
      return NextResponse.json({ error: 'Controller not found for username.' }, { status: 404 });
    } else {
      console.error('Unexpected Cartridge API response structure:', result);
      return NextResponse.json({ error: 'Failed to parse address from Cartridge API response.' }, { status: 500 });
    }
  } catch (error: unknown) {
    console.error('Error fetching from Cartridge API:', error);
    let errorMessage = 'Internal server error: Unknown error';
    if (error instanceof Error) {
      errorMessage = `Internal server error: ${error.message}`;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 