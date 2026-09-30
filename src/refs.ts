export type RefState = { referenced: boolean };

export class Refs extends WeakMap<object, unknown> {
  #states = new WeakMap<object, RefState>();

  override get(key: object): unknown {
    const state = this.#states.get(key);
    const value = super.get(key);

    if (state && value !== undefined) {
      state.referenced = true;
    }

    return value;
  }

  resolve(key: object, value: unknown): void {
    this.#states.delete(key);
    super.set(key, value);
  }

  setPlaceholder(key: object, value: unknown): RefState {
    const state = { referenced: false };
    super.set(key, value);
    this.#states.set(key, state);
    return state;
  }
}
