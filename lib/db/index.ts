/**
 * Database client - now uses PGlite with IndexedDB for pure frontend operation
 */

// Always use PGlite in the new frontend-only architecture
export { db, getDb, getPGliteClient, clearDatabase, exportDatabase, importDatabase } from './pglite-client'; 