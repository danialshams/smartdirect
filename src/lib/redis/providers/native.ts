import Redis from "ioredis";
import type { RedisClientLike, RedisPipelineLike } from "../types";

class NativeRedisPipeline implements RedisPipelineLike {
  private readonly pipeline: ReturnType<Redis["pipeline"]>;

  constructor(pipeline: ReturnType<Redis["pipeline"]>) {
    this.pipeline = pipeline;
  }

  get<T = unknown>(key: string) {
    this.pipeline.get(key);
    return this;
  }

  del(...keys: string[]) {
    this.pipeline.del(...keys);
    return this;
  }

  zrem(key: string, ...members: string[]) {
    this.pipeline.zrem(key, ...members);
    return this;
  }

  async exec<T = unknown>(): Promise<T[]> {
    const results = await this.pipeline.exec();
    if (results === null) return [];
    return results.map(([error, value]) => {
      if (error) throw error;
      return value as T;
    });
  }
}

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
    return this.client.set(key, serialized, ...(args as any));
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
        key,
        min,
        max,
        ...(options.offset !== undefined && options.count !== undefined
          ? ["LIMIT", options.offset, options.count]
          : []),
      ) as unknown as T;
    }
    return (this.client as any).zrange(key, min, max) as T;
  }

  lpush(key: string, ...values: string[]) {
    return this.client.lpush(key, ...values);
  }

  ltrim(key: string, start: number, stop: number) {
    return this.client.ltrim(key, start, stop);
  }

  lrange(key: string, start: number, stop: number) {
    return this.client.lrange(key, start, stop);
  }

  incr(key: string) {
    return this.client.incr(key);
  }

  pipeline() {
    return new NativeRedisPipeline(this.client.pipeline());
  }

  scan(cursor: string | number, options?: any) {
    return this.client.scan(
      String(cursor),
      ...(options?.match ? ["MATCH", options.match] : []),
      ...(options?.count ? ["COUNT", String(options.count)] : []),
    ) as Promise<[string, string[]]>;
  }

  eval<T = unknown>(script: string, keys: string[], args: string[]) {
    return (this.client as any).eval(
      script,
      keys.length,
      ...keys,
      ...args,
    ) as Promise<T>;
  }

  ping() { return this.client.ping(); }

  async disconnect() { this.client.disconnect(); }
}
