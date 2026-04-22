import { getTranslations } from "next-intl/server";
import PageShell from "@/components/layout/PageShell";

export default async function ContactPage() {
  const t = await getTranslations("about");

  return (
    <PageShell>
      <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full">
        <h1 className="text-2xl font-semibold text-slate-100">{t("contact.heading")}</h1>
        <div className="overflow-hidden rounded-lg border border-slate-700/50 bg-slate-900 flex justify-center">
          <iframe
            src="https://docs.google.com/forms/d/e/1FAIpQLScq705jF7sNixkFLQTmJxg1eyNFgNIqLRHrm-za5KIDaMvLOA/viewform?embedded=true"
            width="640"
            height="1000"
            frameBorder={0}
            marginHeight={0}
            marginWidth={0}
            className="block"
          >
            로드 중…
          </iframe>
        </div>
      </div>
    </PageShell>
  );
}
