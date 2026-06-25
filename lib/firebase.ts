// Dummy Firebase mock to allow legacy code to compile without Firebase SDKs
export const db = {};
export const auth = {};
export const collection = (...args: any[]) => ({});
export const doc = (...args: any[]) => ({});
export const getDoc = async (...args: any[]) => ({ exists: () => false, data: () => ({}) });
export const getDocs = async (...args: any[]) => ({ docs: [], empty: true });
export const query = (...args: any[]) => ({});
export const where = (...args: any[]) => ({});
export const addDoc = async (...args: any[]) => ({ id: 'mock-id' });
export const updateDoc = async (...args: any[]) => {};
export const deleteDoc = async (...args: any[]) => {};
export const setDoc = async (...args: any[]) => {};
export const serverTimestamp = (...args: any[]) => new Date();
export const arrayUnion = (...args: any[]) => [args[0]];
export const onAuthStateChanged = (...args: any[]) => () => {};
