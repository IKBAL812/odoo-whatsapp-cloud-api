import { useContext } from "react";
import { TabSyncContext } from "@/app/context/tab-sync-provider";

export const useTabSync = () => {
  const context = useContext(TabSyncContext);
  if (!context) {
    throw new Error("useTabSync must be used within a TabSyncProvider");
  }
  return context;
};
