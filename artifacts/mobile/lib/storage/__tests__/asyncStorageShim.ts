/** Node runner only: AsyncStorage's native backend is absent. */
const values = new Map<string, string>();
export default {
  async getItem(key: string) { return values.get(key) ?? null; },
  async setItem(key: string, value: string) { values.set(key, value); },
  async removeItem(key: string) { values.delete(key); },
  async multiRemove(keys: string[]) { for (const key of keys) values.delete(key); },
  async getAllKeys() { return [...values.keys()]; },
};
