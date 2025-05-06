import { NextResponse } from 'next/server';
import { connectToDatabase, getDatabase } from '@/lib/mongodb';

// --- Configuration ---
const GQL_API_ENDPOINT = process.env.SEASON_PASSES_GQL;
// List of RPC Endpoints
const RPC_ENDPOINTS = [
    'https://starknet-mainnet.public.blastapi.io',
    'https://free-rpc.nethermind.io/mainnet-juno',
    'https://api.zan.top/public/starknet-mainnet'
];
const REALM_CONTRACT_ADDRESS = '0x060e8836acbebb535dfcd237ff01f20be503aae407b67bb6e3b5869afae97156';
const REALMS_COLLECTION = 'realms';

// --- GraphQL Query ---
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

// --- Types ---
interface GQLEdge {
  node: {
    tokenMetadata: {
      __typename: string;
      tokenId?: string;
    };
  };
}

// Define a basic type for GraphQL errors
interface GraphQLError {
  message: string;
  locations?: { line: number; column: number }[];
  path?: (string | number)[];
  extensions?: Record<string, unknown>;
}

interface GQLResponse {
  data: {
    tokens: {
      totalCount: number;
      edges: GQLEdge[];
    };
  };
  errors?: GraphQLError[]; // Use the defined type
}

interface RpcResponse {
  id: number;
  jsonrpc: string;
  result?: string[];
  error?: { code: number; message: string };
}

// --- Helper Functions ---
const toHex = (num: number): string => `0x${num.toString(16)}`;

// --- RPC Fetching Logic with Sequential Fallback ---
const fetchOwnerForRealm = async (realmId: number): Promise<[number, string | null]> => {
  if (typeof realmId !== 'number' || isNaN(realmId) || realmId <= 0) {
      console.error(`[fetchOwnerForRealm] Invalid realmId received: ${realmId}. Skipping RPC call.`);
      return [realmId, null]; 
  }

  const realmIdHex = toHex(realmId);
  const payload = {
    id: realmId, 
    jsonrpc: '2.0', method: 'starknet_call',
    params: {
      request: { 
          contract_address: REALM_CONTRACT_ADDRESS, 
          entry_point_selector: "0x3552df12bdc6089cf963c40c4cf56fbfd4bd14680c244d1c5494c2790f1ea5c", 
          calldata: [realmIdHex, '0x0'] 
      },
      block_id: 'pending',
    },
  };

  let lastError: Error | null = null; // Use Error | null type

  for (const currentRpcUrl of RPC_ENDPOINTS) {
    try {
      const response = await fetch(currentRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'EternumWASD-OwnerUpdateClient/1.0' },
        body: JSON.stringify(payload),
        cache: 'no-store',
      });

      if (response.status === 429 || response.status >= 500) { 
        console.warn(`Realm ${realmId}: Received status ${response.status} from ${currentRpcUrl}. Trying next endpoint...`);
        lastError = new Error(`Received status ${response.status} from ${currentRpcUrl}`);
        continue; 
      }
      
      if (!response.ok) {
          console.warn(`Realm ${realmId}: Received non-retriable status ${response.status} ${response.statusText} from ${currentRpcUrl}. Failing this request.`);
          lastError = new Error(`Received status ${response.status} ${response.statusText} from ${currentRpcUrl}`);
          return [realmId, null]; 
      }

      const data = await response.json() as RpcResponse;
      
      if (data.error) { 
          lastError = new Error(`RPC Error: ${data.error.message}`);
          return [realmId, null]; 
      }
      
      if (data.result && data.result.length > 0) {
          return [realmId, data.result[0]];
      }
      
      console.warn(`Realm ${realmId}: Unexpected JSON-RPC response structure from ${currentRpcUrl}:`, JSON.stringify(data));
      lastError = new Error(`Unexpected JSON-RPC response structure from ${currentRpcUrl}`);
      return [realmId, null]; 

    } catch (error) {
      // Catch fetch errors (network issues, DNS errors, etc.)
      console.warn(`Realm ${realmId}: Network error fetching from ${currentRpcUrl}:`, error);
      // Assign error correctly based on type
      if (error instanceof Error) {
        lastError = error;
      } else {
        lastError = new Error(String(error)); // Convert unknown error to Error object
      }
    }
  }

  console.error(`Realm ${realmId}: Failed to fetch owner after trying all RPC endpoints sequentially. Last error:`, lastError);
  return [realmId, null];
};

