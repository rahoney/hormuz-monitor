import { useTranslations } from "next-intl";
import Image from "next/image";

export default function Footer() {
  const t = useTranslations("common");

  return (
    <footer className="border-t border-slate-700/50 bg-slate-950 py-3 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col items-center gap-2 relative">
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
        <div className="mt-2 sm:mt-0 sm:absolute sm:right-6 sm:top-1/2 sm:-translate-y-1/2 text-xs text-slate-500 hover:text-slate-400 transition-colors">
          <a
            href="https://www.veilplays.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 group"
          >
            <Image 
              src="/veilplays-logo.png" 
              alt="VeilPlays Logo" 
              width={16} 
              height={16} 
              className="opacity-70 group-hover:opacity-100 transition-opacity rounded-sm"
            />
            {t("footer.otherProjects")}: VeilPlays
          </a>
        </div>
      </div>
    </footer>
  );
}
