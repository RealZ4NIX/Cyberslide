/* CYBERSLIDE - secret codes: watches a stream of inputs (typed letters or controller buttons) for a fixed sequence */

export interface SecretCode {
  /** feed one input; returns true on the input that completes the sequence */
  push(token: string, now: number): boolean;
  reset(): void;
}

/**
 * Matches `seq` against the most recent inputs. A gap longer than `gapMs` between two inputs starts over,
 * so a stray key pressed minutes ago can't count toward the code. A wrong input doesn't throw away a
 * prefix that is still valid (typing "sskelly" or pressing up up up down down still works).
 */
export function secretCode(seq: readonly string[], gapMs = 1500): SecretCode {
  let got: string[] = [];
  let lastT = -Infinity;
  return {
    push(token, now) {
      if (now - lastT > gapMs) got = [];
      lastT = now;
      got.push(token);
      if (got.length > seq.length) got = got.slice(got.length - seq.length);
      // keep the longest tail of what we've seen that is still a start of the sequence
      while (got.length && !got.every((t, i) => t === seq[i])) got = got.slice(1);
      if (got.length === seq.length) {
        got = [];
        return true;
      }
      return false;
    },
    reset() {
      got = [];
      lastT = -Infinity;
    },
  };
}
