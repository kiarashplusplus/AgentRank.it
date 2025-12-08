declare module "robots-parser" {
    interface RobotsParser {
        isAllowed(url: string, userAgent?: string): boolean | undefined;
        isDisallowed(url: string, userAgent?: string): boolean | undefined;
        getMatchingLineNumber(url: string, userAgent?: string): number;
        getCrawlDelay(userAgent?: string): number | undefined;
        getSitemaps(): string[];
        getPreferredHost(): string | undefined;
    }

    function robotsParser(url: string, robotsTxt: string): RobotsParser;

    export = robotsParser;
}
