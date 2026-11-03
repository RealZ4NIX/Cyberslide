/* The shared namespace the modules used to hang off window.ND. Each module registers what it provides here;
   typed modules also export their pieces directly, which is what tests and new code should import. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ND: Record<string, any> = {};
