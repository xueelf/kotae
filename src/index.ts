export interface Observer<T> {
  next: (value: T) => void;
  error: (err: any) => void;
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

    Promise.resolve().then(() => {
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

export interface SubscriberOverrides<T> extends Partial<Observer<T>> {
  finalize?: () => void;
}

export class Subscriber<T> extends Subscription implements Observer<T> {
  #next?: ((value: T) => void) | null;
  #error?: ((err: any) => void) | null;
  #complete?: (() => void) | null;
  #onFinalize?: (() => void) | null;

  #destination: Partial<Observer<T>> = {};
  #generator: Generator<void, void, T> = function* (
    this: Subscriber<T>,
  ): Generator<undefined, undefined, T> {
    try {
      while (true) {
        const value: T = yield;
        this.#next?.(value);
      }
    } finally {
      this.#isStopped = true;
    }
  }.call(this);
  #isStopped: boolean = false;

  constructor(destination?: Subscriber<T> | Partial<Observer<T>> | ((value: T) => void) | null);
  constructor(
    destination: Subscriber<any> | Partial<Observer<any>> | Observer<any>['next'] | null,
    overrides: SubscriberOverrides<T>,
  );
  constructor(
    destination?: Subscriber<T> | Partial<Observer<T>> | Observer<T>['next'] | null,
    overrides?: SubscriberOverrides<T>,
  ) {
    super();

    Object.assign(
      this.#destination,
      typeof destination === 'function' ? { next: destination } : destination,
    );
    this.#generator.next();

    this.#next = overrides?.next ?? this.#destination.next ?? null;
    this.#error = overrides?.error ?? this.#destination.error ?? null;
    this.#complete = overrides?.complete ?? this.#destination.complete ?? null;
    this.#onFinalize = overrides?.finalize ?? null;
  }

  next(value: T): void {
    this.#generator.next(value);
  }

  error(err?: any): void {
    if (this.#isStopped) {
      return;
    }
    try {
      this.#error?.(err);
    } finally {
      this.unsubscribe();
    }
  }

  complete(): void {
    if (this.#isStopped) {
      return;
    }
    try {
      this.#complete?.();
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
    this.#onFinalize?.();
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

  forEach(next: (value: T) => void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const subscriber = new Subscriber({
        next: (value: T) => {
          try {
            next(value);
          } catch (err) {
            reject(err);
            subscriber.unsubscribe();
          }
        },
        error: reject,
        complete: resolve,
      });
      this.subscribe(subscriber);
    });
  }

  pipe(): Observable<T>;
  pipe<A>(op1: UnaryFunction<Observable<T>, A>): A;
  pipe<A, B>(op1: UnaryFunction<Observable<T>, A>, op2: UnaryFunction<A, B>): B;
  pipe<A, B, C>(
    op1: UnaryFunction<Observable<T>, A>,
    op2: UnaryFunction<A, B>,
    op3: UnaryFunction<B, C>,
  ): C;
  pipe<A, B, C, D>(
    op1: UnaryFunction<Observable<T>, A>,
    op2: UnaryFunction<A, B>,
    op3: UnaryFunction<B, C>,
    op4: UnaryFunction<C, D>,
  ): D;
  pipe<A, B, C, D, E>(
    op1: UnaryFunction<Observable<T>, A>,
    op2: UnaryFunction<A, B>,
    op3: UnaryFunction<B, C>,
    op4: UnaryFunction<C, D>,
    op5: UnaryFunction<D, E>,
  ): E;
  pipe<A, B, C, D, E, F>(
    op1: UnaryFunction<Observable<T>, A>,
    op2: UnaryFunction<A, B>,
    op3: UnaryFunction<B, C>,
    op4: UnaryFunction<C, D>,
    op5: UnaryFunction<D, E>,
    op6: UnaryFunction<E, F>,
  ): F;
  pipe<A, B, C, D, E, F, G>(
    op1: UnaryFunction<Observable<T>, A>,
    op2: UnaryFunction<A, B>,
    op3: UnaryFunction<B, C>,
    op4: UnaryFunction<C, D>,
    op5: UnaryFunction<D, E>,
    op6: UnaryFunction<E, F>,
    op7: UnaryFunction<F, G>,
  ): G;
  pipe<A, B, C, D, E, F, G, H>(
    op1: UnaryFunction<Observable<T>, A>,
    op2: UnaryFunction<A, B>,
    op3: UnaryFunction<B, C>,
    op4: UnaryFunction<C, D>,
    op5: UnaryFunction<D, E>,
    op6: UnaryFunction<E, F>,
    op7: UnaryFunction<F, G>,
    op8: UnaryFunction<G, H>,
  ): H;
  pipe<A, B, C, D, E, F, G, H, I>(
    op1: UnaryFunction<Observable<T>, A>,
    op2: UnaryFunction<A, B>,
    op3: UnaryFunction<B, C>,
    op4: UnaryFunction<C, D>,
    op5: UnaryFunction<D, E>,
    op6: UnaryFunction<E, F>,
    op7: UnaryFunction<F, G>,
    op8: UnaryFunction<G, H>,
    op9: UnaryFunction<H, I>,
  ): I;
  pipe<A, B, C, D, E, F, G, H, I>(
    op1: UnaryFunction<Observable<T>, A>,
    op2: UnaryFunction<A, B>,
    op3: UnaryFunction<B, C>,
    op4: UnaryFunction<C, D>,
    op5: UnaryFunction<D, E>,
    op6: UnaryFunction<E, F>,
    op7: UnaryFunction<F, G>,
    op8: UnaryFunction<G, H>,
    op9: UnaryFunction<H, I>,
    ...operations: OperatorFunction<any, any>[]
  ): Observable<unknown>;
  pipe<A, B, C, D, E, F, G, H, I>(
    op1: UnaryFunction<Observable<T>, A>,
    op2: UnaryFunction<A, B>,
    op3: UnaryFunction<B, C>,
    op4: UnaryFunction<C, D>,
    op5: UnaryFunction<D, E>,
    op6: UnaryFunction<E, F>,
    op7: UnaryFunction<F, G>,
    op8: UnaryFunction<G, H>,
    op9: UnaryFunction<H, I>,
    ...operations: UnaryFunction<any, any>[]
  ): unknown;
  pipe(...operations: UnaryFunction<any, any>[]): unknown {
    return operations.reduce(pipeReducer, this);
  }
}

export interface OperateConfig<In, Out> extends SubscriberOverrides<In> {
  destination: Subscriber<Out>;
}

export function operate<In, Out>({
  destination,
  ...subscriberOverrides
}: OperateConfig<In, Out>): Subscriber<In> {
  return new Subscriber(destination, subscriberOverrides);
}

function pipeReducer(prev: any, fn: UnaryFunction<any, any>): any {
  return fn(prev);
}

export interface UnaryFunction<T, R> {
  (source: T): R;
}
export interface OperatorFunction<T, R> extends UnaryFunction<Observable<T>, Observable<R>> {}

// https://github.com/ReactiveX/rxjs/blob/master/packages/rxjs/src/internal/operators/map.ts
export function map<T, R>(project: (value: T, index: number) => R): OperatorFunction<T, R> {
  return source =>
    new Observable(destination => {
      let index = 0;

      source.subscribe(
        operate({
          destination,
          next: (value: T) => {
            destination.next(project(value, index++));
          },
        }),
      );
    });
}

export interface MonoTypeOperatorFunction<T> extends OperatorFunction<T, T> {}

// https://github.com/ReactiveX/rxjs/blob/master/packages/rxjs/src/internal/operators/filter.ts
export function filter<T>(
  predicate: (value: T, index: number) => boolean,
  thisArg?: any,
): MonoTypeOperatorFunction<T> {
  return source =>
    new Observable(destination => {
      let index = 0;

      source.subscribe(
        operate({
          destination,
          next: value => predicate.call(thisArg, value, index++) && destination.next(value),
        }),
      );
    });
}
