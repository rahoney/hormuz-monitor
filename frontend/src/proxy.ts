import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // next-intl 라우트 매칭: 정적 자산, API 경로 제외
  matcher: [
    "/",
    "/(ar|de|en|es|fa|fr|it|ja|ko|pt-BR|ru|tr|zh-CN|zh-TW)/:path*",
  ],
};
