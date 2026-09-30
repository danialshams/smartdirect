"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Col, Row, Skeleton, Statistic } from "antd";
import Title from "antd/es/typography/Title";
import Text from "antd/es/typography/Text";
import { BadgePercent, Camera, Headphones, UserRound, Users } from "lucide-react";

type Stats = { users: number; pages: number; activeSubscriptions: number; expiredSubscriptions: number; openTickets: number };

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/stats", { cache: "no-store" })
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.message); return j; })
      .then(setStats)
      .catch(e => setError(e.message || "خطا در دریافت اطلاعات"));
  }, []);

  const cards = stats ? [
    { title: "کاربران", value: stats.users, icon: UserRound, href: "/rickandmorty/users", className: "text-[#2563EB]" },
    { title: "پیج‌های متصل", value: stats.pages, icon: Camera, href: "/rickandmorty/users", className: "text-[#0F172A]" },
    { title: "اشتراک فعال", value: stats.activeSubscriptions, icon: Users, href: "/rickandmorty/users", className: "text-[#16A34A]" },
    { title: "تیکت‌های باز", value: stats.openTickets, icon: Headphones, href: "/rickandmorty/tickets", className: "text-[#D97706]" },
  ] : [];

  return (
    <div className="space-y-5">
      <div>
        <Title level={3} className="!mb-1 !text-[22px] sm:!text-2xl">داشبورد</Title>
        <Text className="!text-[#64748B]">نمای کلی وضعیت کاربران، اشتراک‌ها و پشتیبانی</Text>
      </div>
      {error ? <Card className="!border-red-200 !bg-red-50"><Text type="danger">{error}</Text></Card> : null}
      <Row gutter={[16, 16]}>
        {stats ? cards.map(card => {
          const Icon = card.icon;
          return <Col xs={24} sm={12} xl={6} key={card.title}>
            <Link href={card.href}>
              <Card hoverable className="h-full !border-[#E2E8F0] !shadow-none transition-all duration-200 hover:!-translate-y-0.5 hover:!shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-[#F8FAFC]"><Icon size={20} className={card.className} /></div>
                  <span className="text-xs text-[#64748B]">{card.title}</span>
                </div>
                <Statistic value={card.value} valueStyle={{ fontSize: 28, fontWeight: 700, color: "#0F172A" }} />
              </Card>
            </Link>
          </Col>;
        }) : Array.from({ length: 4 }).map((_, i) => <Col xs={24} sm={12} xl={6} key={i}><Card><Skeleton active paragraph={{ rows: 2 }} /></Card></Col>)}
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="وضعیت اشتراک" className="!border-[#E2E8F0] !shadow-none">
            {stats ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-[#F8FAFC] p-4"><div className="text-xs text-[#64748B]">فعال</div><div className="mt-1 text-2xl font-bold text-[#16A34A]">{stats.activeSubscriptions}</div></div>
              <div className="rounded-xl bg-[#F8FAFC] p-4"><div className="text-xs text-[#64748B]">منقضی</div><div className="mt-1 text-2xl font-bold text-[#DC2626]">{stats.expiredSubscriptions}</div></div>
              <div className="col-span-2 rounded-xl bg-[#F8FAFC] p-4 sm:col-span-1"><div className="text-xs text-[#64748B]">پیج‌های متصل</div><div className="mt-1 text-2xl font-bold text-[#0F172A]">{stats.pages}</div></div>
            </div> : <Skeleton active paragraph={{ rows: 4 }} />}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="دسترسی سریع" className="!border-[#E2E8F0] !shadow-none">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <Link href="/rickandmorty/users" className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] p-3 transition-colors hover:border-[#BFDBFE] hover:bg-[#F8FAFC]"><UserRound size={18} className="text-[#2563EB]" /><span className="text-sm">مدیریت کاربران</span></Link>
              <Link href="/rickandmorty/tickets" className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] p-3 transition-colors hover:border-[#BFDBFE] hover:bg-[#F8FAFC]"><Headphones size={18} className="text-[#D97706]" /><span className="text-sm">مدیریت تیکت‌ها</span></Link>
              <Link href="/rickandmorty/coupons" className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] p-3 transition-colors hover:border-[#BFDBFE] hover:bg-[#F8FAFC]"><BadgePercent size={18} className="text-[#16A34A]" /><span className="text-sm">مدیریت کدهای تخفیف</span></Link>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
