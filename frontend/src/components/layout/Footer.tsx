import { useTranslations } from "next-intl";

export default function Footer() {
  const t = useTranslations("common");

  return (
    <footer className="border-t border-slate-700/50 bg-slate-950 py-3">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col items-center gap-2">
        <p className="text-sm font-bold text-slate-300">{t("footer.copyright")}</p>
        <p className="text-sm text-blue-400 flex items-center gap-2 flex-wrap justify-center">
          <span>{t("footer.supportText")}</span>
          <a
            href="https://ctee.kr/place/wikihoney"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-blue-700 px-2.5 py-0.5 text-blue-400 hover:text-blue-200 hover:border-blue-500 transition-colors"
          >
            {t("footer.supportKr")}
          </a>
          <a
            href="https://ko-fi.com/wikihoney"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-blue-700 px-2.5 py-0.5 text-blue-400 hover:text-blue-200 hover:border-blue-500 transition-colors"
          >
            {t("footer.supportGlobal")}
          </a>
        </p>
      </div>
    </footer>
  );
}
