import { useQuery } from "@tanstack/react-query";

import { listAgentScripts } from "@/api/agent/scripts";
import { listScripts } from "@/api/scripts";
import { Select } from "@/components/ui/select";

export function ScriptSelect({
  value,
  onChange,
  scope = "admin",
  placeholder = "选择脚本",
}: {
  value: string;
  onChange: (value: string) => void;
  scope?: "admin" | "agent";
  placeholder?: string;
}) {
  const activeOnly = scope === "admin";

  const query = useQuery({
    queryKey: ["script-options", scope, activeOnly],
    queryFn: () =>
      scope === "agent"
        ? listAgentScripts({ page_size: 100 })
        : listScripts({ page_size: 100, active_only: activeOnly }),
  });

  const options =
    query.data?.list.map((item) => ({
      value: String(item.id),
      label: item.name,
    })) ?? [];

  return (
    <Select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      options={options}
      placeholder={query.isLoading ? "加载脚本中..." : placeholder}
    />
  );
}
