import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Signal {
    name: string;
    status: "pass" | "warn" | "fail";
    score: number;
    weight: number;
    details: string;
}

interface SignalCardsProps {
    signals: Signal[];
}

const statusConfig = {
    pass: {
        variant: "default" as const,
        label: "Pass",
        className: "bg-green-500/10 text-green-600 hover:bg-green-500/20",
    },
    warn: {
        variant: "secondary" as const,
        label: "Warn",
        className: "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20",
    },
    fail: {
        variant: "destructive" as const,
        label: "Fail",
        className: "bg-red-500/10 text-red-600 hover:bg-red-500/20",
    },
};

/**
 * Display the 5 signal breakdown as cards
 */
export function SignalCards({ signals }: SignalCardsProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {signals.map((signal) => {
                const config = statusConfig[signal.status];
                return (
                    <Card key={signal.name} className="relative overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium capitalize">
                                {signal.name}
                            </CardTitle>
                            <Badge className={config.className}>{config.label}</Badge>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{signal.score}</div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {signal.details}
                            </p>
                            <div className="mt-2 text-xs text-muted-foreground">
                                Weight: {signal.weight}%
                            </div>
                        </CardContent>
                        {/* Colored indicator bar */}
                        <div
                            className={`absolute bottom-0 left-0 right-0 h-1 ${signal.status === "pass"
                                    ? "bg-green-500"
                                    : signal.status === "warn"
                                        ? "bg-yellow-500"
                                        : "bg-red-500"
                                }`}
                        />
                    </Card>
                );
            })}
        </div>
    );
}
