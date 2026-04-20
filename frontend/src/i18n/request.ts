import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const [common, dashboard, events, about, sources] = await Promise.all([
    import(`./${locale}/common.json`),
    import(`./${locale}/dashboard.json`),
    import(`./${locale}/events.json`),
    import(`./${locale}/about.json`),
    import(`./${locale}/sources.json`),
  ]);

  return {
    locale,
    messages: {
      common: common.default,
      dashboard: dashboard.default,
      events: events.default,
      about: about.default,
      sources: sources.default,
    },
  };
});
