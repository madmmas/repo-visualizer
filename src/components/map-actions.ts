import { createContext, useContext } from "react";

export type MapActions = {
  openNode: (path: string) => void;
  closeNode: (path: string) => void;
  selectFile: (path: string) => void;
  setWindow: (path: string, start: number) => void;
};

export const MapActionsContext = createContext<MapActions | null>(null);

export function useMapActions(): MapActions {
  const actions = useContext(MapActionsContext);
  if (!actions) throw new Error("Map actions are missing");
  return actions;
}
