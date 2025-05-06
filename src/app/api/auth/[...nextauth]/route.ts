import NextAuth, { type Account, type Profile, type User, type NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

// Define the structure of the Discord Guild object from their API
interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string; // User's permissions in this guild
}

// Define structure for Discord Channel object (partial)
// interface DiscordChannel {
//   id: string;
//   type: number;
//   guild_id?: string; // ID of the guild the channel is in (if it's a guild channel)
//   name?: string;
// }

// Define profile structure if extending Discord profile data
// interface DiscordProfile extends Profile {
//   // Add specific fields if needed, e.g.:
//   // username: string;
//   // discriminator: string;
//   // avatar: string | null;
//   // id: string;
// }

// Read target Guild ID and Channel ID from environment variables
const TARGET_GUILD_ID = process.env.DISCORD_SERVER_ID;
// const TARGET_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID; // No longer needed for channel check
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_SECRET;
const DISCORD_MEMBERS_ID_STRING = process.env.DISCORD_MEMBERS_ID;

let ALLOWED_MEMBER_IDS: string[] = [];

// Ensure the environment variables are set
if (!TARGET_GUILD_ID) {
  throw new Error("Missing environment variable: DISCORD_SERVER_ID");
}
if (!DISCORD_CLIENT_ID) {
  throw new Error("Missing environment variable: DISCORD_CLIENT_ID");
}
if (!DISCORD_CLIENT_SECRET) {
  throw new Error("Missing environment variable: DISCORD_CLIENT_SECRET");
}
if (!DISCORD_MEMBERS_ID_STRING) {
  throw new Error("Missing environment variable: DISCORD_MEMBERS_ID");
} else {
  try {
    ALLOWED_MEMBER_IDS = JSON.parse(DISCORD_MEMBERS_ID_STRING);
    if (!Array.isArray(ALLOWED_MEMBER_IDS) || !ALLOWED_MEMBER_IDS.every(id => typeof id === 'string' || typeof id === 'number')) {
      throw new Error("DISCORD_MEMBERS_ID must be an array of strings or numbers.");
    }
    // Ensure all IDs are strings for consistent comparison
    ALLOWED_MEMBER_IDS = ALLOWED_MEMBER_IDS.map(id => String(id));
  } catch (e) {
    console.error("Failed to parse DISCORD_MEMBERS_ID. Ensure it is a valid JSON array string (e.g., [\"id1\", \"id2\"])", e);
    throw new Error("Invalid format for DISCORD_MEMBERS_ID. Must be a JSON array of IDs.");
  }
}

// Define NextAuth options
const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: DISCORD_CLIENT_ID,
      clientSecret: DISCORD_CLIENT_SECRET,
      authorization: { params: { scope: "identify guilds" } },
    }),
    // Add other providers here if needed
  ],
  callbacks: {
    // Add types for parameters: User, Account, Profile (optional)
    async signIn({ user, account, profile: _profile }: { user: User, account: Account | null, profile?: Profile | undefined }) {
      if (account?.provider === "discord" && account.access_token && user?.id) { // Ensure user.id is present
        console.log("Attempting Discord sign-in for user:", user.name, user.id);
        console.log("Current ALLOWED_MEMBER_IDS:", ALLOWED_MEMBER_IDS);
        try {
          // Step 1: Fetch user's guilds
          console.log("Checking user guilds...");
          const guildsResponse = await fetch('https://discord.com/api/v10/users/@me/guilds', { // Use v10
            headers: {
              Authorization: `Bearer ${account.access_token}`,
            },
          });

          if (!guildsResponse.ok) {
            const errorText = await guildsResponse.text();
            console.error(`Failed to fetch Discord guilds (${guildsResponse.status}):`, errorText);
            return false; 
          }

          const guilds: DiscordGuild[] = await guildsResponse.json();
          
          // Step 2: Check if the user is a member of the target guild
          const isMemberOfTargetGuild = guilds.some(guild => guild.id === TARGET_GUILD_ID);

          if (!isMemberOfTargetGuild) {
            console.log(`User ${user.id} (${user.name}) is NOT a member of target guild ${TARGET_GUILD_ID}. Denying sign in.`);
            return false;
          }
          
          console.log(`User ${user.id} (${user.name}) is a member of target guild ${TARGET_GUILD_ID}. Proceeding to member ID check.`);

          // Step 3: Check if the user's ID is in the allowed list
          if (ALLOWED_MEMBER_IDS.includes(user.id)) {
            console.log(`User ${user.id} (${user.name}) is in the allowed members list. Allowing sign in.`);
            return true;
          } else {
            console.log(`User ${user.id} (${user.name}) is NOT in the allowed members list. Denying sign in.`);
            return false;
          }
        } catch (error) {
          console.error("Error during signIn callback (guild/member check):", error);
          return false; 
        }
      }
      // If not Discord provider or some preliminary issue, default to deny.
      console.log(`Sign-in attempt not processed by Discord check (provider: ${account?.provider}). Denying.`);
      return false; 
    },
    // Other callbacks (jwt, session) would go here
  },
  session: {
    strategy: "jwt", // Explicitly state JWT strategy
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
  }
  // Other NextAuth config options (pages, secret, etc.) would go here
};

// Initialize NextAuth
const handler = NextAuth(authOptions);

// Explicitly export the GET and POST handlers for the route
export { handler as GET, handler as POST }; 