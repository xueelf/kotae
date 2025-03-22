import { nextTick } from './util';

export interface Observer<T> {
  next: (value: T) => void;
  error: (err: unknown) => void;
  complete: () => void;
}

export interface Unsubscribable {
  unsubscribe(): void;
}

export interface Subscribable<T> {
  subscribe(observer: Partial<Observer<T>>): Unsubscribable;
}

export interface SubscriptionLike extends Unsubscribable {
  closed: boolean;
}

export type TeardownLogic = (() => void) | void;

export class Subscription implements SubscriptionLike {
  #finalizers: Set<TeardownLogic> = new Set();
  closed: boolean = false;

  constructor() {}

  unsubscribe(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    nextTick(() => {
      this.#finalizers.forEach(finalizer => finalizer?.());
    });
  }

  add(teardown: TeardownLogic): void {
    this.#finalizers.add(teardown);
  }

  remove(teardown: TeardownLogic): void {
    this.#finalizers.delete(teardown);
  }
}

export class Subscriber<T> extends Subscription implements Observer<T> {
  #destination: Partial<Observer<T>> = {};
  #generator: Generator<void, void, T> = function* (this: Subscriber<T>) {
    try {
      while (true) {
        const value: T = yield;
        this.#destination?.next?.(value);
      }
    } finally {
      this.#isStopped = true;
    }
  }.call(this);
  #isStopped: boolean = false;

  constructor(destination?: Partial<Observer<T>> | Observer<T>['next']) {
    super();

    Object.assign(
      this.#destination,
      typeof destination === 'function' ? { next: destination } : destination,
    );
    this.#generator.next();
  }

  next(value: T): void {
    this.#generator.next(value);
  }

  error(err?: unknown): void {
    if (this.#isStopped) {
      return;
    }

    try {
      this.#destination?.error?.(err);
    } finally {
      this.unsubscribe();
    }
  }

  complete(): void {
    if (this.#isStopped) {
      return;
    }

    try {
      this.#destination?.complete?.();
    } finally {
      this.unsubscribe();
    }
  }

  unsubscribe(): void {
    if (this.closed) {
      return;
    }
    this.#generator.return();
    super.unsubscribe();
  }
}

export class Observable<T> implements Subscribable<T> {
  #subscribe?: (subscriber: Subscriber<T>) => TeardownLogic;

  constructor(subscribe?: (subscriber: Subscriber<T>) => TeardownLogic) {
    this.#subscribe = subscribe;
  }

  #trySubscribe(sink: Subscriber<T>): TeardownLogic {
    try {
      return this.#subscribe?.(sink);
    } catch (err) {
      sink.error(err);
    }
  }

  subscribe(observerOrNext?: Partial<Observer<T>> | Observer<T>['next']): Subscription {
    const subscriber: Subscriber<T> =
      observerOrNext instanceof Subscriber ? observerOrNext : new Subscriber(observerOrNext);

    subscriber.add(this.#trySubscribe(subscriber));
    return subscriber;
  }
}
