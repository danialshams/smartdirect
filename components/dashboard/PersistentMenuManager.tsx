"use client";

import EntryPointManager from "./EntryPointManager";

type InstagramAccount = {
  id: string;
  igUsername: string;
  igUserId: string;
  isConnected: boolean;
  createdAt: Date;
};

export default function PersistentMenuManager({
  accounts,
}: {
  accounts: InstagramAccount[];
}) {
  return <EntryPointManager accounts={accounts} kind="persistent-menu" />;
}
