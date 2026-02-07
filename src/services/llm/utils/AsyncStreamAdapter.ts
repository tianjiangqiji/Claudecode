/**
 * AsyncStreamAdapter - 异步流适配器
 *
 * 将推送式数据源转为 AsyncIterable，供 Provider 统一使用
 */

export class AsyncStreamAdapter<T> implements AsyncIterable<T> {
    private queue: T[] = [];
    private resolve?: (value: IteratorResult<T>) => void;
    private isDone = false;
    private error?: Error;

    enqueue(item: T): void {
        if (this.isDone) return;

        if (this.resolve) {
            const resolve = this.resolve;
            this.resolve = undefined;
            resolve({ value: item, done: false });
        } else {
            this.queue.push(item);
        }
    }

    done(): void {
        if (this.isDone) return;
        this.isDone = true;

        if (this.resolve) {
            const resolve = this.resolve;
            this.resolve = undefined;
            resolve({ value: undefined as any, done: true });
        }
    }

    fail(err: Error): void {
        this.error = err;
        this.done();
    }

    [Symbol.asyncIterator](): AsyncIterator<T> {
        return {
            next: (): Promise<IteratorResult<T>> => {
                if (this.error) {
                    return Promise.reject(this.error);
                }

                if (this.queue.length > 0) {
                    return Promise.resolve({
                        value: this.queue.shift()!,
                        done: false,
                    });
                }

                if (this.isDone) {
                    return Promise.resolve({
                        value: undefined as any,
                        done: true,
                    });
                }

                return new Promise<IteratorResult<T>>((resolve) => {
                    this.resolve = resolve;
                });
            },
        };
    }
}
