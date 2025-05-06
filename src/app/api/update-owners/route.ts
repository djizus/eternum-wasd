import { NextResponse } from 'next/server';
import { connectToDatabase, getDatabase } from '@/lib/mongodb'; // Assuming your MongoDB helper is here
// import fetch from 'node-fetch'; // Removed node-fetch import

// --- Configuration ---
// Use environment variables for sensitive data
const GQL_API_ENDPOINT = process.env.GQL_API_ENDPOINT || 'YOUR_GQL_API_ENDPOINT'; // Replace or set env var
const CRON_SECRET = process.env.CRON_SECRET || 'YOUR_CRON_SECRET'; // Replace or set env var for security
const RPC_URL = 'https://free-rpc.nethermind.io/mainnet-juno';
const REALM_CONTRACT_ADDRESS = '0x060e8836acbebb535dfcd237ff01f20be503aae407b67bb6e3b5869afae97156';
const OWNER_OF_SELECTOR = '0x3552df12bdc6089cf963c40c4cf56fbfd4bd14680c244d1c5494c2790f1ea5c';
const REALMS_COLLECTION = 'realms';

// --- GraphQL Query (same as before) ---
const GET_ALL_TOKENS_QUERY = `
query getAllTokens {
  tokens(
    limit: 8000
    contractAddress: "0x60e8836acbebb535dfcd237ff01f20be503aae407b67bb6e3b5869afae97156"
  ) {
    totalCount
    edges {
      node {
        tokenMetadata {
          __typename
          ... on ERC721__Token {
            tokenId
          }
        }
      }
    }
  }
}
`;

// --- Types (same as before) ---
interface GQLEdge {
  node: {
    tokenMetadata: {
      __typename: string;
      tokenId?: string;
    };
  };
}

interface GQLResponse {
  data: {
    tokens: {
      totalCount: number;
      edges: GQLEdge[];
    };
  };
  errors?: any[];
}

interface RpcResponse {
  id: number;
  jsonrpc: string;
  result?: string[];
  error?: { code: number; message: string };
}

// --- Helper Functions (same as before) ---
const toHex = (num: number): string => `0x${num.toString(16)}`;

// --- RPC Fetching Logic (using native fetch) ---
const fetchOwnerForRealm = async (realmId: number): Promise<[number, string | null]> => {
  const realmIdHex = toHex(realmId);
  const payload = {
    id: 1, jsonrpc: '2.0', method: 'starknet_call',
    params: {
      request: { contract_address: REALM_CONTRACT_ADDRESS, entry_point_selector: OWNER_OF_SELECTOR, calldata: [realmIdHex, '0x0'] },
      block_id: 'pending',
    },
  };
  try {
    // Using native fetch
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'EternumWASD-OwnerUpdate/1.0' },
      body: JSON.stringify(payload),
      cache: 'no-store', // Good practice for API calls within serverless functions
    });
    if (!response.ok) {
      console.warn(`RPC request failed for realm ${realmId}: ${response.status} ${response.statusText}`);
      return [realmId, null];
    }
    // Type assertion might still be needed depending on TS config
    const data = await response.json() as RpcResponse;
    if (data.error) return [realmId, null];
    if (data.result && data.result.length > 0) return [realmId, data.result[0]];
    console.warn(`Unexpected RPC response for realm ${realmId}:`, data);
    return [realmId, null];
  } catch (error) {
    console.error(`Error fetching owner for realm ${realmId}:`, error);
    return [realmId, null];
  }
};

