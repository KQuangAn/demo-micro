import { ICacheProvider } from '../../domain/services';

export class InMemoryCacheProvider implements ICacheProvider {
    private cache = new Map<string, { value: any; expiresAt?: number }>();

    get<T>(key: string): Promise<T | undefined> {
        const entry = this.cache.get(key);
        if (!entry) return Promise.resolve(undefined);
        if (entry.expiresAt && entry.expiresAt < Date.now()) {
            this.cache.delete(key);
            return Promise.resolve(undefined);
        }
        return Promise.resolve(entry.value as T);
    }

    set<T>(key: string, value: T, ttl?: number): Promise<void> {
        const expiresAt = ttl ? Date.now() + ttl * 1000 : undefined;
        this.cache.set(key, { value, expiresAt });
        return Promise.resolve();
    }

    remove(key: string): Promise<void> {
        this.cache.delete(key);
        return Promise.resolve();
    }
}

export class CachingService {
    constructor(private readonly cacheProvider: ICacheProvider) {}

    async getCached<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T> {
        const cached = await this.cacheProvider.get<T>(key);
        if (cached !== undefined) return cached;
        const value = await fetcher();
        await this.cacheProvider.set(key, value, ttl);
        return value;
    }

    async invalidate(key: string): Promise<void> {
        await this.cacheProvider.remove(key);
    }
}