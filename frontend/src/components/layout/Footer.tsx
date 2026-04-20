import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function Footer() {
  const t = useTranslations("common");

  return (
    <footer className="border-t border-slate-700/50 bg-slate-950 py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-slate-500">{t("footer.disclaimer")}</p>
          <nav className="flex items-center gap-4 text-xs text-slate-500">
            <Link href="/about" className="hover:text-slate-300 transition-colors">
              {t("nav.about")}
            </Link>
            <Link href="/sources" className="hover:text-slate-300 transition-colors">
              {t("nav.sources")}
            </Link>
            <a
              href="https://github.com/rahoney/hormuz-monitor"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-300 transition-colors"
            >
              GitHub
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
