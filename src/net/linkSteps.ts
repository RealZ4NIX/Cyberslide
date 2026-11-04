/* CYBERSLIDE - the code-swap steps of linking up, as a pure state machine (game.ts draws them).
   Adapted from Drifta's lobby by Myrras. */

import type { Link, LinkErrorReason, LinkState } from './protocol';

export type LobbyMode = 'host' | 'join';
export type LobbyResult = { link: Link; role: 'host' | 'guest' } | null;

export type LobbyStep =
  | { k: 'creating' }
  | { k: 'invite'; invite: string; error?: string }
  | { k: 'connecting'; invite: string }
  | { k: 'paste'; error?: string }
  | { k: 'joining'; invite: string }
  | { k: 'reply'; invite: string; reply: string }
  | { k: 'failed'; error: string }
  | { k: 'open' };

export type LobbyEvent =
  | { t: 'hosted'; invite: string }
  | { t: 'joined'; reply: string }
  | { t: 'submit'; code: string }
  | { t: 'error'; reason: LinkErrorReason }
  | { t: 'link'; state: LinkState }
  | { t: 'retry' };

export function errorText(reason: LinkErrorReason, mode: LobbyMode): string {
  switch (reason) {
    case 'version':
      return 'VERSION MISMATCH - BOTH PLAYERS REFRESH THE PAGE';
    case 'bad-code':
      return "THAT CODE ISN'T VALID - COPY THE WHOLE THING";
    case 'wrong-kind':
      return mode === 'host'
        ? "THAT'S AN INVITE - PASTE YOUR FRIEND'S REPLY"
        : "THAT'S A REPLY - PASTE THE HOST'S INVITE";
    case 'timeout':
    case 'failed':
      return "COULDN'T CONNECT - TRY AGAIN. SOME NETWORKS BLOCK DIRECT CONNECTIONS";
  }
}

export const initialStep = (mode: LobbyMode): LobbyStep =>
  mode === 'host' ? { k: 'creating' } : { k: 'paste' };

const FAIL = (mode: LobbyMode): LobbyStep => ({ k: 'failed', error: errorText('failed', mode) });

export function lobbyStep(mode: LobbyMode, s: LobbyStep, e: LobbyEvent): LobbyStep {
  if (s.k === 'open') return s;
  switch (e.t) {
    case 'retry':
      return s.k === 'failed' ? initialStep(mode) : s;
    case 'hosted':
      return s.k === 'creating' ? { k: 'invite', invite: e.invite } : s;
    case 'joined':
      return s.k === 'joining' ? { k: 'reply', invite: s.invite, reply: e.reply } : s;
    case 'submit':
      if (s.k === 'invite') return { k: 'connecting', invite: s.invite };
      if (s.k === 'paste') return { k: 'joining', invite: e.code };
      return s;
    case 'error': {
      const error = errorText(e.reason, mode);
      if (s.k === 'connecting') return { k: 'invite', invite: s.invite, error };
      if (s.k === 'joining') return { k: 'paste', error };
      if (s.k === 'creating') return { k: 'failed', error };
      return s;
    }
    case 'link':
      if (s.k === 'failed') return s;
      if (e.state === 'open') return { k: 'open' };
      if (e.state === 'failed' || e.state === 'closed') return FAIL(mode);
      return s;
  }
}

/** Whether the step has an editable code box whose text is submitted. */
export const takesInput = (s: LobbyStep): boolean => s.k === 'invite' || s.k === 'paste';
