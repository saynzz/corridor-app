"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { useI18n } from "./i18n";

const ITEMS = [
  { href: "/", key: "nav.home", icon: "home" },
  { href: "/agent", key: "nav.agent", icon: "chat" },
  { href: "/rates", key: "nav.rates", icon: "rates" },
  { href: "/shield", key: "nav.shield", icon: "shield" },
];

export function Nav() {
  const path = usePathname();
  const { t } = useI18n();
  return (
    <nav className="nav" aria-label="Main">
      {ITEMS.map((it) => {
        const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
            <Icon name={it.icon} size={20} />
            {t(it.key)}
          </Link>
        );
      })}
    </nav>
  );
}
