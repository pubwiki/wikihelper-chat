/**
 * PGlite Client for Browser-based Postgres with IndexedDB persistence
 * This replaces the Neon Postgres connection with a local browser database
 */

import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from './schema';

let clientInstance: PGlite | null = null;
let dbInstance: any = null;

/**
 * Initialize PGlite with IndexedDB persistence
 */
async function initPGlite(): Promise<PGlite> {
  if (clientInstance) {
    return clientInstance;
  }

  // Create PGlite instance with IndexedDB persistence
  // The database will be stored in IndexedDB under the name 'wikihelper-chat-db'
  clientInstance = new PGlite('idb://wikihelper-chat-db');

  // Wait for the database to be ready
  await clientInstance.waitReady;

  console.log('PGlite initialized with IndexedDB persistence');

  // Run migrations to create tables if they don't exist
  await initializeTables(clientInstance);

  return clientInstance;
}

/**
 * Initialize database tables
 */
async function initializeTables(client: PGlite): Promise<void> {
  try {
    // Create chats table
    await client.exec(`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT 'New Chat',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    // Create messages table
    await client.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY NOT NULL,
        chat_id TEXT NOT NULL,
        role TEXT NOT NULL,
        parts JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      );
    `);

    // Create indexes for better query performance
    await client.exec(`
      CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
      CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
    `);

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing tables:', error);
    throw error;
  }
}

/**
 * Get the Drizzle database instance
 */
export async function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  const client = await initPGlite();
  dbInstance = drizzle(client, { schema });

  return dbInstance;
}

/**
 * Get the raw PGlite client (for direct queries if needed)
 */
export async function getPGliteClient(): Promise<PGlite> {
  return await initPGlite();
}

/**
 * Clear all data from the database (useful for testing or reset)
 */
export async function clearDatabase(): Promise<void> {
  const client = await getPGliteClient();
  await client.exec(`
    DELETE FROM messages;
    DELETE FROM chats;
  `);
  console.log('Database cleared');
}

/**
 * Export the database for backup
 */
export async function exportDatabase(): Promise<any> {
  const dbInstance = await getDb();
  const allChats = await (dbInstance.query as any).chats.findMany({
    with: {
      messages: true,
    },
  });
  return allChats;
}

/**
 * Import data to the database (for restore)
 */
export async function importDatabase(data: any[]): Promise<void> {
  const db = await getDb();
  // Implementation for importing data
  // This would need to handle the specific data structure
  console.log('Import database not yet fully implemented', data);
}

// Export a lazy db instance that initializes on first use
// This maintains compatibility with existing code
let cachedDb: any = null;

async function ensureDb() {
  if (!cachedDb) {
    cachedDb = await getDb();
  }
  return cachedDb;
}

export const db = {
  query: new Proxy({} as any, {
    get: (target, prop) => {
      return (...args: any[]) => {
        return ensureDb().then((dbInstance: any) => dbInstance.query[prop](...args));
      };
    },
  }),
  select: (...args: any[]) => {
    return ensureDb().then((dbInstance: any) => dbInstance.select(...args));
  },
  insert: (...args: any[]) => {
    return ensureDb().then((dbInstance: any) => dbInstance.insert(...args));
  },
  update: (...args: any[]) => {
    return ensureDb().then((dbInstance: any) => dbInstance.update(...args));
  },
  delete: (...args: any[]) => {
    return ensureDb().then((dbInstance: any) => dbInstance.delete(...args));
  },
};