// --- API Route Handler (POST) ---
export async function POST(_request: Request) { // Prefix unused request parameter
  if (!GQL_API_ENDPOINT) {
      console.error('GQL_API_ENDPOINT is not configured.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    let tokenIds: number[] = [];
    try {
      const gqlResponse = await fetch(GQL_API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: GET_ALL_TOKENS_QUERY }),
        cache: 'no-store',
      });
      if (!gqlResponse.ok) throw new Error(`GQL request failed: ${gqlResponse.statusText}`);
      const gqlData = await gqlResponse.json() as GQLResponse;
      if (gqlData.errors) throw new Error(`GraphQL Error: ${JSON.stringify(gqlData.errors)}`);

      tokenIds = gqlData.data.tokens.edges
        .map(edge => edge.node.tokenMetadata.tokenId)
        .filter((id): id is string => !!id)
        .map(idStr => parseInt(idStr, 16))
        .filter(id => !isNaN(id));
    } catch (error) {
      console.error('Failed to fetch token IDs from GQL:', error);
      return NextResponse.json({ error: 'Failed to fetch token IDs from GQL' }, { status: 500 });
    }

    if (tokenIds.length === 0) {
      console.log('No token IDs found from GQL, skipping owner update.');
      return NextResponse.json({ message: 'No tokens found, no updates needed.' });
    }
    
    const ownerPromises: Promise<[number, string | null]>[] = []; 
    for (const id of tokenIds) {
        ownerPromises.push(fetchOwnerForRealm(id)); 
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    const allOwnerResults = await Promise.allSettled(ownerPromises);

    const ownerUpdates: Record<string, string | null> = {};
    let ownersFound = 0;
    let rpcErrors = 0;
    allOwnerResults.forEach((result, index) => {
        const requestedRealmId = tokenIds[index]; 
        if (typeof requestedRealmId !== 'number' || isNaN(requestedRealmId)) {
            console.warn(`Skipping result at index ${index} due to invalid original token ID: ${requestedRealmId}`);
            rpcErrors++; 
            return;
        }
        if (result.status === 'fulfilled') {
            const [returnedRealmId, ownerAddress] = result.value; 
            if (returnedRealmId !== requestedRealmId) {
                console.warn(`Mismatch between requested ID (${requestedRealmId}) and returned ID (${returnedRealmId}) for result at index ${index}`);
            }
            ownerUpdates[`${requestedRealmId}.owner`] = ownerAddress; 
            if(ownerAddress) ownersFound++;
        } else { 
            console.error(`Unexpected rejection processing result for requested realm ${requestedRealmId}:`, result.reason);
            rpcErrors++;
            ownerUpdates[`${requestedRealmId}.owner`] = null; 
        }
    });
    console.log(`Owner processing complete: ${ownersFound} owners found, ${rpcErrors} errors/null results for ${tokenIds.length} tokens.`);

    if (Object.keys(ownerUpdates).length === 0) {
        console.log("No owner data generated to update MongoDB.");
        return NextResponse.json({ message: "No owner data obtained from RPC.", tokensProcessed: tokenIds.length });
    }

    try {
      await connectToDatabase();
      const db = await getDatabase();
      const collection = db.collection(REALMS_COLLECTION);
      const result = await collection.updateOne({}, { $set: ownerUpdates });
      console.log(`MongoDB update: ${result.modifiedCount} owners updated in DB.`);
      return NextResponse.json({ 
          message: 'Owner update process finished successfully.', 
          tokensProcessed: tokenIds.length,
          ownersFound: ownersFound,
          rpcErrors: rpcErrors,
          updatesApplied: result.modifiedCount 
      });
    } catch (dbError) {
      console.error('Failed to update MongoDB:', dbError);
      return NextResponse.json({ error: 'Failed to update database' }, { status: 500 });
    }

  } catch (error) {
    console.error('Unhandled error during owner update POST request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Optional: Simple GET handler for testing endpoint existence
export async function GET() {
    return NextResponse.json({ message: "Owner update endpoint. Use POST to trigger updates." });
} 