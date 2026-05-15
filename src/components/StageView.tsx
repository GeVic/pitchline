import { ExtractView } from "./ExtractView";
import { MatchView } from "./MatchView";
import { PersonasView } from "./PersonasView";
import { CreativeView } from "./CreativeView";
import { CampaignConfigView } from "./CampaignConfigView";

type StageName = "extract" | "match" | "personas" | "creative" | "config";

/**
 * Dispatcher: pick the right readable view for a given stage. Falls back to
 * a JSON dump if the stage name is unknown or the parsed output doesn't
 * match the expected shape.
 */
export function StageView({
  stageName,
  parsedOutput,
}: {
  stageName: string;
  parsedOutput: unknown;
}) {
  switch (stageName as StageName) {
    case "extract":
      return <ExtractView parsedOutput={parsedOutput} />;
    case "match":
      return <MatchView parsedOutput={parsedOutput} />;
    case "personas":
      return <PersonasView parsedOutput={parsedOutput} />;
    case "creative":
      return <CreativeView parsedOutput={parsedOutput} />;
    case "config":
      return <CampaignConfigView parsedOutput={parsedOutput} />;
    default:
      return (
        <pre className="overflow-x-auto px-4 py-3 text-xs text-[#ece8e0]">
          {JSON.stringify(parsedOutput, null, 2)}
        </pre>
      );
  }
}
