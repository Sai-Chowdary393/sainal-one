"use client";

import {
  useContext,
} from "react";

import {
  AccessContext,
} from "../components/access/AccessProvider";

export default function useAccess() {
  const context =
    useContext(AccessContext);

  if (!context) {
    throw new Error(
      "useAccess must be used inside AccessProvider."
    );
  }

  return context;
}
