export interface ISqlStatement {
  run(...params: unknown[]): { changes: number; lastInsertRowid?: number | bigint };
  get(...params: unknown[]): any;
  all(...params: unknown[]): any[];
}

export interface ISqlDatabase {
  exec(sql: string): void;
  prepare(sql: string): ISqlStatement;
  transaction<T>(fn: () => T): () => T;
  pragma(pragmaSql: string, options?: { simple?: boolean }): any;
  close(): void;
  export?(): Uint8Array;
}
