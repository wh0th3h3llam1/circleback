import type { Person } from "@/lib/contracts";
import { PILLAR_COLOR, initials, primaryPillar } from "./ui";

export default function Avatar({ person, size = 36, name }: { person?: Person; size?: number; name?: string }) {
  const n = person?.name ?? name ?? "?";
  const isMe = person?.id === "me";
  const color = isMe ? "#1F4A40" : person ? PILLAR_COLOR[primaryPillar(person)] : "#5f7a70";
  const hollow = person && !person.met;
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, Math.round(size * 0.36)),
        background: hollow ? "#fff" : color,
        color: hollow ? color : "#fff",
        border: hollow ? `1.5px dashed ${color}` : "none",
      }}
    >
      {isMe ? "You" : initials(n)}
    </span>
  );
}
