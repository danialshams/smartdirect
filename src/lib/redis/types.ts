export type RedisSetOptions = {
  ex?: number;
  px?: number;
  nx?: boolean;
  xx?: boolean;
};

export type RedisZRangeOptions = {
  byScore?: boolean;
  offset?: number;
  count?: number;
};

export interface RedisPipelineLike {
  get<T = unknown>(key: string): RedisPipelineLike;
  del(...keys: string[]): RedisPipelineLike;
  zrem(key: string, ...members: string[]): RedisPipelineLike;
  exec<T = unknown>(): Promise<T[]>;
}

export interface RedisClientLike {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, options?: RedisSetOptions): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  exists(...keys: string[]): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  zcard(key: string): Promise<number>;
  zrem(key: string, ...members: string[]): Promise<number>;
  zadd(key: string, ...args: any[]): Promise<number>;
  zrange<T = string[]>(key: string, min: number, max: number, options?: RedisZRangeOptions): Promise<T>;
  lpush(key: string, ...values: string[]): Promise<number>;
  ltrim(key: string, start: number, stop: number): Promise<string>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  incr(key: string): Promise<number>;
  pipeline(): RedisPipelineLike;
  scan(cursor: string | number, options?: { match?: string; count?: number }): Promise<[string, string[]]>;
  eval<T = unknown>(script: string, keys: string[], args: string[]): Promise<T>;
  ping(): Promise<string>;
  disconnect(): Promise<void>;
}
