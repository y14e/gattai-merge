export type RefState = { wasReferenced: boolean };

export class Refs extends WeakMap<object, object> {
  #states = new WeakMap<object, RefState>();

  override get(key: object): object | undefined {
    const state = this.#states.get(key);
    const value = super.get(key);

    if (state && value !== undefined) {
      state.wasReferenced = true;
    }

    return value;
  }

  resolve(key: object, value: object): void {
    this.#states.delete(key);
    super.set(key, value);
  }

  register(key: object, value: object): RefState {
    const state = { wasReferenced: false };
    super.set(key, value);
    this.#states.set(key, state);
    return state;
  }
}
