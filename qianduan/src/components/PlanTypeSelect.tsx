import { Select } from "@/components/ui/select";

const planOptions = [
  { value: "monthly", label: "月付" },
  { value: "quarterly", label: "季付" },
  { value: "yearly", label: "年付" },
  { value: "lifetime", label: "永久" },
  { value: "trial", label: "试用" },
];

export function PlanTypeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return <Select value={value} onChange={(event) => onChange(event.target.value)} options={planOptions} />;
}
