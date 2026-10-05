"use client";

import {
  resolveResponseSurface,
  type ResponseSurfaceFilter,
  type ResponseSurfaceResolution,
} from "@/lib/response-model/surfaces";

import { useResponseModel } from "./useResponseModel";

export function useResponseSurfaceResolution(
  filter: ResponseSurfaceFilter = {},
): ResponseSurfaceResolution {
  const { model } = useResponseModel();
  return resolveResponseSurface(model, filter);
}
