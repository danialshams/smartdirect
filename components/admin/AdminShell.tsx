"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, Button, Drawer, Layout, Menu, Space, Typography } from "antd";
import {
  BadgePercent,
  Headphones,
  LayoutDashboard,
  Menu as MenuIcon,
  ShieldCheck,
  Ticket,
  Users,
  X,
} from "lucide-react";

const { Header, Sider, Content } = Layout;

const items = [
  { key: "/rickandmorty", label: "داشبورد", icon: <LayoutDashboard size={18} />, exact: true },
  { key: "/rickandmorty/users", label: "کاربران", icon: <Users size={18} /> },
  { key: "/rickandmorty/tickets", label: "تیکت‌ها", icon: <Ticket size={18} /> },
  { key: "/rickandmorty/coupons", label: "کدهای تخفیف", icon: <BadgePercent size={18} /> },
];

function selectedKey(pathname: string) {
  if (pathname.startsWith("/rickandmorty/users")) return "/rickandmorty/users";
  if (pathname.startsWith("/rickandmorty/tickets")) return "/rickandmorty/tickets";
  if (pathname.startsWith("/rickandmorty/coupons")) return "/rickandmorty/coupons";
  return "/rickandmorty";
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const menu = (
    <Menu
      mode="inline"
      selectedKeys={[selectedKey(pathname)]}
      items={items}
      onClick={({ key }) => { setMobileOpen(false); router.push(key); }}
      className="!border-none !bg-transparent"
    />
  );

  return (
    <Layout className="min-h-screen bg-[#F8FAFC]">
      <Sider
        width={248}
        theme="light"
        className="!hidden border-l border-[#E2E8F0] lg:!block"
        style={{ position: "fixed", right: 0, top: 0, bottom: 0, zIndex: 30 }}
      >
        <div className="flex h-[72px] items-center gap-3 border-b border-[#E2E8F0] px-5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#2563EB] text-sm font-bold text-white">S</div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold text-[#0F172A]">SmartDirect</div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-[#64748B]">
              <ShieldCheck size={12} /> پنل مدیریت
            </div>
          </div>
        </div>
        <div className="px-3 pt-4">{menu}</div>
        <div className="absolute bottom-4 right-4 left-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
          <div className="flex items-center gap-2">
            <Avatar size={32} className="!bg-[#0F172A]">A</Avatar>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-[#0F172A]">مدیر سیستم</div>
              <div className="text-[10px] text-[#64748B]">ADMIN</div>
            </div>
          </div>
        </div>
      </Sider>

      <Layout className="!mr-0 lg:!mr-[248px]">
        <Header className="!sticky !top-0 !z-20 !h-[64px] !border-b !border-[#E2E8F0] !bg-white !px-4 shadow-[0_1px_8px_rgba(15,23,42,0.03)] sm:!px-6">
          <div className="flex h-full items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                type="text"
                icon={<MenuIcon size={20} />}
                className="!flex lg:!hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="باز کردن منو"
              />
              <div className="hidden sm:block">
                <Typography.Text className="!text-sm !font-semibold !text-[#0F172A]">
                  {pathname === "/rickandmorty" ? "داشبورد" : selectedKey(pathname).split("/").pop() === "users" ? "کاربران" : selectedKey(pathname).split("/").pop() === "tickets" ? "تیکت‌ها" : "کدهای تخفیف"}
                </Typography.Text>
              </div>
            </div>
            <Link href="/dashboard" className="flex items-center gap-2 text-xs text-[#64748B] transition-colors hover:text-[#2563EB]">
              بازگشت به پنل کاربری
            </Link>
          </div>
        </Header>

        <Content className="min-h-[calc(100vh-64px)] px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1440px] animate-[adminFade_.25s_ease-out]">{children}</div>
        </Content>
      </Layout>

      <Drawer
        title={
          <Space>
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#2563EB] text-xs font-bold text-white">S</div>
            پنل مدیریت
          </Space>
        }
        placement="right"
        width={280}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        closeIcon={<X size={18} />}
      >
        {menu}
      </Drawer>
    </Layout>
  );
}
