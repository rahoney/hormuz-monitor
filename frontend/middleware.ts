import createMiddleware from "next-intl/middleware";
import { routing } from "./src/i18n/routing";

export default createMiddleware(routing);

export const config = {
  // next-intl이 처리할 경로 패턴
  // 정적 파일, API, _next 내부 경로는 제외
  matcher: [
    "/",
    "/(ar|de|en|es|fa|fr|it|ja|ko|pt-BR|ru|tr|zh-CN|zh-TW)/:path*",
  ],
};
