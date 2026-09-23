"use client";

import {
  ArrowDown,
  ArrowUp,
  FileBarChart,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import PersianDateSelect from "./PersianDateSelect";

type Snapshot = {
  id: string;
  snapshotDate: string;
  reach: number | null;
  views: number | null;
  accountsEngaged: number | null;
  totalInteractions: number | null;
  follows: number | null;
  unfollows: number | null;
  profileLinksTaps: number | null;
  followerCount: number | null;
};

type Account = {
  id: string;
  igUserId: string;
  username: string;
  isConnected: boolean;
};

type Data = {
  success: boolean;
  account: Account;
  snapshots: Snapshot[];
};

type MetricKey = "reach" | "accountsEngaged" | "follows" | "unfollows" | "profileLinksTaps";

const metrics: Array<{ key: MetricKey; label: string }> = [
  { key: "reach", label: "دسترسی" },
  { key: "accountsEngaged", label: "اکانت‌های درگیر" },
  { key: "follows", label: "فالو جدید" },
  { key: "unfollows", label: "آنفالو" },
  { key: "profileLinksTaps", label: "کلیک لینک پروفایل" },
];
