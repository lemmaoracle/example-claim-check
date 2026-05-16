import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { StepState } from "./types.js";

type Props = Readonly<{
  label: string;
  state: StepState;
}>;

const glyphFor = (state: StepState): React.ReactNode => {
  switch (state.status) {
    case "pending":
      return <Text color="gray">○</Text>;
    case "running":
      return (
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>
      );
    case "ok":
      return <Text color="green">✔</Text>;
    case "fail":
      return <Text color="red">✘</Text>;
    case "skipped":
      return <Text color="yellow">–</Text>;
  }
};

const colorFor = (state: StepState): string => {
  switch (state.status) {
    case "ok":
      return "green";
    case "fail":
      return "red";
    case "running":
      return "cyan";
    case "skipped":
      return "yellow";
    default:
      return "gray";
  }
};

const durationOf = (state: StepState): string => {
  if (state.startedAt === undefined || state.finishedAt === undefined) return "";
  const ms = state.finishedAt - state.startedAt;
  if (ms < 1000) return ` (${String(ms)}ms)`;
  return ` (${(ms / 1000).toFixed(1)}s)`;
};

export const StepIndicator: React.FC<Props> = ({ label, state }) => (
  <Box flexDirection="row">
    <Box width={2}>{glyphFor(state)}</Box>
    <Box width={14}>
      <Text bold color={colorFor(state)}>
        {label}
      </Text>
    </Box>
    <Text color={colorFor(state)}>
      {state.message}
      {durationOf(state)}
    </Text>
  </Box>
);