// --- API Route Handler ---
export async function POST(request: Request) {
  console.log("Received request to /api/update-owners");

  // 1. Security Check
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    console.warn("Unauthorized attempt to update owners.");
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log("Authorization successful. Starting owner update...");

  // Check if GQL endpoint is configured
  if (!GQL_API_ENDPOINT || GQL_API_ENDPOINT === 'YOUR_GQL_API_ENDPOINT') {
      console.error('GQL_API_ENDPOINT is not configured.');
      return NextResponse.json({ error: 'Internal Server Error: GQL endpoint not configured' }, { status: 500 });
  }

  try {
    // 2. Fetch all token IDs from GQL
    console.log('Fetching token IDs from GraphQL API...');
    let tokenIds: number[] = [];
    try {
      // Using native fetch
      const gqlResponse = await fetch(GQL_API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: GET_ALL_TOKENS_QUERY }),
        cache: 'no-store', // Good practice
      });
      if (!gqlResponse.ok) {
        throw new Error(`GQL request failed: ${gqlResponse.statusText}`);
      }
      const gqlData = await gqlResponse.json() as GQLResponse;
      if (gqlData.errors) {
        throw new Error(`GraphQL Error: ${JSON.stringify(gqlData.errors)}`);
      }
      tokenIds = gqlData.data.tokens.edges
        .map(edge => edge.node.tokenMetadata.tokenId)
        .filter((id): id is string => !!id)
        .map(idStr => parseInt(idStr, 10))
        .filter(id => !isNaN(id));
      console.log(`Fetched ${tokenIds.length} token IDs.`);
    } catch (error) {
      console.error('Failed to fetch token IDs from GQL:', error);
      // Decide if we should return error or proceed without updates
      return NextResponse.json({ error: 'Failed to fetch token IDs from GQL' }, { status: 500 });
    }

    if (tokenIds.length === 0) {
      console.log('No token IDs found. Update process complete (no changes). ');
      return NextResponse.json({ message: 'No token IDs found, no updates performed.' });
    }

    // 3. Fetch owners for each token ID via RPC
    console.log('Fetching owners via RPC...');
    const ownerPromises = tokenIds.map(id => fetchOwnerForRealm(id));
    const ownerResults = await Promise.allSettled(ownerPromises);
    console.log('Owner RPC calls settled.');

    const ownerUpdates: Record<string, string | null> = {}; // Allow setting null to clear owner if needed
    let ownersFound = 0;
    let rpcErrors = 0;
    ownerResults.forEach((result, index) => {
        const realmId = tokenIds[index]; // Get realmId from original list based on index
        if (result.status === 'fulfilled') {
            const ownerAddress = result.value[1]; // Can be string or null
            // Key for MongoDB update: `realmId.owner` (e.g., "123.owner")
            ownerUpdates[`${realmId}.owner`] = ownerAddress; 
            if(ownerAddress) ownersFound++;
        } else { // status === 'rejected'
            rpcErrors++;
            // Optionally log rejection reason: console.error(`RPC Error for realm ${realmId}:`, result.reason);
            // We might still want to update the DB entry to null or leave it as is.
            // Setting to null explicitly indicates we tried but failed/got no owner.
            ownerUpdates[`${realmId}.owner`] = null;
        }
    });
    console.log(`Processed owner results. Found ${ownersFound} owners. Encountered ${rpcErrors} RPC errors/null results.`);

    if (Object.keys(ownerUpdates).length === 0) {
        console.log("No owner updates to apply. Update process complete (no changes).");
        return NextResponse.json({ message: "No owner updates generated." });
    }

    // 4. Update MongoDB
    console.log('Connecting to MongoDB...');
    try {
      await connectToDatabase(); // Ensure connection is established (uses cached client if available)
      const db = await getDatabase();
      const collection = db.collection(REALMS_COLLECTION);

      console.log(`Updating ${Object.keys(ownerUpdates).length} owner fields in MongoDB...`);

      // Assuming the 'realms' collection has ONE document where keys are realm IDs
      const result = await collection.updateOne(
          {}, // Find the single document
          { $set: ownerUpdates }
      );

      console.log(`MongoDB update result: Matched ${result.matchedCount}, Modified ${result.modifiedCount}`);
      return NextResponse.json({ 
          message: 'Owner update process finished.', 
          tokensProcessed: tokenIds.length,
          ownersFound: ownersFound,
          updatesApplied: result.modifiedCount 
      });

    } catch (dbError) {
      console.error('Failed to update MongoDB:', dbError);
      return NextResponse.json({ error: 'Failed to update database' }, { status: 500 });
    }

  } catch (error) {
    console.error('Unhandled error during owner update:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Optional: Add a GET handler for health checks or basic info if needed
export async function GET() {
    return NextResponse.json({ message: "Owner update endpoint is active. Use POST with authorization to trigger updates." });
} 