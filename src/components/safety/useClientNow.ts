"use client";

import { useSyncExternalStore } from "react";

/* The current time, read on the client only.

   Safety surfaces reason about "today" — cycle week, overdue labs, recent
   symptoms. Reading the clock during a server render would produce a
   different tree on the client, so the server snapshot is null and callers
   render a loading state until the client value exists.

   The value is refreshed at most once a minute so repeated renders see the
   same Date object, as useSyncExternalStore requires. */

let clientNow: Date | null = null;

const subscribe = () => () => {};

function getSnapshot(): Date {
  const time = Date.now();
  if (!clientNow || time - clientNow.getTime() > 60_000) clientNow = new Date(time);
  return clientNow;
}

function getServerSnapshot(): Date | null {
  return null;
}

export function useClientNow(): Date | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
