import Redis from "ioredis";
import type { RedisClientLike } from "../types";

export class NativeRedisAdapter implements RedisClientLike {
  constructor(private readonly client: Redis) {}
  async get<T = unknown>(key: string) {
    const raw = await this.client.get(key);
    if (raw === null) return null;
    try { return JSON.parse(raw) as T; } catch { return raw as T; }
  }
  async set<T = unknown>(key: string, value: T, options?: any) {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    const args: string[] = [];
    if (options?.nx) args.push("NX");
    if (options?.xx) args.push("XX");
    if (options?.ex !== undefined) args.push("EX", String(options.ex));
    if (options?.px !== undefined) args.push("PX", String(options.px));
    return this.client.set(key, serialized, ...args as any);
  }
  del(...keys: string[]) { return this.client.del(...keys); }
  exists(...keys: string[]) { return this.client.exists(...keys); }
  expire(key: string, seconds: number) { return this.client.expire(key, seconds); }
  ttl(key: string) { return this.client.ttl(key); }
  zcard(key: string) { return this.client.zcard(key); }
  zrem(key: string, ...members: string[]) { return this.client.zrem(key, ...members); }
  async zadd(key: string, ...args: any[]) {
    if (args.length === 1 && args[0] && typeof args[0] === "object" && !Array.isArray(args[0])) {
      const entry = args[0];
      return this.client.zadd(key, String(entry.score), entry.member);
    }
    return (this.client as any).zadd(key, ...args);
  }
  async zrange<T = string[]>(key: string, min: number, max: number, options?: any) {
    if (options?.byScore) {
      return this.client.zrangebyscore(
        key, min, max,
        ...(options.offset !== undefined && options.count !== undefined ? ["LIMIT", options.offset, options.count] : []),
      ) as unknown as T;
    }
    return this.client.zrange(key, min, max) as unknown as T;
  }
  scan(cursor: string, options?: any) {
    return this.client.scan(cursor, ...(options?.match ? ["MATCH", options.match] : []), ...(options?.count ? ["COUNT", String(options.count)] : [])) as Promise<[string, string[]]>;
  }
  eval<T = unknown>(script: string, keys: string[], args: string[]) {
    return this.client.eval(script, keys.length, ...keys, ...args) as unknown as Promise<T>;
  }
  ping() { return this.client.ping(); }
  async disconnect() { this.client.disconnect(); }
}
